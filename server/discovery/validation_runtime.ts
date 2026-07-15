import { edgeStatistics } from './math.js';
import { contentHash } from './store.js';
import type { SignalPoint, SignalResearchArtifact } from './signal_types.js';
import type {
  FactorAttribution, ForwardQuarantineEnrollment, LockboxEvaluation, RegimeEvidence, ResearchLockbox,
} from './validation_types.js';

export const VALIDATION_POLICY_VERSION = 'validation-lockbox-policy-v2';

export function sealResearchLockbox(input: { artifact: SignalResearchArtifact; familyId: string;
  maximumTrialBudget: number; parentLockboxId?: string | null; sealedAt?: number }): ResearchLockbox {
  if (!input.artifact.researchChoices?.length) throw new Error('LOCKBOX_REQUIRES_COMPLETE_RESEARCH_CHOICE_LEDGER');
  const totalDeclaredTrials = input.artifact.researchChoices.reduce((sum, choice) => sum + choice.trialCost, 0);
  if (totalDeclaredTrials !== input.artifact.transform.declaredTrials) throw new Error('LOCKBOX_TRIAL_ACCOUNTING_MISMATCH');
  if (!Number.isInteger(input.maximumTrialBudget) || input.maximumTrialBudget < 1) throw new Error('LOCKBOX_BUDGET_INVALID');
  if (totalDeclaredTrials > input.maximumTrialBudget) throw new Error('LOCKBOX_RESEARCH_BUDGET_EXCEEDED');
  const identity = { familyId: input.familyId, parentLockboxId: input.parentLockboxId ?? null,
    signalArtifactId: input.artifact.id, datasetVersionId: input.artifact.datasetVersionId,
    universeVersionId: input.artifact.universeVersionId, worldContractId: input.artifact.worldContractId,
    signalResearchPolicyVersion: input.artifact.researchPolicyVersion,
    validationPolicyVersion: VALIDATION_POLICY_VERSION,
    researchChoiceIds: input.artifact.researchChoices.map((choice) => choice.id).sort(), totalDeclaredTrials,
    maximumTrialBudget: input.maximumTrialBudget };
  const sealHash = contentHash(identity);
  return { id: `lockbox_${sealHash.slice(0, 20)}`, schemaVersion: 1, ...identity,
    sealedAt: input.sealedAt ?? Date.now(), sealHash, immutable: true, evaluationLimit: 1, liveExecution: 'locked' };
}

function strategyRows(points: SignalPoint[], orientation: 'follow' | 'invert') {
  const orientationSign = orientation === 'follow' ? 1 : -1;
  const relative = points.map((point) => point.assetReturnBps - point.benchmarkReturnBps);
  const marketMean = points.length ? points.reduce((sum, point) => sum + point.benchmarkReturnBps, 0) / points.length : 0;
  return points.slice(0, -1).flatMap((point, index) => {
    if (point.smoothed == null) return [];
    const direction = Math.sign(point.smoothed) * orientationSign;
    if (!direction) return [];
    const next = points[index + 1];
    const recentMomentum = relative.slice(Math.max(0, index - 20), index + 1).reduce((sum, value) => sum + value, 0);
    return [{ index, at: point.availableAt, strategy: direction * relative[index + 1], market: next.benchmarkReturnBps,
      momentum: recentMomentum, volatility: Math.abs(next.benchmarkReturnBps - marketMean) }];
  });
}

function solve(matrix: number[][], vector: number[]): number[] | null {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < matrix.length; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < matrix.length; row++) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    if (Math.abs(augmented[pivot][pivot]) < 1e-10) return null;
    const scale = augmented[pivot][pivot];
    for (let column = pivot; column <= matrix.length; column++) augmented[pivot][column] /= scale;
    for (let row = 0; row < matrix.length; row++) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= matrix.length; column++) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[matrix.length]);
}

function factorAttribution(rows: ReturnType<typeof strategyRows>): FactorAttribution {
  if (rows.length < 20) return { samples: rows.length, alphaBps: null,
    betas: { market: null, momentum: null, volatility: null }, rSquared: null,
    meanStrategyReturnBps: rows.length ? rows.reduce((sum, row) => sum + row.strategy, 0) / rows.length : null,
    factorDominated: true };
  const features = rows.map((row) => [1, row.market, row.momentum, row.volatility]);
  const matrix = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
    features.reduce((sum, feature) => sum + feature[i] * feature[j], 0)));
  const vector = Array.from({ length: 4 }, (_, i) => features.reduce((sum, feature, row) => sum + feature[i] * rows[row].strategy, 0));
  const coefficients = solve(matrix, vector);
  const meanStrategyReturnBps = rows.reduce((sum, row) => sum + row.strategy, 0) / rows.length;
  if (!coefficients) return { samples: rows.length, alphaBps: null,
    betas: { market: null, momentum: null, volatility: null }, rSquared: null, meanStrategyReturnBps, factorDominated: true };
  const predictions = features.map((feature) => feature.reduce((sum, value, index) => sum + value * coefficients[index], 0));
  const residualSum = rows.reduce((sum, row, index) => sum + (row.strategy - predictions[index]) ** 2, 0);
  const totalSum = rows.reduce((sum, row) => sum + (row.strategy - meanStrategyReturnBps) ** 2, 0);
  const rSquared = totalSum > 0 ? Math.max(0, Math.min(1, 1 - residualSum / totalSum)) : 0;
  const alphaBps = coefficients[0];
  return { samples: rows.length, alphaBps,
    betas: { market: coefficients[1], momentum: coefficients[2], volatility: coefficients[3] }, rSquared,
    meanStrategyReturnBps, factorDominated: !(meanStrategyReturnBps > 0) || !(alphaBps > 0)
      || Math.abs(alphaBps) < Math.abs(meanStrategyReturnBps) * 0.25 };
}

function regimeEvidence(rows: ReturnType<typeof strategyRows>, declaredTrials: number): RegimeEvidence[] {
  if (!rows.length) return [];
  const medianVolatility = [...rows].sort((a, b) => a.volatility - b.volatility)[Math.floor(rows.length / 2)].volatility;
  const regimes: Array<{ regime: RegimeEvidence['regime']; select: (row: ReturnType<typeof strategyRows>[number]) => boolean }> = [
    { regime: 'market_up', select: (row) => row.market >= 0 },
    { regime: 'market_down', select: (row) => row.market < 0 },
    { regime: 'high_volatility', select: (row) => row.volatility >= medianVolatility },
    { regime: 'low_volatility', select: (row) => row.volatility < medianVolatility },
  ];
  return regimes.map(({ regime, select }) => {
    const returns = rows.filter(select).map((row) => row.strategy);
    const stats = edgeStatistics(returns, returns.map((value) => value > 0 ? 'upper' : 'lower'), 0.05, declaredTrials);
    return { regime, samples: returns.length, meanStrategyReturnBps: stats.meanNetRelativeBps,
      edgeLowerConfidenceBps: stats.edgeLowerConfidenceBps,
      passed: returns.length >= 20 && (stats.edgeLowerConfidenceBps ?? -Infinity) > 0 };
  });
}

export function evaluateResearchLockbox(input: { lockbox: ResearchLockbox; artifact: SignalResearchArtifact;
  requiredPassingRegimes?: number; evaluatedAt?: number }): LockboxEvaluation {
  if (input.lockbox.signalArtifactId !== input.artifact.id) throw new Error('LOCKBOX_ARTIFACT_MISMATCH');
  if (input.lockbox.sealHash !== contentHash({ familyId: input.lockbox.familyId, parentLockboxId: input.lockbox.parentLockboxId,
    signalArtifactId: input.lockbox.signalArtifactId, datasetVersionId: input.lockbox.datasetVersionId,
    universeVersionId: input.lockbox.universeVersionId, worldContractId: input.lockbox.worldContractId,
    signalResearchPolicyVersion: input.lockbox.signalResearchPolicyVersion,
    validationPolicyVersion: input.lockbox.validationPolicyVersion,
    researchChoiceIds: input.lockbox.researchChoiceIds, totalDeclaredTrials: input.lockbox.totalDeclaredTrials,
    maximumTrialBudget: input.lockbox.maximumTrialBudget })) throw new Error('LOCKBOX_SEAL_INVALID');
  const rows = strategyRows(input.artifact.points, input.artifact.transform.orientation);
  const regimes = regimeEvidence(rows, input.lockbox.totalDeclaredTrials);
  const requiredPassingRegimes = input.requiredPassingRegimes ?? 3;
  const factors = factorAttribution(rows);
  const split = Math.floor(rows.length * 0.8);
  const train = rows.slice(0, split).map((row) => row.strategy); const holdout = rows.slice(split).map((row) => row.strategy);
  const trainMeanBps = train.length ? train.reduce((sum, value) => sum + value, 0) / train.length : null;
  const holdoutMeanBps = holdout.length ? holdout.reduce((sum, value) => sum + value, 0) / holdout.length : null;
  const holdoutDegradationRatio = trainMeanBps != null && trainMeanBps > 0 && holdoutMeanBps != null ? holdoutMeanBps / trainMeanBps : null;
  const passingRegimes = regimes.filter((regime) => regime.passed).length;
  const blockers = [...input.artifact.blockers];
  if (!input.artifact.historicalResearchEligible) blockers.push('HISTORICAL_RESEARCH_NOT_ELIGIBLE');
  if (!input.artifact.plateau.robust) blockers.push('PARAMETER_PLATEAU_NOT_ROBUST');
  if (passingRegimes < requiredPassingRegimes) blockers.push(`REGIME_CONSISTENCY_FAILED:${passingRegimes}/${requiredPassingRegimes}`);
  if (factors.factorDominated) blockers.push('FACTOR_ATTRIBUTION_DOMINATES_OR_ALPHA_NON_POSITIVE');
  if (holdoutDegradationRatio == null || holdoutDegradationRatio < 0.6) blockers.push('HOLDOUT_DEGRADATION_GATE_FAILED');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const disposition = !input.artifact.historicalResearchEligible ? 'blocked'
    : uniqueBlockers.length ? 'declined' : 'forward_candidate';
  const identity = { lockboxId: input.lockbox.id, signalArtifactId: input.artifact.id,
    researchChoiceIds: input.artifact.researchChoices.map((choice) => choice.id), regimeEvidence: regimes,
    requiredPassingRegimes, factorAttribution: factors, trainMeanBps, holdoutMeanBps, holdoutDegradationRatio,
    disposition, blockers: uniqueBlockers };
  const verifierHash = contentHash(identity);
  return { id: `lockbox_evaluation_${verifierHash.slice(0, 20)}`, schemaVersion: 1, lockboxId: input.lockbox.id,
    signalArtifactId: input.artifact.id, evaluatedAt: input.evaluatedAt ?? Date.now(),
    researchChoices: input.artifact.researchChoices, totalChargedTrials: input.lockbox.totalDeclaredTrials,
    regimeEvidence: regimes, requiredPassingRegimes, passingRegimes, factorAttribution: factors,
    trainMeanBps, holdoutMeanBps, holdoutDegradationRatio,
    holdoutEventStudies: input.artifact.eventStudies.filter((study) => study.split === 'holdout'),
    disposition, blockers: uniqueBlockers, verifierHash, numericalGateNonOverridable: true, liveExecution: 'locked' };
}

export function enrollUntouchedForward(input: { evaluation: LockboxEvaluation; artifact: SignalResearchArtifact;
  enrolledAt?: number; minimumResolvedObservations?: number }): ForwardQuarantineEnrollment | null {
  if (input.evaluation.disposition !== 'forward_candidate') return null;
  const enrolledAt = input.enrolledAt ?? Date.now();
  const evidenceCutoffAt = Math.max(...input.artifact.points.map((point) => point.availableAt));
  if (enrolledAt < evidenceCutoffAt) throw new Error('FORWARD_QUARANTINE_ENROLLMENT_BEFORE_EVIDENCE_CUTOFF');
  const identity = { lockboxEvaluationId: input.evaluation.id, signalArtifactId: input.artifact.id,
    evidenceCutoffAt, minimumResolvedObservations: input.minimumResolvedObservations ?? 30 };
  return { id: `forward_quarantine_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    ...identity, enrolledAt, status: 'collecting', resolvedObservations: 0,
    immutableResearchPolicy: true, liveExecution: 'locked' };
}
