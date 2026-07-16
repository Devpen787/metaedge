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
import { simpleMovingAverageSeries, wilderRsiSeries } from '../../server/feature_math.mjs';

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
  return { rsi, atr, volR, sma200: sma(200), sma72: sma(72), sma168: sma(168), atrRank, rollMax24: rollMax(24), rollMax72: rollMax(72), rollMax168: rollMax(168) };
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
  return false;
}

export function runStrategy(family, p, bars, F, from, to, cost = 0.001) {
  const trades = [];
  let i = Math.max(from, 200);
  while (i < to - 1) {
    if (!signalAt(family, p, bars, F, i)) { i++; continue; }
    const entry = bars[i + 1].o * (1 + cost);
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
    exitPx *= (1 - cost);
    trades.push({ ret: (exitPx - entry) / entry, bars: bars_held });
    i = lastJ + 1;                                                   // no overlapping positions
  }
  return trades;
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
