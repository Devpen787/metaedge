import { edgeStatistics, pearsonCorrelation } from './math.js';
import { contentHash } from './store.js';
import type {
  AlphaCandidateSpec, AlphaFamily, AlphaSample, AlphaSplitMetrics, AlphaValidationRecord, FlywheelLane,
} from './flywheel_types.js';
import type { PriceBar } from './types.js';

export interface PriceCandidateGrammarInput {
  lane: Extract<FlywheelLane, 'stocks' | 'spot_crypto' | 'memecoins'>;
  symbols: string[];
  lookbacks: number[];
  horizons: number[];
  roundTripCostBps: number;
}

const CORE_FAMILIES: AlphaFamily[] = [
  'momentum', 'mean_reversion', 'regime_momentum', 'regime_mean_reversion',
  'cross_sectional_momentum', 'cross_sectional_reversal',
];

function familyRule(family: AlphaFamily, lookback: number, horizon: number): string {
  const direction = ['mean_reversion', 'regime_mean_reversion', 'state_transition_reversal', 'cross_sectional_reversal'].includes(family)
    ? 'oppose' : 'follow';
  const regime = family.startsWith('regime_') ? '; only when trailing realized volatility exceeds its prior trailing window' : '';
  const scope = family.startsWith('cross_sectional_') ? '; rank the full point-in-time lane universe and form balanced top/bottom baskets' : '';
  return `${direction} the sign of ${lookback}-bar benchmark-relative return for ${horizon} bars${regime}${scope}`;
}

export function generatePriceCandidateSpecs(input: PriceCandidateGrammarInput): AlphaCandidateSpec[] {
  if (!input.symbols.length) throw new Error('candidate grammar requires symbols');
  if (!input.lookbacks.length || input.lookbacks.some((value) => !Number.isInteger(value) || value < 1)) throw new Error('lookbacks must be positive integers');
  if (!input.horizons.length || input.horizons.some((value) => !Number.isInteger(value) || value < 1)) throw new Error('horizons must be positive integers');
  if (!(input.roundTripCostBps >= 0)) throw new Error('roundTripCostBps must be non-negative');
  const drafts: Omit<AlphaCandidateSpec, 'id' | 'contentHash' | 'declaredTrials'>[] = [];
  const symbols = [...new Set(input.symbols.map((symbol) => symbol.toUpperCase()))].sort();
  for (const lookbackBars of [...new Set(input.lookbacks)].sort((a, b) => a - b)) {
    for (const horizonBars of [...new Set(input.horizons)].sort((a, b) => a - b)) {
      const families = [...CORE_FAMILIES];
      if (lookbackBars === 1) families.push('state_transition_continuation', 'state_transition_reversal');
      for (const family of families) drafts.push({
        lane: input.lane, family, scopeSymbols: symbols, lookbackBars, horizonBars,
        roundTripCostBps: input.roundTripCostBps, targetKind: 'benchmark_relative_return',
        rule: familyRule(family, lookbackBars, horizonBars), liveExecution: 'locked',
      });
    }
  }
  const declaredTrials = drafts.length;
  return drafts.map((draft) => {
    const payload = { ...draft, declaredTrials };
    const hash = contentHash(payload);
    return { ...payload, id: `candidate_${hash.slice(0, 20)}`, contentHash: hash };
  });
}

export function purgedTemporalSplit(samples: AlphaSample[], purgeBars: number): {
  train: AlphaSample[]; validation: AlphaSample[]; holdout: AlphaSample[]; purged: number;
} {
  if (!Number.isInteger(purgeBars) || purgeBars < 0) throw new Error('purgeBars must be a non-negative integer');
  const ordered = [...samples].sort((a, b) => a.enteredAt - b.enteredAt || a.symbol.localeCompare(b.symbol));
  const times = [...new Set(ordered.map((sample) => sample.enteredAt))];
  const validationStart = Math.floor(times.length * 0.6);
  const holdoutStart = Math.floor(times.length * 0.8);
  const trainTimes = new Set(times.slice(0, Math.max(0, validationStart - purgeBars)));
  const validationTimes = new Set(times.slice(validationStart, Math.max(validationStart, holdoutStart - purgeBars)));
  const holdoutTimes = new Set(times.slice(holdoutStart));
  const train = ordered.filter((sample) => trainTimes.has(sample.enteredAt));
  const validation = ordered.filter((sample) => validationTimes.has(sample.enteredAt));
  const holdout = ordered.filter((sample) => holdoutTimes.has(sample.enteredAt));
  return { train, validation, holdout, purged: ordered.length - train.length - validation.length - holdout.length };
}

function calibratedWinProbability(rows: AlphaSample[]): number | null {
  if (!rows.length) return null;
  const wins = rows.filter((row) => row.netReturnBps > 0).length;
  return (wins + 1) / (rows.length + 2);
}

function metrics(rows: AlphaSample[], alpha: number, trials: number, predictedWinProbability: number | null): AlphaSplitMetrics {
  if (!rows.length) return { n: 0, meanGrossReturnBps: null, meanNetReturnBps: null, edgeLowerConfidenceBps: null,
    directionalAccuracy: null, predictedWinProbability, brierScore: null, scoreReturnCorrelation: null, minimumCapacityUsd: null };
  const gross = rows.map((row) => row.grossReturnBps);
  const net = rows.map((row) => row.netReturnBps);
  const outcomes = net.map((value) => value > 0 ? 'upper' as const : 'lower' as const);
  const edge = edgeStatistics(net, outcomes, alpha, trials);
  const capacities = rows.map((row) => row.capacityUsd).filter((value): value is number => value != null && Number.isFinite(value));
  const probability = predictedWinProbability ?? calibratedWinProbability(rows);
  const brier = probability == null ? null : rows.reduce((sum, row) => sum + (probability - (row.netReturnBps > 0 ? 1 : 0)) ** 2, 0) / rows.length;
  return {
    n: rows.length,
    meanGrossReturnBps: gross.reduce((sum, value) => sum + value, 0) / gross.length,
    meanNetReturnBps: edge.meanNetRelativeBps,
    edgeLowerConfidenceBps: edge.edgeLowerConfidenceBps,
    directionalAccuracy: outcomes.filter((value) => value === 'upper').length / rows.length,
    predictedWinProbability: probability,
    brierScore: brier,
    scoreReturnCorrelation: pearsonCorrelation(rows.map((row) => row.score), net),
    minimumCapacityUsd: capacities.length ? Math.min(...capacities) : null,
  };
}

function walkForwardRatio(rows: AlphaSample[], alpha: number, trials: number): number {
  const ordered = [...rows].sort((a, b) => a.enteredAt - b.enteredAt);
  const times = [...new Set(ordered.map((row) => row.enteredAt))];
  if (times.length < 4) return 0;
  let positive = 0;
  for (let fold = 1; fold <= 3; fold++) {
    const start = Math.floor(times.length * fold / 4);
    const end = fold === 3 ? times.length : Math.floor(times.length * (fold + 1) / 4);
    const allowed = new Set(times.slice(start, end));
    const testRows = ordered.filter((row) => allowed.has(row.enteredAt));
    if ((metrics(testRows, alpha, trials, null).edgeLowerConfidenceBps ?? -Infinity) > 0) positive++;
  }
  return positive / 3;
}

export function collapseSimultaneousSamples(samples: AlphaSample[]): AlphaSample[] {
  const grouped = new Map<number, AlphaSample[]>();
  for (const sample of samples) {
    const rows = grouped.get(sample.enteredAt) || [];
    rows.push(sample); grouped.set(sample.enteredAt, rows);
  }
  return [...grouped.entries()].sort(([a], [b]) => a - b).map(([enteredAt, rows]) => {
    if (rows.length === 1) return rows[0];
    const capacities = rows.map((row) => row.capacityUsd).filter((value): value is number => value != null);
    const payload = { enteredAt, sampleIds: rows.map((row) => row.id).sort() };
    return {
      id: `cluster_${contentHash(payload).slice(0, 20)}`,
      symbol: 'TIME_CLUSTER', enteredAt, labelAt: Math.max(...rows.map((row) => row.labelAt)),
      score: rows.reduce((sum, row) => sum + row.score, 0) / rows.length,
      grossReturnBps: rows.reduce((sum, row) => sum + row.grossReturnBps, 0) / rows.length,
      netReturnBps: rows.reduce((sum, row) => sum + row.netReturnBps, 0) / rows.length,
      capacityUsd: capacities.length ? Math.min(...capacities) : null,
    };
  });
}

export function validateAlphaCandidate(
  spec: AlphaCandidateSpec,
  samples: AlphaSample[],
  options: { alpha: number; minimumSplitSamples: number; stressedExtraCostBps: number; requestedNotionalUsd: number },
): AlphaValidationRecord {
  // Assets observed at the same timestamp are one portfolio opportunity, not
  // independent statistical observations. Collapse them before every metric.
  const independentSamples = collapseSimultaneousSamples(samples);
  const split = purgedTemporalSplit(independentSamples, spec.horizonBars);
  const predictedWinProbability = calibratedWinProbability(split.train);
  const train = metrics(split.train, options.alpha, spec.declaredTrials, predictedWinProbability);
  const validation = metrics(split.validation, options.alpha, spec.declaredTrials, predictedWinProbability);
  const holdout = metrics(split.holdout, options.alpha, spec.declaredTrials, predictedWinProbability);
  const stressedRows = split.holdout.map((row) => ({ ...row, netReturnBps: row.netReturnBps - options.stressedExtraCostBps }));
  const stressedHoldoutEdgeLcbBps = metrics(stressedRows, options.alpha, spec.declaredTrials, predictedWinProbability).edgeLowerConfidenceBps;
  const sortedHoldout = split.holdout.map((row) => row.netReturnBps).sort((a, b) => a - b);
  const lowerTail = sortedHoldout.length ? sortedHoldout[Math.floor((sortedHoldout.length - 1) * 0.05)] : null;
  const tailLossBps = lowerTail == null ? null : Math.max(0, -lowerTail);
  const positiveWalkForwardFoldRatio = walkForwardRatio([...split.train, ...split.validation], options.alpha, spec.declaredTrials);
  let disposition: AlphaValidationRecord['disposition'] = 'candidate';
  let reason = 'POST_COST_PURGED_VALIDATION_AND_HOLDOUT_PASSED';
  if (validation.n < options.minimumSplitSamples || holdout.n < options.minimumSplitSamples) {
    disposition = 'blocked'; reason = 'INSUFFICIENT_PURGED_EVALUATION_SAMPLES';
  } else if (!((validation.edgeLowerConfidenceBps ?? -Infinity) > 0)) {
    disposition = 'declined'; reason = 'VALIDATION_EDGE_NOT_POSITIVE';
  } else if (!((holdout.edgeLowerConfidenceBps ?? -Infinity) > 0)) {
    disposition = 'declined'; reason = 'HOLDOUT_EDGE_NOT_POSITIVE';
  } else if (positiveWalkForwardFoldRatio < 2 / 3) {
    disposition = 'declined'; reason = 'WALK_FORWARD_ROBUSTNESS_FAILED';
  } else if (!((stressedHoldoutEdgeLcbBps ?? -Infinity) > 0)) {
    disposition = 'declined'; reason = 'COST_STRESS_FAILED';
  } else if (holdout.minimumCapacityUsd == null || holdout.minimumCapacityUsd < options.requestedNotionalUsd) {
    disposition = 'blocked'; reason = 'CAPACITY_UNMEASURED_OR_INSUFFICIENT';
  }
  const evidenceFingerprint = contentHash({ candidateHash: spec.contentHash,
    sampleIds: independentSamples.map((sample) => sample.id), netReturns: independentSamples.map((sample) => sample.netReturnBps) });
  const payload = { candidateHash: spec.contentHash, evidenceFingerprint, purgeBars: spec.horizonBars,
    train, validation, holdout, stressedHoldoutEdgeLcbBps, positiveWalkForwardFoldRatio, tailLossBps, disposition, reason };
  const id = `validation_${contentHash(payload).slice(0, 20)}`;
  return { id, candidateId: spec.id, candidateHash: spec.contentHash, evidenceFingerprint, createdAt: Date.now(),
    purgeBars: spec.horizonBars, train, validation, holdout, stressedHoldoutEdgeLcbBps,
    positiveWalkForwardFoldRatio, tailLossBps, disposition, reason, liveExecution: 'locked' };
}

export type PriceSeriesMap = Map<string, { asset: PriceBar[]; benchmark: PriceBar[] }>;

function relativeReturnBps(assetStart: number, assetEnd: number, benchmarkStart: number, benchmarkEnd: number): number {
  if (!(assetStart > 0 && assetEnd > 0 && benchmarkStart > 0 && benchmarkEnd > 0)) return NaN;
  return (((assetEnd / assetStart) - 1) - ((benchmarkEnd / benchmarkStart) - 1)) * 10_000;
}

function estimatedCapacityUsd(bar: PriceBar): number | null {
  const quoteVolume = bar.qv ?? bar.v * bar.c;
  return Number.isFinite(quoteVolume) && quoteVolume > 0 ? quoteVolume * 0.0005 : null;
}

function isReversalFamily(family: AlphaFamily): boolean {
  return family === 'mean_reversion' || family === 'regime_mean_reversion' || family === 'state_transition_reversal';
}

function rawSymbolSamples(spec: AlphaCandidateSpec, symbol: string, rows: { asset: PriceBar[]; benchmark: PriceBar[] }): AlphaSample[] {
  const count = Math.min(rows.asset.length, rows.benchmark.length);
  const oneBarAbs = new Array<number>(count).fill(0);
  const prefix = new Array<number>(count + 1).fill(0);
  for (let i = 1; i < count; i++) {
    const value = relativeReturnBps(rows.asset[i - 1].c, rows.asset[i].c, rows.benchmark[i - 1].c, rows.benchmark[i].c);
    oneBarAbs[i] = Number.isFinite(value) ? Math.abs(value) : 0;
    prefix[i + 1] = prefix[i] + oneBarAbs[i];
  }
  const regimeFamily = spec.family === 'regime_momentum' || spec.family === 'regime_mean_reversion';
  const regimeWindow = Math.max(10, spec.lookbackBars * 2);
  const start = Math.max(spec.lookbackBars, regimeFamily ? regimeWindow * 2 : spec.lookbackBars);
  const samples: AlphaSample[] = [];
  for (let i = start; i + spec.horizonBars < count; i += spec.horizonBars) {
    if (regimeFamily) {
      const recent = prefix[i + 1] - prefix[i + 1 - regimeWindow];
      const prior = prefix[i + 1 - regimeWindow] - prefix[i + 1 - regimeWindow * 2];
      if (!(recent > prior)) continue;
    }
    const signal = relativeReturnBps(rows.asset[i - spec.lookbackBars].c, rows.asset[i].c,
      rows.benchmark[i - spec.lookbackBars].c, rows.benchmark[i].c);
    if (!Number.isFinite(signal) || Math.abs(signal) < 1e-9) continue;
    const direction = (signal > 0 ? 1 : -1) * (isReversalFamily(spec.family) ? -1 : 1);
    const futureRelative = relativeReturnBps(rows.asset[i].c, rows.asset[i + spec.horizonBars].c,
      rows.benchmark[i].c, rows.benchmark[i + spec.horizonBars].c);
    if (!Number.isFinite(futureRelative)) continue;
    const grossReturnBps = direction * futureRelative;
    const payload = { candidate: spec.contentHash, symbol, enteredAt: rows.asset[i].t, labelAt: rows.asset[i + spec.horizonBars].t };
    samples.push({ id: `sample_${contentHash(payload).slice(0, 20)}`, symbol, enteredAt: rows.asset[i].t,
      labelAt: rows.asset[i + spec.horizonBars].t, score: Math.abs(signal), grossReturnBps,
      netReturnBps: grossReturnBps - spec.roundTripCostBps, capacityUsd: estimatedCapacityUsd(rows.asset[i]) });
  }
  return samples;
}

function crossSectionalSamples(spec: AlphaCandidateSpec, series: PriceSeriesMap): AlphaSample[] {
  const observations = new Map<number, Array<{ symbol: string; signal: number; futureRelative: number; labelAt: number; capacityUsd: number | null }>>();
  for (const symbol of spec.scopeSymbols) {
    const rows = series.get(symbol); if (!rows) continue;
    const count = Math.min(rows.asset.length, rows.benchmark.length);
    for (let i = spec.lookbackBars; i + spec.horizonBars < count; i += spec.horizonBars) {
      const signal = relativeReturnBps(rows.asset[i - spec.lookbackBars].c, rows.asset[i].c,
        rows.benchmark[i - spec.lookbackBars].c, rows.benchmark[i].c);
      const futureRelative = relativeReturnBps(rows.asset[i].c, rows.asset[i + spec.horizonBars].c,
        rows.benchmark[i].c, rows.benchmark[i + spec.horizonBars].c);
      if (!Number.isFinite(signal) || !Number.isFinite(futureRelative)) continue;
      const bucket = observations.get(rows.asset[i].t) || [];
      bucket.push({ symbol, signal, futureRelative, labelAt: rows.asset[i + spec.horizonBars].t, capacityUsd: estimatedCapacityUsd(rows.asset[i]) });
      observations.set(rows.asset[i].t, bucket);
    }
  }
  const samples: AlphaSample[] = [];
  for (const [enteredAt, rows] of [...observations.entries()].sort(([a], [b]) => a - b)) {
    if (rows.length < 4) continue;
    rows.sort((a, b) => a.signal - b.signal);
    const count = Math.max(1, Math.floor(rows.length / 4));
    const selected = [...rows.slice(0, count).map((row) => ({ row, rankDirection: -1 })),
      ...rows.slice(-count).map((row) => ({ row, rankDirection: 1 }))];
    const reversal = spec.family === 'cross_sectional_reversal';
    const grossReturnBps = selected.reduce((sum, item) => sum + item.row.futureRelative * item.rankDirection * (reversal ? -1 : 1), 0) / selected.length;
    const capacities = selected.map((item) => item.row.capacityUsd).filter((value): value is number => value != null);
    const labelAt = Math.max(...selected.map((item) => item.row.labelAt));
    const payload = { candidate: spec.contentHash, enteredAt, labelAt, symbols: selected.map((item) => item.row.symbol) };
    samples.push({ id: `sample_${contentHash(payload).slice(0, 20)}`, symbol: 'CROSS_SECTION', enteredAt, labelAt,
      score: selected.reduce((sum, item) => sum + Math.abs(item.row.signal), 0) / selected.length,
      grossReturnBps, netReturnBps: grossReturnBps - spec.roundTripCostBps,
      capacityUsd: capacities.length ? Math.min(...capacities) : null });
  }
  return samples;
}

export function buildPriceAlphaSamples(spec: AlphaCandidateSpec, series: PriceSeriesMap): AlphaSample[] {
  if (spec.targetKind !== 'benchmark_relative_return') throw new Error('price alpha samples require benchmark-relative target');
  if (spec.family === 'cross_sectional_momentum' || spec.family === 'cross_sectional_reversal') {
    return crossSectionalSamples(spec, series);
  }
  return spec.scopeSymbols.flatMap((symbol) => {
    const rows = series.get(symbol);
    return rows ? rawSymbolSamples(spec, symbol, rows) : [];
  }).sort((a, b) => a.enteredAt - b.enteredAt || a.symbol.localeCompare(b.symbol));
}
