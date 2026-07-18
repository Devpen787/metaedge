import { Router } from 'express';
import { readDatabase, writeDatabase, generateId, sanitizeText } from './storage.js';
import { getSpotPrice } from './prices.js';
import type { DatabaseState, ArenaLeague, PaperTrade, PredictionMarket } from '../src/types';

export const arenaRouter = Router();

const GLOBAL_START_BALANCE = 10000;
const RISKS = ['Low', 'Medium', 'High'];

// A trade's contribution to competition P&L. Closed trades use their realized
// pnl (unchanged). Open wallet positions (MetaMask paper actions) are
// marked-to-market against the arena's single spot-price universe, so using a
// swap/perp in paper mode moves your standing live and consistently.
function tradePnl(trade: PaperTrade): number {
  if (typeof trade.pnl === 'number') return trade.pnl;
  if (trade.source === 'wallet' && trade.status === 'open') {
    const cur = getSpotPrice(trade.assetSymbol);
    if (cur == null) return 0;
    const dir = trade.side === 'sell' || trade.side === 'short' ? -1 : 1;
    return (cur - trade.price) * trade.size * dir;
  }
  return 0;
}

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

// ---- Seasons: the global board runs in monthly seasons so late joiners always
// compete fresh. League boards keep their own start/end. ----
function seasonInfo(now = Date.now()) {
  const d = new Date(now);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    name: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    startMs: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    endMs: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  };
}

// ---- Achievements: every badge is derived from real activity and awarded
// idempotently on read. No fake mechanics. ----
export const BADGES: Record<string, { name: string; icon: string; desc: string }> = {
  first_trade: { name: 'First Blood', icon: '🗡️', desc: 'Made your first trade' },
  first_win: { name: 'On the Board', icon: '📈', desc: 'Locked in your first profit' },
  streak_3: { name: 'Hot Streak', icon: '🔥', desc: '3 profitable days in a row' },
  league_founder: { name: 'Founder', icon: '🏛️', desc: 'Created a league' },
  wallet_pioneer: { name: 'Explorer', icon: '🧭', desc: 'Used a MetaMask wallet capability' },
};

// Consecutive days of positive realized P&L ending today (or yesterday if no
// trades yet today). Uses closed/realized trades only, so streaks are earned.
function computeStreaks(db: DatabaseState, userIds: string[]) {
  const include = new Set(userIds);
  const byUserDay: Record<string, Record<string, number>> = {};
  for (const t of db.trades) {
    if (!include.has(t.userId) || typeof t.pnl !== 'number') continue;
    const day = new Date(t.timestamp).toISOString().slice(0, 10);
    const m = (byUserDay[t.userId] = byUserDay[t.userId] || {});
    m[day] = (m[day] || 0) + t.pnl;
  }
  const DAY = 86400000;
  const streaks: Record<string, number> = {};
  for (const id of userIds) {
    const days = byUserDay[id] || {};
    let cursor = Date.now();
    if (!(new Date(cursor).toISOString().slice(0, 10) in days)) cursor -= DAY;
    let streak = 0;
    for (;;) {
      const v = days[new Date(cursor).toISOString().slice(0, 10)];
      if (v !== undefined && v > 0) { streak++; cursor -= DAY; } else break;
    }
    streaks[id] = streak;
  }
  return streaks;
}

// Award any badges the user's real activity now merits (idempotent).
function syncBadges(db: DatabaseState, userIds: string[], streaks: Record<string, number>) {
  db.arenaBadges = db.arenaBadges || [];
  const include = new Set(userIds);
  const have: Record<string, Set<string>> = {};
  for (const b of db.arenaBadges) (have[b.userId] = have[b.userId] || new Set()).add(b.badgeId);
  const facts: Record<string, { traded: boolean; won: boolean; wallet: boolean }> = {};
  for (const t of db.trades) {
    if (!include.has(t.userId)) continue;
    const f = (facts[t.userId] = facts[t.userId] || { traded: false, won: false, wallet: false });
    f.traded = true;
    if (typeof t.pnl === 'number' && t.pnl > 0) f.won = true;
    if (t.source === 'wallet') f.wallet = true;
  }
  const founders = new Set(Object.values(db.arenaLeagues || {}).filter((l) => l.creatorId !== 'system').map((l) => l.creatorId));
  let added = false;
  const award = (userId: string, badgeId: string) => {
    if (have[userId]?.has(badgeId)) return;
    (have[userId] = have[userId] || new Set()).add(badgeId);
    db.arenaBadges!.push({ id: 'bdg_' + generateId(), userId, badgeId, earnedAt: Date.now() });
    added = true;
  };
  for (const id of userIds) {
    const f = facts[id];
    if (f?.traded) award(id, 'first_trade');
    if (f?.won) award(id, 'first_win');
    if (f?.wallet) award(id, 'wallet_pioneer');
    if ((streaks[id] || 0) >= 3) award(id, 'streak_3');
    if (founders.has(id)) award(id, 'league_founder');
  }
  const badgesByUser: Record<string, string[]> = {};
  for (const [uid, set] of Object.entries(have)) badgesByUser[uid] = [...set];
  return { newBadges: added, badgesByUser };
}

// ---- Rank movement: rotate a per-board snapshot every window; ▲/▼ compares the
// current rank to the previous window's. Writes only on rotation. ----
const SNAP_INTERVAL_MS = 10 * 60 * 1000;

function rankMovement(db: DatabaseState, boardKey: string, current: Record<string, number>) {
  db.arenaRankSnapshots = db.arenaRankSnapshots || {};
  const now = Date.now();
  const snap = db.arenaRankSnapshots[boardKey];
  let baseline: Record<string, number> | null = null;
  let dirty = false;
  if (!snap) {
    db.arenaRankSnapshots[boardKey] = { at: now, ranks: current };
    dirty = true;
  } else if (now - snap.at > SNAP_INTERVAL_MS) {
    db.arenaRankSnapshots[boardKey] = { at: now, ranks: current, prevAt: snap.at, prevRanks: snap.ranks };
    baseline = snap.ranks;
    dirty = true;
  } else {
    baseline = snap.prevRanks || null;
  }
  return { baseline, dirty };
}

type ArenaLaneKey = 'spot' | 'perps' | 'predictions';
type ArenaLane = {
  key: ArenaLaneKey;
  label: string;
  events: number;
  volumeUsd: number;
  realizedPnl: number;
  unrealizedPnl: number;
};

function emptyLane(key: ArenaLaneKey): ArenaLane {
  return {
    key,
    label: key === 'spot' ? 'Spot' : key === 'perps' ? 'Perps' : 'Predictions',
    events: 0,
    volumeUsd: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
  };
}

function predictionValue(market: PredictionMarket, side: 'yes' | 'no', shares: number): number {
  const totalPool = market.yesPool + market.noPool || 1;
  if (!market.resolved) {
    const probability = side === 'yes' ? market.yesPool / totalPool : market.noPool / totalPool;
    return shares * probability;
  }
  if (market.outcome !== side) return 0;
  const totalWinningShares = Object.values(market.bets || {}).reduce(
    (sum, bet) => sum + (side === 'yes' ? bet.yesShares : bet.noShares),
    0,
  );
  return shares * (totalPool / (totalWinningShares || 1));
}

function predictionLane(db: DatabaseState, userId: string, since: number) {
  const lane = emptyLane('predictions');
  const activeDays = new Set<string>();
  let wins = 0;
  let losses = 0;

  for (const market of Object.values(db.predictionMarkets || {})) {
    const marketEvents = (db.predictionBetEvents || [])
      .filter((event) => event.userId === userId && event.marketId === market.id && event.timestamp >= since);

    // Existing databases predate the event ledger. Preserve an attributable
    // legacy position only when its first stake is inside this scoring window.
    if (marketEvents.length === 0) {
      const hasAnyLedgerEvents = (db.predictionBetEvents || [])
        .some((event) => event.userId === userId && event.marketId === market.id);
      const bet = market.bets?.[userId];
      if (!hasAnyLedgerEvents && bet && (bet.firstBetAt ?? 0) >= since) {
        const value = market.resolved
          ? predictionValue(market, market.outcome === 'no' ? 'no' : 'yes', market.outcome === 'no' ? bet.noShares : bet.yesShares)
          : predictionValue(market, 'yes', bet.yesShares) + predictionValue(market, 'no', bet.noShares);
        const pnl = value - bet.invested;
        lane.events += 1;
        lane.volumeUsd += bet.invested;
        if (market.resolved) {
          lane.realizedPnl += pnl;
          if (pnl > 0) wins++; else if (pnl < 0) losses++;
        } else {
          lane.unrealizedPnl += pnl;
        }
        activeDays.add(new Date(bet.firstBetAt || since).toISOString().slice(0, 10));
      }
      continue;
    }

    let marketPnl = 0;
    for (const event of marketEvents) {
      marketPnl += predictionValue(market, event.side, event.shares) - event.amount;
      lane.events++;
      lane.volumeUsd += event.amount;
      activeDays.add(new Date(event.timestamp).toISOString().slice(0, 10));
    }
    if (market.resolved) {
      lane.realizedPnl += marketPnl;
      if (marketPnl > 0) wins++; else if (marketPnl < 0) losses++;
    } else {
      lane.unrealizedPnl += marketPnl;
    }
  }
  return { lane, activeDays, wins, losses };
}

type PositionLot = { direction: 1 | -1; size: number; price: number; eligible: boolean; lane: ArenaLaneKey; symbol: string };

// Rebuild player positions from immutable fills. FIFO lots let a league close
// a carried-in position without importing P&L earned before the player joined.
function tradingLanes(db: DatabaseState, userId: string, since: number) {
  const lanes = { spot: emptyLane('spot'), perps: emptyLane('perps') };
  const lots: Record<string, PositionLot[]> = {};
  const activeDays = new Set<string>();
  let wins = 0;
  let losses = 0;
  const trades = db.trades.filter((trade) => trade.userId === userId).sort((a, b) => a.timestamp - b.timestamp);

  for (const trade of trades) {
    const laneKey: 'spot' | 'perps' = trade.tradeType === 'perp' ? 'perps' : 'spot';
    const lane = lanes[laneKey];
    const inPeriod = trade.timestamp >= since;
    if (inPeriod) {
      lane.events++;
      lane.volumeUsd += Math.abs(trade.size * trade.price);
      activeDays.add(new Date(trade.timestamp).toISOString().slice(0, 10));
    }

    // Wallet positions are independent records and freeze their P&L in place
    // when closed. Agent fills below form a true multi-fill cost-basis ledger.
    if (trade.source === 'wallet') {
      if (!inPeriod) continue;
      const pnl = tradePnl(trade);
      if (typeof trade.pnl === 'number' || trade.status === 'closed') {
        lane.realizedPnl += pnl;
        if (pnl > 0) wins++; else if (pnl < 0) losses++;
      } else {
        lane.unrealizedPnl += pnl;
      }
      continue;
    }

    const direction: 1 | -1 = trade.side === 'sell' || trade.side === 'short' ? -1 : 1;
    const key = `${trade.agentId}:${trade.assetSymbol}:${trade.tradeType}`;
    const queue = (lots[key] = lots[key] || []);
    let remaining = trade.size;
    let realizedThisFill = 0;
    while (remaining > 0 && queue.length > 0 && queue[0].direction !== direction) {
      const lot = queue[0];
      const closed = Math.min(remaining, lot.size);
      if (inPeriod && lot.eligible) {
        const pnl = (trade.price - lot.price) * closed * lot.direction;
        lane.realizedPnl += pnl;
        realizedThisFill += pnl;
      }
      lot.size -= closed;
      remaining -= closed;
      if (lot.size <= 1e-12) queue.shift();
    }
    if (inPeriod && realizedThisFill > 0) wins++;
    else if (inPeriod && realizedThisFill < 0) losses++;
    if (remaining > 1e-12) {
      queue.push({ direction, size: remaining, price: trade.price, eligible: inPeriod, lane: laneKey, symbol: trade.assetSymbol });
    }
  }

  for (const queue of Object.values(lots)) {
    for (const lot of queue) {
      if (!lot.eligible) continue;
      const mark = getSpotPrice(lot.symbol);
      if (mark == null) continue;
      lanes[lot.lane as 'spot' | 'perps'].unrealizedPnl += (mark - lot.price) * lot.size * lot.direction;
    }
  }
  return { lanes, activeDays, wins, losses };
}

function playerMetrics(db: DatabaseState, userId: string, since: number) {
  const trading = tradingLanes(db, userId, since);
  const prediction = predictionLane(db, userId, since);
  const lanes: ArenaLane[] = [trading.lanes.spot, trading.lanes.perps, prediction.lane].map((lane) => ({
    ...lane,
    volumeUsd: Number(lane.volumeUsd.toFixed(2)),
    realizedPnl: Number(lane.realizedPnl.toFixed(2)),
    unrealizedPnl: Number(lane.unrealizedPnl.toFixed(2)),
  }));
  const activeDays = new Set([...trading.activeDays, ...prediction.activeDays]);
  const wins = trading.wins + prediction.wins;
  const losses = trading.losses + prediction.losses;
  const realizedPnl = lanes.reduce((sum, lane) => sum + lane.realizedPnl, 0);
  const unrealizedPnl = lanes.reduce((sum, lane) => sum + lane.unrealizedPnl, 0);
  return {
    lanes,
    realizedPnl: Number(realizedPnl.toFixed(2)),
    unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
    totalPnl: Number((realizedPnl + unrealizedPnl).toFixed(2)),
    volumeUsd: Number(lanes.reduce((sum, lane) => sum + lane.volumeUsd, 0).toFixed(2)),
    activityCount: lanes.reduce((sum, lane) => sum + lane.events, 0),
    activeDays: activeDays.size,
    winRatePct: wins + losses ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : null,
  };
}

function aggregate(db: DatabaseState, userIds: string[], sinceByUser: Record<string, number>) {
  const include = new Set(userIds);
  const metrics: Record<string, ReturnType<typeof playerMetrics>> = {};
  const agentCount: Record<string, number> = {};
  const strategy: Record<string, string> = {};
  for (const id of userIds) {
    metrics[id] = playerMetrics(db, id, sinceByUser[id] ?? 0);
    agentCount[id] = 0;
  }
  for (const agent of Object.values(db.agents)) {
    if (!include.has(agent.ownerId) || agent.status === 'revoked') continue;
    agentCount[agent.ownerId] = (agentCount[agent.ownerId] || 0) + 1;
    if (!strategy[agent.ownerId]) strategy[agent.ownerId] = humanizeStrategy(agent.strategyType);
  }
  for (const id of userIds) {
    const activeLanes = metrics[id].lanes.filter((lane) => lane.events > 0);
    if (!strategy[id] && activeLanes.length === 1) strategy[id] = activeLanes[0].label;
    else if (!strategy[id] && activeLanes.length > 1) strategy[id] = 'Multi-lane';
  }
  return { metrics, agentCount, strategy };
}

// Real, shared leaderboard. `?leagueId=global` ranks everyone with an agent;
// a specific id ranks that league's members by P&L earned since they joined.
arenaRouter.get('/api/arena/leaderboard', (req, res) => {
  const db = readDatabase();
  const leagueId = String(req.query.leagueId || 'global');
  const metric = String(req.query.metric || 'roi');
  const metricLabels: Record<string, string> = { roi: 'Return %', pnl: 'Paper P&L', volume: 'Traded Volume' };
  if (!metricLabels[metric]) {
    res.status(400).json({ error: 'metric must be roi, pnl, or volume.' });
    return;
  }
  const season = seasonInfo();

  let entries: { userId: string; username: string; startBalance: number; since: number }[];
  let board: { name: string; endsAt: number; metric: string; metricLabel: string };
  if (leagueId === 'global') {
    // Competing requires bringing your own MetaMask Agent Wallet: the global
    // board ranks CONNECTED players (agent owners or wallet traders). Guests
    // can practice solo but don't appear here until they connect.
    // Global scoring is seasonal — floored at the season start — so newcomers
    // always compete fresh.
    const owners = new Set(Object.values(db.agents).map((a) => a.ownerId));
    for (const t of db.trades) {
      if (t.source === 'wallet') owners.add(t.userId);
    }
    // Prediction-market bettors compete too.
    for (const m of Object.values(db.predictionMarkets || {})) {
      for (const uid of Object.keys(m.bets || {})) owners.add(uid);
    }
    entries = [...owners]
      .filter((userId) => !!db.users[userId]?.walletAddress)
      .map((userId) => ({
        userId,
        username: db.users[userId]?.username || 'Anon',
        startBalance: GLOBAL_START_BALANCE,
        since: season.startMs,
      }));
    board = { name: `Season · ${season.name}`, endsAt: season.endMs, metric, metricLabel: metricLabels[metric] };
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
    board = { name: league.name, endsAt: league.endsAt, metric, metricLabel: metricLabels[metric] };
  }

  const sinceByUser = Object.fromEntries(entries.map((e) => [e.userId, e.since]));
  const { metrics, agentCount, strategy } = aggregate(db, entries.map((e) => e.userId), sinceByUser);

  const leaderboard = entries
    .map((e) => {
      const player = metrics[e.userId];
      const roiPct = e.startBalance ? (player.totalPnl / e.startBalance) * 100 : 0;
      const wallet = db.users[e.userId]?.walletAddress;
      return {
        userId: e.userId,
        address: wallet && wallet.startsWith('0x') ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : shortId(e.userId),
        name: e.username,
        agents: agentCount[e.userId] || 0,
        strategy: strategy[e.userId] || 'No agents',
        startBal: e.startBalance,
        currentBal: Number((e.startBalance + player.totalPnl).toFixed(2)),
        pnlValue: player.totalPnl,
        realizedPnl: player.realizedPnl,
        unrealizedPnl: player.unrealizedPnl,
        volumeUsd: player.volumeUsd,
        activityCount: player.activityCount,
        activeDays: player.activeDays,
        winRatePct: player.winRatePct,
        lanes: player.lanes,
        roiValue: Number(roiPct.toFixed(4)),
        roi: `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}%`,
        scoreMetric: metric,
        scoreValue: metric === 'pnl' ? player.totalPnl : metric === 'volume' ? player.volumeUsd : roiPct,
      };
    })
    .sort((a, b) => b.scoreValue - a.scoreValue || b.roiValue - a.roiValue || b.pnlValue - a.pnlValue || a.name.localeCompare(b.name))
    .map((row, i) => ({ rank: i + 1, ...row }));

  // Gamification layer — all earned from real data: streaks from realized daily
  // P&L, badges from actual activity, ▲/▼ movement from rank snapshots.
  const userIds = entries.map((e) => e.userId);
  const streaks = computeStreaks(db, userIds);
  const { newBadges, badgesByUser } = syncBadges(db, userIds, streaks);
  const ranksNow: Record<string, number> = {};
  for (const r of leaderboard) ranksNow[r.userId] = r.rank;
  const { baseline, dirty } = rankMovement(db, `${leagueId}:${metric}`, ranksNow);
  if (newBadges || dirty) writeDatabase(db);

  const rows = leaderboard.map((r) => ({
    ...r,
    move: baseline && baseline[r.userId] ? baseline[r.userId] - r.rank : 0,
    streak: streaks[r.userId] || 0,
    badges: (badgesByUser[r.userId] || []).map((b) => ({ id: b, ...BADGES[b] })),
  }));

  res.json({ leaderboard: rows, leagueId, board, availableMetrics: Object.entries(metricLabels).map(([id, label]) => ({ id, label })) });
});

// List leagues with live participant counts and the caller's joined status.
arenaRouter.get('/api/arena/leagues', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const members = db.arenaMembers || [];
  const now = Date.now();
  const leagues = Object.values(db.arenaLeagues || {})
    .map((l) => ({
      ...l,
      // Status is derived from the clock so a stale persisted "active" value
      // can never make an expired league appear joinable.
      status: l.status === 'active' && l.endsAt > now ? 'active' : 'ended',
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

  if (!user.walletAddress) {
    res.status(403).json({ error: 'wallet_required', message: 'Connect your MetaMask Agent Wallet to create a league.' });
    return;
  }

  // Per-user cap on user-created leagues (system leagues excluded).
  const LEAGUE_CAP = 15;
  if (Object.values(db.arenaLeagues || {}).filter((l) => l.creatorId === userId).length >= LEAGUE_CAP) {
    res.status(400).json({ error: `You've reached the maximum of ${LEAGUE_CAP} leagues.` });
    return;
  }

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
  if (!user.walletAddress) {
    res.status(403).json({ error: 'wallet_required', message: 'Connect your MetaMask Agent Wallet to join a league.' });
    return;
  }
  const league = db.arenaLeagues?.[leagueId];
  if (!league) { res.status(404).json({ error: 'League not found.' }); return; }
  if (league.endsAt <= Date.now()) {
    res.status(410).json({ error: 'league_ended', message: 'This league has ended. Final standings remain available.' });
    return;
  }
  if (league.status !== 'active') {
    res.status(409).json({ error: 'league_inactive', message: 'This league is not accepting new players.' });
    return;
  }
  db.arenaMembers = db.arenaMembers || [];
  if (db.arenaMembers.some((m) => m.leagueId === leagueId && m.userId === userId)) {
    res.status(409).json({ error: 'Already joined this league.' });
    return;
  }
  db.arenaMembers.push({ id: 'lm_' + generateId(), leagueId, userId, username: user.username, joinedAt: Date.now(), startBalance: league.startBalance });
  writeDatabase(db);
  res.json({ success: true });
});

// Enrich a wallet position with live pricing + P&L for display.
function positionView(trade: PaperTrade) {
  const dir = trade.side === 'sell' || trade.side === 'short' ? -1 : 1;
  const pnl = tradePnl(trade);
  // Open: mark against the live spot price. Closed: reconstruct the frozen
  // settle price from the realized pnl so the row still reads sensibly.
  const current = trade.status === 'closed'
    ? (trade.size ? trade.price + (dir * pnl) / trade.size : trade.price)
    : getSpotPrice(trade.assetSymbol);
  const notional = trade.price * trade.size;
  return {
    id: trade.id,
    symbol: trade.assetSymbol,
    side: trade.side,
    size: trade.size,
    leverage: trade.leverage,
    tradeType: trade.tradeType,
    entry: trade.price,
    current: current != null ? Number(current.toFixed(4)) : null,
    status: trade.status || 'open',
    pnl: Number(pnl.toFixed(2)),
    pnlPct: notional ? Number(((pnl / notional) * 100).toFixed(2)) : 0,
    openedAt: trade.timestamp
  };
}

// A player's wallet positions (MetaMask paper actions), newest first.
arenaRouter.get('/api/arena/positions', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const positions = db.trades
    .filter((t) => t.userId === userId && t.source === 'wallet')
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(positionView);
  const openPnl = positions.filter((p) => p.status === 'open').reduce((s, p) => s + p.pnl, 0);
  res.json({ positions, openPnl: Number(openPnl.toFixed(2)) });
});

// Close (realize) an open wallet position: freeze its mark-to-market P&L so it
// stops moving and counts as realized on the leaderboard.
arenaRouter.post('/api/arena/positions/:id/close', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const trade = db.trades.find((t) => t.id === req.params.id && t.userId === userId && t.source === 'wallet');
  if (!trade) { res.status(404).json({ error: 'Position not found.' }); return; }
  if (trade.status === 'closed') { res.status(409).json({ error: 'Position already closed.' }); return; }
  const cur = getSpotPrice(trade.assetSymbol);
  if (cur == null) { res.status(400).json({ error: 'No price to settle against.' }); return; }
  const dir = trade.side === 'sell' || trade.side === 'short' ? -1 : 1;
  trade.pnl = Number(((cur - trade.price) * trade.size * dir).toFixed(2));
  trade.status = 'closed';
  writeDatabase(db);
  res.json({ success: true, position: positionView(trade) });
});
