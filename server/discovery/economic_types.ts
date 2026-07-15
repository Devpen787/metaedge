import type { FlywheelLane } from './flywheel_types.js';

export type SpeedTier = 'microstructure' | 'fast_event' | 'research';
export type PaperLifecycleState = 'research_candidate' | 'shadow_paper' | 'funded_paper' | 'live_review';

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
  candidateId: string;
  strategyFamilyId: string;
  lane: FlywheelLane;
  speedTier: SpeedTier;
  mechanism: string;
  trigger: string;
  instrument: string;
  venue: string;
  side: 'long' | 'short' | 'both';
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
  realizedNetPnlUsd: number;
  fillRate: number | null;
  costCalibrationErrorFraction: number | null;
  maximumDrawdownUsd: number;
  consecutiveLosses: number;
  sourceObservationIds: string[];
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
