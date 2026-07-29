// THE strategy rules — one definition, used by BOTH the historical sweep and the
// live forward-paper trial.
//
// This module exists to guarantee PARITY. A forward paper trial is only evidence
// if it runs the SAME rule the backtest ran; a re-implementation drifts, and then
// a difference in results cannot be attributed to the market rather than to your
// own code. Everything here is causal by construction (bar i uses bars <= i,
// entry at the OPEN of i+1), so a signal can never see its own outcome.
//
// Extracted verbatim from scripts/backtest_sweep.mjs. Only change: `cost` is an
// explicit argument to runStrategy instead of a module-level constant, so every
// caller must state its cost assumption rather than inherit a hidden one.
import { simpleMovingAverageSeries, wilderRsiSeries, exponentialMovingAverageSeries } from '../../server/feature_math.mjs';

// ---------- causal features (bar i uses bars ≤ i only) ----------
export function computeFeatures(bars) {
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
  // ---- MACD (EMA12/26, signal EMA9 of the MACD line) — genuinely different
  // information from a plain SMA/RSI threshold: it's rate-of-change-of-momentum.
  const ema12 = exponentialMovingAverageSeries(closes, 12), ema26 = exponentialMovingAverageSeries(closes, 26);
  const macdLine = closes.map((_, i) => (ema12[i] != null && ema26[i] != null) ? ema12[i] - ema26[i] : null);
  const macdVals = macdLine.filter((v) => v != null);
  const macdSignalDense = exponentialMovingAverageSeries(macdVals, 9);
  const macdSignal = new Array(n).fill(null);
  { let k = 0; for (let i = 0; i < n; i++) if (macdLine[i] != null) { macdSignal[i] = macdSignalDense[k]; k++; } }
  const sma50 = sma(50);

  // ---- volume z-score vs a TRAILING (prior-bar-only) 20-bar mean/std — causal:
  // bar i's own volume is compared to bars strictly before it, so a spike is
  // measured against what was "normal" walking in, never against itself.
  const volZ = new Array(n).fill(null);
  for (let i = 20; i < n; i++) {
    let sum = 0; for (let j = i - 20; j < i; j++) sum += bars[j].v;
    const mean = sum / 20;
    let sq = 0; for (let j = i - 20; j < i; j++) sq += (bars[j].v - mean) ** 2;
    const sd = Math.sqrt(sq / 20) || 1e-9;
    volZ[i] = (bars[i].v - mean) / sd;
  }

  // ---- rolling swing-low reference for RSI divergence: the lowest CLOSE in a
  // [i-40, i-5] window (excludes the 4 most-recent bars so "the prior low" can't
  // be the bar right next to today), plus the RSI reading at that same bar —
  // causal, uses only bars < i-4.
  const swingLowPx = new Array(n).fill(null), swingLowRsi = new Array(n).fill(null);
  for (let i = 45; i < n; i++) {
    let lo = Infinity, loIdx = -1;
    for (let j = i - 40; j <= i - 5; j++) if (bars[j].c < lo) { lo = bars[j].c; loIdx = j; }
    if (loIdx >= 0 && rsi[loIdx] != null) { swingLowPx[i] = lo; swingLowRsi[i] = rsi[loIdx]; }
  }

  return { rsi, atr, volR, sma200: sma(200), sma72: sma(72), sma168: sma(168), sma50, atrRank,
    rollMax24: rollMax(24), rollMax72: rollMax(72), rollMax168: rollMax(168),
    macdLine, macdSignal, volZ, swingLowPx, swingLowRsi };
}

// ---------- strategy templates (signal on bar i → entry at OPEN of i+1) ----------
export function signalAt(family, p, bars, F, i) {
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
  // ---- new families: classic TA the crash-detector shape (meanrev_stab) misses,
  // because a SLOW grind down never trips an 8%-in-24h trigger. ----
  if (family === 'golden_cross') {
    // sma50 crosses ABOVE sma200 from below — the classic long-horizon trend flip,
    // widely watched (a real "other participants act on this too" flow argument).
    if (F.sma50[i] == null || F.sma50[i - 1] == null || F.sma200[i - 1] == null) return false;
    return F.sma50[i - 1] <= F.sma200[i - 1] && F.sma50[i] > F.sma200[i];
  }
  if (family === 'rsi_divergence') {
    // BULLISH DIVERGENCE: price makes a LOWER low than the recent swing low, but
    // RSI makes a HIGHER low at the same time — momentum improving while price
    // still falls, a classic exhaustion signal. Genuinely different from the plain
    // "RSI <= threshold" test (rsi_meanrev): that fires on ANY dip; this fires only
    // when the dip's INTERNAL momentum is decelerating. Confirmed on a
    // stabilization bar (close > prior high), same discipline as meanrev_stab.
    if (F.swingLowPx[i] == null || F.rsi[i] == null) return false;
    return bars[i].c < F.swingLowPx[i] && F.rsi[i] > F.swingLowRsi[i] && bars[i].c > bars[i - 1].h;
  }
  if (family === 'macd_cross') {
    // MACD line crosses above its signal line from below — momentum turning up,
    // independent of any fixed threshold (unlike RSI<35, it's relative to the
    // trend's own recent behavior).
    if (F.macdLine[i] == null || F.macdSignal[i] == null || F.macdLine[i - 1] == null || F.macdSignal[i - 1] == null) return false;
    return F.macdLine[i - 1] <= F.macdSignal[i - 1] && F.macdLine[i] > F.macdSignal[i];
  }
  if (family === 'round_bounce') {
    // "Human psychology" level: does price bounce off a ROUND number (the level
    // retail limit orders and mental stop-losses cluster at)? Round step scales
    // with the coin's own price magnitude (BTC ~$60k -> nearest $5,000; ETH ~$1.8k
    // -> nearest $100; a $2 coin -> nearest $0.10), recomputed every bar so it
    // tracks price over 2 years, not a fixed level. Fires when the bar's LOW
    // approaches a round level from above (a test of round-number support) and
    // the bar closes back above it as a green candle (the bounce confirmation) —
    // same "wait for confirmation" discipline as meanrev_stab/volume_climax.
    const px = bars[i].c;
    const step = px >= 10000 ? 5000 : px >= 1000 ? 100 : px >= 100 ? 10 : px >= 10 ? 1 : px >= 1 ? 0.1 : px >= 0.1 ? 0.01 : 0.001;
    const level = Math.round(px / step) * step;
    if (!(level > 0)) return false;
    const dist = Math.abs(bars[i].l - level) / px;
    return dist <= p.bandPct && bars[i].c > level && bars[i].c > bars[i].o;
  }
  if (family === 'offgrid_bounce') {
    // CONTROL for round_bounce: identical bounce-confirmation logic, but the
    // reference level is offset to the MIDPOINT between round numbers — same grid
    // density, deliberately NOT round. If round_bounce beats this control, the
    // effect is really about roundness/psychology. If they perform the same, it's
    // just generic support-bounce (already tested elsewhere) wearing a new label.
    const px = bars[i].c;
    const step = px >= 10000 ? 5000 : px >= 1000 ? 100 : px >= 100 ? 10 : px >= 10 ? 1 : px >= 1 ? 0.1 : px >= 0.1 ? 0.01 : 0.001;
    const level = Math.round(px / step) * step - step / 2;
    if (!(level > 0)) return false;
    const dist = Math.abs(bars[i].l - level) / px;
    return dist <= p.bandPct && bars[i].c > level && bars[i].c > bars[i].o;
  }
  if (family === 'volume_climax') {
    // Capitulation-reversal: a volume SPIKE (vs the trailing 20-bar normal) on a
    // fresh local low, with the bar itself closing back above its open — the
    // "smart money absorbed the panic sellers" footprint. Distinct from
    // meanrev_stab's pure % move test: this reacts to an ANOMALOUS participation
    // event, not a fixed price-drop threshold, so it can fire on a slow grind's
    // final flush even when no single day dropped 8%.
    if (i < 21 || F.volZ[i] == null) return false;
    let lo = Infinity; for (let j = i - 20; j < i; j++) lo = Math.min(lo, bars[j].l);
    return F.volZ[i] >= p.zThresh && bars[i].l <= lo && bars[i].c > bars[i].o;
  }
  return false;
}

// Simulate ONE trade entered on signal bar i. Returns the trade plus its
// entry/exit indices, or {skip:true} for a degenerate stop (caller advances by 1).
// This is the SINGLE source of entry/exit truth — runStrategy (trade P&L) and
// positionPath (bar-by-bar exposure) are both built on it, so they can never drift.
function simulateOne(family, p, bars, F, i, to, cost) {
  const entry = bars[i + 1].o * (1 + cost);
  let stopPx, targetPx;
  if (family === 'trend_atr') {
    stopPx = entry - p.atrMult * (F.atr[i] ?? entry * 0.02); targetPx = Infinity; // trailing stop only
  } else if (family === 'vol_squeeze') {
    let lo = Infinity; for (let k = Math.max(0, i - 24); k <= i; k++) lo = Math.min(lo, bars[k].l);
    stopPx = lo * 0.998; targetPx = entry + 2 * (entry - stopPx);
    if (stopPx >= entry) return { skip: true };
  } else if (family === 'meanrev_stab') {
    let lo = Infinity; for (let k = Math.max(0, i - 6); k <= i; k++) lo = Math.min(lo, bars[k].l);
    stopPx = lo * 0.998; targetPx = entry + 2 * (entry - stopPx);                 // structural stop, 2R target
    if (stopPx >= entry) return { skip: true };                                    // degenerate stop → skip
  } else {
    stopPx = entry * (1 - p.stop); targetPx = entry * (1 + p.stop * 2);            // 2R target
  }
  let exitPx = null, bars_held = 0, trailHigh = entry;
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
  exitPx *= (1 - cost);
  return { ret: (exitPx - entry) / entry, bars: bars_held, entryIdx: i, exitIdx: lastJ };
}

export function runStrategy(family, p, bars, F, from, to, cost = 0.001) {
  const trades = [];
  let i = Math.max(from, 200);
  while (i < to - 1) {
    if (!signalAt(family, p, bars, F, i)) { i++; continue; }
    const t = simulateOne(family, p, bars, F, i, to, cost);
    if (t.skip) { i++; continue; }
    trades.push({ ret: t.ret, bars: t.bars });
    i = t.exitIdx + 1;                                             // no overlapping positions
  }
  return trades;
}

// Bar-by-bar LONG exposure (0/1) from the SAME entry/exit logic as runStrategy.
// pos[k] = 1 means the strategy is holding during bar k. Entry is at the open of
// signalBar+1, so a position occupies bars [signalBar+1 .. exitIdx]. Causal:
// pos[k] is fully determined by information at bars <= k-1. The portfolio ledger
// consumes this as a target and applies its OWN fills/costs (no idealized stop
// prices leak into portfolio P&L — that stays the ledger's honest job).
export function positionPath(family, p, bars, F, from, to, cost = 0.001) {
  const pos = new Array(bars.length).fill(0);
  let i = Math.max(from, 200);
  while (i < to - 1) {
    if (!signalAt(family, p, bars, F, i)) { i++; continue; }
    const t = simulateOne(family, p, bars, F, i, to, cost);
    if (t.skip) { i++; continue; }
    for (let k = t.entryIdx + 1; k <= t.exitIdx; k++) pos[k] = 1;
    i = t.exitIdx + 1;
  }
  return pos;
}

export function metrics(trades) {
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
