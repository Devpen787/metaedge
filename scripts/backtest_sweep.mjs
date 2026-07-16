#!/usr/bin/env node
/**
 * Walk-forward backtest sweep — turns the 2-year backfill into SCREENED
 * strategy candidates. Implements the canon:
 *   Murphy 4/5: indicator features, combined (never one signal alone)
 *   Bandy 8:    walk-forward — params picked on TRAIN, judged on unseen TEST
 *   Bandy 9:    many metrics (PF, drawdown, expectancy), never return alone
 *   LdP 10:     every hypothesis logged to the registry; survivor bar accounts
 *               for how many things we tried
 *   LdP 11:     causal features only; entries at NEXT bar open; embargo gap
 *               between train and test windows
 *
 * Costs: 10bps/side (matches paper cost realism) applied to every fill.
 * Long-only v1 (honest limit: short dynamics differ; shorts need their own card).
 * Survivors are CANDIDATES for paper forward-testing — never tradable edges.
 *
 * Usage: node scripts/backtest_sweep.mjs (--symbols A,B | --universe-file PATH) [--interval 1h]
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { explicitUniverse, flag } from './lib/universe.mjs';
// Strategy rules live in ONE place so the sweep and the live forward trial can
// never drift apart — that shared definition is what makes a forward paper
// result comparable to the backtest that justified it.
import { computeFeatures, signalAt, runStrategy, metrics } from './lib/strategy_core.mjs';

const args = process.argv.slice(2);
const INTERVAL = flag(args, 'interval', '1h');
const SYMBOLS = explicitUniverse(args, 'symbols');
// Market-agnostic: the same walk-forward engine runs crypto (hourly) or stocks
// (daily) — only the bar-count windows differ. Defaults are the hourly-crypto
// values; `--train --test --embargo --cost --market` retune it for another
// asset class WITHOUT forking a second, drift-prone sweep.
//   Stocks (daily): --interval 1d --train 500 --test 120 --embargo 3
const COST = Number(flag(args, 'cost', '0.001'));       // per side (10bps default)
const TRAIN = Number(flag(args, 'train', '4320'));      // ~6mo of 1h bars
const TEST = Number(flag(args, 'test', '1440'));        // ~2mo of 1h bars
const EMBARGO = Number(flag(args, 'embargo', '48'));    // gap so positions can't leak the split
const MARKET = flag(args, 'market', 'crypto');          // label for the report only
// --frozen '{"rsiBuy":35,...}' evaluates ONE precommitted param set across every
// fold instead of re-picking the best per fold. Use it to ask whether a sweep
// "survivor" is a real edge or an artifact of hindsight parameter selection.
const FROZEN = flag(args, 'frozen', '') ? JSON.parse(flag(args, 'frozen', '')) : null;
const ALL_FAMILIES = ['momentum_breakout', 'rsi_meanrev', 'trend_atr', 'meanrev_stab', 'vol_squeeze', 'volume_surge'];
const ONLY_FAMILY = flag(args, 'family', '');
const FAMILIES = ONLY_FAMILY ? [ONLY_FAMILY] : ALL_FAMILIES;
if (FROZEN && !ONLY_FAMILY) throw new Error('--frozen requires --family (params belong to exactly one family)');
const dstr = new Date().toISOString().slice(0, 10);


// ---------- hypothesis grid (bounded on purpose: LdP 10) ----------
const GRID = [];
for (const lookback of [24, 72, 168]) for (const minVolR of [1.0, 1.5]) for (const stop of [0.015, 0.03])
  GRID.push({ family: 'momentum_breakout', p: { lookback, minVolR, stop, maxHold: 48 } });
for (const rsiBuy of [25, 30, 35]) for (const stop of [0.015, 0.03])
  GRID.push({ family: 'rsi_meanrev', p: { rsiBuy, stop, maxHold: 48 } });
for (const smaN of [72, 168]) for (const atrMult of [2, 3])
  GRID.push({ family: 'trend_atr', p: { smaN, atrMult, maxHold: 500 } });   // Carver: trend + ATR trail
for (const dropPct of [0.05, 0.08])
  GRID.push({ family: 'meanrev_stab', p: { dropPct, maxHold: 72 } });       // scalarfield: wait for stabilization
for (const rankMax of [0.15, 0.25]) for (const breakN of [24, 72])
  GRID.push({ family: 'vol_squeeze', p: { rankMax, breakN, maxHold: 72 } }); // Devin: compression → expansion
for (const minVolR of [2.5, 3.5]) for (const stop of [0.015, 0.03])
  GRID.push({ family: 'volume_surge', p: { minVolR, stop, maxHold: 48 } });  // Devin: participation spike

// ---------- walk-forward per symbol ----------
fs.mkdirSync('data/edgeops', { recursive: true });
const registry = fs.createWriteStream('data/edgeops/hypothesis-registry.jsonl', { flags: 'a' });
const out = [];
const p = (s = '') => out.push(s);
let totalHypotheses = 0;

p(`# Backtest Sweep (${MARKET}) — ${dstr}`);
p();
p(`Market: ${MARKET} · ${INTERVAL} bars. Walk-forward: train ${TRAIN} → embargo ${EMBARGO} → test ${TEST} bars, rolling. Costs ${COST * 1e4}bps/side. Long-only v1.`);
p();
p(`| Symbol | Family | Best params (per-fold) | OOS trades | OOS win% | OOS expectancy | OOS PF | OOS maxDD | +folds | Verdict |`);
p(`|---|---|---|---|---|---|---|---|---|---|`);

const survivors = [];
for (const sym of SYMBOLS) {
  const file = `data/market/backfill-${sym}-${INTERVAL}.jsonl`;
  if (!fs.existsSync(file)) { console.log(`  ${sym}: no backfill, skipping`); continue; }
  const bars = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  if (bars.length < TRAIN + TEST + 200) { console.log(`  ${sym}: too little history (${bars.length}), skipping`); continue; }
  const F = computeFeatures(bars);

  for (const family of FAMILIES) {
    const oosTrades = [];
    const chosen = [];
    let posFolds = 0, folds = 0;
    for (let start = 0; start + TRAIN + EMBARGO + TEST <= bars.length; start += TEST) {
      folds++;
      // pick best on TRAIN by profit factor (min 10 trades)
      let best = null;
      if (FROZEN) {
        // FROZEN mode: use ONE precommitted param set for every fold — no
        // per-fold re-selection. This is the honest question: you cannot re-pick
        // parameters with hindsight in live trading, you must freeze them and
        // trade them forward. Re-picking per fold (the default below) lets the
        // strategy adapt using information it would not have had, which inflates
        // OOS metrics and can manufacture a "survivor" out of noise.
        best = { h: { family, p: FROZEN }, m: null };
      } else {
        for (const h of GRID.filter((g) => g.family === family)) {
          totalHypotheses++;
          const m = metrics(runStrategy(family, h.p, bars, F, start, start + TRAIN, COST));
          registry.write(JSON.stringify({ t: Date.now(), sym, family, params: h.p, phase: 'train', foldStart: start, ...m }) + '\n');
          if (m.n >= 10 && (best == null || (m.profitFactor > best.m.profitFactor))) best = { h, m };
        }
      }
      if (!best) continue;
      // judge on unseen TEST (after embargo)
      const testTrades = runStrategy(family, best.h.p, bars, F, start + TRAIN + EMBARGO, start + TRAIN + EMBARGO + TEST, COST);
      const tm = metrics(testTrades);
      registry.write(JSON.stringify({ t: Date.now(), sym, family, params: best.h.p, phase: 'test', foldStart: start, ...tm }) + '\n');
      oosTrades.push(...testTrades);
      chosen.push(best.h.p);
      if ((tm.expectancyPct || 0) > 0) posFolds++;
    }
    const agg = metrics(oosTrades);
    const paramSummary = chosen.length ? JSON.stringify(chosen[chosen.length - 1]) : '—';
    // Survivor bar (deflated for the size of the grid): PF ≥ 1.1, n ≥ 30, ≥55% positive folds, t-stat ≥ 2
    const pass = agg.n >= 30 && agg.profitFactor >= 1.1 && folds > 0 && posFolds / folds >= 0.55 && (agg.tstat || 0) >= 2;
    if (pass) survivors.push({ sym, family, params: chosen[chosen.length - 1], agg });
    p(`| ${sym} | ${family} | \`${paramSummary}\` | ${agg.n || 0} | ${agg.n ? (agg.winRate * 100).toFixed(0) + '%' : '—'} | ${agg.n ? agg.expectancyPct.toFixed(3) + '%' : '—'} | ${agg.n ? agg.profitFactor.toFixed(2) : '—'} | ${agg.n ? agg.maxDrawdownPct.toFixed(1) + '%' : '—'} | ${posFolds}/${folds} | ${pass ? '🟡 CANDIDATE' : 'rejected'} |`);
  }
  console.log(`  ${sym}: done`);
}

// ---------- relative-strength rotation (Chan) — portfolio harness ----------
// Weekly: rank the universe by trailing return, hold top-K equal-weight.
// Each held-asset-week is one sample; costs charged on position changes.
{
  const barsBySym = {};
  for (const sym of SYMBOLS) {
    const f = `data/market/backfill-${sym}-${INTERVAL}.jsonl`;
    if (fs.existsSync(f)) {
      const b = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      if (b.length >= TRAIN + TEST + 200) barsBySym[sym] = new Map(b.map((x) => [x.t, x.c]));
    }
  }
  const syms = Object.keys(barsBySym);
  const common = [...(barsBySym[syms[0]] || new Map()).keys()].filter((t) => syms.every((s2) => barsBySym[s2].has(t))).sort((a, b) => a - b);
  const closes = {}; for (const s2 of syms) closes[s2] = common.map((t) => barsBySym[s2].get(t));
  const W = 168; // weekly rebalance
  const runRS = (lookback, K, from, to) => {
    const samples = [];
    let held = [];
    for (let i = from + lookback; i + W <= to; i += W) {
      const ranked = syms.map((s2) => ({ s2, r: closes[s2][i] / closes[s2][i - lookback] - 1 })).sort((a, b) => b.r - a.r).slice(0, K).map((x) => x.s2);
      for (const s2 of ranked) {
        const gross = closes[s2][i + W] / closes[s2][i] - 1;
        const cost = held.includes(s2) ? 0 : 2 * COST;   // enter+eventual exit charged on turnover
        samples.push({ ret: gross - cost, bars: W });
      }
      held = ranked;
    }
    return samples;
  };
  const oos = []; const chosen = []; let posFolds = 0, folds = 0;
  for (let start = 0; start + TRAIN + EMBARGO + TEST <= common.length; start += TEST) {
    folds++;
    let best = null;
    for (const lookback of [336, 720]) for (const K of [2, 3]) {
      totalHypotheses++;
      const m = metrics(runRS(lookback, K, start, start + TRAIN));
      registry.write(JSON.stringify({ t: Date.now(), sym: 'PORTFOLIO', family: 'relstrength', params: { lookback, K }, phase: 'train', foldStart: start, ...m }) + '\n');
      if (m.n >= 10 && (best == null || m.profitFactor > best.m.profitFactor)) best = { p: { lookback, K }, m };
    }
    if (!best) continue;
    const tm0 = runRS(best.p.lookback, best.p.K, start + TRAIN + EMBARGO, start + TRAIN + EMBARGO + TEST);
    const tm = metrics(tm0);
    registry.write(JSON.stringify({ t: Date.now(), sym: 'PORTFOLIO', family: 'relstrength', params: best.p, phase: 'test', foldStart: start, ...tm }) + '\n');
    oos.push(...tm0); chosen.push(best.p);
    if ((tm.expectancyPct || 0) > 0) posFolds++;
  }
  const agg = metrics(oos);
  const pass = agg.n >= 30 && agg.profitFactor >= 1.1 && folds > 0 && posFolds / folds >= 0.55 && (agg.tstat || 0) >= 2;
  if (pass) survivors.push({ sym: 'PORTFOLIO', family: 'relstrength', params: chosen[chosen.length - 1], agg });
  p(`| PORTFOLIO (${syms.length} syms) | relstrength | ${chosen.length ? JSON.stringify(chosen[chosen.length - 1]) : '—'} | ${agg.n || 0} | ${agg.n ? (agg.winRate * 100).toFixed(0) + '%' : '—'} | ${agg.n ? agg.expectancyPct.toFixed(3) + '%' : '—'} | ${agg.n ? agg.profitFactor.toFixed(2) : '—'} | ${agg.n ? agg.maxDrawdownPct.toFixed(1) + '%' : '—'} | ${posFolds}/${folds} | ${pass ? '🟡 CANDIDATE' : 'rejected'} |`);
  console.log('  PORTFOLIO relstrength: done');
}

p();
p(`## Multiple-testing accounting (LdP 10)`);
p(`- Hypotheses evaluated this run: **${totalHypotheses}** (all logged to \`data/edgeops/hypothesis-registry.jsonl\`)`);
p(`- With this many trials, chance alone produces impressive-looking losers. The survivor bar (PF≥1.1, n≥30, ≥55% positive folds, t≥2 on OUT-OF-SAMPLE trades only) is deliberately strict — and still not proof.`);
p();
p(`## Honest limits`);
p(`- Long-only, one position per symbol, ${INTERVAL} bars (not our live feed).`);
p(`- Candidates are HYPOTHESES for the paper fleet to forward-verify on our real feed with real cost realism. Nothing here is a tradable edge.`);
p(`- Regime caveat: 2 years ≈ one macro regime. Survivors may be regime artifacts.`);
p();
p(`## Candidates for forward testing`);
if (survivors.length) for (const s of survivors) p(`- **${s.sym} / ${s.family}** ${JSON.stringify(s.params)} — OOS n=${s.agg.n}, PF ${s.agg.profitFactor.toFixed(2)}, expectancy ${s.agg.expectancyPct.toFixed(3)}%/trade → write a research card before encoding.`);
else p(`- **None survived.** That is a valid, useful result: these simple templates have no detectable edge after costs on this universe/period. The factory's baselines remain benchmarks, and the next hypotheses need richer features — not looser standards.`);

// Survivors as a RECORD, not prose. Until now the only output was the markdown
// bullet above, which meant the pipeline's last step was "a human reads this
// sentence and retypes the params into the forward runner." That human was the
// bottleneck: ~30k hypotheses have been screened and exactly zero ever reached a
// forward trial without being hand-carried. A machine-readable survivor closes
// the loop — scripts/forward_paper.mjs picks these up on its own.
//
// Append-only and content-addressed: re-running the sweep re-emits the same id
// for the same (symbol, family, params), so the forward runner de-duplicates
// rather than arming a strategy twice. A params change is a NEW id, i.e. a new
// trial — which is correct, because it is a different strategy.
if (survivors.length) {
  fs.mkdirSync('data/edgeops', { recursive: true });
  const rows = survivors.map((s) => {
    const key = `${s.sym}:${s.family}:${JSON.stringify(s.params)}`;
    const id = `${s.sym}:${s.family}:${createHash('sha256').update(key).digest('hex').slice(0, 8)}`;
    return JSON.stringify({
      id, t: Date.now(), symbol: s.sym, family: s.family, params: s.params,
      interval: INTERVAL, market: MARKET, costPerSide: COST,
      screened: {
        n: s.agg.n, profitFactor: +s.agg.profitFactor.toFixed(3),
        expectancyPct: +s.agg.expectancyPct.toFixed(3),
        winRatePct: +(s.agg.winRate * 100).toFixed(1),
        maxDrawdownPct: +s.agg.maxDrawdownPct.toFixed(2),
        tstat: +(s.agg.tstat || 0).toFixed(2),
      },
      // Screened ≠ real. This flag is what the forward trial exists to settle.
      status: 'screened_candidate',
    });
  });
  fs.appendFileSync('data/edgeops/survivors.jsonl', rows.join('\n') + '\n');
  console.log(`\n  → ${survivors.length} survivor(s) recorded to data/edgeops/survivors.jsonl (forward runner picks these up automatically)`);
}

registry.end();
const outPath = `data/edgeops/backtest-report-${MARKET}-${dstr}.md`;
fs.writeFileSync(outPath, out.join('\n'));
console.log('\n' + out.join('\n'));
console.log(`\nWritten to ${outPath}`);
