import { Router } from 'express';
import crypto from 'crypto';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { User, AuditEvent, GraphEvent, DatabaseState } from '../src/types';

export const authRouter = Router();

const SESSION_COOKIE = 'metaedge_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_OPTIONS = {
  maxAge: SESSION_TTL_MS,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production'
};

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

function createSessionToken(): string {
  return `mes_${crypto.randomBytes(32).toString('base64url')}`;
}

function createAnonymousUser(userId: string): User {
  const now = Date.now();
  return {
    id: userId,
    username: `Trader_${Math.floor(1000 + Math.random() * 9000)}`,
    profile: {
      displayName: `MetaEdge Agent`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
      bio: 'Self-custodial agent room member.',
      updatedAt: now
    },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 100000,
    faucetClaimedCount: 0
  };
}

function attachNewSession(db: DatabaseState, userId: string, res: any) {
  const now = Date.now();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  db.sessions ||= {};
  db.sessions[tokenHash] = {
    id: 'ses_' + generateId(),
    tokenHash,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: now + SESSION_TTL_MS
  };
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return tokenHash;
}

function recordLoginEvents(db: DatabaseState, user: User, req: any) {
  const auditEvent: AuditEvent = {
    id: 'aud_' + generateId(),
    userId: user.id,
    username: user.username,
    action: 'LOGIN',
    details: 'Created anonymous user session.',
    timestamp: Date.now()
  };
  db.auditEvents.push(auditEvent);

  const graphEvent: GraphEvent = {
    id: 'gph_' + generateId(),
    type: 'login',
    userId: user.id,
    targetId: user.id,
    targetType: 'User',
    metadata: { browser: req.headers['user-agent'] || 'unknown' },
    timestamp: Date.now()
  };
  db.graphEvents.push(graphEvent);
}

// Middleware to resolve or create anonymous session.
export const sessionMiddleware = (req: any, res: any, next: any) => {
  const db = readDatabase();
  db.sessions ||= {};
  const now = Date.now();
  const cookieToken = typeof req.cookies?.[SESSION_COOKIE] === 'string' ? req.cookies[SESSION_COOKIE] : '';
  let userId: string | undefined;

  if (cookieToken && cookieToken.startsWith('mes_')) {
    const tokenHash = hashSessionToken(cookieToken);
    const session = db.sessions[tokenHash];
    if (session && session.expiresAt > now && db.users[session.userId]) {
      userId = session.userId;
      session.lastSeenAt = now;
      session.expiresAt = now + SESSION_TTL_MS;
      db.users[userId].lastActiveAt = now;
      res.cookie(SESSION_COOKIE, cookieToken, SESSION_COOKIE_OPTIONS);
      writeDatabase(db);
      req.userId = userId;
      return next();
    }
  }

  if (!userId) {
    userId = 'usr_' + generateId();
    const newUser = createAnonymousUser(userId);
    db.users[userId] = newUser;
    recordLoginEvents(db, newUser, req);
  }

  attachNewSession(db, userId, res);
  writeDatabase(db);
  req.userId = userId;
  next();
};

// --- SESSION ENDPOINT ---
authRouter.get('/api/session', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const user = db.users[userId];
  res.json({ user, session: { mode: 'anonymous', expiresInMs: SESSION_TTL_MS } });
});

// --- DASHBOARD DATA ENDPOINT (BATCHED) ---
authRouter.get('/api/dashboard-data', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  
  const rooms = Object.values(db.rooms).filter(r => r.memberIds.includes(userId));
  const agents = Object.values(db.agents).filter((a: any) => a.ownerId === userId);
  const strategies = Object.values(db.strategies).filter((s: any) => s.authorId === userId);
  const vaults = Object.values(db.vaultClubs).filter(v => v.ownerId === userId || v.memberContributions[userId] !== undefined);
  const audits = db.auditEvents.filter(a => a.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  const trades = db.trades.filter(t => t.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  const predictionMarkets = Object.values(db.predictionMarkets).sort((a, b) => b.endTime - a.endTime);

  res.json({ rooms, agents, strategies, vaults, audits, trades, predictionMarkets });
});

// --- PROFILE MUTATION ---
authRouter.post('/api/profile', (req: any, res) => {
  const userId = req.userId;
  const { displayName, avatarUrl, bio } = req.body;

  if (!displayName || !displayName.trim()) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }

  const db = readDatabase();
  const user = db.users[userId];
  
  user.profile.displayName = sanitizeText(displayName, 50);
  user.profile.avatarUrl = sanitizeText(avatarUrl, 250);
  user.profile.bio = sanitizeText(bio || '', 300);
  user.profile.claimedAt ||= Date.now();
  user.profile.updatedAt = Date.now();
  user.username = sanitizeText(displayName, 50).toLowerCase().replace(/\s+/g, '_');

  // Record audit and graph event
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PROFILE_UPDATE',
    details: `Updated display name to ${user.profile.displayName}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'profile_update',
    userId,
    targetId: userId,
    targetType: 'User',
    metadata: { profile: user.profile },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, user });
});

// --- FAUCET CLAIM ---
authRouter.post('/api/faucet', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const user = db.users[userId];

  if (user.faucetClaimedCount >= 10) {
    res.status(400).json({ error: 'Faucet limit reached for this simulation session (max 10 times).' });
    return;
  }

  const faucetAmount = 10000; // Claim $10,000 Paper Money
  user.paperBalance += faucetAmount;
  user.faucetClaimedCount += 1;

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'FAUCET_CLAIM',
    details: `Claimed $${faucetAmount} paper funds. New balance: $${user.paperBalance}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: userId,
    targetType: 'User',
    metadata: { amount: faucetAmount, balance: user.paperBalance },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, balance: user.paperBalance, faucetClaimedCount: user.faucetClaimedCount });
});

// --- AUDIT ENDPOINT ---
authRouter.get('/api/audit', (req, res) => {
  const db = readDatabase();
  // Return last 50 audit logs sorted by timestamp desc
  const sortedAudits = [...db.auditEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
  res.json({ audits: sortedAudits });
});
