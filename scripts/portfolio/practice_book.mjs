#!/usr/bin/env node
// PRACTICE BOOK + RISK OS — the always-on paper loop the market-comparison canvas
// argued for. Its job is NOT to find edge; it is to EXERCISE and validate the risk
// machinery we deferred: hard stop, time-stop, daily max-DD kill, risk-based sizing.
// Scored on EXIT DISCIPLINE (did every position have a stop? did losers get cut
// small? did the kill switch fire on time?) — PnL is secondary and expected to be
// break-even-ish minus costs, because the entries are a simple baseline, not edge.
//
// Split the bar (per the canvas): the STRICT survivor/grader bar governs promotion
// to LIVE. This practice book runs freely in PAPER so the agent learns exits.
// Live stays locked; this has no order path, only the honest ledger.
//
// Runs on the parity ledger. Buy-and-hold each slot from entry until a RISK RULE
// closes it. Usage: node scripts/portfolio/practice_book.mjs [--slots 5] [--stop 0.06]
import fs from 'node:fs';
import path from 'node:path';
import { computeFeatures, positionPath } from '../lib/strategy_core.mjs';
import { allCryptoEngines } from '../engines/crypto_core.mjs';
import { createLedger } from './ledger.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SLOTS = Number(flag('slots', '5'));
const STOP_PCT = Number(flag('stop', '0.06'));        // hard stop distance
const MAX_HOLD = Number(flag('max-hold', '48'));      // time-stop in bars (hours)
const PER_TRADE_RISK = Number(flag('risk', '0.005')); // 0.5% of equity risked per trade -> size = risk/stop
const DAILY_DD_KILL = Number(flag('dd-kill', '0.03')); // flatten + pause for the day if book down 3%
const START = Number(flag('start', '100000'));
const DIR = path.join(process.cwd(), 'data', 'market');

// universe + per-instrument engine exposure (entry signal) — features once
const universe = fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).map((f) => f.slice('backfill-'.length, -'-1h.jsonl'.length)).sort();
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

const ledger = createLedger({ startCash: START, takerBps: 10, slipBps: 5, noTradeBand: 0.02 });
const open = new Map();   // instrument -> { entryPx, entryBar, stopPx, qty }
const closed = [];        // { instrument, reason, retPct, barsHeld }
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
    let reason = null, exitPx = bar.c;
    if (bar.l <= pos.stopPx) { reason = 'stop'; exitPx = pos.stopPx; }           // stop checked on the low (conservative)
    else if (barNo - pos.entryBar >= MAX_HOLD) { reason = 'time'; exitPx = bar.c; }
    if (reason) { closed.push({ instrument: sym, reason, retPct: (exitPx / pos.entryPx - 1) * 100, barsHeld: barNo - pos.entryBar }); open.delete(sym); }
  }

  // 2) daily max-DD kill switch: flatten everything, no new entries this day
  const eqNow = ledger.curve.length ? ledger.curve[ledger.curve.length - 1].equity : START;
  if (!ddKilled && (eqNow - dayStartEq) / dayStartEq <= -DAILY_DD_KILL) {
    for (const [sym, pos] of [...open]) { const px = prices[sym] ?? lastPrice[sym]; closed.push({ instrument: sym, reason: 'dd_kill', retPct: (px / pos.entryPx - 1) * 100, barsHeld: barNo - pos.entryBar }); open.delete(sym); }
    ddKilled = true;
  }

  // 3) open new slots (risk-based size: a stop-out loses ~PER_TRADE_RISK of equity)
  if (!ddKilled && open.size < SLOTS) {
    const cand = syms.filter((s) => prices[s] > 0 && !open.has(s)).map((s) => ({ s, conv: inst[s].conviction[inst[s].idxByT.get(t)] || 0 })).filter((x) => x.conv > 0).sort((a, b) => b.conv - a.conv);
    for (const { s } of cand.slice(0, SLOTS - open.size)) {
      const px = prices[s]; const notional = (PER_TRADE_RISK / STOP_PCT) * eqNow;
      open.set(s, { entryPx: px, entryBar: barNo, stopPx: px * (1 - STOP_PCT), qty: notional / px });
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
console.log(`\n=== PRACTICE BOOK — always-on paper, Risk OS (stop ${STOP_PCT * 100}% / time ${MAX_HOLD}h / dd-kill ${DAILY_DD_KILL * 100}% / risk ${PER_TRADE_RISK * 100}%/trade) ===`);
console.log(`  ${syms.length} instruments, ${SLOTS} slots | ${closed.length} paper trades closed`);
console.log(`\n  EXIT DISCIPLINE (the point):`);
console.log(`    exits by reason: ${Object.entries(byReason).map(([k, v]) => `${k}=${v}`).join('  ') || 'none'}`);
console.log(`    every position had a hard stop: YES (enforced at entry)`);
console.log(`    losers cut within stop distance: ${cutSmall}/${losers.length} (${losers.length ? (100 * cutSmall / losers.length).toFixed(0) : 0}%)`);
console.log(`    daily DD-kill fired: ${byReason.dd_kill || 0} time(s)`);
console.log(`\n  PnL (secondary — baseline entries, not edge):`);
console.log(`    final equity $${eq.toFixed(0)} (${((eq / START - 1) * 100).toFixed(1)}%) | max DD ${(mdd * 100).toFixed(1)}%`);
console.log(`    avg win ${(closed.filter((c) => c.retPct > 0).reduce((s, c) => s + c.retPct, 0) / (closed.filter((c) => c.retPct > 0).length || 1)).toFixed(1)}% | avg loss ${(losers.reduce((s, c) => s + c.retPct, 0) / (losers.length || 1)).toFixed(1)}%`);
console.log(`\n  This validates the risk machinery, not an edge. Live stays locked.\n`);
