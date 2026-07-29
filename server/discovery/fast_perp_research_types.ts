export type FastPerpFamily =
  | 'book_imbalance_continuation'
  | 'book_imbalance_reversal'
  | 'short_momentum_continuation'
  | 'short_momentum_reversal'
  | 'aggressive_flow_continuation'
  | 'aggressive_flow_reversal'
  | 'liquidity_withdrawal_continuation'
  | 'liquidity_withdrawal_reversal'
  | 'liquidation_rebound'
  | 'funding_crowding_reversal';

export interface FastPerpParameterChoice {
  horizonMs: number;
  lookbackMs: number;
  threshold: number;
}

export interface FastPerpResearchSample {
  id: string;
  symbol: string;
  family: FastPerpFamily;
  sign: -1 | 1;
  decisionAt: number;
  resolvedAt: number;
  grossReturnBps: number;
  netReturnBps: number;
  executionCostBps?: number;
  filledNotionalUsd?: number;
  sourceEventIds: string[];
}

export interface FastPerpSplitMetrics {
  samples: number;
  meanGrossReturnBps: number | null;
  meanNetReturnBps: number | null;
  lowerBoundNetEdgeBps: number | null;
  winRate: number | null;
  independentBlockCount?: number;
  blockLengthMs?: number;
  alphaSpent?: number;
}

export interface FastPerpFamilyEvaluation {
  id: string;
  schemaVersion: 1;
  symbol: string;
  family: FastPerpFamily;
  speedTier: 'microstructure' | 'fast_event';
  selectedParameters: FastPerpParameterChoice | null;
  declaredTrials: number;
  training: FastPerpSplitMetrics;
  validation: FastPerpSplitMetrics;
  holdout: FastPerpSplitMetrics;
  independentSamples: number;
  opportunitiesPerDay: number;
  estimatedCapacityUsd: number;
  disposition: 'shadow_candidate' | 'declined' | 'insufficient';
  blockers: string[];
  sourceEventIds: string[];
  sampleDigest?: string;
  sourceEventCount?: number;
  evidenceCutoffAt: number;
  liveExecution: 'locked';
}

export interface FastPerpResearchRun {
  id: string;
  schemaVersion: 1;
  sourceVersion: string;
  researchPolicyVersion: string;
  evidenceFingerprint: string;
  datasetVersionId: string;
  universeVersionId: string;
  worldContractId: string;
  createdAt: number;
  symbols: string[];
  speedTiers: Array<'microstructure' | 'fast_event'>;
  declaredTrials: number;
  researchEpochId?: string;
  researchLookNumber?: number;
  globalDeclaredTrials?: number;
  evaluations: FastPerpFamilyEvaluation[];
  candidateContractIds: string[];
  shadowContractIds: string[];
  missingMechanismBlockers: string[];
  datasetManifest?: { tradeCount: number; bookCount: number; contextCount: number; sampleDigest: string };
  liveExecution: 'locked';
}
