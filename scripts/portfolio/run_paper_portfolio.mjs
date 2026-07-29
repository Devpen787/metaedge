#!/usr/bin/env node
// PAPER PORTFOLIO RUNNER (v1) — wires all five layers into a backtest over the 2y
// crypto backfill and reports the ONLY thing that matters: does the COMBINATION,
// after realistic costs and vol targeting, produce a risk-adjusted return — or is
// it vol-targeted noise?
//
//   engines (crypto_core) -> per-instrument [0,1] exposure per bar
//   construct             -> equal-risk-budget + inverse-vol weights
//   risk                  -> × vol-target scalar × equity, then hard caps
//   ledger                -> no-trade band, real fees+slippage, attribution
//   feedback              -> portfolio return -> vol targeter
//
// Long-only v1. Rebalances every bar; the no-trade band controls turnover.
import fs from 'node:fs';
import path from 'node:path';
import { computeFeatures, positionPath } from '../lib/strategy_core.mjs';
import { allCryptoEngines } from '../engines/crypto_core.mjs';
import { construct } from './construct.mjs';
import { ewmaVolSeries, createVolTargeter, capExposure } from './risk.mjs';
import { createLedger } from './ledger.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BARS_PER_YEAR = 8760;                 // 1h crypto
const TARGET_VOL = Number(flag('target-vol', '0.10'));
const START_CASH = Number(flag('start', '100000'));
const REBAL_EVERY = Number(flag('rebal-every', '1'));   // rebalance every N bars (turnover control)
const BAND = Number(flag('band', '0.15'));              // no-trade band (turnover control)
const CFG = {
  ledger: { startCash: START_CASH, takerBps: 10, slipBps: 5, noTradeBand: BAND },
  caps: { maxGross: 1.5, maxPerInstrument: 0.25 },
  volTarget: { targetVol: TARGET_VOL, barsPerYear: BARS_PER_YEAR, minObs: 200, maxLeverage: 3 },
};

// ---- load universe ----
const DIR = path.join(process.cwd(), 'data', 'market');
const universe = fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).map((f) => f.slice('backfill-'.length, -'-1h.jsonl'.length)).sort();
const engines = allCryptoEngines();

console.log(`\n=== Paper portfolio backtest — ${engines.length} engines × ${universe.length} crypto instruments, target vol ${(TARGET_VOL * 100).toFixed(0)}% ===`);

// per-instrument: bars, sigma series, and exposure per engine (features computed ONCE)
const inst = {};
for (const sym of universe) {
  const bars = fs.readFileSync(path.join(DIR, `backfill-${sym}-1h.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
  if (bars.length < 400) continue;
  const F = computeFeatures(bars);
  const sigma = ewmaVolSeries(bars, { barsPerYear: BARS_PER_YEAR });
  const exposure = {};                                    // engineId -> [0,1] per bar
  for (const e of engines) {
    const paths = e.params.map((p) => positionPath(e.family, p, bars, F, 200, bars.length, 0));
    exposure[e.id] = bars.map((_, i) => paths.reduce((s, pp) => s + pp[i], 0) / paths.length);
  }
  const idxByT = new Map(bars.map((b, i) => [b.t, i]));
  inst[sym] = { bars, sigma, exposure, idxByT };
}
const syms = Object.keys(inst);

// ---- common timeline (union of all timestamps) ----
const timeline = [...new Set(syms.flatMap((s) => inst[s].bars.map((b) => b.t)))].sort((a, b) => a - b);

// ---- run ----
const ledger = createLedger(CFG.ledger);
const vt = createVolTargeter(CFG.volTarget);
let prevEquity = START_CASH;
let barCount = 0;
const lastPrice = {};   // last-known close per instrument, so a held position is ALWAYS markable
for (const t of timeline) {
  // build this bar's engine exposures + sigmas + LIVE prices from instruments present at t
  const engineTargetsAt = {}; const sigmasAt = {}; const prices = {};
  for (const sym of syms) {
    const i = inst[sym].idxByT.get(t); if (i == null) continue;
    const px = inst[sym].bars[i].c; if (!(px > 0)) continue;
    prices[sym] = px; lastPrice[sym] = px;
    const sig = inst[sym].sigma[i]; if (sig > 0) sigmasAt[sym] = sig;
    for (const e of engines) {
      const x = inst[sym].exposure[e.id][i];
      if (x > 0) (engineTargetsAt[e.id] = engineTargetsAt[e.id] || {})[sym] = x;
    }
  }
  const weights = construct(engineTargetsAt, sigmasAt);
  const k = vt.scalar();
  const equity = ledger.curve.length ? ledger.curve[ledger.curve.length - 1].equity : START_CASH;
  let targets = weights.map((w) => ({ engine: w.engine, instrument: w.instrument, targetNotional: w.weight * k * equity }));
  targets = capExposure(targets, equity, CFG.caps);
  if (barCount % REBAL_EVERY === 0) ledger.rebalance(t, targets, prices);   // turnover control: only rebalance every N bars
  barCount++;
  const m = ledger.mark(t, lastPrice);                  // marks EVERY held position (last-known fills gaps)
  vt.update((m.equity - prevEquity) / prevEquity);
  prevEquity = m.equity;
}

// ---- metrics ----
const curve = ledger.curve;
const rets = [];
for (let i = 1; i < curve.length; i++) rets.push(curve[i].equity / curve[i - 1].equity - 1);
const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length) || 1e-12;
const annReturn = (curve[curve.length - 1].equity / START_CASH) ** (BARS_PER_YEAR / rets.length) - 1;
const annVol = sd * Math.sqrt(BARS_PER_YEAR);
const sharpe = (mean / sd) * Math.sqrt(BARS_PER_YEAR);
let peak = -Infinity, mdd = 0;
for (const p of curve) { peak = Math.max(peak, p.equity); mdd = Math.max(mdd, 1 - p.equity / peak); }
const avgGross = curve.reduce((s, p) => s + p.gross, 0) / curve.length / curve[curve.length - 1].equity;

console.log(`  bars: ${curve.length} | period ~${(rets.length / BARS_PER_YEAR).toFixed(2)}y`);
console.log(`  final equity: $${curve[curve.length - 1].equity.toFixed(0)}  (start $${START_CASH})`);
console.log(`  total return: ${((curve[curve.length - 1].equity / START_CASH - 1) * 100).toFixed(1)}%  | annualized: ${(annReturn * 100).toFixed(1)}%`);
console.log(`  realized vol: ${(annVol * 100).toFixed(1)}%  (target ${(TARGET_VOL * 100).toFixed(0)}%)  | avg gross exposure: ${(avgGross * 100).toFixed(0)}%`);
console.log(`  Sharpe: ${sharpe.toFixed(2)}  | max drawdown: ${(mdd * 100).toFixed(1)}%`);
console.log(`\n  Per-engine attribution (final):`);
const last = curve[curve.length - 1].byEngine;
const totalPnl = curve[curve.length - 1].equity - START_CASH;
console.log(`  ${'engine'.padEnd(26)} ${'pnl'.padStart(10)} ${'% of total'.padStart(10)} ${'costPaid'.padStart(10)} ${'traded'.padStart(12)}`);
for (const [name, e] of Object.entries(last).sort((a, b) => b[1].pnl - a[1].pnl)) {
  console.log(`  ${name.padEnd(26)} ${('$' + e.pnl.toFixed(0)).padStart(10)} ${(totalPnl ? (100 * e.pnl / totalPnl).toFixed(0) + '%' : '—').padStart(10)} ${('$' + e.costPaid.toFixed(0)).padStart(10)} ${('$' + (e.tradedNotional / 1000).toFixed(0) + 'k').padStart(12)}`);
}
console.log(`\n  Honest read: this is the COMBINATION after costs + vol targeting. Sharpe near 0 = vol-targeted noise;`);
console.log(`  positive Sharpe with vol near target = the risk layer is doing its job on a real (if marginal) edge.\n`);

// persist the equity curve for inspection
fs.mkdirSync(path.join(DIR, 'portfolio'), { recursive: true });
fs.writeFileSync(path.join(DIR, 'portfolio', 'equity-latest.json'), JSON.stringify({ generatedAt: Date.now(), cfg: CFG, metrics: { annReturn, annVol, sharpe, mdd }, curve: curve.map((p) => ({ t: p.t, equity: p.equity, gross: p.gross })) }));
