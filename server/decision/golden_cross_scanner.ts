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

// Open a paper long and tag it with a trailing stop. Exported for the probe.
export function openGoldenCrossPosition(ownerId: string, agentId: string, base: string, price: number): boolean {
  if (!(price > 0)) return false;
  const res = placePaperTrade(
    ownerId,
    { agentId, assetSymbol: base, side: 'buy', size: Number((CLIP_USD / price).toFixed(6)), price, leverage: 1,
      nonce: `gc_${agentId.slice(0, 6)}_${base}_${Date.now()}_${generateId().slice(0, 6)}`,
      thesis: { strategy: 'golden_cross', setup: '50/200 daily cross', trigger: 'vol>=3x50d + $1M turnover', trailingStopPct: TRAIL_PCT } },
    { action: 'GC_ENTRY', detailsPrefix: 'Golden-cross entry' }
  );
  if (!res.ok) return false;
  const db = readDatabase();                             // tag the trailing stop AFTER the trade's own write
  db.trailingState = db.trailingState || {};
  db.trailingState[`${agentId}:${base}`] = { highWaterMark: price, trailPct: TRAIL_PCT, updatedAt: Date.now() };
  writeDatabase(db);
  console.log(`[golden-cross] entry ${base} @ ${price} (trail ${TRAIL_PCT}%)`);
  return true;
}

// One scan pass over the liquid universe. Returns a small summary. Exported for the probe.
export function scanOnce(): { scanned: number; evaluated: number; entries: string[] } {
  const { ownerId, agentId } = ensureGoldenCrossBook();
  const db = readDatabase();
  const held = new Set(Object.keys(db.trailingState || {}).filter((k) => k.startsWith(`${agentId}:`)).map((k) => k.slice(agentId.length + 1)));
  let openCount = held.size, evaluated = 0;
  const entries: string[] = [];
  for (const base of listBroadSymbols()) {
    if (openCount >= MAX_POSITIONS) break;
    if (held.has(base)) continue;
    const tick = getBroadTick(base);
    if (!tick || tick.vol24hUsd < MIN_VOL_USD) continue;   // cheap liquidity pre-filter before touching the daily cache
    const ind = dailyIndicators(base, tick.price, tick.vol24hUsd);
    if (!ind) continue;
    evaluated++;
    if (!evaluateGoldenCrossEntry(ind).enter) continue;
    if (openGoldenCrossPosition(ownerId, agentId, base, tick.price)) { entries.push(base); openCount++; held.add(base); }
  }
  if (entries.length) console.log(`[golden-cross] scan: ${entries.length} new entries (${entries.join(', ')})`);
  return { scanned: listBroadSymbols().length, evaluated, entries };
}

export function startGoldenCrossScanner() {
  if (process.env.GC_SCANNER_DISABLED === 'true') { console.log('[golden-cross] scanner disabled via GC_SCANNER_DISABLED'); return; }
  setTimeout(() => { try { scanOnce(); } catch (e: any) { console.warn('[golden-cross] scan failed:', e?.message); } }, 60_000); // let the feed warm up
  setInterval(() => { try { scanOnce(); } catch (e: any) { console.warn('[golden-cross] scan failed:', e?.message); } }, SCAN_MS).unref();
  console.log(`[golden-cross] scanner armed — volume-confirmed 50/200 entries, 15% trailing stop, scan every ${Math.round(SCAN_MS / 3_600_000)}h`);
}
