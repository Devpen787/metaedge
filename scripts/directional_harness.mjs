#!/usr/bin/env node
/**
 * DIRECTIONAL HARNESS — the shared forward-paper engine for momentum/memecoin/
 * stocks/perps/fx-style lanes (entry + stop/target/hold, as opposed to Kalshi's
 * binary-payout mechanic, which has its own bespoke harness).
 *
 * Uses a lightweight, trivially-persistable JSON position tracker (not the full
 * portfolio/ledger.mjs Map-based ledger — that class isn't cheaply serializable
 * across separate cron invocations without custom (de)serialization, and this
 * only ever holds one position per symbol, so it doesn't need the ledger's
 * multi-engine attribution machinery). It DOES apply the same real-cost
 * discipline as everything else in this codebase: COST_RT round-trip cost
 * deducted on both entry and exit — a first version of this shipped without
 * that (an unused ledger import stood in for real cost logic) and was caught
 * before deploy; zero-cost paper fills are exactly the kind of thing that
 * manufactures a fake edge.
 *
 * Called by edge_watcher.mjs's spinUp(lane) on a NEW FLAGS>0 flip (opens
 * positions for whatever's currently live in the flagged band) and by its own
 * tick() on a regular cadence (marks every open position: hard stop, time-stop,
 * closes on trigger).
 *
 * HONEST SCOPE: only ONE adapter is built and tested (crypto momentum). The
 * other 4 directional lanes (memecoin/stocks/perps/fx) do NOT have adapters
 * yet — spinUp() reports that plainly rather than faking coverage. This is
 * deliberate: shipping 5 unverified adapters at once would repeat the exact
 * "built but never actually run" mistake this session has caught elsewhere.
 * Extend UNIVERSE_FETCH/DISCOVERY_BAR with the same shape once each is needed
 * and tested the same way (real spinUp call + synthetic stop/time-stop test).
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'edgeops', 'directional_harness');
const STOP_PCT = 0.06, TIME_STOP_HOURS = 72, COST_RT = 0.003; // 0.3% round trip, liquid crypto — matches confluence_search.mjs's cost assumption
fs.mkdirSync(DIR, { recursive: true });

function ledgerFile(lane) { return path.join(DIR, `${lane.replace(/\W+/g, '_')}.json`); }
function loadLedgerState(lane) {
  const fp = ledgerFile(lane);
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
  return { positions: {}, closed: [] }; // positions: symbol -> {entry, stopPx, openedAt, direction}
}
function saveLedgerState(lane, s) { fs.writeFileSync(ledgerFile(lane), JSON.stringify(s, null, 1)); }

// ---- adapters: fetch CURRENT live candidates clearing the lane's real flag bar ----
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function momentumScore(c) {
  const h24 = N(c.price_change_percentage_24h_in_currency) || 0;
  const d7 = N(c.price_change_percentage_7d_in_currency) || 0;
  const d30 = N(c.price_change_percentage_30d_in_currency) || 0;
  const turnover = c.market_cap > 0 ? c.total_volume / c.market_cap : 0;
  const dailyPace7 = d7 / 7, accel = h24 - dailyPace7;
  let s = 0;
  s += Math.min(25, Math.max(0, h24) * 1.5);
  s += Math.min(20, Math.max(0, accel) * 1.5);
  s += Math.min(25, turnover * 60);
  s += (d7 > 5 && d7 < 80) ? 15 : 0;
  if (d7 > 120) s -= Math.min(25, (d7 - 120) / 10);
  if (d30 > 300) s -= 15;
  return Math.round(Math.max(0, s));
}
// IMPORTANT: returns the FULL unfiltered universe (with scores attached), not
// just score>=75 candidates. A position, once open, must stay trackable even
// after its score naturally falls below the discovery bar (which is the norm,
// not the exception — the discovery bar is deliberately rare). Discovery
// filtering and price-lookup are two different uses of the same fetch and must
// use two different filters, or open positions silently become unclosable
// (a real bug caught by testing before this shipped — see the commit message).
async function cryptoMomentumUniverse() {
  const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d,30d', { headers: { 'User-Agent': 'MetaEdge/1.0' } });
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.filter((c) => c.total_volume >= 100000 && c.market_cap >= 1e6)
    .map((c) => ({ symbol: c.id, price: c.current_price, score: momentumScore(c) }));
}
const DISCOVERY_BAR = { 'Crypto momentum': 75 }; // the REAL flagged bar (momentum_grader's 75+ band), not the looser 60 screening bar
const UNIVERSE_FETCH = { 'Crypto momentum': cryptoMomentumUniverse };

export async function spinUp(laneName) {
  const fetchUniverse = UNIVERSE_FETCH[laneName];
  if (!fetchUniverse) return { opened: 0, note: `no live adapter built yet for "${laneName}" — needs one written + tested before auto-harness can act (same as Kalshi originally required manual work)` };
  const state = loadLedgerState(laneName);
  const all = await fetchUniverse();
  const cands = all.filter((c) => c.score >= DISCOVERY_BAR[laneName]);
  let opened = 0;
  for (const c of cands) {
    if (state.positions[c.symbol]) continue;               // already holding, don't pyramid
    state.positions[c.symbol] = { entry: c.price, stopPx: c.price * (1 - STOP_PCT), openedAt: Date.now(), score: c.score };
    opened++;
  }
  saveLedgerState(laneName, state);
  return { opened, candidatesSeen: cands.length };
}

// Marks every open position across every lane with a live adapter: hard stop,
// time-stop, records the close. Call regularly (independent of new flips).
// Uses the UNFILTERED universe fetch so a position stays trackable regardless
// of whether its score still clears the discovery bar.
export async function tick() {
  for (const [lane, fetchUniverse] of Object.entries(UNIVERSE_FETCH)) {
    const state = loadLedgerState(lane);
    const symbols = Object.keys(state.positions);
    if (!symbols.length) continue;
    const live = await fetchUniverse().catch(() => []);
    const priceOf = new Map(live.map((c) => [c.symbol, c.price]));
    for (const sym of symbols) {
      const pos = state.positions[sym];
      const px = priceOf.get(sym);
      if (px == null) continue;                              // fell out of the adapter's universe this tick; leave open, try again next tick
      const ageH = (Date.now() - pos.openedAt) / 3600000;
      let closeReason = null;
      if (px <= pos.stopPx) closeReason = 'stop';
      else if (ageH >= TIME_STOP_HOURS) closeReason = 'time';
      if (closeReason) {
        const rawRetPct = (px / pos.entry - 1) * 100;
        const netRetPct = rawRetPct - COST_RT * 100;             // real round-trip cost, not a zero-cost fantasy fill
        state.closed.push({ symbol: sym, reason: closeReason, entry: pos.entry, exit: px, rawRetPct: +rawRetPct.toFixed(2), retPct: +netRetPct.toFixed(2), heldHours: +ageH.toFixed(1), closedAt: Date.now() });
        delete state.positions[sym];
      }
    }
    saveLedgerState(lane, state);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tick().then(() => console.log('[directional-harness] tick complete')).catch((e) => console.error('[directional-harness] tick failed:', e.message));
}
