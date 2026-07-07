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
 * Usage: node scripts/backtest_sweep.mjs [--symbols BTC,ETH] [--interval 1h]
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const INTERVAL = flag('interval', '1h');
const SYMBOLS = flag('symbols', 'BTC,ETH,SOL,LINK,DOGE,BNB,XRP,ADA,AVAX,DOT').split(',');
const COST = 0.001;               // 10bps per side, as in paper fills
const TRAIN = 4320, TEST = 1440;  // ~6mo train → ~2mo test (1h bars)
const EMBARGO = 48;               // 2-day gap so positions can't leak across the split
const dstr = new Date().toISOString().slice(0, 10);

// ---------- causal features (bar i uses bars ≤ i only) ----------
function computeFeatures(bars) {
  const n = bars.length;
  const rsi = new Array(n).fill(null), atr = new Array(n).fill(null);
  const volR = new Array(n).fill(null), sma200 = new Array(n).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < n; i++) {
    const ch = bars[i].c - bars[i - 1].c;
    if (i <= 14) { gain += Math.max(ch, 0); loss += Math.max(-ch, 0); if (i === 14) rsi[i] = 100 - 100 / (1 + (gain / 14) / ((loss / 14) || 1e-9)); }
    else { gain = (gain * 13 + Math.max(ch, 0)) / 14; loss = (loss * 13 + Math.max(-ch, 0)) / 14; rsi[i] = 100 - 100 / (1 + gain / (loss || 1e-9)); }
  }
  let trSum = 0;
  for (let i = 1; i < n; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
    if (i <= 14) { trSum += tr; if (i === 14) atr[i] = trSum / 14; }
    else atr[i] = (atr[i - 1] * 13 + tr) / 14;
  }
  let volSum = 0, closeSum = 0;
  for (let i = 0; i < n; i++) {
    volSum += bars[i].v; if (i >= 20) volSum -= bars[i - 20].v;
    if (i >= 19) volR[i] = bars[i].v / ((volSum / 20) || 1e-9);
    closeSum += bars[i].c; if (i >= 200) closeSum -= bars[i - 200].c;
    if (i >= 199) sma200[i] = closeSum / 200;
  }
  // rolling max of the PRIOR N closes (excludes current bar → causal breakout)
  const rollMax = (N) => { const out = new Array(n).fill(null); for (let i = N; i < n; i++) { let m = -Infinity; for (let j = i - N; j < i; j++) m = Math.max(m, bars[j].c); out[i] = m; } return out; };
  return { rsi, atr, volR, sma200, rollMax24: rollMax(24), rollMax72: rollMax(72), rollMax168: rollMax(168) };
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
  return false;
}

function runStrategy(family, p, bars, F, from, to) {
  const trades = [];
  let i = Math.max(from, 200);
  while (i < to - 1) {
    if (!signalAt(family, p, bars, F, i)) { i++; continue; }
    const entry = bars[i + 1].o * (1 + COST);
    const stopPx = entry * (1 - p.stop), targetPx = entry * (1 + p.stop * 2); // 2R target
    let exitPx = null, bars_held = 0;
    for (let j = i + 1; j < Math.min(i + 1 + p.maxHold, to); j++) {
      bars_held = j - i;
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

// ---------- walk-forward per symbol ----------
fs.mkdirSync('data/edgeops', { recursive: true });
const registry = fs.createWriteStream('data/edgeops/hypothesis-registry.jsonl', { flags: 'a' });
const out = [];
const p = (s = '') => out.push(s);
let totalHypotheses = 0;

p(`# Backtest Sweep — ${dstr}`);
p();
p(`Walk-forward: train ${TRAIN} bars (~6mo) → embargo ${EMBARGO} → test ${TEST} bars (~2mo), rolling. Costs ${COST * 1e4}bps/side. Long-only v1.`);
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

  for (const family of ['momentum_breakout', 'rsi_meanrev']) {
    const oosTrades = [];
    const chosen = [];
    let posFolds = 0, folds = 0;
    for (let start = 0; start + TRAIN + EMBARGO + TEST <= bars.length; start += TEST) {
      folds++;
      // pick best on TRAIN by profit factor (min 10 trades)
      let best = null;
      for (const h of GRID.filter((g) => g.family === family)) {
        totalHypotheses++;
        const m = metrics(runStrategy(family, h.p, bars, F, start, start + TRAIN));
        registry.write(JSON.stringify({ t: Date.now(), sym, family, params: h.p, phase: 'train', foldStart: start, ...m }) + '\n');
        if (m.n >= 10 && (best == null || (m.profitFactor > best.m.profitFactor))) best = { h, m };
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

p();
p(`## Multiple-testing accounting (LdP 10)`);
p(`- Hypotheses evaluated this run: **${totalHypotheses}** (all logged to \`data/edgeops/hypothesis-registry.jsonl\`)`);
p(`- With this many trials, chance alone produces impressive-looking losers. The survivor bar (PF≥1.1, n≥30, ≥55% positive folds, t≥2 on OUT-OF-SAMPLE trades only) is deliberately strict — and still not proof.`);
p();
p(`## Honest limits`);
p(`- Long-only, one position per symbol, 1h bars, exchange candles (not our live feed).`);
p(`- Candidates are HYPOTHESES for the paper fleet to forward-verify on our real feed with real cost realism. Nothing here is a tradable edge.`);
p(`- Regime caveat: 2 years ≈ one macro regime. Survivors may be regime artifacts.`);
p();
p(`## Candidates for forward testing`);
if (survivors.length) for (const s of survivors) p(`- **${s.sym} / ${s.family}** ${JSON.stringify(s.params)} — OOS n=${s.agg.n}, PF ${s.agg.profitFactor.toFixed(2)}, expectancy ${s.agg.expectancyPct.toFixed(3)}%/trade → write a research card before encoding.`);
else p(`- **None survived.** That is a valid, useful result: these simple templates have no detectable edge after costs on this universe/period. The factory's baselines remain benchmarks, and the next hypotheses need richer features — not looser standards.`);

registry.end();
const outPath = `data/edgeops/backtest-report-${dstr}.md`;
fs.writeFileSync(outPath, out.join('\n'));
console.log('\n' + out.join('\n'));
console.log(`\nWritten to ${outPath}`);
