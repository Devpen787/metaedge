import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';
import { edgeStatistics } from '../discovery/math.js';
import { applyExperimentLifecycleEventV5 } from './experiments.js';
import type {
  DatabaseState,
  ExperimentEpisodeOutcomeV5,
  ExperimentEvidenceAssessmentV5,
  ExperimentLearningPolicyV5,
  ExperimentLifecycleEventV5,
  ExperimentSpecV5,
  ExperimentTrialV5,
  OrderIntentV5,
  PaperFillV5,
  PaperTrade,
} from '../../src/types.js';

export const DEFAULT_EXPERIMENT_LEARNING_POLICY_V5: ExperimentLearningPolicyV5 = {
  authorityVersion: 5,
  schema: 'experiment-learning-policy.v5',
  id: 'experiment-learning-policy-v5',
  semanticVersion: '5.0.0',
  alpha: 0.05,
  minimumIndependentEpisodes: 20,
  costStressMultiplier: 1.5,
  episodeClusterMs: 24 * 60 * 60_000,
  requiredControls: ['no_trade', 'buy_hold_same_symbol_same_window'],
  liveExecution: 'locked',
};

const EPSILON = 1e-9;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function learning(db: DatabaseState) {
  return (db.experimentLearningV5 ||= {
    policy: structuredClone(DEFAULT_EXPERIMENT_LEARNING_POLICY_V5),
    trials: {},
    outcomes: {},
    assessments: {},
    lifecycleAppliedOutcomeIds: {},
  });
}

function trialBody(trial: Omit<ExperimentTrialV5, 'trialHash'>) {
  return {
    authorityVersion: trial.authorityVersion,
    schema: trial.schema,
    trialId: trial.trialId,
    experimentId: trial.experimentId,
    strategyHash: trial.strategyHash,
    family: trial.family,
    variant: trial.variant,
    familyTrialSequence: trial.familyTrialSequence,
    declaredAt: trial.declaredAt,
    evidenceCutoffAt: trial.evidenceCutoffAt,
    controls: trial.controls,
    policyId: trial.policyId,
    immutable: trial.immutable,
    liveExecution: trial.liveExecution,
  };
}

export function compileExperimentTrialV5(
  spec: ExperimentSpecV5,
  familyTrialSequence: number,
  declaredAt = Date.now(),
): ExperimentTrialV5 {
  if (!Number.isInteger(familyTrialSequence) || familyTrialSequence < 1) {
    throw new Error('EXPERIMENT_FAMILY_TRIAL_SEQUENCE_INVALID');
  }
  const identity = {
    experimentId: spec.experimentId,
    strategyHash: spec.strategyHash,
    family: spec.family,
    variant: spec.pluginId,
    familyTrialSequence,
  };
  const base: Omit<ExperimentTrialV5, 'trialHash'> = {
    authorityVersion: 5,
    schema: 'experiment-trial.v5',
    trialId: `trial_v5_${digest(identity).slice(0, 24)}`,
    ...identity,
    declaredAt,
    evidenceCutoffAt: declaredAt,
    controls: [
      {
        kind: 'no_trade',
        definition: 'zero position and zero PnL over the exact episode window',
        immutable: true,
      },
      {
        kind: 'buy_hold_same_symbol_same_window',
        definition: 'continuously long the first eligible episode reference notional from the first open through the latest resolved episode; per-episode values remain diagnostics',
        immutable: true,
      },
    ],
    policyId: DEFAULT_EXPERIMENT_LEARNING_POLICY_V5.id,
    immutable: true,
    liveExecution: 'locked',
  };
  return { ...base, trialHash: digest(trialBody(base)) };
}

export function validateExperimentTrialV5(
  trial: ExperimentTrialV5,
  policy: ExperimentLearningPolicyV5 = DEFAULT_EXPERIMENT_LEARNING_POLICY_V5,
): void {
  if (trial.authorityVersion !== 5 || trial.schema !== 'experiment-trial.v5'
    || !trial.immutable || trial.liveExecution !== 'locked') {
    throw new Error('EXPERIMENT_TRIAL_AUTHORITY_INVALID');
  }
  if (trial.policyId !== policy.id) throw new Error('EXPERIMENT_TRIAL_POLICY_MISMATCH');
  const kinds = trial.controls.map((control) => control.kind);
  if (new Set(kinds).size !== kinds.length
    || policy.requiredControls.some((required) => !kinds.includes(required))
    || trial.controls.some((control) => !control.immutable || !control.definition.trim())) {
    throw new Error('EXPERIMENT_TRIAL_CONTROLS_INCOMPLETE');
  }
  const { trialHash, ...withoutHash } = trial;
  if (digest(trialBody(withoutHash)) !== trialHash) throw new Error('EXPERIMENT_TRIAL_HASH_INVALID');
}

function ensureTrials(db: DatabaseState, now: number): ExperimentTrialV5[] {
  const state = learning(db);
  const specs = Object.values(db.experimentsV5?.specs || {})
    .sort((left, right) => left.createdAt - right.createdAt || left.experimentId.localeCompare(right.experimentId));
  const sequenceByFamily = new Map<string, number>();
  const trials: ExperimentTrialV5[] = [];
  for (const spec of specs) {
    const sequence = (sequenceByFamily.get(spec.family) || 0) + 1;
    sequenceByFamily.set(spec.family, sequence);
    const candidate = compileExperimentTrialV5(spec, sequence, now);
    const existing = state.trials[candidate.trialId];
    if (existing) {
      validateExperimentTrialV5(existing, state.policy);
      if (existing.experimentId !== spec.experimentId || existing.strategyHash !== spec.strategyHash) {
        throw new Error(`EXPERIMENT_TRIAL_LINEAGE_MISMATCH:${existing.trialId}`);
      }
      trials.push(existing);
    } else {
      state.trials[candidate.trialId] = candidate;
      trials.push(candidate);
    }
  }
  return trials;
}

export function ensureExperimentTrialsV5(now = Date.now()): ExperimentTrialV5[] {
  const db = readDatabase();
  const state = learning(db);
  if (canonical(state.policy) !== canonical(DEFAULT_EXPERIMENT_LEARNING_POLICY_V5)) {
    throw new Error('EXPERIMENT_LEARNING_POLICY_MUTATED');
  }
  const trials = ensureTrials(db, now);
  writeDatabase(db, ['experimentLearningV5']);
  return trials;
}

interface ClosedEpisode {
  experimentId: string;
  symbol: string;
  trades: PaperTrade[];
}

function completedEpisodes(trades: PaperTrade[]): ClosedEpisode[] {
  const groups = new Map<string, PaperTrade[]>();
  for (const trade of trades) {
    if (!trade.experimentId) continue;
    const key = `${trade.experimentId}:${trade.assetSymbol}`;
    const group = groups.get(key) || [];
    group.push(trade);
    groups.set(key, group);
  }
  const episodes: ClosedEpisode[] = [];
  for (const group of groups.values()) {
    group.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
    let signedPosition = 0;
    let current: PaperTrade[] = [];
    for (const trade of group) {
      const sign = trade.side === 'buy' || trade.side === 'long' ? 1 : -1;
      if (Math.abs(signedPosition) <= EPSILON) current = [];
      current.push(trade);
      signedPosition += sign * trade.size;
      if (Math.abs(signedPosition) <= EPSILON && current.length >= 2) {
        episodes.push({
          experimentId: trade.experimentId!,
          symbol: trade.assetSymbol,
          trades: [...current],
        });
        current = [];
        signedPosition = 0;
      }
    }
  }
  return episodes;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function rounded(value: number): number {
  return Number(value.toPrecision(12));
}

export function compileEpisodeOutcomeV5(input: {
  trial: ExperimentTrialV5;
  episode: ClosedEpisode;
  intents: Record<string, OrderIntentV5>;
  fills: Record<string, PaperFillV5>;
  policy?: ExperimentLearningPolicyV5;
}): ExperimentEpisodeOutcomeV5 {
  const policy = input.policy || DEFAULT_EXPERIMENT_LEARNING_POLICY_V5;
  const trades = [...input.episode.trades]
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
  if (trades.length < 2) throw new Error('EXPERIMENT_EPISODE_NOT_CLOSED');
  const firstSign = trades[0].side === 'buy' || trades[0].side === 'long' ? 1 : -1;
  const direction = firstSign > 0 ? 'long' as const : 'short' as const;
  const openedAt = trades[0].timestamp;
  const resolvedAt = trades.at(-1)!.timestamp;
  const reasons: string[] = [];
  try { validateExperimentTrialV5(input.trial, policy); }
  catch (error: any) { reasons.push(error?.message || 'EXPERIMENT_TRIAL_INVALID'); }
  if (openedAt <= input.trial.evidenceCutoffAt) reasons.push('EPISODE_NOT_FORWARD_OF_TRIAL_CUTOFF');
  if (input.episode.experimentId !== input.trial.experimentId) reasons.push('EPISODE_EXPERIMENT_MISMATCH');
  if (trades.some((trade) => trade.thesis?.strategyHash !== input.trial.strategyHash)) {
    reasons.push('EPISODE_STRATEGY_HASH_MISMATCH');
  }
  if (trades.some((trade) => !trade.orderIntentId || !trade.paperFillId || !trade.referenceObservationHash
    || !(Number(trade.referencePrice) > 0) || trade.brokerPolicyId !== 'paper-broker-conservative-v5')) {
    reasons.push('EPISODE_EXECUTION_LINEAGE_INCOMPLETE');
  }
  if (trades.some((trade) => {
    const fill = trade.paperFillId ? input.fills[trade.paperFillId] : undefined;
    return !fill || fill.intentId !== trade.orderIntentId
      || fill.observationHash !== trade.referenceObservationHash;
  })) reasons.push('EPISODE_FILL_LINEAGE_MISSING_OR_MISMATCHED');
  const orderIntentIds = [...new Set(trades.flatMap((trade) => trade.orderIntentId ? [trade.orderIntentId] : []))];
  if (orderIntentIds.some((id) => input.intents[id]?.status !== 'EXECUTED')) {
    reasons.push('EPISODE_ORDER_NOT_DURABLY_EXECUTED');
  }
  if (trades.some((trade) => !finiteNonNegative(trade.feeUsd)
    || !finiteNonNegative(trade.spreadCostUsd) || !finiteNonNegative(trade.slippageUsd))) {
    reasons.push('EPISODE_COST_COMPONENT_MISSING_OR_INVALID');
  }
  const entryTrades = trades.filter((trade) => {
    const sign = trade.side === 'buy' || trade.side === 'long' ? 1 : -1;
    return sign === firstSign;
  });
  const reference = (trade: PaperTrade) => Number(trade.referencePrice) > 0 ? Number(trade.referencePrice) : trade.price;
  const cashFlow = (trade: PaperTrade, price: number) => {
    const sign = trade.side === 'buy' || trade.side === 'long' ? 1 : -1;
    return -sign * trade.size * price;
  };
  const grossReferencePnlUsd = trades.reduce((sum, trade) => sum + cashFlow(trade, reference(trade)), 0);
  const executionGrossPnlUsd = trades.reduce((sum, trade) => sum + cashFlow(trade, trade.price), 0);
  const entryReferenceNotionalUsd = entryTrades.reduce((sum, trade) => sum + trade.size * reference(trade), 0);
  const feeUsd = trades.reduce((sum, trade) => sum + (finiteNonNegative(trade.feeUsd) ? trade.feeUsd : 0), 0);
  const spreadCostUsd = trades.reduce((sum, trade) => sum + (finiteNonNegative(trade.spreadCostUsd) ? trade.spreadCostUsd : 0), 0);
  const slippageUsd = trades.reduce((sum, trade) => sum + (finiteNonNegative(trade.slippageUsd) ? trade.slippageUsd : 0), 0);
  const fundingUsd = trades.reduce((sum, trade) => sum + (finiteNonNegative(trade.fundingUsd) ? trade.fundingUsd : 0), 0);
  const borrowUsd = trades.reduce((sum, trade) => sum + (finiteNonNegative(trade.borrowUsd) ? trade.borrowUsd : 0), 0);
  const signedImplementationShortfallUsd = grossReferencePnlUsd - executionGrossPnlUsd;
  const conservativeImplementationDragUsd = Math.max(0, signedImplementationShortfallUsd);
  const actualPostCostPnlUsd = executionGrossPnlUsd - feeUsd - fundingUsd - borrowUsd;
  const evidencePostCostPnlUsd = grossReferencePnlUsd - conservativeImplementationDragUsd - feeUsd - fundingUsd - borrowUsd;
  const costStressedPnlUsd = grossReferencePnlUsd - policy.costStressMultiplier
    * (conservativeImplementationDragUsd + feeUsd + fundingUsd + borrowUsd);
  const firstReference = reference(trades[0]);
  const lastReference = reference(trades.at(-1)!);
  const benchmarkQuantity = firstReference > 0 ? entryReferenceNotionalUsd / firstReference : 0;
  const buyHoldControlPnlUsd = benchmarkQuantity * (lastReference - firstReference);
  if (!(entryReferenceNotionalUsd > 0)) reasons.push('EPISODE_ENTRY_NOTIONAL_INVALID');
  const scale = entryReferenceNotionalUsd > 0 ? 10_000 / entryReferenceNotionalUsd : 0;
  const reconciliationErrorUsd = Math.abs(
    (executionGrossPnlUsd - feeUsd - fundingUsd - borrowUsd) - actualPostCostPnlUsd,
  );
  if (reconciliationErrorUsd > 1e-8) reasons.push('EPISODE_ACCOUNTING_RECONCILIATION_FAILED');
  const episodeIdentity = {
    trialId: input.trial.trialId,
    experimentId: input.trial.experimentId,
    symbol: input.episode.symbol,
    tradeIds: trades.map((trade) => trade.id),
  };
  const episodeId = `episode_v5_${digest(episodeIdentity).slice(0, 24)}`;
  const outcomeId = `outcome_v5_${digest({ episodeId, policyId: policy.id, policyVersion: policy.semanticVersion }).slice(0, 24)}`;
  const independentClusterId = `cluster_v5_${digest({
    family: input.trial.family,
    symbol: input.episode.symbol,
    window: Math.floor(openedAt / policy.episodeClusterMs),
  }).slice(0, 24)}`;
  const operationalReasons = reasons.filter((reason) => reason !== 'EPISODE_NOT_FORWARD_OF_TRIAL_CUTOFF');
  const operationalStatus = operationalReasons.length ? 'invalid' as const : 'valid' as const;
  return {
    authorityVersion: 5,
    schema: 'experiment-episode-outcome.v5',
    outcomeId,
    episodeId,
    independentClusterId,
    trialId: input.trial.trialId,
    experimentId: input.trial.experimentId,
    strategyHash: input.trial.strategyHash,
    family: input.trial.family,
    symbol: input.episode.symbol,
    direction,
    openedAt,
    resolvedAt,
    tradeIds: trades.map((trade) => trade.id),
    orderIntentIds,
    fillIds: trades.flatMap((trade) => trade.paperFillId ? [trade.paperFillId] : []),
    sourceObservationHashes: trades.flatMap((trade) => trade.referenceObservationHash ? [trade.referenceObservationHash] : []),
    entryReferenceNotionalUsd: rounded(entryReferenceNotionalUsd),
    entryReferencePrice: rounded(firstReference),
    exitReferencePrice: rounded(lastReference),
    grossReferencePnlUsd: rounded(grossReferencePnlUsd),
    executionGrossPnlUsd: rounded(executionGrossPnlUsd),
    signedImplementationShortfallUsd: rounded(signedImplementationShortfallUsd),
    conservativeImplementationDragUsd: rounded(conservativeImplementationDragUsd),
    feeUsd: rounded(feeUsd),
    spreadCostUsd: rounded(spreadCostUsd),
    slippageUsd: rounded(slippageUsd),
    fundingUsd: rounded(fundingUsd),
    borrowUsd: rounded(borrowUsd),
    actualPostCostPnlUsd: rounded(actualPostCostPnlUsd),
    evidencePostCostPnlUsd: rounded(evidencePostCostPnlUsd),
    costStressedPnlUsd: rounded(costStressedPnlUsd),
    noTradeControlPnlUsd: 0,
    buyHoldControlPnlUsd: rounded(buyHoldControlPnlUsd),
    evidenceNetBps: rounded(evidencePostCostPnlUsd * scale),
    costStressedNetBps: rounded(costStressedPnlUsd * scale),
    noTradeRelativeBps: rounded(evidencePostCostPnlUsd * scale),
    benchmarkRelativeBps: rounded((evidencePostCostPnlUsd - buyHoldControlPnlUsd) * scale),
    reconciliationErrorUsd: rounded(reconciliationErrorUsd),
    operationalStatus,
    classification: operationalStatus === 'valid' && reasons.length === 0 ? 'evidence_eligible' : 'quarantined',
    reasons: [...new Set(reasons)].sort(),
    liveExecution: 'locked',
  };
}

function clusterMetrics(
  outcomes: ExperimentEpisodeOutcomeV5[],
  field: 'evidenceNetBps' | 'costStressedNetBps' | 'noTradeRelativeBps' | 'benchmarkRelativeBps',
): number[] {
  const clusters = new Map<string, { weighted: number; weight: number }>();
  for (const outcome of outcomes) {
    const current = clusters.get(outcome.independentClusterId) || { weighted: 0, weight: 0 };
    current.weighted += outcome[field] * outcome.entryReferenceNotionalUsd;
    current.weight += outcome.entryReferenceNotionalUsd;
    clusters.set(outcome.independentClusterId, current);
  }
  return [...clusters.values()].map((cluster) => cluster.weight > 0 ? cluster.weighted / cluster.weight : 0);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function assessExperimentEvidenceV5(input: {
  trial: ExperimentTrialV5;
  outcomes: ExperimentEpisodeOutcomeV5[];
  declaredFamilyTrials: number;
  assessedAt?: number;
  policy?: ExperimentLearningPolicyV5;
}): ExperimentEvidenceAssessmentV5 {
  const policy = input.policy || DEFAULT_EXPERIMENT_LEARNING_POLICY_V5;
  const reasons: string[] = [];
  try { validateExperimentTrialV5(input.trial, policy); }
  catch (error: any) { reasons.push(error?.message || 'EXPERIMENT_TRIAL_INVALID'); }
  if (!Number.isInteger(input.declaredFamilyTrials) || input.declaredFamilyTrials < 1) {
    reasons.push('DECLARED_FAMILY_TRIAL_COUNT_INVALID');
  }
  const related = input.outcomes.filter((outcome) => outcome.trialId === input.trial.trialId);
  const valid = related.filter((outcome) => outcome.classification === 'evidence_eligible');
  const invalid = related.filter((outcome) => outcome.operationalStatus === 'invalid');
  const quarantined = related.filter((outcome) => outcome.classification === 'quarantined');
  if (invalid.length) reasons.push(`OPERATIONALLY_INVALID_OUTCOMES_PRESENT:${invalid.length}`);
  const evidence = clusterMetrics(valid, 'evidenceNetBps');
  const stressed = clusterMetrics(valid, 'costStressedNetBps');
  const noTrade = clusterMetrics(valid, 'noTradeRelativeBps');
  const trialCount = Math.max(1, input.declaredFamilyTrials);
  const stats = edgeStatistics(
    noTrade,
    noTrade.map((value) => value > 0 ? 'upper' : 'lower'),
    policy.alpha,
    trialCount,
  );
  const cumulativeEvidencePnlUsd = valid.reduce((sum, outcome) => sum + outcome.evidencePostCostPnlUsd, 0);
  const bySymbol = new Map<string, ExperimentEpisodeOutcomeV5[]>();
  for (const outcome of valid) {
    const group = bySymbol.get(outcome.symbol) || [];
    group.push(outcome);
    bySymbol.set(outcome.symbol, group);
  }
  let continuousBenchmarkCapitalUsd = 0;
  let continuousBuyHoldControlPnlUsd = 0;
  for (const group of bySymbol.values()) {
    group.sort((left, right) => left.openedAt - right.openedAt || left.outcomeId.localeCompare(right.outcomeId));
    const first = group[0];
    const last = group.at(-1)!;
    if (!(first.entryReferencePrice > 0) || !(first.entryReferenceNotionalUsd > 0)) continue;
    continuousBenchmarkCapitalUsd += first.entryReferenceNotionalUsd;
    continuousBuyHoldControlPnlUsd += (first.entryReferenceNotionalUsd / first.entryReferencePrice)
      * (last.exitReferencePrice - first.entryReferencePrice);
  }
  const benchmarkRelativePnlUsd = cumulativeEvidencePnlUsd - continuousBuyHoldControlPnlUsd;
  const benchmarkRelativeBps = continuousBenchmarkCapitalUsd > 0
    ? benchmarkRelativePnlUsd / continuousBenchmarkCapitalUsd * 10_000
    : null;
  if (evidence.length < policy.minimumIndependentEpisodes) {
    reasons.push(`INDEPENDENT_EPISODES_BELOW_${policy.minimumIndependentEpisodes}:${evidence.length}`);
  }
  if (evidence.length >= policy.minimumIndependentEpisodes) {
    if (!((average(evidence) ?? -Infinity) > 0)) reasons.push('MEAN_POST_COST_EDGE_NON_POSITIVE');
    if (!((average(stressed) ?? -Infinity) > 0)) reasons.push('COST_STRESSED_EDGE_NON_POSITIVE');
    if (!((average(noTrade) ?? -Infinity) > 0)) reasons.push('NO_TRADE_CONTROL_NOT_BEATEN');
    if (!((benchmarkRelativeBps ?? -Infinity) > 0)) reasons.push('CONTINUOUS_BUY_HOLD_CONTROL_NOT_BEATEN');
    if (!((stats.edgeLowerConfidenceBps ?? -Infinity) > 0)) {
      reasons.push('MULTIPLICITY_ADJUSTED_NO_TRADE_LOWER_CONFIDENCE_NON_POSITIVE');
    }
  }
  const integrityBlocked = reasons.some((reason) => reason.startsWith('EXPERIMENT_TRIAL_')
    || reason.startsWith('DECLARED_FAMILY_') || reason.startsWith('OPERATIONALLY_INVALID_'));
  const collecting = evidence.length < policy.minimumIndependentEpisodes && !integrityBlocked;
  const promotable = reasons.length === 0;
  const disposition: ExperimentEvidenceAssessmentV5['disposition'] = promotable
    ? 'review_candidate'
    : integrityBlocked ? 'blocked'
      : collecting ? 'collecting' : 'declined';
  const assessedAt = input.assessedAt ?? Date.now();
  const identity = {
    trialId: input.trial.trialId,
    outcomeIds: related.map((outcome) => outcome.outcomeId).sort(),
    declaredFamilyTrials: trialCount,
    assessedAt,
    disposition,
    reasons: [...new Set(reasons)].sort(),
  };
  return {
    authorityVersion: 5,
    schema: 'experiment-evidence-assessment.v5',
    assessmentId: `assessment_v5_${digest(identity).slice(0, 24)}`,
    trialId: input.trial.trialId,
    experimentId: input.trial.experimentId,
    strategyHash: input.trial.strategyHash,
    family: input.trial.family,
    assessedAt,
    outcomeIds: related.map((outcome) => outcome.outcomeId).sort(),
    validOutcomeCount: valid.length,
    invalidOutcomeCount: invalid.length,
    quarantinedOutcomeCount: quarantined.length,
    independentEpisodeCount: evidence.length,
    declaredFamilyTrials: trialCount,
    alpha: policy.alpha,
    multiplicityAdjustedAlpha: policy.alpha / trialCount,
    meanEvidenceNetBps: average(evidence),
    meanCostStressedNetBps: average(stressed),
    meanNoTradeRelativeBps: average(noTrade),
    meanBenchmarkRelativeBps: benchmarkRelativeBps,
    cumulativeEvidencePnlUsd: rounded(cumulativeEvidencePnlUsd),
    continuousBuyHoldControlPnlUsd: rounded(continuousBuyHoldControlPnlUsd),
    benchmarkRelativePnlUsd: rounded(benchmarkRelativePnlUsd),
    lowerConfidenceNoTradeRelativeBps: stats.edgeLowerConfidenceBps,
    winRate: stats.winRate,
    disposition,
    promotable,
    reasons: [...new Set(reasons)].sort(),
    numericalGateNonOverridable: true,
    liveExecution: 'locked',
  };
}

export function reconcileExperimentOutcomesV5(now = Date.now()): {
  trials: number;
  completedEpisodes: number;
  newOutcomes: number;
  validOutcomes: number;
  invalidOutcomes: number;
  assessments: number;
} {
  const db = readDatabase();
  const state = learning(db);
  if (canonical(state.policy) !== canonical(DEFAULT_EXPERIMENT_LEARNING_POLICY_V5)) {
    throw new Error('EXPERIMENT_LEARNING_POLICY_MUTATED');
  }
  const trialCountBefore = Object.keys(state.trials).length;
  const trials = ensureTrials(db, now);
  const trialsChanged = Object.keys(state.trials).length !== trialCountBefore;
  const trialByExperiment = new Map(trials.map((trial) => [trial.experimentId, trial]));
  const episodes = completedEpisodes(db.trades);
  const fills = Object.fromEntries((db.paperFillsV5 || []).map((fill) => [fill.fillId, fill]));
  let newOutcomes = 0;
  for (const episode of episodes) {
    const trial = trialByExperiment.get(episode.experimentId);
    if (!trial) continue;
    const outcome = compileEpisodeOutcomeV5({
      trial,
      episode,
      intents: db.orderIntentsV5 || {},
      fills,
      policy: state.policy,
    });
    const existing = state.outcomes[outcome.outcomeId];
    if (existing && canonical(existing) !== canonical(outcome)) {
      throw new Error(`EXPERIMENT_OUTCOME_IMMUTABILITY_VIOLATION:${outcome.outcomeId}`);
    }
    if (!existing) {
      state.outcomes[outcome.outcomeId] = outcome;
      newOutcomes += 1;
    }
  }
  const allOutcomes = Object.values(state.outcomes);
  const assessmentsMissing = trials.some((trial) => !state.assessments[trial.trialId]);
  // The continuous reconciler runs every few seconds. Assessments are evidence
  // artifacts, so wall-clock passage alone must not create a new canonical
  // state revision. Reassess only when the declared trial population or its
  // resolved outcomes changed; clock freshness is tracked in process by
  // outcomeReconcilerLastCompletedAt below.
  if (!trialsChanged && !assessmentsMissing && newOutcomes === 0) {
    return {
      trials: trials.length,
      completedEpisodes: episodes.length,
      newOutcomes: 0,
      validOutcomes: allOutcomes.filter((outcome) => outcome.operationalStatus === 'valid').length,
      invalidOutcomes: allOutcomes.filter((outcome) => outcome.operationalStatus === 'invalid').length,
      assessments: Object.keys(state.assessments).length,
    };
  }
  const familyTrialCounts = trials.reduce((counts, trial) => {
    counts.set(trial.family, (counts.get(trial.family) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  for (const trial of trials) {
    state.assessments[trial.trialId] = assessExperimentEvidenceV5({
      trial,
      outcomes: allOutcomes,
      declaredFamilyTrials: familyTrialCounts.get(trial.family) || 1,
      assessedAt: now,
      policy: state.policy,
    });
  }
  state.lastReconciledAt = now;
  writeDatabase(db, ['experimentLearningV5']);

  for (const outcome of allOutcomes) {
    if (outcome.classification !== 'evidence_eligible' || state.lifecycleAppliedOutcomeIds[outcome.outcomeId]) continue;
    const event: ExperimentLifecycleEventV5 = {
      authorityVersion: 5,
      schema: 'experiment-lifecycle-event.v5',
      eventId: `lifecycle_v5_${digest({ outcomeId: outcome.outcomeId, type: outcome.evidencePostCostPnlUsd > 0 ? 'eligible_win' : 'eligible_loss' }).slice(0, 24)}`,
      experimentId: outcome.experimentId,
      type: outcome.evidencePostCostPnlUsd > 0 ? 'eligible_win' : 'eligible_loss',
      actor: 'system',
      reason: outcome.evidencePostCostPnlUsd > 0 ? 'POST_COST_ELIGIBLE_EPISODE_WIN' : 'POST_COST_ELIGIBLE_EPISODE_LOSS',
      evidenceIds: [outcome.outcomeId],
      // Apply in reconciliation order. The outcome keeps the true resolvedAt;
      // the lifecycle event must not backdate over newer regime/health state.
      at: now,
    };
    applyExperimentLifecycleEventV5(event);
    const latest = readDatabase();
    const latestLearning = learning(latest);
    latestLearning.lifecycleAppliedOutcomeIds[outcome.outcomeId] = event.eventId;
    writeDatabase(latest, ['experimentLearningV5']);
  }

  const final = learning(readDatabase());
  const finalOutcomes = Object.values(final.outcomes);
  return {
    trials: Object.keys(final.trials).length,
    completedEpisodes: episodes.length,
    newOutcomes,
    validOutcomes: finalOutcomes.filter((outcome) => outcome.operationalStatus === 'valid').length,
    invalidOutcomes: finalOutcomes.filter((outcome) => outcome.operationalStatus === 'invalid').length,
    assessments: Object.keys(final.assessments).length,
  };
}

let outcomeReconcilerStarted = false;
let outcomeReconcilerLastCompletedAt: number | null = null;
let outcomeReconcilerCadenceMs = 5_000;

export function runExperimentOutcomeReconcilerOnceV5(now = Date.now()) {
  const result = reconcileExperimentOutcomesV5(now);
  outcomeReconcilerLastCompletedAt = Date.now();
  return result;
}

export function outcomeReconcilerClockV5() {
  return {
    id: 'experiment_outcome_reconciler_v5',
    enabled: outcomeReconcilerStarted,
    cadenceMs: outcomeReconcilerCadenceMs,
    lastCompletedAt: outcomeReconcilerLastCompletedAt,
  };
}

export function startExperimentOutcomeReconcilerV5(): void {
  if (outcomeReconcilerStarted) return;
  outcomeReconcilerStarted = true;
  outcomeReconcilerCadenceMs = Math.max(1_000, Number(process.env.EXPERIMENT_OUTCOME_RECONCILE_MS) || 5_000);
  const run = () => {
    try {
      runExperimentOutcomeReconcilerOnceV5();
    } catch (error: any) {
      console.warn('[experiment-outcomes-v5] reconciliation failed:', error?.message);
    }
  };
  run();
  setInterval(run, outcomeReconcilerCadenceMs).unref();
  console.log(`[experiment-outcomes-v5] reconciling every ${outcomeReconcilerCadenceMs}ms; live execution locked`);
}

export function experimentLearningSnapshotV5() {
  const db = readDatabase();
  const state = db.experimentLearningV5 || {
    policy: structuredClone(DEFAULT_EXPERIMENT_LEARNING_POLICY_V5),
    trials: {},
    outcomes: {},
    assessments: {},
    lifecycleAppliedOutcomeIds: {},
  };
  return {
    mode: 'Paper money',
    liveExecution: 'locked',
    policy: state.policy,
    trials: Object.values(state.trials),
    outcomes: Object.values(state.outcomes).sort((left, right) => right.resolvedAt - left.resolvedAt),
    assessments: Object.values(state.assessments),
    lastReconciledAt: state.lastReconciledAt || null,
  };
}
