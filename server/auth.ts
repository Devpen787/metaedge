import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { User, AuditEvent, GraphEvent } from '../src/types';

export const authRouter = Router();

// Middleware to resolve or create anonymous session
export const sessionMiddleware = (req: any, res: any, next: any) => {
  // Use httpOnly cookie, fallback to header only if necessary but prefer cookie for identity
  let userId = req.cookies.metaedge_session || (req.headers['x-metaedge-session-id'] as string);
  const db = readDatabase();

  if (!userId || !db.users[userId]) {
    // Generate new anonymous user
    userId = 'usr_' + generateId();
    const newUser: User = {
      id: userId,
      username: `Trader_${Math.floor(1000 + Math.random() * 9000)}`,
      profile: {
        displayName: `MetaEdge Agent`,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`,
        bio: 'Self-custodial agent room member.',
        updatedAt: Date.now()
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      paperBalance: 100000, // $100,000 initial balance
      faucetClaimedCount: 0
    };
    db.users[userId] = newUser;

    // Log login audit & graph events
    const auditEvent: AuditEvent = {
      id: 'aud_' + generateId(),
      userId,
      username: newUser.username,
      action: 'LOGIN',
      details: 'Created anonymous user session.',
      timestamp: Date.now()
    };
    db.auditEvents.push(auditEvent);

    const graphEvent: GraphEvent = {
      id: 'gph_' + generateId(),
      type: 'login',
      userId,
      targetId: userId,
      targetType: 'User',
      metadata: { browser: req.headers['user-agent'] || 'unknown' },
      timestamp: Date.now()
    };
    db.graphEvents.push(graphEvent);

    writeDatabase(db);
    res.cookie('metaedge_session', userId, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  } else {
    // Update last active time
    db.users[userId].lastActiveAt = Date.now();
    writeDatabase(db);
    // ensure cookie is set
    res.cookie('metaedge_session', userId, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  }

  req.userId = userId;
  next();
};

// --- SESSION ENDPOINT ---
authRouter.get('/api/session', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const user = db.users[userId];
  res.json({ user });
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
  
  if (!displayName) {
    res.status(400).json({ error: 'Display name is required' });
    return;
  }

  const db = readDatabase();
  const user = db.users[userId];
  
  user.profile.displayName = sanitizeText(displayName, 50);
  user.profile.avatarUrl = sanitizeText(avatarUrl, 250);
  user.profile.bio = sanitizeText(bio || '', 300);
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
