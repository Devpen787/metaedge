export type FlywheelLane =
  | 'stocks'
  | 'spot_crypto'
  | 'perpetuals'
  | 'memecoins'
  | 'prediction_markets'
  | 'cross_chain';

export type FlywheelLaneStatus = 'implemented' | 'partial' | 'blocked';
export type AlphaLifecycle = 'research' | 'validated' | 'paper_shadow' | 'decaying' | 're_research' | 'killed';
export type AlphaFamily =
  | 'momentum'
  | 'mean_reversion'
  | 'regime_momentum'
  | 'regime_mean_reversion'
  | 'state_transition_continuation'
  | 'state_transition_reversal'
  | 'cross_sectional_momentum'
  | 'cross_sectional_reversal'
  | 'signed_event_drift'
  | 'microstructure_imbalance'
  | 'cross_market_relationship'
  | 'funding_carry'
  | 'prediction_calibration'
  | 'executable_arbitrage'
  | 'legacy_import';

export interface PointInTimeFeature {
  key: string;
  value: number | string | boolean | null;
  observedAt: number;
  availableAt: number;
  pointInTime: boolean;
  sourceHash?: string;
}

export interface PointInTimeStateInput {
  lane: FlywheelLane;
  symbol: string;
  observedAt: number;
  decisionAt: number;
  features: PointInTimeFeature[];
}

export interface PointInTimeState extends PointInTimeStateInput {
  id: string;
  contentHash: string;
  valid: boolean;
  blockers: string[];
  liveExecution: 'locked';
}

export interface BinaryTransitionEvidence {
  support: number;
  successes: number;
  posteriorProbability: number;
  adjustedLowerBound: number;
  baselineProbability: number;
  alpha: number;
  declaredTrials: number;
  minimumSupport: number;
  disposition: 'candidate' | 'declined' | 'blocked';
  reason: string;
}

export interface ExecutionCostInput {
  enabled: boolean;
  feeBps: number;
  impactBps: number;
  fundingBps: number;
}

export interface TakerCostInput extends ExecutionCostInput {
  halfSpreadBps: number;
  slippageBps: number;
}

export interface MakerCostInput extends ExecutionCostInput {
  adverseSelectionBps: number;
  fillProbability: number;
}

export interface DelayedCostInput extends TakerCostInput {
  edgeRetention: number;
  delayBars: number;
}

export interface ExecutionPolicyInput {
  predictedGrossEdgeBps: number;
  uncertaintyBufferBps: number;
  minimumNetEdgeBps: number;
  taker: TakerCostInput;
  maker: MakerCostInput;
  delayed?: DelayedCostInput;
}

export interface ExecutionPolicyDecision {
  policy: 'maker' | 'taker' | 'delayed' | 'no_trade';
  conservativeNetEdgeBps: number;
  estimatedCostBps: number;
  fillProbability: number;
  blockers: string[];
  liveExecution: 'locked';
}

export interface AlphaNoveltyRecord {
  id: string;
  candidateHash: string;
  nearestCandidateHash: string | null;
  maximumAbsoluteCorrelation: number;
  overlap: number;
  distinct: boolean;
  reason: string;
  createdAt: number;
}

export interface ExecutionDecisionRecord extends ExecutionPolicyDecision {
  id: string;
  trialId: string;
  candidateHash: string;
  createdAt: number;
  reason: string;
}

export interface PortfolioDecisionRecord extends PortfolioRiskDecision {
  id: string;
  trialId: string;
  candidateHash: string;
  createdAt: number;
  maximumExistingCorrelation: number;
  crowdingScore: number;
  stressedLossBps: number;
}

export interface PortfolioRiskInput {
  conservativeNetEdgeBps: number;
  maximumExistingCorrelation: number;
  crowdingScore: number;
  stressedLossBps: number;
  remainingTailBudgetBps: number;
  currentDrawdownBps: number;
  maximumDrawdownBps: number;
  maximumAllowedCorrelation: number;
  maximumCrowdingScore: number;
}

export interface PortfolioRiskDecision {
  allowed: boolean;
  blockers: string[];
  incrementalEdgeAfterCorrelationBps: number;
  paperOnly: true;
}

export interface AlphaTrial {
  id: string;
  candidateHash: string;
  evidenceFingerprint: string;
  lane: FlywheelLane;
  family: string;
  startedAt: number;
  completedAt: number;
  status: 'candidate' | 'declined' | 'blocked' | 'failed';
  reason: string;
  declaredTrials: number;
  support: number;
  validationId?: string;
  liveExecution: 'locked';
}

export interface AlphaCandidateSpec {
  id: string;
  contentHash: string;
  lane: FlywheelLane;
  family: AlphaFamily;
  scopeSymbols: string[];
  lookbackBars: number;
  horizonBars: number;
  roundTripCostBps: number;
  declaredTrials: number;
  targetKind: 'benchmark_relative_return' | 'funding_adjusted_return' | 'binary_resolution_probability' | 'executable_spread';
  rule: string;
  liveExecution: 'locked';
}

export interface AlphaSample {
  id: string;
  symbol: string;
  enteredAt: number;
  labelAt: number;
  score: number;
  grossReturnBps: number;
  netReturnBps: number;
  capacityUsd: number | null;
}

export interface AlphaSplitMetrics {
  n: number;
  meanGrossReturnBps: number | null;
  meanNetReturnBps: number | null;
  edgeLowerConfidenceBps: number | null;
  directionalAccuracy: number | null;
  predictedWinProbability: number | null;
  brierScore: number | null;
  scoreReturnCorrelation: number | null;
  minimumCapacityUsd: number | null;
}

export interface AlphaValidationRecord {
  id: string;
  candidateId: string;
  candidateHash: string;
  evidenceFingerprint: string;
  createdAt: number;
  purgeBars: number;
  train: AlphaSplitMetrics;
  validation: AlphaSplitMetrics;
  holdout: AlphaSplitMetrics;
  stressedHoldoutEdgeLcbBps: number | null;
  positiveWalkForwardFoldRatio: number;
  tailLossBps: number | null;
  disposition: 'candidate' | 'declined' | 'blocked';
  reason: string;
  liveExecution: 'locked';
}

export interface ForwardObservation {
  id: string;
  trialId: string;
  forecastAt: number;
  resolveAt: number;
  status: 'pending' | 'resolved' | 'expired';
  predictedValue: number;
  realizedValue: number | null;
  netPaperPnlBps: number | null;
  executionQuality: number | null;
  candidateHash?: string;
  lane?: FlywheelLane;
  kind?: 'paper_forecast' | 'calibration_forecast' | 'carry_trial';
}

export interface AttributionRecord {
  id: string;
  forwardObservationId: string;
  trialId: string;
  candidateHash: string;
  resolvedAt: number;
  directionalHit: boolean | null;
  calibrationSquaredError: number | null;
  netPaperPnlBps: number | null;
  executionQuality: number | null;
}

export interface AlphaLifecycleRecord {
  id: string;
  candidateHash: string;
  trialId: string;
  state: AlphaLifecycle;
  at: number;
  reason: string;
  resolvedForwardObservations: number;
  liveExecution: 'locked';
}

export interface ResearchQueueItem {
  id: string;
  candidateHash: string;
  sourceTrialId: string;
  trigger: 'FORWARD_DECAY' | 'HARD_RISK_BREACH' | 'NEW_EVIDENCE';
  status: 'open' | 'superseded' | 'completed';
  createdAt: number;
  reason: string;
}

export interface FlywheelCoverageLane {
  status: FlywheelLaneStatus;
  observations: number;
  trials: number;
  blockers: string[];
  symbols?: string[];
  universeAuthority?: string;
}

export interface FlywheelCoverage {
  generatedAt: number;
  lanes: Record<FlywheelLane, FlywheelCoverageLane>;
  liveExecution: 'locked';
}

export interface FlywheelSnapshot {
  mode: 'Paper research';
  states: PointInTimeState[];
  candidates: AlphaCandidateSpec[];
  validations: AlphaValidationRecord[];
  novelty: AlphaNoveltyRecord[];
  executionDecisions: ExecutionDecisionRecord[];
  portfolioDecisions: PortfolioDecisionRecord[];
  trials: AlphaTrial[];
  forwardObservations: ForwardObservation[];
  attributions: AttributionRecord[];
  lifecycle: AlphaLifecycleRecord[];
  researchQueue: ResearchQueueItem[];
  coverage: FlywheelCoverage | null;
  integrity: {
    orphanTrialIds: string[];
    orphanValidationIds: string[];
    invalidStateIds: string[];
    allLiveExecutionLocked: boolean;
  };
  operatorSummary: {
    generatedAt: number;
    currentCandidateContracts: number;
    currentTrials: Record<AlphaTrial['status'], number>;
    currentLifecycle: Partial<Record<AlphaLifecycle, number>>;
    currentExecutionPolicies: Partial<Record<ExecutionPolicyDecision['policy'], number>>;
    portfolioAllowed: number;
    portfolioBlocked: number;
    forward: { pending: number; resolved: number; expired: number; attributed: number };
    measuredChangeFromV1: {
      researchCards: number;
      accountableCandidateContracts: number;
      marketLanes: { before: number; now: number };
      promotedAlpha: number;
      conclusion: string;
    };
  };
  liveExecution: 'locked';
}
