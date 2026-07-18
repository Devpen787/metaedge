import type { FlywheelLane } from './flywheel_types.js';

export type SpeedTier = 'microstructure' | 'fast_event' | 'research';
export type PaperLifecycleState = 'research_candidate' | 'shadow_paper' | 'funded_paper' | 'live_review';
export type EvidenceMode = 'historical_replay' | 'canary' | 'paper_forward';

export interface StrategyVersion {
  id: string;
  schemaVersion: 1;
  strategyFamilyId: string;
  mechanism: string;
  parameterGrammar: string;
  universeVersionId: string;
  costModel: PaperTradeCosts;
  riskPolicy: PaperTradeRiskLimits;
  softwareVersion: string;
  immutable: true;
}

export interface EconomicObjectivePolicy {
  schemaVersion: 1;
  id: string;
  version: string;
  description: string;
  scoreUnit: 'conservative_net_usd_per_day';
  tierGates: Record<SpeedTier, {
    minimumHistoricalSamplesForShadow: number;
    minimumUntouchedForwardSamplesForFunding: number;
    minimumFundedPaperSamplesForLiveReview: number;
    minimumFillRateForFunding: number;
    maximumCostCalibrationErrorFraction: number;
  }>;
  liveExecution: 'locked';
}

export interface PaperTradeCosts {
  feeBps: number;
  spreadBps: number;
  slippageBps: number;
  impactBps: number;
  fundingBps: number;
  borrowBps: number;
  adverseSelectionBps: number;
  latencyBps: number;
  totalBps: number;
}

export interface PaperTradeConfidence {
  confidenceLevel: number;
  predictedWinProbability: number | null;
  lowerBoundNetEdgeBps: number | null;
  independentHistoricalSamples: number;
  untouchedForwardSamples: number;
  fundedPaperSamples: number;
}

export interface PaperTradeCapacity {
  requestedPaperUsd: number;
  deployableUsd: number;
  participationRate: number;
}

export interface PaperTradeRiskLimits {
  maximumPositionUsd: number;
  maximumLossPerTradeUsd: number;
  maximumStrategyDrawdownUsd: number;
  maximumGrossExposureUsd: number;
  maximumConsecutiveLosses: number;
}

export interface PaperTradeProvenance {
  datasetVersionId: string;
  universeVersionId: string;
  worldContractId: string;
  sourceEventIds: string[];
  signalArtifactIds: string[];
  validationEvaluationIds: string[];
  sourceVenue: string;
  sourceVersion: string;
  feeProvenance: 'configured_conservative' | 'authenticated_venue';
}

export interface ImmutableKillRule {
  maximumForwardLossBps: number;
  maximumDrawdownUsd: number;
  maximumConsecutiveLosses: number;
  minimumForwardNetEdgeBps: number;
  minimumForwardFillRate: number;
  action: 'kill_and_research';
  immutable: true;
}

export interface PaperTradeEconomics {
  opportunitiesPerDay: number;
  conservativeNetUsdPerTrade: number;
  conservativeNetUsdPerDay: number;
  capitalEfficiencyBpsPerDay: number;
  correlationPenaltyUsdPerDay: number;
  tailRiskPenaltyUsdPerDay: number;
  drawdownPenaltyUsdPerDay: number;
  objectiveScoreUsdPerDay: number;
}

export interface PaperTradeContract {
  id: string;
  schemaVersion: 1;
  objectivePolicyId: string;
  strategyVersionId: string;
  candidateId: string;
  strategyFamilyId: string;
  lane: FlywheelLane;
  speedTier: SpeedTier;
  mechanism: string;
  trigger: string;
  instrument: string;
  venue: string;
  side: 'long' | 'short' | 'both';
  executionPolicy: 'taker_market' | 'maker_limit' | 'delayed_taker';
  decisionAt: number;
  evidenceCutoffAt: number;
  edgeHalfLifeMs: number;
  entryRule: string;
  exitRule: string;
  expiresAt: number;
  predictedGrossEdgeBps: number;
  costs: PaperTradeCosts;
  uncertaintyBufferBps: number;
  conservativeNetEdgeBps: number;
  confidence: PaperTradeConfidence;
  capacity: PaperTradeCapacity;
  economics: PaperTradeEconomics;
  riskLimits: PaperTradeRiskLimits;
  provenance: PaperTradeProvenance;
  lifecycleState: PaperLifecycleState;
  lifecycleBlockers: string[];
  killRule: ImmutableKillRule;
  immutable: true;
  createdAt: number;
  liveExecution: 'locked';
}

export interface PaperTradeLifecycleEvidence {
  historicalSamples: number;
  untouchedForwardSamples: number;
  fundedPaperSamples: number;
  forwardNetEdgeLowerBoundBps: number | null;
  costStressedNetEdgeLowerBoundBps: number | null;
  worstNetReturnBps: number | null;
  realizedNetPnlUsd: number;
  fillRate: number | null;
  costCalibrationErrorFraction: number | null;
  maximumDrawdownUsd: number;
  consecutiveLosses: number;
  sourceObservationIds: string[];
  eligibleSampleIds?: string[];
  independentBlockCount?: number;
  blockLengthMs?: number;
  statisticalLookNumber?: number;
  alphaSpent?: number;
}

export interface PaperTradeLifecycleEvent {
  id: string;
  schemaVersion: 1;
  contractId: string;
  from: PaperLifecycleState;
  to: PaperLifecycleState;
  evaluatedAt: number;
  evidence: PaperTradeLifecycleEvidence;
  passed: boolean;
  blockers: string[];
  policyId: string;
  eligibleSampleIds: string[];
  independentBlockCount: number;
  statisticalLookNumber: number;
  alphaSpent: number;
  costEvidence: { expectedCostBps: number; calibrationErrorFraction: number | null };
  riskEvidence: { maximumDrawdownUsd: number; consecutiveLosses: number };
  liveExecution: 'locked';
}

export interface PaperTradeKillEvent {
  id: string;
  schemaVersion: 1;
  contractId: string;
  evaluatedAt: number;
  evidence: PaperTradeLifecycleEvidence;
  triggered: boolean;
  blockers: string[];
  action: 'kill_and_research' | 'continue_observation';
  liveExecution: 'locked';
}

export interface CompoundedPaperTradeReturn {
  at: number;
  grossReturnBps: number;
  totalCostBps: number;
  netReturnBps: number;
}

export interface CompoundedPaperNavPoint extends CompoundedPaperTradeReturn {
  navBeforeUsd: number;
  pnlUsd: number;
  navAfterUsd: number;
}

export type ShadowExecutionCohort = 'maker' | 'taker' | 'delayed' | 'no_trade';

export interface FastShadowDecision {
  id: string;
  schemaVersion: 1;
  contractId: string;
  strategyVersionId: string;
  candidateId: string;
  sourceSignalEventIds: string[];
  symbol: string;
  side: 'long' | 'short';
  cohort: ShadowExecutionCohort;
  evidenceMode: EvidenceMode;
  recordedAt: number;
  decidedAt: number;
  evidenceCutoffAt: number;
  expiresAt: number;
  horizonMs: number;
  latencyMs: number;
  requestedNotionalUsd: number;
  participationRate: number;
  referenceMidPrice: number;
  primaryExecutionPolicy: PaperTradeContract['executionPolicy'];
  decisionLagMs: number;
  riskReservationId: string;
  decisionBlockers?: string[];
  liveExecution: 'locked';
}

export interface FastShadowOutcome {
  id: string;
  schemaVersion: 1;
  decisionId: string;
  contractId: string;
  cohort: ShadowExecutionCohort;
  evidenceMode: EvidenceMode;
  promotable: boolean;
  resolvedAt: number;
  expectedResolutionAt: number;
  timingDeviationMs: number | null;
  timingValid: boolean;
  status: 'filled' | 'partial' | 'cancelled' | 'no_trade' | 'risk_rejected' | 'unresolved';
  requestedNotionalUsd: number;
  filledNotionalUsd: number;
  fillRate: number;
  queueAheadUsd: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  grossPnlUsd: number;
  feeUsd: number;
  spreadUsd: number;
  slippageUsd: number;
  impactUsd: number;
  fundingUsd: number;
  borrowUsd: number;
  adverseSelectionUsd: number;
  netPnlUsd: number;
  noTradeCounterfactualNetPnlUsd: number;
  navBeforeUsd: number;
  navAfterUsd: number;
  marginUsedUsd: number;
  blockers: string[];
  sourceEventIds: string[];
  liveExecution: 'locked';
}

// Stable cross-runtime names frozen for the canonical Python port. The legacy
// FastShadow names remain for one compatibility release.
export type PaperDecision = FastShadowDecision;
export type PaperOutcome = FastShadowOutcome;
export type LifecycleEvent = PaperTradeLifecycleEvent;
