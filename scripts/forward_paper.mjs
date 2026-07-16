#!/usr/bin/env node
/**
 * Forward paper trial — the only test that can tell a real edge from a lucky
 * backtest, because it runs on bars nobody has fitted anything to.
 *
 * HOW IT STAYS HONEST
 * - It imports the SAME rule module the backtest uses (scripts/lib/strategy_core).
 *   Not a re-implementation. If the rule changes, both change together, so a
 *   difference in results is the market's doing and not ours.
 * - It runs on REAL exchange candles (same venue + shape as the backfill), so a
 *   backtested stop-out is reproducible here. Our old 60s-sampled feed could not
 *   promise that, which made its paper evidence unable to predict live.
 * - Bars BEFORE --since are warmup only. They give the rule its lookback (a
 *   200-hour average has to come from somewhere) but they can never count as
 *   forward evidence, because the strategy was chosen while knowing them.
 *   Only trades OPENED after --since are scored. That line is the whole point.
 * - The rule is replayed from scratch each run and is deterministic and
 *   non-overlapping, so "what should I be holding right now" is recomputed
 *   rather than accumulated — no drifting internal state to corrupt.
 *
 * Live money is never touched: this writes a paper ledger, nothing else.
 *
 * Usage:
 *   node scripts/forward_paper.mjs --since 2026-07-16
 *   node scripts/forward_paper.mjs --since 2026-07-16 --json
 */
import fs from 'node:fs';
import path from 'node:path';
import { computeFeatures, runStrategy, metrics } from './lib/strategy_core.mjs';
import { flag } from './lib/universe.mjs';

const args = process.argv.slice(2);
const SINCE = flag(args, 'since', new Date().toISOString().slice(0, 10));
const COST = Number(flag(args, 'cost', '0.001'));   // same 10bps/side the sweep charged
const LIMIT = Number(flag(args, 'limit', '1000'));  // exchange max per request
const AS_JSON = args.includes('--json');
const OUT_DIR = path.join(process.cwd(), 'data', 'edgeops', 'forward');

// The precommitted trials. These are EXACTLY the params that survived the frozen
// walk-forward — writing them here freezes them: any later edit is a new trial,
// not a better result. (docs/EDGE_PORTFOLIO_OS.md lifecycle.)
const TRIALS = [
  { symbol: 'DOT', family: 'rsi_meanrev', params: { rsiBuy: 35, stop: 0.03, maxHold: 48 },
    screened: { n: 41, pf: 2.13, expectancyPct: 0.786 } },
  { symbol: 'ZEC', family: 'meanrev_stab', params: { dropPct: 0.08, maxHold: 72 },
    screened: { n: 56, pf: 2.26, expectancyPct: 3.157 } },
  { symbol: 'PAXG', family: 'vol_squeeze', params: { rankMax: 0.25, breakN: 72, maxHold: 72 },
    screened: { n: 37, pf: 2.73, expectancyPct: 0.655 } },
];

async function realCandles(symbol) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1h&limit=${LIMIT}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
  if (!res.ok) return null;                       // unknown market → DECLINE, never guess
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.map((r) => ({
    t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]),
  })).filter((b) => Number.isFinite(b.c) && b.c > 0);
}

const sinceMs = Date.parse(`${SINCE}T00:00:00Z`);
const report = [];

for (const trial of TRIALS) {
  const bars = await realCandles(trial.symbol);
  if (!bars) { report.push({ ...trial, status: 'NO_MARKET_DATA' }); continue; }

  // The index where forward evidence begins. Everything before it is lookback.
  const startIdx = bars.findIndex((b) => b.t >= sinceMs);
  if (startIdx < 0) { report.push({ ...trial, status: 'SINCE_IS_IN_THE_FUTURE' }); continue; }

  const F = computeFeatures(bars);
  // Replay the identical rule across the whole series; the runner only enters
  // from `startIdx` onward, so warmup bars inform the lookback but never trade.
  const trades = runStrategy(trial.family, trial.params, bars, F, startIdx, bars.length, COST);
  const m = metrics(trades);

  report.push({
    ...trial,
    status: 'RUNNING',
    warmupBars: startIdx,
    forwardBars: bars.length - startIdx,
    forwardFrom: new Date(bars[startIdx].t).toISOString(),
    latestBar: new Date(bars[bars.length - 1].t).toISOString(),
    forward: m.n ? {
      trades: m.n, winRatePct: +(m.winRate * 100).toFixed(1), expectancyPct: +m.expectancyPct.toFixed(3),
      profitFactor: Number.isFinite(m.profitFactor) ? +m.profitFactor.toFixed(2) : null,
      totalReturnPct: +m.totalReturnPct.toFixed(2), maxDrawdownPct: +m.maxDrawdownPct.toFixed(1),
    } : null,
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT_DIR, `forward-${stamp}.json`),
  `${JSON.stringify({ generatedAt: Date.now(), since: SINCE, costPerSide: COST, trials: report }, null, 2)}\n`);

if (AS_JSON) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

console.log(`\n=== Forward paper trials — evidence from ${SINCE} onward (real exchange candles) ===\n`);
for (const r of report) {
  if (r.status !== 'RUNNING') { console.log(`  ${r.symbol.padEnd(5)} ${r.family.padEnd(13)} ${r.status}`); continue; }
  const f = r.forward;
  const line = f
    ? `${String(f.trades).padStart(2)} trades · ${f.winRatePct}% win · ${f.expectancyPct > 0 ? '+' : ''}${f.expectancyPct}%/trade · PF ${f.profitFactor ?? '∞'} · maxDD ${f.maxDrawdownPct}%`
    : 'no signal yet (conditions not met)';
  console.log(`  ${r.symbol.padEnd(5)} ${r.family.padEnd(13)} ${String(r.forwardBars).padStart(3)}h forward | ${line}`);
  console.log(`        screened: ${r.screened.n} trades, PF ${r.screened.pf}, ${r.screened.expectancyPct}%/trade  ← what forward must reproduce`);
}
console.log(`\n  Paper only. Forward samples are tiny at first — a handful of trades proves nothing.`);
console.log(`  Written to data/edgeops/forward/forward-${stamp}.json\n`);
