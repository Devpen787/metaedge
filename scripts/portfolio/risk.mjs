// RISK & VOLATILITY TARGETING (Layer 3). Two levels, both causal:
//   1. RELATIVE sizing (inverse-vol, in construct.mjs): each position sized ∝ 1/σ
//      so a high-vol coin doesn't dominate — equalizes per-position risk IGNORING
//      correlation.
//   2. ABSOLUTE scaling (here): the whole book is scaled by k = targetVol /
//      trailingRealizedPortfolioVol. Because it uses the portfolio's OWN realized
//      returns, it captures correlation empirically — which matters enormously
//      here (all crypto engines are long crypto = highly correlated, so a naive
//      uncorrelated estimate would massively over-lever). This is the honest fix
//      for the "fake diversification" risk.
//
// Plus hard caps (per-instrument aggregate, gross) as a backstop the vol-target
// scalar can never override.

// Causal annualized volatility per bar via EWMA of simple returns.
// out[i] uses returns of bars <= i only; null until minObs returns seen.
export function ewmaVolSeries(bars, { lambda = 0.94, barsPerYear = 8760, minObs = 20 } = {}) {
  const n = bars.length, out = new Array(n).fill(null);
  let variance = null, count = 0;
  for (let i = 1; i < n; i++) {
    const r = bars[i].c / bars[i - 1].c - 1;
    if (!Number.isFinite(r)) continue;
    variance = variance == null ? r * r : lambda * variance + (1 - lambda) * r * r;
    count++;
    if (count >= minObs) out[i] = Math.sqrt(variance * barsPerYear);
  }
  return out;
}

// Portfolio-level vol targeter: feed it the portfolio's realized return each bar;
// ask for the scalar to apply to the whole book. Stateful, causal (scalar() uses
// only returns fed so far). maxLeverage caps k so a quiet stretch can't blow up
// exposure; during warmup it returns 1 (never lever before vol is known).
export function createVolTargeter({ targetVol = 0.10, lambda = 0.94, barsPerYear = 8760, volFloor = 0.02, minObs = 50, maxLeverage = 3 } = {}) {
  let variance = null, count = 0;
  return {
    update(portReturn) {
      if (!Number.isFinite(portReturn)) return;
      variance = variance == null ? portReturn * portReturn : lambda * variance + (1 - lambda) * portReturn * portReturn;
      count++;
    },
    vol() { return variance == null ? null : Math.sqrt(variance * barsPerYear); },
    scalar() {
      if (count < minObs || variance == null) return 1;                 // warmup: no leverage
      const v = Math.max(Math.sqrt(variance * barsPerYear), volFloor);
      return Math.min(maxLeverage, targetVol / v);
    },
  };
}

// Hard caps applied to dollar targets. Order: cap aggregate per-instrument exposure
// (across engines), then cap gross. Both scale legs down proportionally; they never
// scale up. This is the backstop under the vol-target scalar.
export function capExposure(dollarTargets, equity, { maxGross = 1.5, maxPerInstrument = 0.25 } = {}) {
  if (!(equity > 0)) return dollarTargets.map((t) => ({ ...t, targetNotional: 0 }));
  const byInstr = {};
  for (const t of dollarTargets) byInstr[t.instrument] = (byInstr[t.instrument] || 0) + t.targetNotional;
  const instrCap = maxPerInstrument * equity;
  let scaled = dollarTargets.map((t) => {
    const agg = Math.abs(byInstr[t.instrument]);
    const s = agg > instrCap ? instrCap / agg : 1;
    return { ...t, targetNotional: t.targetNotional * s };
  });
  const gross = scaled.reduce((s, t) => s + Math.abs(t.targetNotional), 0);
  const gcap = maxGross * equity;
  const g = gross > gcap ? gcap / gross : 1;
  return scaled.map((t) => ({ ...t, targetNotional: t.targetNotional * g }));
}
