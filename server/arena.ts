import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import type { DatabaseState, ArenaLeague } from '../src/types';

export const arenaRouter = Router();

const GLOBAL_START_BALANCE = 10000;
const RISKS = ['Low', 'Medium', 'High'];

function humanizeStrategy(strategy?: string): string {
  switch (strategy) {
    case 'momentum': return 'Momentum';
    case 'grid': return 'Grid';
    case 'mean_reversion': return 'Mean Reversion';
    case 'custom_ai': return 'Custom AI';
    default: return 'Mixed';
  }
}

function shortId(id: string): string {
  return id && id.length >= 8 ? `${id.slice(0, 4)}…${id.slice(-3)}` : (id || 'anon');
}

// Single pass over agents + trades to build each user's realized P&L, agent count,
// and lead strategy. `sinceByUser` floors trades at each member's league join time
// so a competition only counts performance earned inside it. O(agents + trades).
function aggregate(db: DatabaseState, userIds: string[], sinceByUser: Record<string, number>) {
  const include = new Set(userIds);
  const pnl: Record<string, number> = {};
  const agentCount: Record<string, number> = {};
  const strategy: Record<string, string> = {};
  for (const id of userIds) { pnl[id] = 0; agentCount[id] = 0; }
  for (const agent of Object.values(db.agents)) {
    if (!include.has(agent.ownerId)) continue;
    agentCount[agent.ownerId] = (agentCount[agent.ownerId] || 0) + 1;
    if (!strategy[agent.ownerId]) strategy[agent.ownerId] = humanizeStrategy(agent.strategyType);
  }
  for (const trade of db.trades) {
    if (!include.has(trade.userId) || typeof trade.pnl !== 'number') continue;
    if (trade.timestamp < (sinceByUser[trade.userId] ?? 0)) continue;
    pnl[trade.userId] = (pnl[trade.userId] || 0) + trade.pnl;
  }
  return { pnl, agentCount, strategy };
}

// Real, shared leaderboard. `?leagueId=global` ranks everyone with an agent;
// a specific id ranks that league's members by P&L earned since they joined.
arenaRouter.get('/api/arena/leaderboard', (req, res) => {
  const db = readDatabase();
  const leagueId = String(req.query.leagueId || 'global');

  let entries: { userId: string; username: string; startBalance: number; since: number }[];
  if (leagueId === 'global') {
    const owners = new Set(Object.values(db.agents).map((a) => a.ownerId));
    entries = [...owners].map((userId) => ({
      userId,
      username: db.users[userId]?.username || 'Anon',
      startBalance: GLOBAL_START_BALANCE,
      since: 0,
    }));
  } else {
    const league = db.arenaLeagues?.[leagueId];
    if (!league) { res.status(404).json({ error: 'League not found.' }); return; }
    entries = (db.arenaMembers || [])
      .filter((m) => m.leagueId === leagueId)
      .map((m) => ({
        userId: m.userId,
        username: m.username || db.users[m.userId]?.username || 'Anon',
        startBalance: m.startBalance || league.startBalance,
        since: m.joinedAt,
      }));
  }

  const sinceByUser = Object.fromEntries(entries.map((e) => [e.userId, e.since]));
  const { pnl, agentCount, strategy } = aggregate(db, entries.map((e) => e.userId), sinceByUser);

  const leaderboard = entries
    .map((e) => {
      const realized = pnl[e.userId] || 0;
      const roiPct = e.startBalance ? (realized / e.startBalance) * 100 : 0;
      return {
        userId: e.userId,
        address: shortId(e.userId),
        name: e.username,
        agents: agentCount[e.userId] || 0,
        strategy: strategy[e.userId] || 'No agents',
        startBal: e.startBalance,
        currentBal: Math.round(e.startBalance + realized),
        roiValue: roiPct,
        roi: `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}%`,
      };
    })
    .sort((a, b) => b.roiValue - a.roiValue)
    .map((row, i) => ({ rank: i + 1, ...row }));

  res.json({ leaderboard, leagueId });
});

// List leagues with live participant counts and the caller's joined status.
arenaRouter.get('/api/arena/leagues', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const members = db.arenaMembers || [];
  const leagues = Object.values(db.arenaLeagues || {})
    .map((l) => ({
      ...l,
      participants: members.filter((m) => m.leagueId === l.id).length,
      joined: members.some((m) => m.leagueId === l.id && m.userId === userId),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json({ leagues });
});

// Create a league (creator auto-joins).
arenaRouter.post('/api/arena/leagues', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const user = db.users[userId];
  if (!user) { res.status(401).json({ error: 'No active session.' }); return; }

  const name = sanitizeText(req.body?.name || '', 60);
  if (!name) { res.status(400).json({ error: 'League name is required.' }); return; }
  const startBalance = Number(req.body?.startBalance);
  const durationDays = Number(req.body?.durationDays);
  if (!Number.isFinite(startBalance) || startBalance < 100 || startBalance > 1_000_000) {
    res.status(400).json({ error: 'Start balance must be between 100 and 1,000,000.' });
    return;
  }
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 365) {
    res.status(400).json({ error: 'Duration must be between 1 and 365 days.' });
    return;
  }
  const risk = (RISKS.includes(req.body?.risk) ? req.body.risk : 'Medium') as ArenaLeague['risk'];
  const prize = sanitizeText(req.body?.prize || '', 60) || 'Reputation Badge';

  const now = Date.now();
  const id = 'lg_' + generateId();
  const league: ArenaLeague = {
    id, name, creatorId: userId, creatorName: user.username,
    startBalance, durationDays, createdAt: now, endsAt: now + durationDays * 86400000,
    risk, prize, status: 'active',
  };
  db.arenaLeagues = db.arenaLeagues || {};
  db.arenaLeagues[id] = league;
  db.arenaMembers = db.arenaMembers || [];
  db.arenaMembers.push({ id: 'lm_' + generateId(), leagueId: id, userId, username: user.username, joinedAt: now, startBalance });
  writeDatabase(db);
  res.json({ success: true, league });
});

// Join a league (idempotent — cannot join twice).
arenaRouter.post('/api/arena/leagues/:id/join', (req: any, res) => {
  const userId = req.userId;
  const leagueId = req.params.id;
  const db = readDatabase();
  const user = db.users[userId];
  if (!user) { res.status(401).json({ error: 'No active session.' }); return; }
  const league = db.arenaLeagues?.[leagueId];
  if (!league) { res.status(404).json({ error: 'League not found.' }); return; }
  db.arenaMembers = db.arenaMembers || [];
  if (db.arenaMembers.some((m) => m.leagueId === leagueId && m.userId === userId)) {
    res.status(409).json({ error: 'Already joined this league.' });
    return;
  }
  db.arenaMembers.push({ id: 'lm_' + generateId(), leagueId, userId, username: user.username, joinedAt: Date.now(), startBalance: league.startBalance });
  writeDatabase(db);
  res.json({ success: true });
});
