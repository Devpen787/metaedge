#!/usr/bin/env node
// PRACTICE BOOK + RISK OS — the always-on paper loop the market-comparison canvas
// argued for. Its job is NOT to find edge; it is to EXERCISE and validate the risk
// machinery we deferred: hard stop, time-stop, daily max-DD kill, risk-based sizing.
// Scored on EXIT DISCIPLINE (did every position have a stop? did losers get cut
// small? did the kill switch fire on time?) — PnL is secondary.
//
// MEASURED, not assumed (a direct investigation after a Cluster-1a A/B test
// surfaced this file running -73% to -80% equity, far outside an earlier
// "break-even-ish" assumption): all 6 signal families, tested independently,
// land in a uniform 43-45.5% win rate on the FULL backfilled universe (then
// ~616 instruments) — not one bad family, a structural characteristic of
// generic technical signals against a wide, largely illiquid/volatile
// universe. The SAME families on a real, liquid large-cap universe (~24
// coins) tested +16.4% GROSS of cost, ~46.7% win rate — nearly identical win
// rate, but a much better win/loss payoff skew. Real trading costs still ate
// that down to -34.9% net, a separate, trade-frequency-driven problem (3710
// trades across 24 instruments). Both findings pointed the same direction:
// universe breadth was hurting more than helping THIS ensemble. Restricted
// the tradeable universe below to real, liquidity-derived large-caps —
// same "derive live, don't hand-pick" discipline as mm_scout.mjs's pair list
// — rather than a hardcoded list of tickers.
//
// Split the bar (per the canvas): the STRICT survivor/grader bar governs promotion
// to LIVE. This practice book runs freely in PAPER so the agent learns exits.
// Live stays locked; this has no order path, only the honest ledger.
//
// Runs on the parity ledger. Buy-and-hold each slot from entry until a RISK RULE
// closes it. Usage: node scripts/portfolio/practice_book.mjs [--slots 5] [--stop 0.06]
// [--universe-n 30] [--universe all] (all = the old full-backfill behavior, for comparison)
import fs from 'node:fs';
import path from 'node:path';
import { computeFeatures, positionPath } from '../lib/strategy_core.mjs';
import { allCryptoEngines } from '../engines/crypto_core.mjs';
import { createLedger } from './ledger.mjs';
import { nextLongStop } from '../lib/trailing_stop.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SLOTS = Number(flag('slots', '5'));
const STOP_PCT = Number(flag('stop', '0.06'));        // hard stop distance
const MAX_HOLD = Number(flag('max-hold', '48'));      // time-stop in bars (hours)
const PER_TRADE_RISK = Number(flag('risk', '0.005')); // 0.5% of equity risked per trade -> size = risk/stop
const DAILY_DD_KILL = Number(flag('dd-kill', '0.03')); // flatten + pause for the day if book down 3%
const START = Number(flag('start', '100000'));
const UNIVERSE_N = Number(flag('universe-n', '30'));   // how many top-liquidity coins to trade; --universe all restores the old full-backfill universe
const DIR = path.join(process.cwd(), 'data', 'market');

// Real 24h USDT-quote volume from Binance (already the codebase's established
// liquidity source — refresh_universe.mjs derives eligibility from the same
// endpoint), ranked descending, filtered to symbols we've actually backfilled
// locally, top UNIVERSE_N. Falls back to the full local backfill set if
// Binance is unreachable (rather than crash) — this file is sometimes run
// from the VM where Binance is geo-blocked, per prior operational history.
async function liquidUniverse(n, localSyms) {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr', { headers: { 'User-Agent': 'MetaEdge/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    const local = new Set(localSyms);
    const ranked = rows
      .filter((x) => x.symbol.endsWith('USDT'))
      .map((x) => ({ sym: x.symbol.slice(0, -4), quoteVolume: Number(x.quoteVolume) }))
      .filter((x) => local.has(x.sym) && Number.isFinite(x.quoteVolume))
      .sort((a, b) => b.quoteVolume - a.quoteVolume)
      .slice(0, n);
    if (!ranked.length) throw new Error('no overlap between Binance USDT pairs and local backfill');
    return ranked.map((x) => x.sym);
  } catch (e) {
    console.error(`[practice-book] liquidUniverse() failed (${e.message}) — falling back to the full local backfill set (${localSyms.length} instruments).`);
    return localSyms;
  }
}

// universe + per-instrument engine exposure (entry signal) — features once
const allLocalSyms = fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).map((f) => f.slice('backfill-'.length, -'-1h.jsonl'.length)).sort();
const universe = flag('universe', '') === 'all' ? allLocalSyms : await liquidUniverse(UNIVERSE_N, allLocalSyms);
const engines = allCryptoEngines();
const inst = {};
for (const sym of universe) {
  const bars = fs.readFileSync(path.join(DIR, `backfill-${sym}-1h.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  if (bars.length < 400) continue;
  const F = computeFeatures(bars);
  const conviction = bars.map(() => 0);   // # of engines wanting in, per bar (entry signal)
  for (const e of engines) for (const p of e.params) { const pp = positionPath(e.family, p, bars, F, 200, bars.length, 0); for (let i = 0; i < pp.length; i++) conviction[i] += pp[i]; }
  inst[sym] = { bars, conviction, idxByT: new Map(bars.map((b, i) => [b.t, i])) };
}
const syms = Object.keys(inst);
const timeline = [...new Set(syms.flatMap((s) => inst[s].bars.map((b) => b.t)))].sort((a, b) => a - b);

// Laddered/scaled exits (Cluster 1b): instead of one all-or-nothing exit,
// sell fixed fractions of the ORIGINAL size at defined favorable-move
// triggers, letting the remainder ride the trailing stop / time-stop to its
// own natural close. Sum of fractions < 1.0 by design — the rest keeps
// riding. A trade's reported retPct is the BLENDED weighted-average across
// every tranche (each scale-out's return, weighted by the fraction sold at
// that point, plus the final remaining fraction's return at full close) —
// not just the last slice's return, which would misrepresent how the whole
// position actually did.
const SCALE_LEVELS = [
  { trigger: 0.04, fraction: 0.33 },   // once up 4% from entry, sell 1/3 of the original size
  { trigger: 0.08, fraction: 0.33 },   // once up 8%, sell another 1/3 — ~34% left riding the trail
];

const ledger = createLedger({ startCash: START, takerBps: 10, slipBps: 5, noTradeBand: 0.02 });
const open = new Map();   // instrument -> { entryPx, entryBar, stopPx, qty }
const closed = [];        // { instrument, reason, retPct, barsHeld }
const scaleOuts = [];      // { instrument, trigger, fraction, retPct, barsHeld } — partial-close audit trail, not a trade outcome
let day = null, dayStartEq = START, ddKilled = false, barNo = 0;
const lastPrice = {};

function targetsFor(prices) {
  // hold each open slot at its fixed QTY (buy-and-hold); the ledger closes anything omitted
  const out = [];
  for (const [sym, pos] of open) { const px = prices[sym] ?? lastPrice[sym]; if (px > 0) out.push({ engine: 'practice', instrument: sym, targetNotional: pos.qty * px }); }
  return out;
}

for (const t of timeline) {
  const prices = {};
  for (const sym of syms) { const i = inst[sym].idxByT.get(t); if (i == null) continue; const px = inst[sym].bars[i].c; if (px > 0) { prices[sym] = px; lastPrice[sym] = px; } }
  const d = Math.floor(t / 86400000);
  if (d !== day) { day = d; dayStartEq = ledger.curve.length ? ledger.curve[ledger.curve.length - 1].equity : START; ddKilled = false; }

  // 1) RISK OS: manage/close open positions
  for (const [sym, pos] of [...open]) {
    const i = inst[sym].idxByT.get(t); if (i == null) continue;
    const bar = inst[sym].bars[i];
    pos.peakPx = Math.max(pos.peakPx, bar.h);                                    // track the best price seen since entry, using the bar high (not close) — same intrabar-conservative convention as the stop-hit check below
    pos.stopPx = nextLongStop(pos.entryPx, pos.peakPx, pos.stopPx);              // ratchets up only; never below the original hard stop

    // scaled exits: sell a fixed fraction of the ORIGINAL size the first
    // time each level's trigger is crossed (checked on the bar high, same
    // intrabar-conservative convention as everything else here — a level
    // that was touched intrabar counts even if the close pulled back).
    for (let lvl = 0; lvl < SCALE_LEVELS.length; lvl++) {
      if (pos.scaledFired[lvl]) continue;
      const { trigger, fraction } = SCALE_LEVELS[lvl];
      const gainPct = bar.h / pos.entryPx - 1;
      if (gainPct < trigger) continue;
      pos.scaledFired[lvl] = true;
      const scalePx = pos.entryPx * (1 + trigger);          // fill at the trigger level, not the (better) bar high — pessimistic
      const scaleRetPct = (scalePx / pos.entryPx - 1) * 100;
      pos.weightedRetSum += fraction * scaleRetPct;
      pos.soldFraction += fraction;
      pos.qty -= pos.origQty * fraction;                    // sell `fraction` of the ORIGINAL size, in units — simple and exact, no compounding-fraction math needed
      scaleOuts.push({ instrument: sym, trigger, fraction, retPct: +scaleRetPct.toFixed(2), barsHeld: barNo - pos.entryBar });
    }

    let stopHit = bar.l <= pos.stopPx, timeHit = barNo - pos.entryBar >= MAX_HOLD;
    let reason = null, exitPx = bar.c;
    // Exit-reason taxonomy (Cluster 1c): a bare 'stop' told us THAT a position
    // closed defensively, never WHY the stop was where it was — a hard stop
    // hitting immediately means the entry was bad; a trailed stop hitting
    // after ratcheting up means the position ran favorably first and gave
    // some back. Distinguishing them is what lets "why do most exits happen
    // this way" actually be answerable from this data, per
    // EXTERNAL_REPO_ADOPTION_CHECKLIST.md's exit-reason-taxonomy item.
    if (stopHit) {
      const trailed = pos.stopPx > pos.entryPx * (1 - STOP_PCT) + 1e-9;   // did the trail actually ratchet above the original hard stop before this exit?
      reason = trailed ? 'stop_trailed' : 'stop_hard';
      exitPx = pos.stopPx;
    } else if (timeHit) { reason = 'time'; exitPx = bar.c; }
    if (reason) {
      const finalTrancheRetPct = (exitPx / pos.entryPx - 1) * 100;
      const remainingFraction = 1 - pos.soldFraction;
      const blendedRetPct = pos.weightedRetSum + remainingFraction * finalTrancheRetPct;   // whole-position return across every tranche, not just the last slice
      closed.push({ instrument: sym, reason, retPct: blendedRetPct, finalTrancheRetPct, scaledOutFraction: pos.soldFraction, barsHeld: barNo - pos.entryBar });
      open.delete(sym);
    }
  }

  // 2) daily max-DD kill switch: flatten everything, no new entries this day
  const eqNow = ledger.curve.length ? ledger.curve[ledger.curve.length - 1].equity : START;
  if (!ddKilled && (eqNow - dayStartEq) / dayStartEq <= -DAILY_DD_KILL) {
    for (const [sym, pos] of [...open]) {
      const px = prices[sym] ?? lastPrice[sym];
      const finalTrancheRetPct = (px / pos.entryPx - 1) * 100;
      const blendedRetPct = pos.weightedRetSum + (1 - pos.soldFraction) * finalTrancheRetPct;   // same blending as a stop/time close — a dd_kill can also follow a partial scale-out
      closed.push({ instrument: sym, reason: 'dd_kill', retPct: blendedRetPct, finalTrancheRetPct, scaledOutFraction: pos.soldFraction, barsHeld: barNo - pos.entryBar });
      open.delete(sym);
    }
    ddKilled = true;
  }

  // 3) open new slots (risk-based size: a stop-out loses ~PER_TRADE_RISK of equity)
  if (!ddKilled && open.size < SLOTS) {
    const cand = syms.filter((s) => prices[s] > 0 && !open.has(s)).map((s) => ({ s, conv: inst[s].conviction[inst[s].idxByT.get(t)] || 0 })).filter((x) => x.conv > 0).sort((a, b) => b.conv - a.conv);
    for (const { s } of cand.slice(0, SLOTS - open.size)) {
      const px = prices[s]; const notional = (PER_TRADE_RISK / STOP_PCT) * eqNow;
      const qty = notional / px;
      open.set(s, { entryPx: px, entryBar: barNo, stopPx: px * (1 - STOP_PCT), peakPx: px, qty, origQty: qty, scaledFired: SCALE_LEVELS.map(() => false), weightedRetSum: 0, soldFraction: 0 });
    }
  }

  ledger.rebalance(t, targetsFor(prices), prices);
  ledger.mark(t, lastPrice);
  barNo++;
}

// ---- practice metrics: exit discipline first, PnL second ----
const eq = ledger.curve[ledger.curve.length - 1].equity;
const byReason = {}; for (const c of closed) byReason[c.reason] = (byReason[c.reason] || 0) + 1;
const losers = closed.filter((c) => c.retPct < 0);
const cutSmall = losers.filter((c) => c.retPct >= -(STOP_PCT * 100 + 1)).length;   // loss within ~stop distance = clean cut
let peak = -Infinity, mdd = 0; for (const p of ledger.curve) { peak = Math.max(peak, p.equity); mdd = Math.max(mdd, 1 - p.equity / peak); }
const stopExits = closed.filter((c) => c.reason === 'stop_hard' || c.reason === 'stop_trailed');
const trailedExits = closed.filter((c) => c.reason === 'stop_trailed');
console.log(`\n=== PRACTICE BOOK — always-on paper, Risk OS (stop ${STOP_PCT * 100}% trailing / time ${MAX_HOLD}h / dd-kill ${DAILY_DD_KILL * 100}% / risk ${PER_TRADE_RISK * 100}%/trade) ===`);
console.log(`  universe: ${flag('universe', '') === 'all' ? `ALL ${allLocalSyms.length} backfilled instruments` : `top ${UNIVERSE_N} by real Binance 24h volume`} | ${syms.length} instruments tradeable, ${SLOTS} slots | ${closed.length} paper trades closed`);
console.log(`\n  EXIT DISCIPLINE (the point):`);
console.log(`    exits by reason: ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join('  ') || 'none'}`);
console.log(`    every position had a hard stop: YES (enforced at entry, trails per scripts/lib/trailing_stop.mjs's step profile)`);
console.log(`    stop exits where the trail had ratcheted above the original hard stop: ${trailedExits.length}/${stopExits.length} (${stopExits.length ? (100 * trailedExits.length / stopExits.length).toFixed(0) : 0}%) — a real gain protected before reversal, not just a stop-out at entry-distance`);
console.log(`    losers cut within stop distance: ${cutSmall}/${losers.length} (${losers.length ? (100 * cutSmall / losers.length).toFixed(0) : 0}%)`);
console.log(`    daily DD-kill fired: ${byReason.dd_kill || 0} time(s)`);
const scaledTrades = closed.filter((c) => c.scaledOutFraction > 0).length;
console.log(`    scaled exits: ${scaleOuts.length} partial closes fired, across ${scaledTrades}/${closed.length} trades that reached at least one scale-out level before their final close (levels: ${SCALE_LEVELS.map((l) => `+${(l.trigger * 100).toFixed(0)}%->sell ${(l.fraction * 100).toFixed(0)}%`).join(', ')})`);
console.log(`\n  PnL (secondary — baseline entries, not edge):`);
console.log(`    final equity $${eq.toFixed(0)} (${((eq / START - 1) * 100).toFixed(1)}%) | max DD ${(mdd * 100).toFixed(1)}%`);
console.log(`    avg win ${(closed.filter((c) => c.retPct > 0).reduce((s, c) => s + c.retPct, 0) / (closed.filter((c) => c.retPct > 0).length || 1)).toFixed(1)}% | avg loss ${(losers.reduce((s, c) => s + c.retPct, 0) / (losers.length || 1)).toFixed(1)}%`);
console.log(`\n  This validates the risk machinery, not an edge. Live stays locked.\n`);
