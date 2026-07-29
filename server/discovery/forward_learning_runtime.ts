import { edgeStatistics, finiteNumber } from './math.js';
import { contentHash } from './store.js';
import type {
  DatasetDriftAssessment, DriftFeatureAssessment, ForwardAttributionRecord, ForwardEvidenceObservation,
  ForwardLifecycleDecision, ForwardResearchQueueItem,
} from './forward_learning_types.js';
import type { ForwardQuarantineEnrollment, LockboxEvaluation } from './validation_types.js';

export const FORWARD_LEARNING_POLICY_VERSION = 'forward-learning-policy-v1';

type ObservationInput = Omit<ForwardEvidenceObservation, 'id' | 'schemaVersion' | 'forwardLearningPolicyVersion'
  | 'immutable' | 'liveExecution'>;

function assertFiniteRecord(label: string, record: Record<string, number>): void {
  for (const [key, value] of Object.entries(record)) if (!finiteNumber(value)) throw new Error(`${label}_NON_FINITE:${key}`);
}

export function makeForwardEvidenceObservation(input: ObservationInput): ForwardEvidenceObservation {
  if (!(input.observedAt > input.evidenceCutoffAt)) throw new Error('FORWARD_OBSERVATION_NOT_AFTER_EVIDENCE_CUTOFF');
  if (!(input.resolvedAt >= input.observedAt)) throw new Error('FORWARD_RESOLUTION_BEFORE_OBSERVATION');
  if (!Number.isInteger(input.horizonBars) || input.horizonBars < 1) throw new Error('FORWARD_HORIZON_INVALID');
  if (!input.sourceEventIds.length) throw new Error('FORWARD_SOURCE_EVENTS_REQUIRED');
  if (new Set(input.sourceEventIds).size !== input.sourceEventIds.length) throw new Error('FORWARD_SOURCE_EVENTS_DUPLICATED');
  if (!input.lockboxEvaluationId || !input.quarantineEnrollmentId || !input.signalArtifactId) {
    throw new Error('FORWARD_ADMISSION_LINEAGE_REQUIRED');
  }
  assertFiniteRecord('FORWARD_FACTOR_RETURN', input.factorReturnsBps);
  assertFiniteRecord('FORWARD_FACTOR_BETA', input.factorBetas);
  assertFiniteRecord('FORWARD_COST', { ...input.costs });
  assertFiniteRecord('FORWARD_EXECUTION', {
    impactBps: input.execution.impactBps,
    alphaDecayBps: input.execution.alphaDecayBps,
    adverseSelectionBps: input.execution.adverseSelectionBps,
    implementationShortfallBps: input.execution.implementationShortfallBps,
  });
  assertFiniteRecord('FORWARD_RETURN', { rawSignalReturnBps: input.rawSignalReturnBps,
    benchmarkReturnBps: input.benchmarkReturnBps, reportedNetBps: input.reportedNetBps,
    counterfactualNoTradeBps: input.counterfactualNoTradeBps });
  if (input.costs.feesBps < 0 || input.costs.slippageBps < 0 || input.costs.borrowBps < 0) {
    throw new Error('FORWARD_NON_FUNDING_COST_NEGATIVE');
  }
  if (input.execution.impactBps < 0 || input.execution.alphaDecayBps < 0
    || input.execution.adverseSelectionBps < 0 || input.execution.implementationShortfallBps < 0) {
    throw new Error('FORWARD_EXECUTION_DRAG_NEGATIVE');
  }
  if (input.status === 'resolved' && input.blockers.length) throw new Error('RESOLVED_FORWARD_CANNOT_HAVE_BLOCKERS');
  if (input.status === 'quarantined' && !input.blockers.length) throw new Error('QUARANTINED_FORWARD_REQUIRES_BLOCKER');
  const identity = { ...input, sourceEventIds: [...input.sourceEventIds].sort(), blockers: [...input.blockers].sort() };
  return { id: `forward_evidence_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    forwardLearningPolicyVersion: FORWARD_LEARNING_POLICY_VERSION, ...identity,
    immutable: true, liveExecution: 'locked' };
}

export function attributeForwardObservation(observation: ForwardEvidenceObservation): ForwardAttributionRecord | null {
  if (observation.status !== 'resolved' || observation.blockers.length) return null;
  const benchmarkRelativeBps = observation.rawSignalReturnBps - observation.benchmarkReturnBps;
  const factorExplainedBps = (Object.keys(observation.factorReturnsBps) as Array<keyof typeof observation.factorReturnsBps>)
    .reduce((sum, factor) => sum + observation.factorReturnsBps[factor] * observation.factorBetas[factor], 0);
  const factorResidualBeforeCostsBps = benchmarkRelativeBps - factorExplainedBps;
  const totalCostBps = observation.costs.feesBps + observation.costs.slippageBps
    + observation.costs.borrowBps + observation.costs.fundingBps;
  // Impact and delay are separate implementation losses. Adverse selection and
  // implementation shortfall remain diagnostics because they overlap those
  // components and would otherwise be double counted.
  const executionDragBps = observation.execution.impactBps + observation.execution.alphaDecayBps;
  const reconstructedNetBps = factorResidualBeforeCostsBps - totalCostBps - executionDragBps;
  const reconciliationErrorBps = Math.abs(reconstructedNetBps - observation.reportedNetBps);
  const identity = { observationId: observation.id, lockboxEvaluationId: observation.lockboxEvaluationId,
    resolvedAt: observation.resolvedAt, reconstructedNetBps, reportedNetBps: observation.reportedNetBps };
  return { id: `forward_attribution_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    observationId: observation.id, lockboxEvaluationId: observation.lockboxEvaluationId,
    resolvedAt: observation.resolvedAt, rawSignalReturnBps: observation.rawSignalReturnBps,
    benchmarkReturnBps: observation.benchmarkReturnBps, benchmarkRelativeBps, factorExplainedBps,
    factorResidualBeforeCostsBps, totalCostBps, executionDragBps, reconstructedNetBps,
    reportedNetBps: observation.reportedNetBps, reconciliationErrorBps,
    counterfactualNoTradeBps: observation.counterfactualNoTradeBps,
    incrementalVsNoTradeBps: observation.reportedNetBps - observation.counterfactualNoTradeBps,
    directionalHit: observation.reportedNetBps > 0, liveExecution: 'locked' };
}

function finite(values: Array<number | null>): number[] { return values.filter((value): value is number => finiteNumber(value)); }
function mean(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function sampleStd(values: number[], average: number | null): number | null {
  if (values.length < 2 || average == null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}
function quantile(sorted: number[], probability: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * (sorted.length - 1))));
  return sorted[index];
}
function psi(reference: number[], current: number[]): number | null {
  if (!reference.length || !current.length) return null;
  const sorted = [...reference].sort((a, b) => a - b);
  const boundaries = [...new Set(Array.from({ length: 9 }, (_, index) => quantile(sorted, (index + 1) / 10)))];
  const bin = (value: number) => boundaries.findIndex((edge) => value <= edge) < 0
    ? boundaries.length : boundaries.findIndex((edge) => value <= edge);
  const epsilon = 1e-6;
  let total = 0;
  for (let index = 0; index <= boundaries.length; index++) {
    const expected = Math.max(epsilon, reference.filter((value) => bin(value) === index).length / reference.length);
    const actual = Math.max(epsilon, current.filter((value) => bin(value) === index).length / current.length);
    total += (actual - expected) * Math.log(actual / expected);
  }
  return total;
}

function assessFeature(feature: string, referenceInput: Array<number | null>, currentInput: Array<number | null>): DriftFeatureAssessment {
  const reference = finite(referenceInput); const current = finite(currentInput);
  const referenceMissingFraction = referenceInput.length ? 1 - reference.length / referenceInput.length : 1;
  const currentMissingFraction = currentInput.length ? 1 - current.length / currentInput.length : 1;
  const referenceMean = mean(reference); const currentMean = mean(current);
  const referenceStd = sampleStd(reference, referenceMean); const currentStd = sampleStd(current, currentMean);
  const standardizedMeanShift = referenceMean == null || currentMean == null || referenceStd == null
    ? null : Math.abs(currentMean - referenceMean) / Math.max(referenceStd, 1e-9);
  const standardDeviationRatio = referenceStd == null || currentStd == null || referenceStd === 0
    ? null : currentStd / referenceStd;
  const populationStabilityIndex = psi(reference, current);
  const missingnessDelta = currentMissingFraction - referenceMissingFraction;
  const reasons: string[] = [];
  let status: DriftFeatureAssessment['status'] = 'stable';
  if (reference.length < 20 || current.length < 20) { status = 'insufficient'; reasons.push('DRIFT_SAMPLE_BELOW_20'); }
  else {
    const breaches = (populationStabilityIndex ?? 0) >= 0.25 || (standardizedMeanShift ?? 0) >= 2.5
      || Math.abs(missingnessDelta) >= 0.1 || (standardDeviationRatio != null
        && (standardDeviationRatio < 0.5 || standardDeviationRatio > 2));
    const watches = (populationStabilityIndex ?? 0) >= 0.1 || (standardizedMeanShift ?? 0) >= 1
      || Math.abs(missingnessDelta) >= 0.05 || (standardDeviationRatio != null
        && (standardDeviationRatio < 0.75 || standardDeviationRatio > 1.5));
    if (breaches) status = 'breach'; else if (watches) status = 'watch';
    if ((populationStabilityIndex ?? 0) >= 0.25) reasons.push('PSI_AT_OR_ABOVE_0_25');
    if ((standardizedMeanShift ?? 0) >= 2.5) reasons.push('MEAN_SHIFT_AT_OR_ABOVE_2_5_STD');
    if (Math.abs(missingnessDelta) >= 0.1) reasons.push('MISSINGNESS_DELTA_AT_OR_ABOVE_0_10');
    if (standardDeviationRatio != null && (standardDeviationRatio < 0.5 || standardDeviationRatio > 2)) {
      reasons.push('STD_RATIO_OUTSIDE_0_5_TO_2');
    }
    if (status === 'watch' && !reasons.length) reasons.push('DRIFT_WATCH_THRESHOLD_REACHED');
  }
  return { feature, referenceSamples: reference.length, currentSamples: current.length,
    referenceMissingFraction, currentMissingFraction, missingnessDelta, referenceMean, currentMean,
    referenceStd, currentStd, standardizedMeanShift, standardDeviationRatio, populationStabilityIndex,
    status, reasons };
}

export function assessDatasetDrift(input: { lockboxEvaluationId: string; measuredAt: number;
  referenceDatasetVersionId: string; currentDatasetVersionId: string; referenceSourceAuthority: string;
  currentSourceAuthority: string; referenceFeatures: Record<string, Array<number | null>>;
  currentFeatures: Record<string, Array<number | null>> }): DatasetDriftAssessment {
  const featureNames = [...new Set([...Object.keys(input.referenceFeatures), ...Object.keys(input.currentFeatures)])].sort();
  const features = featureNames.map((feature) => assessFeature(feature,
    input.referenceFeatures[feature] ?? [], input.currentFeatures[feature] ?? []));
  const sourceAuthorityChanged = input.referenceSourceAuthority !== input.currentSourceAuthority;
  const reasons = [...new Set([
    ...(sourceAuthorityChanged ? ['SOURCE_AUTHORITY_CHANGED'] : []),
    ...features.flatMap((feature) => feature.reasons.map((reason) => `${feature.feature}:${reason}`)),
  ])].sort();
  const status: DatasetDriftAssessment['status'] = sourceAuthorityChanged || features.some((feature) => feature.status === 'breach')
    ? 'breach' : features.some((feature) => feature.status === 'insufficient') ? 'insufficient'
      : features.some((feature) => feature.status === 'watch') ? 'watch' : 'stable';
  const identity = { lockboxEvaluationId: input.lockboxEvaluationId, measuredAt: input.measuredAt,
    referenceDatasetVersionId: input.referenceDatasetVersionId, currentDatasetVersionId: input.currentDatasetVersionId,
    referenceSourceAuthority: input.referenceSourceAuthority, currentSourceAuthority: input.currentSourceAuthority,
    features, status, reasons };
  return { id: `dataset_drift_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    forwardLearningPolicyVersion: FORWARD_LEARNING_POLICY_VERSION,
    lockboxEvaluationId: input.lockboxEvaluationId, measuredAt: input.measuredAt,
    referenceDatasetVersionId: input.referenceDatasetVersionId, currentDatasetVersionId: input.currentDatasetVersionId,
    referenceSourceAuthority: input.referenceSourceAuthority, currentSourceAuthority: input.currentSourceAuthority,
    datasetVersionChanged: input.referenceDatasetVersionId !== input.currentDatasetVersionId,
    sourceAuthorityChanged, features, status, reasons, numericalGateNonOverridable: true, liveExecution: 'locked' };
}

export function evaluateForwardLifecycle(input: { evaluation: LockboxEvaluation;
  enrollment: ForwardQuarantineEnrollment | null; attributions: ForwardAttributionRecord[];
  drift: DatasetDriftAssessment | null; decidedAt?: number; hardLossBps?: number }): {
    decision: ForwardLifecycleDecision; researchQueue: ForwardResearchQueueItem[] } {
  const decidedAt = input.decidedAt ?? Math.max(input.evaluation.evaluatedAt,
    input.enrollment?.enrolledAt ?? 0, input.drift?.measuredAt ?? 0,
    ...input.attributions.filter((row) => row.lockboxEvaluationId === input.evaluation.id).map((row) => row.resolvedAt));
  const rows = input.attributions.filter((row) => row.lockboxEvaluationId === input.evaluation.id);
  const values = rows.map((row) => row.reportedNetBps);
  const stats = edgeStatistics(values, values.map((value) => value > 0 ? 'upper' : 'lower'), 0.05, 1);
  const expected = input.evaluation.holdoutMeanBps;
  const ratio = expected != null && expected > 0 && stats.meanNetRelativeBps != null
    ? stats.meanNetRelativeBps / expected : null;
  const reasons: string[] = [];
  let state: ForwardLifecycleDecision['state'];
  let action: ForwardLifecycleDecision['action'];
  let trigger: ForwardResearchQueueItem['trigger'] | null = null;
  if (input.evaluation.disposition !== 'forward_candidate') {
    state = 'blocked'; action = 'hold_blocked'; reasons.push('EVALUATION_NOT_FORWARD_CANDIDATE');
  } else if (!input.enrollment || input.enrollment.lockboxEvaluationId !== input.evaluation.id) {
    state = 'blocked'; action = 'hold_blocked'; reasons.push('UNTOUCHED_FORWARD_ENROLLMENT_MISSING_OR_MISMATCHED');
  } else if (rows.some((row) => row.reconciliationErrorBps > 1e-6)) {
    state = 'blocked'; action = 'hold_blocked'; reasons.push('ATTRIBUTION_RECONCILIATION_FAILED');
  } else if (rows.some((row) => row.reportedNetBps <= (input.hardLossBps ?? -1_000))) {
    state = 'killed'; action = 'kill'; trigger = 'HARD_RISK_BREACH'; reasons.push('HARD_FORWARD_LOSS_LIMIT_BREACHED');
  } else if (input.drift?.status === 'breach') {
    state = 're_research'; action = 'stop_and_research'; trigger = 'DATASET_DRIFT';
    reasons.push('DATASET_DRIFT_GATE_BREACHED', ...input.drift.reasons);
  } else if (expected == null || !(expected > 0)) {
    state = 'blocked'; action = 'hold_blocked'; reasons.push('LOCKED_EXPECTED_EDGE_NON_POSITIVE_OR_MISSING');
  } else if (rows.length < 20) {
    state = 'collecting'; action = 'continue_collecting'; reasons.push(`FORWARD_SAMPLE_BELOW_20:${rows.length}`);
  } else if (rows.length >= (input.enrollment?.minimumResolvedObservations ?? 30)
    && (stats.edgeLowerConfidenceBps ?? -Infinity) <= 0) {
    state = 're_research'; action = 'stop_and_research'; trigger = 'NON_POSITIVE_FORWARD_EDGE';
    reasons.push('FORWARD_NET_EDGE_LOWER_CONFIDENCE_NON_POSITIVE');
  } else if (rows.length >= (input.enrollment?.minimumResolvedObservations ?? 30) && (ratio ?? -Infinity) < 0.6) {
    state = 're_research'; action = 'stop_and_research'; trigger = 'ALPHA_DECAY'; reasons.push('ALPHA_DECAY_RATIO_BELOW_0_60');
  } else if ((ratio ?? -Infinity) < 0.8) {
    state = 'decaying'; action = 'continue_shadow'; reasons.push('ALPHA_DECAY_RATIO_BELOW_0_80');
  } else if (rows.length < (input.enrollment?.minimumResolvedObservations ?? 30)
    || input.drift == null || input.drift.status !== 'stable') {
    state = 'paper_shadow'; action = 'continue_shadow';
    reasons.push(rows.length < (input.enrollment?.minimumResolvedObservations ?? 30)
      ? 'MINIMUM_FORWARD_SAMPLE_NOT_REACHED' : `DRIFT_STATUS_NOT_STABLE:${input.drift?.status ?? 'missing'}`);
  } else {
    state = 'eligible_for_review'; action = 'paper_review'; reasons.push('FORWARD_NUMERICAL_GATES_PASSED');
  }
  const identity = { lockboxEvaluationId: input.evaluation.id, decidedAt,
    quarantineEnrollmentId: input.enrollment?.id ?? null, state, resolvedObservations: rows.length,
    meanForwardNetBps: stats.meanNetRelativeBps, forwardNetLowerConfidenceBps: stats.edgeLowerConfidenceBps,
    alphaDecayRatio: ratio, driftAssessmentId: input.drift?.id ?? null, action, reasons };
  const decision: ForwardLifecycleDecision = { id: `forward_lifecycle_${contentHash(identity).slice(0, 20)}`,
    schemaVersion: 1, forwardLearningPolicyVersion: FORWARD_LEARNING_POLICY_VERSION,
    lockboxEvaluationId: input.evaluation.id, quarantineEnrollmentId: input.enrollment?.id ?? null, decidedAt,
    state, resolvedObservations: rows.length, expectedNetEdgeBps: expected,
    meanForwardNetBps: stats.meanNetRelativeBps, forwardNetLowerConfidenceBps: stats.edgeLowerConfidenceBps,
    alphaDecayRatio: ratio, driftAssessmentId: input.drift?.id ?? null, action, reasons,
    numericalGateNonOverridable: true, liveExecution: 'locked' };
  const researchQueue = trigger ? [{ id: `forward_research_${contentHash({ lifecycleDecisionId: decision.id, trigger }).slice(0, 20)}`,
    schemaVersion: 1 as const, lifecycleDecisionId: decision.id, sourceLockboxEvaluationId: input.evaluation.id,
    trigger, status: 'open' as const, createdAt: decidedAt, reason: reasons.join('|'),
    requiresNewLockbox: true as const, liveExecution: 'locked' as const }] : [];
  return { decision, researchQueue };
}
