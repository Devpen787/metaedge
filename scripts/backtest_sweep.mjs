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
import { explicitUniverse, flag } from './lib/universe.mjs';
import { simpleMovingAverageSeries, wilderRsiSeries } from '../server/feature_math.mjs';

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

// ---------- causal features (bar i uses bars ≤ i only) ----------
function computeFeatures(bars) {
  const n = bars.length;
  const rsi = wilderRsiSeries(bars.map((bar) => bar.c), 14), atr = new Array(n).fill(null);
  const volR = new Array(n).fill(null), sma200 = new Array(n).fill(null);
  let trSum = 0;
  for (let i = 1; i < n; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
    if (i <= 14) { trSum += tr; if (i === 14) atr[i] = trSum / 14; }
    else atr[i] = (atr[i - 1] * 13 + tr) / 14;
  }
  let volSum = 0;
  for (let i = 0; i < n; i++) {
    volSum += bars[i].v; if (i >= 20) volSum -= bars[i - 20].v;
    if (i >= 19) volR[i] = bars[i].v / ((volSum / 20) || 1e-9);
  }
  // rolling max of the PRIOR N closes (excludes current bar → causal breakout)
  const rollMax = (N) => { const out = new Array(n).fill(null); for (let i = N; i < n; i++) { let m = -Infinity; for (let j = i - N; j < i; j++) m = Math.max(m, bars[j].c); out[i] = m; } return out; };
  const closes = bars.map((bar) => bar.c);
  const sma = (period) => simpleMovingAverageSeries(closes, period);
  // ATR% percentile rank over the trailing 240 bars — low rank = volatility
  // compression (the coiled spring); causal by construction.
  const atrPct = atr.map((a, i) => (a != null ? a / bars[i].c : null));
  const atrRank = new Array(n).fill(null);
  for (let i = 254; i < n; i++) {
    if (atrPct[i] == null) continue;
    let below = 0, cnt = 0;
    for (let j = i - 240; j < i; j++) if (atrPct[j] != null) { cnt++; if (atrPct[j] < atrPct[i]) below++; }
    if (cnt > 100) atrRank[i] = below / cnt;
  }
  return { rsi, atr, volR, sma200: sma(200), sma72: sma(72), sma168: sma(168), atrRank, rollMax24: rollMax(24), rollMax72: rollMax(72), rollMax168: rollMax(168) };
}

// ---------- strategy templates (signal on bar i → entry at OPEN of i+1) ----------
function signalAt(family, p, bars, F, i) {
  if (F.sma200[i] == null || F.rsi[i] == null || F.volR[i] == null) return false;
  if (family === 'momentum_breakout') {
    const rm = p.lookback === 24 ? F.rollMax24[i] : p.lookback === 72 ? F.rollMax72[i] : F.rollMax168[i];
    return rm != null && bars[i].c > rm && F.volR[i] >= p.minVolR && bars[i].c > F.sma200[i];
  }
  if (family === 'rsi_meanrev') {
    return F.rsi[i] <= p.rsiBuy && bars[i].c > F.sma200[i]; // Chan filter: fade dips only in uptrends
  }
  if (family === 'trend_atr') {
    // Carver-style trend entry: close crosses ABOVE the SMA (was below on the prior bar).
    const smaArr = p.smaN === 72 ? F.sma72 : F.sma168;
    return i > 0 && smaArr[i] != null && smaArr[i - 1] != null && bars[i - 1].c <= smaArr[i - 1] && bars[i].c > smaArr[i];
  }
  if (family === 'vol_squeeze') {
    // Devin's energy principle: compression precedes expansion. Enter when
    // volatility is in its bottom quintile AND price breaks the recent range up.
    const rm = p.breakN === 24 ? F.rollMax24[i] : F.rollMax72[i];
    return F.atrRank[i] != null && F.atrRank[i] <= p.rankMax && rm != null && bars[i].c > rm;
  }
  if (family === 'volume_surge') {
    // Participation spike + upward bar: someone showed up. Follow briefly.
    return F.volR[i] >= p.minVolR && bars[i].c > bars[i - 1].c && bars[i].c > (F.sma200[i] ?? 0);
  }
  if (family === 'meanrev_stab') {
    // Stabilization-wait dip buy: big drop over 24 bars, but ONLY enter once a
    // bar closes above the prior bar's high (the knife has stopped falling).
    if (i < 25) return false;
    const drop = (bars[i].c - bars[i - 24].c) / bars[i - 24].c;
    return drop <= -p.dropPct && bars[i].c > bars[i - 1].h; // deliberately no trend filter: sharp dips mostly happen in downtrends
  }
  return false;
}

function runStrategy(family, p, bars, F, from, to) {
  const trades = [];
  let i = Math.max(from, 200);
  while (i < to - 1) {
    if (!signalAt(family, p, bars, F, i)) { i++; continue; }
    const entry = bars[i + 1].o * (1 + COST);
    let stopPx, targetPx;
    if (family === 'trend_atr') {
      stopPx = entry - p.atrMult * (F.atr[i] ?? entry * 0.02); targetPx = Infinity; // trailing stop only
    } else if (family === 'vol_squeeze') {
      let lo = Infinity; for (let k = Math.max(0, i - 24); k <= i; k++) lo = Math.min(lo, bars[k].l);
      stopPx = lo * 0.998; targetPx = entry + 2 * (entry - stopPx);
      if (stopPx >= entry) { i++; continue; }
    } else if (family === 'meanrev_stab') {
      let lo = Infinity; for (let k = Math.max(0, i - 6); k <= i; k++) lo = Math.min(lo, bars[k].l);
      stopPx = lo * 0.998; targetPx = entry + 2 * (entry - stopPx);                 // structural stop, 2R target
      if (stopPx >= entry) { i++; continue; }                                        // degenerate stop → skip
    } else {
      stopPx = entry * (1 - p.stop); targetPx = entry * (1 + p.stop * 2);            // 2R target
    }
    let exitPx = null, bars_held = 0;
    let trailHigh = entry;
    for (let j = i + 1; j < Math.min(i + 1 + p.maxHold, to); j++) {
      bars_held = j - i;
      if (family === 'trend_atr') {
        trailHigh = Math.max(trailHigh, bars[j].c);
        stopPx = Math.max(stopPx, trailHigh - p.atrMult * (F.atr[j] ?? 0));          // ratchet up only
      }
      if (bars[j].l <= stopPx) { exitPx = stopPx; break; }          // conservative: stop checked first
      if (bars[j].h >= targetPx) { exitPx = targetPx; break; }
      if (family === 'rsi_meanrev' && F.rsi[j] != null && F.rsi[j] >= 50) { exitPx = bars[j].c; break; }
    }
    const lastJ = Math.min(i + bars_held, to - 1);
    if (exitPx == null) exitPx = bars[lastJ].c;                      // time exit
    exitPx *= (1 - COST);
    trades.push({ ret: (exitPx - entry) / entry, bars: bars_held });
    i = lastJ + 1;                                                   // no overlapping positions
  }
  return trades;
}

function metrics(trades) {
  if (!trades.length) return { n: 0 };
  const rets = trades.map((t) => t.ret);
  const wins = rets.filter((r) => r > 0), losses = rets.filter((r) => r <= 0);
  const gross = wins.reduce((s, r) => s + r, 0), grossL = -losses.reduce((s, r) => s + r, 0);
  let eq = 1, peak = 1, mdd = 0;
  for (const r of rets) { eq *= 1 + r; peak = Math.max(peak, eq); mdd = Math.max(mdd, 1 - eq / peak); }
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length) || 1e-9;
  return {
    n: rets.length, winRate: wins.length / rets.length,
    expectancyPct: mean * 100, profitFactor: grossL > 0 ? gross / grossL : Infinity,
    totalReturnPct: (eq - 1) * 100, maxDrawdownPct: mdd * 100, tstat: mean / (sd / Math.sqrt(rets.length))
  };
}

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
          const m = metrics(runStrategy(family, h.p, bars, F, start, start + TRAIN));
          registry.write(JSON.stringify({ t: Date.now(), sym, family, params: h.p, phase: 'train', foldStart: start, ...m }) + '\n');
          if (m.n >= 10 && (best == null || (m.profitFactor > best.m.profitFactor))) best = { h, m };
        }
      }
      if (!best) continue;
      // judge on unseen TEST (after embargo)
      const testTrades = runStrategy(family, best.h.p, bars, F, start + TRAIN + EMBARGO, start + TRAIN + EMBARGO + TEST);
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

registry.end();
const outPath = `data/edgeops/backtest-report-${MARKET}-${dstr}.md`;
fs.writeFileSync(outPath, out.join('\n'));
console.log('\n' + out.join('\n'));
console.log(`\nWritten to ${outPath}`);
