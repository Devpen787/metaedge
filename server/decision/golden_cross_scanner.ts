import { readDatabase, writeDatabase, generateId } from '../storage.js';
import { placePaperTrade, agentPosition } from '../trades.js';
import { getBroadTick, listBroadSymbols } from '../broad_feed.js';
import { dailyIndicators, DailyIndicators } from './daily_features.js';

// GOLDEN-CROSS SCANNER — the entry engine. Each scan walks the liquid universe, finds the
// volume-confirmed daily golden crosses the research proved (+~1% median edge), and opens a
// paper position tagged with a 15% trailing stop (written to db.trailingState, which the
// Risk-OS then manages between decision cycles). Entry is daily-cadence; exit is event-driven.
// Paper only.
const TRAIL_PCT = Number(process.env.GC_TRAIL_PCT) || 15;          // 15% trailing stop (the proven exit)
const VOL_MULT = Number(process.env.GC_VOL_MULT) || 3;             // >= 3x the 50-day avg daily volume
const MIN_VOL_USD = Number(process.env.GC_MIN_VOL_USD) || 1_000_000; // >= $1M 24h turnover (executable)
const CLIP_USD = Number(process.env.GC_CLIP_USD) || 500;          // notional per new position
const MAX_POSITIONS = Number(process.env.GC_MAX_POSITIONS) || 25;
const START_BALANCE = Number(process.env.GC_START_BALANCE) || 100_000;
const SCAN_MS = Math.max(600_000, Number(process.env.GC_SCAN_MS) || 6 * 3_600_000); // ~4x/day; the signal is daily

// Pure entry rule — exactly the researched, fact-gated edge. Exported for the probe.
export function evaluateGoldenCrossEntry(ind: DailyIndicators, opts: { volMult?: number; minVolUsd?: number } = {}) {
  const volMult = opts.volMult ?? VOL_MULT, minVolUsd = opts.minVolUsd ?? MIN_VOL_USD;
  const freshCross = ind.sma50Prev <= ind.sma200Prev && ind.sma50 > ind.sma200;   // 50 crossed above 200 today
  const volSurge = ind.vol24hUsd != null && ind.vol50dAvg > 0 && ind.vol24hUsd >= volMult * ind.vol50dAvg;
  const liquid = ind.vol24hUsd != null && ind.vol24hUsd >= minVolUsd;              // absolute liquidity floor
  return { enter: freshCross && volSurge && liquid, freshCross, volSurge, liquid };
}

// The context captured for every candidate/trade — the "why", not just yes/no.
export interface GcEnriched {
  base: string; price: number;
  sma50: number; sma200: number;
  distAboveCrossPct: number;    // how far the 50d sits above the 200d (strength of the cross)
  priceVsSma50Pct: number;      // price vs the fast MA — positive+large = chasing an extended move
  volMultiple: number;          // 24h volume / 50d avg — the research-proven, dose-responsive lever
  turnover24hUsd: number;
  return30dPct: number | null;  // recent momentum context
  realizedVolPctDaily: number | null;  // for judging whether a fixed 15% trail fits this token
  days: number; score: number;
}

// Ranking is grounded ONLY in what the research proved: the volume multiple (dose-responsive
// edge), with a gentle liquidity bonus for executability. Every other enriched field is
// DESCRIPTIVE context, deliberately NOT weighted — baking unproven factors into the score is
// exactly the overfitting we fought to avoid.
export function scoreCandidate(e: Pick<GcEnriched, 'volMultiple' | 'turnover24hUsd'>): number {
  const volScore = Math.min(10, e.volMultiple);                                          // capped so one freak print can't dominate
  const liqScore = Math.min(2, Math.log10(Math.max(1, e.turnover24hUsd / 1_000_000)));   // 0..2 gentle depth bonus
  return Number((volScore + liqScore).toFixed(3));
}

export function enrichCandidate(base: string, price: number, ind: DailyIndicators): GcEnriched {
  const volMultiple = ind.vol50dAvg > 0 && ind.vol24hUsd != null ? ind.vol24hUsd / ind.vol50dAvg : 0;
  const turnover24hUsd = ind.vol24hUsd ?? 0;
  return {
    base, price, sma50: ind.sma50, sma200: ind.sma200,
    distAboveCrossPct: ind.sma200 > 0 ? (ind.sma50 / ind.sma200 - 1) * 100 : 0,
    priceVsSma50Pct: ind.sma50 > 0 ? (price / ind.sma50 - 1) * 100 : 0,
    volMultiple, turnover24hUsd,
    return30dPct: ind.return30dPct, realizedVolPctDaily: ind.realizedVolPctDaily,
    days: ind.days, score: scoreCandidate({ volMultiple, turnover24hUsd }),
  };
}

// Ensure the paper "book" (a system user + one multi-symbol golden-cross agent) exists.
export function ensureGoldenCrossBook(): { ownerId: string; agentId: string } {
  const db = readDatabase();
  const ownerId = 'gc_book_user', agentId = 'gc_book';
  let changed = false;
  if (!db.users[ownerId]) { db.users[ownerId] = { id: ownerId, username: 'Golden Cross Book', profile: {}, createdAt: Date.now(), lastActiveAt: Date.now(), paperBalance: START_BALANCE, faucetClaimedCount: 0 } as any; changed = true; }
  if (!db.agents[agentId]) { db.agents[agentId] = { id: agentId, name: 'Golden Cross Book', description: 'Volume-confirmed 50/200 golden cross, 15% trailing stop (paper)', ownerId, roomId: null, assetSymbol: 'MULTI', tradeType: 'spot', strategyType: 'golden_cross', leverage: 1, status: 'active', autopilot: true, createdAt: Date.now(), lastTradeAt: 0 } as any; changed = true; }
  if (changed) writeDatabase(db);
  return { ownerId, agentId };
}

// Open a paper long and tag it with a trailing stop, recording the full entry context. Exported for the probe.
export function openGoldenCrossPosition(ownerId: string, agentId: string, base: string, price: number, ctx?: GcEnriched): boolean {
  if (!(price > 0)) return false;
  const res = placePaperTrade(
    ownerId,
    { agentId, assetSymbol: base, side: 'buy', size: Number((CLIP_USD / price).toFixed(6)), price, leverage: 1,
      nonce: `gc_${agentId.slice(0, 6)}_${base}_${Date.now()}_${generateId().slice(0, 6)}`,
      thesis: {
        strategy: 'golden_cross', setup: '50/200 daily golden cross',
        trigger: ctx ? `vol ${ctx.volMultiple.toFixed(1)}x 50d-avg, $${(ctx.turnover24hUsd / 1e6).toFixed(1)}M turnover, 50d ${ctx.distAboveCrossPct.toFixed(1)}% above 200d` : 'vol>=3x50d + $1M turnover',
        trailingStopPct: TRAIL_PCT, context: ctx ?? null,
      } },
    { action: 'GC_ENTRY', detailsPrefix: 'Golden-cross entry' }
  );
  if (!res.ok) return false;
  const db = readDatabase();                             // tag the trailing stop AFTER the trade's own write
  db.trailingState = db.trailingState || {};
  db.trailingState[`${agentId}:${base}`] = { highWaterMark: price, trailPct: TRAIL_PCT, updatedAt: Date.now() };
  writeDatabase(db);
  console.log(`[golden-cross] entry ${base} @ ${price} — vol ${ctx ? ctx.volMultiple.toFixed(1) + 'x' : '?'}, score ${ctx?.score ?? '?'} (trail ${TRAIL_PCT}%)`);
  return true;
}

// One scan pass over the liquid universe. Gathers ALL qualifying crosses, ranks them by quality
// score, and opens the BEST ones up to the remaining capacity (not first-come). Exported for the probe.
export function scanOnce(): { scanned: number; evaluated: number; qualified: number; entries: GcEnriched[] } {
  const { ownerId, agentId } = ensureGoldenCrossBook();
  const db = readDatabase();
  const held = new Set(Object.keys(db.trailingState || {}).filter((k) => k.startsWith(`${agentId}:`)).map((k) => k.slice(agentId.length + 1)));
  let evaluated = 0;
  const candidates: GcEnriched[] = [];
  for (const base of listBroadSymbols()) {
    if (held.has(base)) continue;
    const tick = getBroadTick(base);
    if (!tick || tick.vol24hUsd < MIN_VOL_USD) continue;   // cheap liquidity pre-filter before touching the daily cache
    const ind = dailyIndicators(base, tick.price, tick.vol24hUsd);
    if (!ind) continue;
    evaluated++;
    if (!evaluateGoldenCrossEntry(ind).enter) continue;
    candidates.push(enrichCandidate(base, tick.price, ind));
  }
  candidates.sort((a, b) => b.score - a.score);           // best crosses first
  const entries: GcEnriched[] = [];
  let openCount = held.size;
  for (const c of candidates) {
    if (openCount >= MAX_POSITIONS) break;
    if (openGoldenCrossPosition(ownerId, agentId, c.base, c.price, c)) { entries.push(c); openCount++; }
  }
  if (entries.length) console.log(`[golden-cross] scan: ${candidates.length} qualified, opened top ${entries.length} (${entries.map((e) => `${e.base}@${e.score}`).join(', ')})`);
  return { scanned: listBroadSymbols().length, evaluated, qualified: candidates.length, entries };
}

export function startGoldenCrossScanner() {
  if (process.env.GC_SCANNER_DISABLED === 'true') { console.log('[golden-cross] scanner disabled via GC_SCANNER_DISABLED'); return; }
  setTimeout(() => { try { scanOnce(); } catch (e: any) { console.warn('[golden-cross] scan failed:', e?.message); } }, 60_000); // let the feed warm up
  setInterval(() => { try { scanOnce(); } catch (e: any) { console.warn('[golden-cross] scan failed:', e?.message); } }, SCAN_MS).unref();
  console.log(`[golden-cross] scanner armed — volume-confirmed 50/200 entries, 15% trailing stop, scan every ${Math.round(SCAN_MS / 3_600_000)}h`);
}
