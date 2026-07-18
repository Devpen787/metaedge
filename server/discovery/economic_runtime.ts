import { contentHash } from './store.js';
import type {
  CompoundedPaperNavPoint,
  CompoundedPaperTradeReturn,
  EconomicObjectivePolicy,
  PaperLifecycleState,
  PaperTradeContract,
  PaperTradeLifecycleEvent,
  PaperTradeLifecycleEvidence,
  PaperTradeKillEvent,
  SpeedTier,
} from './economic_types.js';

export const ECONOMIC_OBJECTIVE_POLICY: EconomicObjectivePolicy = {
  schemaVersion: 1,
  id: 'economic-objective-policy-v2',
  version: 'economic-objective-policy-v2',
  description: 'Maximize conservative post-cost net paper dollars per day after capacity, correlation, tail-risk, and drawdown penalties.',
  scoreUnit: 'conservative_net_usd_per_day',
  tierGates: {
    microstructure: {
      minimumHistoricalSamplesForShadow: 100,
      minimumUntouchedForwardSamplesForFunding: 500,
      minimumFundedPaperSamplesForLiveReview: 2_000,
      minimumFillRateForFunding: 0.25,
      maximumCostCalibrationErrorFraction: 0.2,
    },
    fast_event: {
      minimumHistoricalSamplesForShadow: 30,
      minimumUntouchedForwardSamplesForFunding: 100,
      minimumFundedPaperSamplesForLiveReview: 300,
      minimumFillRateForFunding: 0.4,
      maximumCostCalibrationErrorFraction: 0.25,
    },
    research: {
      minimumHistoricalSamplesForShadow: 20,
      minimumUntouchedForwardSamplesForFunding: 30,
      minimumFundedPaperSamplesForLiveReview: 100,
      minimumFillRateForFunding: 0.5,
      maximumCostCalibrationErrorFraction: 0.3,
    },
  },
  liveExecution: 'locked',
};

const ORDERED_STATES: PaperLifecycleState[] = ['research_candidate', 'shadow_paper', 'funded_paper', 'live_review'];

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name.toUpperCase()}_NOT_FINITE`);
  return value;
}

function nonNegative(value: number, name: string): number {
  finite(value, name);
  if (value < 0) throw new Error(`${name.toUpperCase()}_NEGATIVE`);
  return value;
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }

export function totalPaperTradeCosts(costs: Omit<PaperTradeContract['costs'], 'totalBps'>): number {
  return Object.entries(costs).reduce((sum, [name, value]) => sum + nonNegative(value, `cost_${name}`), 0);
}

export function buildPaperTradeContract(input: {
  candidateId: string;
  strategyFamilyId: string;
  lane: PaperTradeContract['lane'];
  speedTier: SpeedTier;
  mechanism: string;
  trigger: string;
  instrument: string;
  venue: string;
  side: PaperTradeContract['side'];
  executionPolicy: PaperTradeContract['executionPolicy'];
  decisionAt: number;
  evidenceCutoffAt: number;
  edgeHalfLifeMs: number;
  entryRule: string;
  exitRule: string;
  expiresAt: number;
  predictedGrossEdgeBps: number;
  costs: Omit<PaperTradeContract['costs'], 'totalBps'>;
  uncertaintyBufferBps: number;
  confidence: PaperTradeContract['confidence'];
  capacity: PaperTradeContract['capacity'];
  opportunitiesPerDay: number;
  maximumExistingCorrelation: number;
  tailRiskPenaltyUsdPerDay: number;
  drawdownPenaltyUsdPerDay: number;
  riskLimits: PaperTradeContract['riskLimits'];
  provenance: Omit<PaperTradeContract['provenance'], 'feeProvenance'> & { feeProvenance?: PaperTradeContract['provenance']['feeProvenance'] };
  killRule: PaperTradeContract['killRule'];
  createdAt?: number;
  softwareVersion?: string;
  policy?: EconomicObjectivePolicy;
}): PaperTradeContract {
  const policy = input.policy ?? ECONOMIC_OBJECTIVE_POLICY;
  if (!input.candidateId || !input.strategyFamilyId || !input.instrument || !input.venue) throw new Error('PAPER_CONTRACT_IDENTITY_INCOMPLETE');
  if (!input.mechanism || !input.trigger || !input.entryRule || !input.exitRule) throw new Error('PAPER_CONTRACT_RULES_INCOMPLETE');
  if (!(input.decisionAt >= input.evidenceCutoffAt)) throw new Error('PAPER_CONTRACT_DECISION_PRECEDES_EVIDENCE_CUTOFF');
  if (!(input.expiresAt > input.decisionAt) || !(input.edgeHalfLifeMs > 0)
    || input.expiresAt - input.decisionAt > input.edgeHalfLifeMs) throw new Error('PAPER_CONTRACT_EXPIRY_EXCEEDS_EDGE_HALF_LIFE');
  if (!(input.confidence.confidenceLevel > 0.5 && input.confidence.confidenceLevel < 1)) throw new Error('PAPER_CONTRACT_CONFIDENCE_LEVEL_INVALID');
  if (input.confidence.predictedWinProbability != null
    && !(input.confidence.predictedWinProbability >= 0 && input.confidence.predictedWinProbability <= 1)) {
    throw new Error('PAPER_CONTRACT_WIN_PROBABILITY_INVALID');
  }
  const sourceEventIds = [...new Set(input.provenance.sourceEventIds)].sort();
  if (!input.provenance.datasetVersionId || !input.provenance.universeVersionId || !input.provenance.worldContractId
    || !input.provenance.sourceVenue || !input.provenance.sourceVersion || !sourceEventIds.length) {
    throw new Error('PAPER_CONTRACT_PROVENANCE_INCOMPLETE');
  }
  const totalBps = totalPaperTradeCosts(input.costs);
  const uncertaintyBufferBps = nonNegative(input.uncertaintyBufferBps, 'uncertainty_buffer_bps');
  const predictedGrossEdgeBps = finite(input.predictedGrossEdgeBps, 'predicted_gross_edge_bps');
  const conservativeNetEdgeBps = predictedGrossEdgeBps - totalBps - uncertaintyBufferBps;
  const lowerBound = input.confidence.lowerBoundNetEdgeBps;
  const scoringEdgeBps = Math.min(conservativeNetEdgeBps, lowerBound ?? Number.NEGATIVE_INFINITY);
  const deployableUsd = nonNegative(input.capacity.deployableUsd, 'deployable_usd');
  const requestedPaperUsd = nonNegative(input.capacity.requestedPaperUsd, 'requested_paper_usd');
  if (!(input.capacity.participationRate > 0 && input.capacity.participationRate <= 1)) throw new Error('PAPER_CONTRACT_PARTICIPATION_INVALID');
  const notionalUsd = Math.min(deployableUsd, requestedPaperUsd);
  const conservativeNetUsdPerTrade = Number.isFinite(scoringEdgeBps) ? notionalUsd * scoringEdgeBps / 10_000 : 0;
  const opportunitiesPerDay = nonNegative(input.opportunitiesPerDay, 'opportunities_per_day');
  const conservativeNetUsdPerDay = conservativeNetUsdPerTrade * opportunitiesPerDay;
  const correlationPenaltyUsdPerDay = Math.max(0, conservativeNetUsdPerDay) * clamp01(Math.abs(input.maximumExistingCorrelation));
  const tailRiskPenaltyUsdPerDay = nonNegative(input.tailRiskPenaltyUsdPerDay, 'tail_risk_penalty_usd_per_day');
  const drawdownPenaltyUsdPerDay = nonNegative(input.drawdownPenaltyUsdPerDay, 'drawdown_penalty_usd_per_day');
  const historicalSampleEligible = input.confidence.independentHistoricalSamples
    >= policy.tierGates[input.speedTier].minimumHistoricalSamplesForShadow;
  const objectiveScoreUsdPerDay = historicalSampleEligible ? conservativeNetUsdPerDay - correlationPenaltyUsdPerDay
    - tailRiskPenaltyUsdPerDay - drawdownPenaltyUsdPerDay : 0;
  const capitalEfficiencyBpsPerDay = notionalUsd > 0 ? conservativeNetUsdPerDay / notionalUsd * 10_000 : 0;
  const lifecycleBlockers = [
    ...(!(scoringEdgeBps > 0) ? ['CONSERVATIVE_NET_EDGE_LOWER_BOUND_NOT_POSITIVE'] : []),
    ...(notionalUsd <= 0 ? ['NO_DEPLOYABLE_PAPER_CAPACITY'] : []),
    ...(input.confidence.independentHistoricalSamples < policy.tierGates[input.speedTier].minimumHistoricalSamplesForShadow
      ? [`HISTORICAL_SAMPLE_GATE:${input.confidence.independentHistoricalSamples}/${policy.tierGates[input.speedTier].minimumHistoricalSamplesForShadow}`] : []),
    ...(!(objectiveScoreUsdPerDay > 0) ? ['ECONOMIC_OBJECTIVE_SCORE_NOT_POSITIVE'] : []),
    ...(tailRiskPenaltyUsdPerDay <= 0 ? ['TAIL_RISK_PENALTY_UNMEASURED'] : []),
    ...(drawdownPenaltyUsdPerDay <= 0 ? ['DRAWDOWN_PENALTY_UNMEASURED'] : []),
  ];
  if (!input.killRule.immutable || input.killRule.action !== 'kill_and_research') throw new Error('PAPER_CONTRACT_KILL_RULE_NOT_IMMUTABLE');
  if (input.riskLimits.maximumPositionUsd > input.riskLimits.maximumGrossExposureUsd) throw new Error('PAPER_CONTRACT_POSITION_EXCEEDS_GROSS_LIMIT');
  const createdAt = input.createdAt ?? Date.now();
  const strategyVersionId = `strategy_version_${contentHash({ strategyFamilyId: input.strategyFamilyId,
    mechanism: input.mechanism, parameterGrammar: input.trigger, universeVersionId: input.provenance.universeVersionId,
    costModel: { ...input.costs, totalBps }, riskPolicy: input.riskLimits, executionPolicy: input.executionPolicy,
    objectivePolicyId: policy.id, killRule: input.killRule, softwareVersion: input.softwareVersion ?? 'working-tree' }).slice(0, 20)}`;
  const base = {
    schemaVersion: 1 as const,
    objectivePolicyId: policy.id,
    strategyVersionId,
    candidateId: input.candidateId,
    strategyFamilyId: input.strategyFamilyId,
    lane: input.lane,
    speedTier: input.speedTier,
    mechanism: input.mechanism,
    trigger: input.trigger,
    instrument: input.instrument,
    venue: input.venue,
    side: input.side,
    executionPolicy: input.executionPolicy,
    decisionAt: input.decisionAt,
    evidenceCutoffAt: input.evidenceCutoffAt,
    edgeHalfLifeMs: input.edgeHalfLifeMs,
    entryRule: input.entryRule,
    exitRule: input.exitRule,
    expiresAt: input.expiresAt,
    predictedGrossEdgeBps,
    costs: { ...input.costs, totalBps },
    uncertaintyBufferBps,
    conservativeNetEdgeBps,
    confidence: input.confidence,
    capacity: input.capacity,
    economics: { opportunitiesPerDay, conservativeNetUsdPerTrade, conservativeNetUsdPerDay,
      capitalEfficiencyBpsPerDay, correlationPenaltyUsdPerDay, tailRiskPenaltyUsdPerDay,
      drawdownPenaltyUsdPerDay, objectiveScoreUsdPerDay },
    riskLimits: input.riskLimits,
    provenance: { ...input.provenance, feeProvenance: input.provenance.feeProvenance ?? 'configured_conservative', sourceEventIds,
      signalArtifactIds: [...new Set(input.provenance.signalArtifactIds)].sort(),
      validationEvaluationIds: [...new Set(input.provenance.validationEvaluationIds)].sort() },
    lifecycleState: 'research_candidate' as const,
    lifecycleBlockers,
    killRule: input.killRule,
    immutable: true as const,
    createdAt,
    liveExecution: 'locked' as const,
  };
  return { id: `paper_contract_${contentHash(base).slice(0, 20)}`, ...base };
}

function nextState(state: PaperLifecycleState): PaperLifecycleState | null {
  return ORDERED_STATES[ORDERED_STATES.indexOf(state) + 1] ?? null;
}

export function evaluatePaperLifecycle(input: {
  contract: PaperTradeContract;
  currentState: PaperLifecycleState;
  requestedState: PaperLifecycleState;
  evidence: PaperTradeLifecycleEvidence;
  evaluatedAt?: number;
  policy?: EconomicObjectivePolicy;
}): PaperTradeLifecycleEvent {
  const policy = input.policy ?? ECONOMIC_OBJECTIVE_POLICY;
  if (input.contract.liveExecution !== 'locked') throw new Error('PAPER_LIFECYCLE_LIVE_NOT_LOCKED');
  if (nextState(input.currentState) !== input.requestedState) throw new Error('PAPER_LIFECYCLE_TRANSITION_NOT_SEQUENTIAL');
  const gate = policy.tierGates[input.contract.speedTier];
  const blockers = [...input.contract.lifecycleBlockers];
  if (input.requestedState === 'shadow_paper') {
    if (input.evidence.historicalSamples < gate.minimumHistoricalSamplesForShadow) {
      blockers.push(`HISTORICAL_SAMPLE_GATE:${input.evidence.historicalSamples}/${gate.minimumHistoricalSamplesForShadow}`);
    }
  } else if (input.requestedState === 'funded_paper') {
    if (input.evidence.untouchedForwardSamples < gate.minimumUntouchedForwardSamplesForFunding) {
      blockers.push(`UNTOUCHED_FORWARD_SAMPLE_GATE:${input.evidence.untouchedForwardSamples}/${gate.minimumUntouchedForwardSamplesForFunding}`);
    }
    if (!(input.evidence.forwardNetEdgeLowerBoundBps != null && input.evidence.forwardNetEdgeLowerBoundBps > 0)) {
      blockers.push('FORWARD_NET_EDGE_LOWER_BOUND_NOT_POSITIVE');
    }
    if (!(input.evidence.costStressedNetEdgeLowerBoundBps != null && input.evidence.costStressedNetEdgeLowerBoundBps > 0)) {
      blockers.push('COST_STRESSED_NET_EDGE_LOWER_BOUND_NOT_POSITIVE');
    }
    if (!(input.evidence.realizedNetPnlUsd > 0)) blockers.push('FORWARD_REALIZED_NET_PNL_NOT_POSITIVE');
    if (!(input.evidence.fillRate != null && input.evidence.fillRate >= gate.minimumFillRateForFunding)) {
      blockers.push(`FORWARD_FILL_RATE_GATE:${input.evidence.fillRate ?? 'missing'}/${gate.minimumFillRateForFunding}`);
    }
    if (!(input.evidence.costCalibrationErrorFraction != null
      && input.evidence.costCalibrationErrorFraction <= gate.maximumCostCalibrationErrorFraction)) {
      blockers.push(`COST_CALIBRATION_GATE:${input.evidence.costCalibrationErrorFraction ?? 'missing'}/${gate.maximumCostCalibrationErrorFraction}`);
    }
    const minimumBlocks = input.contract.speedTier === 'microstructure' ? 20 : input.contract.speedTier === 'fast_event' ? 10 : 5;
    if ((input.evidence.independentBlockCount ?? 0) < minimumBlocks) {
      blockers.push(`INDEPENDENT_TIME_BLOCK_GATE:${input.evidence.independentBlockCount ?? 0}/${minimumBlocks}`);
    }
  } else if (input.requestedState === 'live_review') {
    if (input.evidence.fundedPaperSamples < gate.minimumFundedPaperSamplesForLiveReview) {
      blockers.push(`FUNDED_PAPER_SAMPLE_GATE:${input.evidence.fundedPaperSamples}/${gate.minimumFundedPaperSamplesForLiveReview}`);
    }
    if (!(input.evidence.forwardNetEdgeLowerBoundBps != null && input.evidence.forwardNetEdgeLowerBoundBps > 0)) {
      blockers.push('FUNDED_PAPER_NET_EDGE_LOWER_BOUND_NOT_POSITIVE');
    }
    if (!(input.evidence.costStressedNetEdgeLowerBoundBps != null && input.evidence.costStressedNetEdgeLowerBoundBps > 0)) {
      blockers.push('FUNDED_PAPER_COST_STRESSED_EDGE_NOT_POSITIVE');
    }
    if (input.contract.provenance.feeProvenance !== 'authenticated_venue') blockers.push('AUTHENTICATED_VENUE_FEE_PROVENANCE_MISSING');
    const minimumBlocks = input.contract.speedTier === 'microstructure' ? 20 : input.contract.speedTier === 'fast_event' ? 10 : 5;
    if ((input.evidence.independentBlockCount ?? 0) < minimumBlocks) {
      blockers.push(`INDEPENDENT_TIME_BLOCK_GATE:${input.evidence.independentBlockCount ?? 0}/${minimumBlocks}`);
    }
  }
  if (input.evidence.worstNetReturnBps != null
    && input.evidence.worstNetReturnBps <= -input.contract.killRule.maximumForwardLossBps) {
    blockers.push('IMMUTABLE_MAXIMUM_FORWARD_LOSS_KILL_RULE_TRIGGERED');
  }
  if (input.evidence.maximumDrawdownUsd > input.contract.killRule.maximumDrawdownUsd) blockers.push('IMMUTABLE_DRAWDOWN_KILL_RULE_TRIGGERED');
  if (input.evidence.consecutiveLosses >= input.contract.killRule.maximumConsecutiveLosses) blockers.push('IMMUTABLE_CONSECUTIVE_LOSS_KILL_RULE_TRIGGERED');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const evaluatedAt = input.evaluatedAt ?? Date.now();
  const identity = { contractId: input.contract.id, from: input.currentState, to: input.requestedState,
    evaluatedAt, evidence: input.evidence, blockers: uniqueBlockers, policyId: policy.id };
  const eligibleSampleIds = input.evidence.eligibleSampleIds ?? input.evidence.sourceObservationIds;
  const independentBlockCount = input.evidence.independentBlockCount ?? 0;
  const statisticalLookNumber = input.evidence.statisticalLookNumber ?? 1;
  const alphaSpent = input.evidence.alphaSpent ?? 0.025;
  return { id: `paper_lifecycle_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    ...identity, eligibleSampleIds, independentBlockCount, statisticalLookNumber, alphaSpent,
    costEvidence: { expectedCostBps: input.contract.costs.totalBps,
      calibrationErrorFraction: input.evidence.costCalibrationErrorFraction },
    riskEvidence: { maximumDrawdownUsd: input.evidence.maximumDrawdownUsd,
      consecutiveLosses: input.evidence.consecutiveLosses },
    passed: uniqueBlockers.length === 0, liveExecution: 'locked' };
}

export function evaluatePaperKillRule(input: {
  contract: PaperTradeContract;
  evidence: PaperTradeLifecycleEvidence;
  evaluatedAt?: number;
}): PaperTradeKillEvent {
  const blockers: string[] = [];
  if (input.evidence.worstNetReturnBps != null
    && input.evidence.worstNetReturnBps <= -input.contract.killRule.maximumForwardLossBps) {
    blockers.push('IMMUTABLE_MAXIMUM_FORWARD_LOSS_KILL_RULE_TRIGGERED');
  }
  if (input.evidence.maximumDrawdownUsd > input.contract.killRule.maximumDrawdownUsd) {
    blockers.push('IMMUTABLE_DRAWDOWN_KILL_RULE_TRIGGERED');
  }
  if (input.evidence.consecutiveLosses >= input.contract.killRule.maximumConsecutiveLosses) {
    blockers.push('IMMUTABLE_CONSECUTIVE_LOSS_KILL_RULE_TRIGGERED');
  }
  const minimumMonitoringSamples = ECONOMIC_OBJECTIVE_POLICY.tierGates[input.contract.speedTier]
    .minimumUntouchedForwardSamplesForFunding;
  const monitoredSamples = input.evidence.untouchedForwardSamples + input.evidence.fundedPaperSamples;
  if (monitoredSamples >= minimumMonitoringSamples && (input.evidence.forwardNetEdgeLowerBoundBps == null
    || input.evidence.forwardNetEdgeLowerBoundBps < input.contract.killRule.minimumForwardNetEdgeBps)) {
    blockers.push('IMMUTABLE_MINIMUM_FORWARD_EDGE_KILL_RULE_TRIGGERED');
  }
  const evaluatedAt = input.evaluatedAt ?? Date.now();
  const identity = { contractId: input.contract.id, evaluatedAt, evidence: input.evidence, blockers };
  return { id: `paper_kill_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, ...identity,
    triggered: blockers.length > 0, action: blockers.length ? 'kill_and_research' : 'continue_observation',
    liveExecution: 'locked' };
}

export function compoundPaperNav(initialNavUsd: number, returns: CompoundedPaperTradeReturn[]): CompoundedPaperNavPoint[] {
  if (!(initialNavUsd > 0)) throw new Error('COMPOUND_INITIAL_NAV_INVALID');
  let nav = initialNavUsd;
  return [...returns].sort((left, right) => left.at - right.at).map((row) => {
    const grossReturnBps = finite(row.grossReturnBps, 'compound_gross_return_bps');
    const totalCostBps = nonNegative(row.totalCostBps, 'compound_total_cost_bps');
    const netReturnBps = grossReturnBps - totalCostBps;
    const navBeforeUsd = nav;
    const pnlUsd = navBeforeUsd * netReturnBps / 10_000;
    nav += pnlUsd;
    return { ...row, netReturnBps, navBeforeUsd, pnlUsd, navAfterUsd: nav };
  });
}

export function rankPaperTradeContracts(contracts: PaperTradeContract[]): PaperTradeContract[] {
  return [...contracts].sort((left, right) => right.economics.objectiveScoreUsdPerDay - left.economics.objectiveScoreUsdPerDay
    || right.confidence.independentHistoricalSamples - left.confidence.independentHistoricalSamples
    || left.id.localeCompare(right.id));
}
