import { Router } from 'express';
import { readDatabase } from './storage.js';

export const platformRouter = Router();

// Real platform analytics — every number aggregated from the live database.
// No invented users, no fabricated volume. On a fresh instance this reads zero,
// and that's the honest answer.
platformRouter.get('/api/platform-stats', (_req, res) => {
  const db = readDatabase();

  const users = Object.values(db.users);
  const agents = Object.values(db.agents);
  const trades = db.trades;

  const volume = trades.reduce((s, t) => s + Math.abs((t.size || 0) * (t.price || 0)), 0);
  const realizedPnl = trades.reduce((s, t) => s + (typeof t.pnl === 'number' ? t.pnl : 0), 0);
  const autopilotAgents = agents.filter((a) => a.autopilot && a.status === 'active').length;
  const walletConnected = users.filter((u) => u.walletAddress).length;
  // Identity tiers (docs/DATA_MODEL.md): players = acted (claimed a profile or
  // connected); visitors = touched the site only. Public counts must not pass
  // scanner noise off as adoption.
  const players = users.filter((u: any) => u.profile?.claimedAt || u.walletAddress).length;
  const visitors = users.length - players;

  // Strategy distribution from real agents.
  const stratCounts: Record<string, number> = {};
  for (const a of agents) stratCounts[a.strategyType] = (stratCounts[a.strategyType] || 0) + 1;
  const strategyDistribution = Object.entries(stratCounts)
    .map(([name, count]) => ({ name, count, pct: agents.length ? Math.round((count / agents.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  // Daily growth buckets (last 14 days) from real timestamps.
  const DAY = 86400000;
  const now = Date.now();
  const days = 14;
  const growth: { day: string; users: number; agents: number; trades: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayEnd = now - i * DAY;
    const label = new Date(dayEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    growth.push({
      day: label,
      users: users.filter((u) => u.createdAt <= dayEnd).length,
      agents: agents.filter((a) => a.createdAt <= dayEnd).length,
      trades: trades.filter((t) => t.timestamp <= dayEnd).length,
    });
  }

  // Real recent activity from the audit log.
  const recentEvents = [...db.auditEvents]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)
    .map((e) => ({ action: e.action, details: e.details, username: e.username, timestamp: e.timestamp }));

  res.json({
    metrics: {
      users: users.length,
      players,
      visitors,
      walletConnected,
      agents: agents.length,
      autopilotAgents,
      trades: trades.length,
      volume: Math.round(volume),
      realizedPnl: Number(realizedPnl.toFixed(2)),
    },
    strategyDistribution,
    growth,
    recentEvents,
  });
});
