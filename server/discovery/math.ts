import type { EdgeStatistics, PriceBar, UpswingLabel } from './types.js';

export interface BarrierContract {
  horizonBars: number;
  upperBarrierBps: number;
  lowerBarrierBps: number;
  roundTripCostBps: number;
}

export function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function netBenchmarkRelativeReturnBps(
  entry: number,
  exit: number,
  benchmarkEntry: number,
  benchmarkExit: number,
  roundTripCostBps: number,
): number {
  for (const [name, value] of Object.entries({ entry, exit, benchmarkEntry, benchmarkExit })) {
    if (!finiteNumber(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
  }
  if (!finiteNumber(roundTripCostBps) || roundTripCostBps < 0) {
    throw new Error('roundTripCostBps must be finite and non-negative');
  }
  return (((exit / entry) - 1) - ((benchmarkExit / benchmarkEntry) - 1)) * 10_000 - roundTripCostBps;
}

// Close-to-close barriers are deliberate: daily and hourly public bars cannot
// prove the ordering of an intrabar high and low. We refuse to invent that path.
export function labelUpswing(
  assetBars: PriceBar[],
  benchmarkBars: PriceBar[],
  entryIndex: number,
  contract: BarrierContract,
): UpswingLabel {
  if (!Number.isInteger(entryIndex) || entryIndex < 0) throw new Error('entryIndex must be a non-negative integer');
  if (!Number.isInteger(contract.horizonBars) || contract.horizonBars < 1) throw new Error('horizonBars must be positive');
  if (!(contract.upperBarrierBps > 0) || !(contract.lowerBarrierBps < 0)) {
    throw new Error('barriers must straddle zero');
  }
  const aligned = Math.min(assetBars.length, benchmarkBars.length);
  if (entryIndex >= aligned) throw new Error('entryIndex outside aligned series');
  const entry = assetBars[entryIndex].c;
  const benchmarkEntry = benchmarkBars[entryIndex].c;
  const end = Math.min(aligned - 1, entryIndex + contract.horizonBars);
  let lastReturn: number | null = null;

  for (let i = entryIndex + 1; i <= end; i++) {
    lastReturn = netBenchmarkRelativeReturnBps(
      entry, assetBars[i].c, benchmarkEntry, benchmarkBars[i].c, contract.roundTripCostBps,
    );
    if (lastReturn <= contract.lowerBarrierBps) {
      return { outcome: 'lower', horizonBars: contract.horizonBars, barsObserved: i - entryIndex,
        upperBarrierBps: contract.upperBarrierBps, lowerBarrierBps: contract.lowerBarrierBps,
        roundTripCostBps: contract.roundTripCostBps, realizedNetRelativeBps: lastReturn, hitAt: assetBars[i].t };
    }
    if (lastReturn >= contract.upperBarrierBps) {
      return { outcome: 'upper', horizonBars: contract.horizonBars, barsObserved: i - entryIndex,
        upperBarrierBps: contract.upperBarrierBps, lowerBarrierBps: contract.lowerBarrierBps,
        roundTripCostBps: contract.roundTripCostBps, realizedNetRelativeBps: lastReturn, hitAt: assetBars[i].t };
    }
  }
  const complete = entryIndex + contract.horizonBars < aligned;
  return {
    outcome: complete ? 'timeout' : 'unresolved', horizonBars: contract.horizonBars,
    barsObserved: Math.max(0, end - entryIndex), upperBarrierBps: contract.upperBarrierBps,
    lowerBarrierBps: contract.lowerBarrierBps, roundTripCostBps: contract.roundTripCostBps,
    realizedNetRelativeBps: lastReturn,
  };
}

// Peter J. Acklam's rational approximation. Accurate within the 3e-8 absolute
// tolerance used by the golden vectors for the probability range used here.
export function inverseStandardNormal(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error('p must be in (0,1)');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function edgeStatistics(
  valuesBps: number[],
  outcomes: Array<UpswingLabel['outcome']>,
  alpha = 0.05,
  multipleTestingTrials = 1,
): EdgeStatistics {
  if (!(alpha > 0 && alpha < 0.5)) throw new Error('alpha must be in (0,0.5)');
  if (!Number.isInteger(multipleTestingTrials) || multipleTestingTrials < 1) throw new Error('multipleTestingTrials must be positive');
  const values = valuesBps.filter(finiteNumber);
  const n = values.length;
  if (n === 0) return { n: 0, meanNetRelativeBps: null, sampleStdBps: null, standardErrorBps: null,
    oneSidedCriticalZ: null, edgeLowerConfidenceBps: null, winRate: null, alpha, multipleTestingTrials };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const wins = outcomes.filter((o) => o === 'upper').length;
  if (n < 2) return { n, meanNetRelativeBps: mean, sampleStdBps: null, standardErrorBps: null,
    oneSidedCriticalZ: null, edgeLowerConfidenceBps: null, winRate: wins / n, alpha, multipleTestingTrials };
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const se = std / Math.sqrt(n);
  const z = inverseStandardNormal(1 - alpha / multipleTestingTrials);
  return { n, meanNetRelativeBps: mean, sampleStdBps: std, standardErrorBps: se,
    oneSidedCriticalZ: z, edgeLowerConfidenceBps: mean - z * se,
    winRate: wins / n, alpha, multipleTestingTrials };
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return null;
  const x = xs.slice(0, n); const y = ys.slice(0, n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0; let vx = 0; let vy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx; const dy = y[i] - my; cov += dx * dy; vx += dx * dx; vy += dy * dy; }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

export function correlationPUpperBound(r: number, n: number): number {
  if (!finiteNumber(r) || n < 4) return 1;
  const clipped = Math.max(-0.999999, Math.min(0.999999, r));
  const z = Math.abs(0.5 * Math.log((1 + clipped) / (1 - clipped)) * Math.sqrt(n - 3));
  // Conservative two-sided normal tail upper bound via the Chernoff bound.
  return Math.min(1, 2 * Math.exp(-(z * z) / 2));
}
