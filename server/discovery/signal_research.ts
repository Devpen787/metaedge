import { edgeStatistics, pearsonCorrelation } from './math.js';
import { contentHash } from './store.js';
import type {
  EventStudyResult, InformationHorizonPoint, ParameterPlateau, ParameterSurfacePoint, SignalInputPoint,
  SignalNormalization, SignalPoint, SignalResearchArtifact, SignalResearchChoice, SignalTransformSpec, TrafficTransition,
} from './signal_types.js';

export const SIGNAL_RESEARCH_POLICY_VERSION = 'signal-research-policy-v2';

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}
function sampleStd(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

export function makeSignalTransformSpec(input: Omit<SignalTransformSpec, 'id' | 'schemaVersion' | 'liveExecution'>): SignalTransformSpec {
  if (!Number.isInteger(input.normalizationWindow) || input.normalizationWindow < 5) throw new Error('SIGNAL_NORMALIZATION_WINDOW_INVALID');
  if (!Number.isInteger(input.residualWindow) || input.residualWindow < 5) throw new Error('SIGNAL_RESIDUAL_WINDOW_INVALID');
  if (!(input.smoothingAlpha > 0 && input.smoothingAlpha <= 1)) throw new Error('SIGNAL_SMOOTHING_ALPHA_INVALID');
  if (!Number.isInteger(input.calibrationBins) || input.calibrationBins < 2) throw new Error('SIGNAL_CALIBRATION_BINS_INVALID');
  if (!Number.isInteger(input.declaredTrials) || input.declaredTrials < 1) throw new Error('SIGNAL_DECLARED_TRIALS_INVALID');
  const base = { schemaVersion: 1 as const, ...input, liveExecution: 'locked' as const };
  return { id: `signal_transform_${contentHash(base).slice(0, 20)}`, ...base };
}

function rollingResiduals(input: SignalInputPoint[], window: number): Array<number | null> {
  return input.map((point, index) => {
    if (index < window) return null;
    const history = input.slice(index - window, index);
    const xs = history.map((row) => row.benchmarkReturnBps);
    const ys = history.map((row) => row.assetReturnBps);
    const xMean = mean(xs); const yMean = mean(ys);
    const variance = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
    const beta = variance > 1e-12
      ? xs.reduce((sum, value, offset) => sum + (value - xMean) * (ys[offset] - yMean), 0) / variance : 0;
    const alpha = yMean - beta * xMean;
    return point.assetReturnBps - (alpha + beta * point.benchmarkReturnBps);
  });
}

function causalNormalize(values: Array<number | null>, window: number, kind: SignalNormalization): Array<number | null> {
  return values.map((value, index) => {
    if (value == null) return null;
    const history = values.slice(Math.max(0, index - window), index).filter((item): item is number => item != null && Number.isFinite(item));
    if (history.length < window) return null;
    if (kind === 'causal_zscore') {
      const deviation = sampleStd(history);
      return deviation > 1e-12 ? (value - mean(history)) / deviation : 0;
    }
    const center = median(history);
    const mad = median(history.map((item) => Math.abs(item - center)));
    return mad > 1e-12 ? (value - center) / (1.4826 * mad) : 0;
  });
}

function ema(values: Array<number | null>, alpha: number): Array<number | null> {
  let prior: number | null = null;
  return values.map((value) => {
    if (value == null) return null;
    prior = prior == null ? value : alpha * value + (1 - alpha) * prior;
    return prior;
  });
}

function futureRelativeReturns(input: SignalInputPoint[], horizon: number): Array<number | null> {
  const relative = input.map((row) => row.assetReturnBps - row.benchmarkReturnBps);
  const prefix = [0];
  for (const value of relative) prefix.push(prefix[prefix.length - 1] + value);
  return input.map((_row, index) => index + horizon < input.length ? prefix[index + horizon + 1] - prefix[index + 1] : null);
}

function assignCalibration(points: SignalPoint[], future: Array<number | null>, bins: number, trainEnd: number): SignalPoint[] {
  const training = points.slice(0, trainEnd).map((point, index) => ({ score: point.smoothed, outcome: future[index] }))
    .filter((row): row is { score: number; outcome: number } => row.score != null && row.outcome != null);
  if (training.length < bins * 3) return points;
  const orderedScores = training.map((row) => row.score).sort((a, b) => a - b);
  const thresholds = Array.from({ length: bins - 1 }, (_, index) =>
    orderedScores[Math.min(orderedScores.length - 1, Math.floor(orderedScores.length * (index + 1) / bins))]);
  const binFor = (score: number) => thresholds.findIndex((threshold) => score <= threshold) < 0
    ? bins - 1 : thresholds.findIndex((threshold) => score <= threshold);
  const counts = Array.from({ length: bins }, () => ({ n: 0, wins: 0 }));
  for (const row of training) {
    const bucket = counts[binFor(row.score)]; bucket.n++; if (row.outcome > 0) bucket.wins++;
  }
  return points.map((point) => point.smoothed == null ? point : {
    ...point,
    calibratedProbability: (counts[binFor(point.smoothed)].wins + 1) / (counts[binFor(point.smoothed)].n + 2),
  });
}

export function compileSignalPoints(input: SignalInputPoint[], spec: SignalTransformSpec, calibrationHorizon: number): SignalPoint[] {
  const ordered = [...input].sort((left, right) => left.availableAt - right.availableAt || left.at - right.at);
  if (ordered.some((row, index) => index > 0 && row.availableAt < ordered[index - 1].availableAt)) throw new Error('SIGNAL_INPUT_NOT_CAUSAL');
  const residuals = rollingResiduals(ordered, spec.residualWindow);
  const normalized = causalNormalize(residuals, spec.normalizationWindow, spec.normalization);
  const smoothed = ema(normalized, spec.smoothingAlpha);
  const points = ordered.map((row, index): SignalPoint => ({ ...row, residualized: residuals[index], normalized: normalized[index],
    smoothed: smoothed[index], calibratedProbability: null }));
  return assignCalibration(points, futureRelativeReturns(ordered, calibrationHorizon), spec.calibrationBins, Math.floor(points.length * 0.6));
}

function splitBounds(length: number, split: EventStudyResult['split']): [number, number] {
  const trainEnd = Math.floor(length * 0.6); const validationEnd = Math.floor(length * 0.8);
  if (split === 'training') return [0, trainEnd];
  if (split === 'validation') return [trainEnd, validationEnd];
  return [validationEnd, length];
}

export function buildEventStudies(points: SignalPoint[], input: SignalInputPoint[], horizons: number[], threshold: number,
  declaredTrials: number, orientation: SignalTransformSpec['orientation'] = 'follow'): EventStudyResult[] {
  return (['training', 'validation', 'holdout'] as const).flatMap((split) => horizons.flatMap((horizonBars) => {
    const future = futureRelativeReturns(input, horizonBars);
    const [start, end] = splitBounds(points.length, split);
    return (['positive', 'negative'] as const).map((direction): EventStudyResult => {
      const returns: number[] = [];
      let lastEvent = -Infinity;
      for (let index = Math.max(start, 1); index < end; index++) {
        const score = points[index].smoothed; const prior = points[index - 1].smoothed;
        if (score == null || prior == null || future[index] == null || index < lastEvent + horizonBars) continue;
        const crossed = direction === 'positive' ? score >= threshold && prior < threshold : score <= -threshold && prior > -threshold;
        if (!crossed) continue;
        const signalDirection = direction === 'positive' ? 1 : -1;
        const orientationDirection = orientation === 'follow' ? 1 : -1;
        returns.push(signalDirection * orientationDirection * (future[index] as number)); lastEvent = index;
      }
      const stats = edgeStatistics(returns, returns.map((value) => value > 0 ? 'upper' : 'lower'), 0.05, declaredTrials);
      return { split, horizonBars, threshold, direction, events: returns.length,
        meanRelativeReturnBps: returns.length ? mean(returns) : null,
        medianRelativeReturnBps: returns.length ? median(returns) : null,
        winRate: returns.length ? returns.filter((value) => value > 0).length / returns.length : null,
        edgeLowerConfidenceBps: stats.edgeLowerConfidenceBps };
    });
  }));
}

export function buildInformationHorizon(points: SignalPoint[], input: SignalInputPoint[], horizons: number[]): InformationHorizonPoint[] {
  const trainEnd = Math.floor(points.length * 0.6);
  return horizons.map((horizonBars) => {
    const future = futureRelativeReturns(input, horizonBars);
    const rows = points.slice(0, trainEnd).map((point, index) => ({ signal: point.smoothed, future: future[index] }))
      .filter((row): row is { signal: number; future: number } => row.signal != null && row.future != null);
    return { split: 'training', horizonBars, samples: rows.length,
      signalReturnCorrelation: pearsonCorrelation(rows.map((row) => row.signal), rows.map((row) => row.future)),
      meanAbsoluteSignal: rows.length ? mean(rows.map((row) => Math.abs(row.signal))) : null };
  });
}

function trafficState(probability: number): TrafficTransition['from'] {
  return probability >= 0.6 ? 'bullish' : probability <= 0.4 ? 'bearish' : 'neutral';
}

export function buildTraffic(points: SignalPoint[], input: SignalInputPoint[], horizonBars: number): TrafficTransition[] {
  const future = futureRelativeReturns(input, horizonBars);
  const cells = new Map<string, { from: TrafficTransition['from']; to: TrafficTransition['to']; returns: number[] }>();
  const originCounts = new Map<TrafficTransition['from'], number>();
  for (let index = 0; index + 1 < points.length; index++) {
    const current = points[index].calibratedProbability; const next = points[index + 1].calibratedProbability;
    if (current == null || next == null || future[index] == null) continue;
    const from = trafficState(current); const to = trafficState(next); const key = `${from}:${to}`;
    const cell = cells.get(key) ?? { from, to, returns: [] }; cell.returns.push(future[index] as number); cells.set(key, cell);
    originCounts.set(from, (originCounts.get(from) ?? 0) + 1);
  }
  return [...cells.values()].sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)).map((cell) => ({
    from: cell.from, to: cell.to, support: cell.returns.length,
    probability: cell.returns.length / (originCounts.get(cell.from) ?? cell.returns.length),
    meanNextRelativeReturnBps: cell.returns.length ? mean(cell.returns) : null,
  }));
}

function surfacePoint(input: SignalInputPoint[], normalization: SignalNormalization, normalizationWindow: number,
  smoothingAlpha: number, eventThreshold: number, horizonBars: number, trialCount: number): ParameterSurfacePoint {
  const spec = makeSignalTransformSpec({ normalization, normalizationWindow, smoothing: 'ema', smoothingAlpha,
    residualization: 'rolling_ols_beta', residualWindow: normalizationWindow, calibration: 'training_quantile_laplace',
    calibrationBins: 5, orientation: 'follow', declaredTrials: trialCount });
  const points = compileSignalPoints(input, spec, horizonBars);
  const future = futureRelativeReturns(input, horizonBars);
  const trainEnd = Math.floor(points.length * 0.6);
  const rows = points.slice(0, trainEnd).map((point, index) => ({ signal: point.smoothed, future: future[index] }))
    .filter((row): row is { signal: number; future: number } => row.signal != null && row.future != null && Math.abs(row.signal) >= eventThreshold);
  return { normalizationWindow, smoothingAlpha, eventThreshold, samples: rows.length,
    trainingScore: rows.length >= 20 ? pearsonCorrelation(rows.map((row) => row.signal), rows.map((row) => row.future)) : null };
}

export function buildParameterSurface(input: SignalInputPoint[], grid: { normalization: SignalNormalization;
  normalizationWindows: number[]; smoothingAlphas: number[]; eventThresholds: number[]; horizonBars: number;
  toleranceFraction?: number }): { points: ParameterSurfacePoint[]; plateau: ParameterPlateau } {
  const windows = [...new Set(grid.normalizationWindows)].sort((a, b) => a - b);
  const alphas = [...new Set(grid.smoothingAlphas)].sort((a, b) => a - b);
  const thresholds = [...new Set(grid.eventThresholds)].sort((a, b) => a - b);
  const trialCount = windows.length * alphas.length * thresholds.length;
  const points = windows.flatMap((normalizationWindow) => alphas.flatMap((smoothingAlpha) => thresholds.map((eventThreshold) =>
    surfacePoint(input, grid.normalization, normalizationWindow, smoothingAlpha, eventThreshold, grid.horizonBars, trialCount))));
  const scored = points.filter((point): point is ParameterSurfacePoint & { trainingScore: number } => point.trainingScore != null);
  const toleranceFraction = grid.toleranceFraction ?? 0.15;
  const bestPoint = [...scored].sort((left, right) => Math.abs(right.trainingScore) - Math.abs(left.trainingScore))[0] ?? null;
  const nearBestPoints = bestPoint ? scored.filter((point) => Math.abs(point.trainingScore) >= Math.abs(bestPoint.trainingScore) * (1 - toleranceFraction)) : [];
  const adjacent = bestPoint ? nearBestPoints.filter((point) => {
    const windowDistance = Math.abs(windows.indexOf(point.normalizationWindow) - windows.indexOf(bestPoint.normalizationWindow));
    const alphaDistance = Math.abs(alphas.indexOf(point.smoothingAlpha) - alphas.indexOf(bestPoint.smoothingAlpha));
    const thresholdDistance = Math.abs(thresholds.indexOf(point.eventThreshold) - thresholds.indexOf(bestPoint.eventThreshold));
    return windowDistance + alphaDistance + thresholdDistance === 1;
  }).length : 0;
  const plateauFraction = points.length ? nearBestPoints.length / points.length : 0;
  const robust = nearBestPoints.length >= 3 && adjacent >= 2 && plateauFraction >= 0.2;
  return { points, plateau: { bestPoint, nearBestPoints, plateauFraction, adjacentNearBestPoints: adjacent,
    toleranceFraction, robust, reason: robust ? 'NEAR_BEST_REGION_HAS_LOCAL_PLATEAU' : 'BEST_PARAMETER_IS_ISOLATED_OR_SURFACE_TOO_SPARSE' } };
}

export function buildSignalResearchArtifact(input: {
  datasetVersionId: string; universeVersionId: string; worldContractId: string;
  lane: SignalResearchArtifact['lane']; symbol: string; benchmark: string; points: SignalInputPoint[];
  normalization: SignalNormalization; normalizationWindows: number[]; smoothingAlphas: number[];
  eventThresholds: number[]; horizons: number[]; historicalResearchEligible: boolean; paperForwardEligible: boolean;
  blockers: string[]; createdAt?: number;
}): SignalResearchArtifact {
  if (!input.horizons.length) throw new Error('SIGNAL_HORIZONS_EMPTY');
  const surface = buildParameterSurface(input.points, { normalization: input.normalization,
    normalizationWindows: input.normalizationWindows, smoothingAlphas: input.smoothingAlphas,
    eventThresholds: input.eventThresholds, horizonBars: input.horizons[0] });
  const selected = surface.plateau.bestPoint ?? surface.points[0];
  if (!selected) throw new Error('SIGNAL_PARAMETER_SURFACE_EMPTY');
  const choiceDrafts: Array<Omit<SignalResearchChoice, 'id'>> = [
    { category: 'parameter_surface', description: `${surface.points.length} normalization-window/smoothing/threshold combinations`,
      actor: 'automated', trialCost: surface.points.length },
    { category: 'normalization_family', description: input.normalization, actor: 'manual_precommit', trialCost: 1 },
    { category: 'residualization', description: 'rolling_ols_beta', actor: 'manual_precommit', trialCost: 1 },
    { category: 'calibration', description: 'training_quantile_laplace:5_bins', actor: 'manual_precommit', trialCost: 1 },
    { category: 'horizon_set', description: input.horizons.join(','), actor: 'manual_precommit', trialCost: input.horizons.length },
    { category: 'orientation', description: 'training_correlation_sign', actor: 'automated', trialCost: 1 },
  ];
  const researchChoices = choiceDrafts.map((choice) => ({ id: `research_choice_${contentHash(choice).slice(0, 20)}`, ...choice }));
  const totalDeclaredTrials = researchChoices.reduce((sum, choice) => sum + choice.trialCost, 0);
  const transform = makeSignalTransformSpec({ normalization: input.normalization,
    normalizationWindow: selected.normalizationWindow, smoothing: 'ema', smoothingAlpha: selected.smoothingAlpha,
    residualization: 'rolling_ols_beta', residualWindow: selected.normalizationWindow,
    calibration: 'training_quantile_laplace', calibrationBins: 5,
    orientation: (selected.trainingScore ?? 0) < 0 ? 'invert' : 'follow', declaredTrials: totalDeclaredTrials });
  const points = compileSignalPoints(input.points, transform, input.horizons[0]);
  const eventStudies = buildEventStudies(points, input.points, input.horizons, selected.eventThreshold,
    totalDeclaredTrials, transform.orientation);
  const informationHorizon = buildInformationHorizon(points, input.points, input.horizons);
  const traffic = buildTraffic(points, input.points, input.horizons[0]);
  const blockers = [...new Set(input.blockers)].sort();
  const qualifyingHoldout = eventStudies.filter((study) => study.split === 'holdout' && study.events >= 20
    && (study.edgeLowerConfidenceBps ?? -Infinity) > 0);
  const hasScoredHoldout = eventStudies.some((study) => study.split === 'holdout' && study.events >= 20);
  const methodDisposition = !hasScoredHoldout ? 'insufficient' : surface.plateau.robust && qualifyingHoldout.length
    ? 'promising' : 'rejected';
  const promotionDisposition = !input.historicalResearchEligible ? 'blocked'
    : methodDisposition === 'promising' ? 'forward_candidate' : 'declined';
  const decisionReasons = [...new Set([
    ...(!input.historicalResearchEligible ? ['HISTORICAL_RESEARCH_NOT_ELIGIBLE'] : []),
    ...(!surface.plateau.robust ? ['PARAMETER_PLATEAU_NOT_ROBUST'] : []),
    ...(!hasScoredHoldout ? ['HOLDOUT_EVENT_SUPPORT_BELOW_20']
      : qualifyingHoldout.length ? [] : ['HOLDOUT_EDGE_LOWER_CONFIDENCE_NOT_POSITIVE']),
  ])];
  const identity = { researchPolicyVersion: SIGNAL_RESEARCH_POLICY_VERSION,
    datasetVersionId: input.datasetVersionId, universeVersionId: input.universeVersionId,
    worldContractId: input.worldContractId, lane: input.lane, symbol: input.symbol, benchmark: input.benchmark,
    transformId: transform.id, researchChoices, sourceEventIds: input.points.flatMap((point) => point.sourceEventIds),
    eventStudies, informationHorizon, traffic, parameterSurface: surface.points, plateau: surface.plateau,
    methodDisposition, promotionDisposition, decisionReasons,
    historicalResearchEligible: input.historicalResearchEligible, paperForwardEligible: input.paperForwardEligible, blockers };
  return { id: `signal_artifact_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    researchPolicyVersion: SIGNAL_RESEARCH_POLICY_VERSION,
    createdAt: input.createdAt ?? Date.now(), datasetVersionId: input.datasetVersionId,
    universeVersionId: input.universeVersionId, worldContractId: input.worldContractId, lane: input.lane,
    symbol: input.symbol, benchmark: input.benchmark, transform, researchChoices, points, eventStudies, informationHorizon,
    traffic, parameterSurface: surface.points, plateau: surface.plateau,
    methodDisposition, promotionDisposition, decisionReasons,
    historicalResearchEligible: input.historicalResearchEligible, paperForwardEligible: input.paperForwardEligible,
    blockers, liveExecution: 'locked' };
}
