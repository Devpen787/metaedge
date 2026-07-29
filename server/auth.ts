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

// Anonymous sessions live in memory until the user does something worth saving.
//
// The old middleware wrote a user row + two login events + a session, and rewrote
// the WHOLE of db.json, on every request that lacked a valid cookie. readDatabase()
// parses the entire file and writeDatabase() re-serializes and fsyncs it (there is
// no cache), so a cookieless flood was an O(n^2) disk DoS on a shared e2-micro:
// each minted user made every later request slower, and an attacker just omits the
// cookie. This is the abuse vector left open when the rate-limiter fix landed.
//
// Now a cookieless request gets an in-memory ephemeral session. A cookie is still
// set, so a real browser keeps a stable identity, but nothing touches disk. The
// row is persisted only when the user first MUTATES (persistEphemeralOnMutation),
// so a curl loop that never mutates costs zero writes and strictly bounded memory.
type EphemeralSession = { userId: string; user: User; tokenHash: string; createdAt: number; lastSeen: number };
const ephemeralSessions = new Map<string, EphemeralSession>();
const EPHEMERAL_TTL_MS = 30 * 60 * 1000;   // read-only browsing keeps its identity this long
const EPHEMERAL_MAX = 10_000;              // hard ceiling: memory stays bounded under flood

function sweepEphemeral(now: number) {
  for (const [hash, s] of ephemeralSessions) {
    if (now - s.createdAt > EPHEMERAL_TTL_MS) ephemeralSessions.delete(hash);
  }
}
setInterval(() => sweepEphemeral(Date.now()), 5 * 60 * 1000).unref?.();

function putEphemeral(s: EphemeralSession) {
  // Map iterates in insertion order, so the first key is the oldest. Evicting it
  // when full means an attacker can churn this cache but never grow it past the cap.
  if (ephemeralSessions.size >= EPHEMERAL_MAX) {
    const oldest = ephemeralSessions.keys().next().value;
    if (oldest !== undefined) ephemeralSessions.delete(oldest);
  }
  ephemeralSessions.set(s.tokenHash, s);
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

// Drop expired sessions so the sessions map doesn't grow forever.
function pruneExpiredSessions(db: DatabaseState, now: number) {
  if (!db.sessions) return;
  for (const [hash, s] of Object.entries(db.sessions)) {
    if (s.expiresAt <= now) delete db.sessions[hash];
  }
}

// Middleware to resolve or create anonymous session.
export const sessionMiddleware = (req: any, res: any, next: any) => {
  const now = Date.now();
  const cookieToken = typeof req.cookies?.[SESSION_COOKIE] === 'string' ? req.cookies[SESSION_COOKIE] : '';

  if (cookieToken && cookieToken.startsWith('mes_')) {
    const tokenHash = hashSessionToken(cookieToken);

    // Ephemeral returner: resolved entirely from memory — a cookieless flood
    // never reaches disk, and a returning browser keeps its identity for free.
    const eph = ephemeralSessions.get(tokenHash);
    if (eph && now - eph.createdAt < EPHEMERAL_TTL_MS) {
      eph.lastSeen = now;
      req.userId = eph.userId;
      req.currentUser = eph.user;
      req.ephemeral = true;
      req.ephemeralTokenHash = tokenHash;
      return next();
    }

    // Persisted (logged-in, or previously-mutated) user. This is the only branch
    // that reads the db, which is unavoidable — an authenticated request needs
    // its own record — and it is gated behind presenting a valid cookie.
    const db = readDatabase();
    db.sessions ||= {};
    const session = db.sessions[tokenHash];
    if (session && session.expiresAt > now && db.users[session.userId]) {
      const userId = session.userId;
      req.userId = userId;
      req.currentUser = db.users[userId];
      // This request PRESENTED a session that resolved. Rate limiters must not
      // read `req.userId` as an identity a caller had to earn — see rateLimitKey().
      req.sessionAuthenticated = true;
      // Throttle the session touch: rewriting the whole db on EVERY request just
      // to bump lastSeenAt is huge write amplification under polling. Renew at
      // most once per window (TTL is 30 days, so this stays accurate).
      const RENEW_WINDOW_MS = 5 * 60 * 1000;
      if (now - (session.lastSeenAt || 0) > RENEW_WINDOW_MS) {
        session.lastSeenAt = now;
        session.expiresAt = now + SESSION_TTL_MS;
        db.users[userId].lastActiveAt = now;
        res.cookie(SESSION_COOKIE, cookieToken, SESSION_COOKIE_OPTIONS);
        pruneExpiredSessions(db, now);
        writeDatabase(db);
      }
      return next();
    }
    // Cookie present but unknown or expired: fall through and mint a fresh one.
  }

  // Mint an ephemeral session. No db read, no db write — the whole point.
  const userId = 'usr_' + generateId();
  const user = createAnonymousUser(userId);
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  putEphemeral({ userId, user, tokenHash, createdAt: now, lastSeen: now });
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  req.userId = userId;
  req.currentUser = user;
  req.ephemeral = true;
  req.ephemeralTokenHash = tokenHash;
  next();
};

// Promote an ephemeral session to a persisted one on the user's first mutating
// request. Mounted after the rate limiter (so a 429'd flood never persists) and
// before the routers — so any handler that reads db.users[req.userId] finds the
// row already written. Read-only browsing never reaches this, which is the whole
// defense: you become real by doing something, not by loading a page.
export function persistEphemeralOnMutation(req: any, _res: any, next: any) {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  if (!req.ephemeral) return next();

  const db = readDatabase();
  if (!db.users[req.userId]) {
    const now = Date.now();
    db.users[req.userId] = req.currentUser;
    db.sessions ||= {};
    db.sessions[req.ephemeralTokenHash] = {
      id: 'ses_' + generateId(),
      tokenHash: req.ephemeralTokenHash,
      userId: req.userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + SESSION_TTL_MS
    };
    recordLoginEvents(db, req.currentUser, req);
    pruneExpiredSessions(db, now);
    writeDatabase(db);
  }
  ephemeralSessions.delete(req.ephemeralTokenHash);
  req.ephemeral = false;
  req.sessionAuthenticated = true; // it is now a presented session that resolves
  next();
}

// --- SESSION ENDPOINT ---
authRouter.get('/api/session', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  // An ephemeral (not-yet-persisted) user has no db row; sessionMiddleware put the
  // in-memory user on req.currentUser. Without this fallback a first-time visitor's
  // session endpoint returned { user: undefined } and the app rendered logged-out.
  const user = db.users[userId] || req.currentUser;
  res.json({ user, session: { mode: 'anonymous', expiresInMs: SESSION_TTL_MS } });
});

// --- DASHBOARD DATA ENDPOINT (BATCHED) ---
authRouter.get('/api/dashboard-data', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  
  const rooms = Object.values(db.rooms).filter(r => r.memberIds.includes(userId));
  const agents = Object.values(db.agents).filter((a: any) => a.ownerId === userId);
  const roomIds = new Set(rooms.map(r => r.id));
  const strategies = Object.values(db.strategies).filter((s: any) => s.authorId === userId || (s.roomId && roomIds.has(s.roomId)));
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
