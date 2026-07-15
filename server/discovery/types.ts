export type MarketLane = 'stocks' | 'crypto' | 'memecoins';
export type InstrumentKind = 'equity' | 'spot';
export type CatalystKind =
  | 'filing_event'
  | 'price_volume_breakout'
  | 'momentum_attention'
  | 'meme_participation_spike'
  | 'cross_market_lead_lag';

export interface SourceProvenance {
  provider: string;
  dataset: string;
  sourcePath: string;
  observedAt: number;
  retrievedAt: number;
  pointInTime: boolean;
}

export interface PriceBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  qv?: number;
  trades?: number;
}

export interface CatalystObservation {
  id: string;
  lane: MarketLane;
  symbol: string;
  benchmark: string;
  instrument: InstrumentKind;
  kind: CatalystKind;
  occurredAt: number;
  availableAt: number;
  featureCutoffAt: number;
  features: Record<string, number | string | boolean | null>;
  provenance: SourceProvenance[];
}

export type BarrierOutcome = 'upper' | 'lower' | 'timeout' | 'unresolved';

export interface UpswingLabel {
  outcome: BarrierOutcome;
  horizonBars: number;
  barsObserved: number;
  upperBarrierBps: number;
  lowerBarrierBps: number;
  roundTripCostBps: number;
  realizedNetRelativeBps: number | null;
  hitAt?: number;
}

export interface EdgeStatistics {
  n: number;
  meanNetRelativeBps: number | null;
  sampleStdBps: number | null;
  standardErrorBps: number | null;
  oneSidedCriticalZ: number | null;
  edgeLowerConfidenceBps: number | null;
  winRate: number | null;
  alpha: number;
  multipleTestingTrials: number;
}

export interface WalkForwardEvidence {
  train: EdgeStatistics;
  validation: EdgeStatistics;
  holdout: EdgeStatistics;
  folds: Array<{ fold: number; trainSamples: number; testSamples: number; test: EdgeStatistics }>;
  positiveFoldRatio: number;
  positiveValidation: boolean;
  positiveHoldout: boolean;
  costSensitivity: Array<{ roundTripCostBps: number; holdoutEdgeLcbBps: number | null }>;
}

export interface MemeRiskGate {
  liquidityUsd: number | null;
  exitCapacityUsd: number | null;
  requestedNotionalUsd: number;
  holderConcentrationTop10Pct: number | null;
  turnoverRatio: number | null;
  volumeAcceleration: number | null;
  tradeCountAcceleration: number | null;
  passed: boolean;
  blockers: string[];
}

export type FactoryDisposition =
  | 'declined'
  | 'research_hypothesis'
  | 'forward_paper_candidate';

export interface AgentStageEvidence {
  role: 'observer' | 'miner' | 'compiler' | 'skeptic' | 'validator' | 'paper_operator' | 'research_memory';
  at: number;
  status: 'pass' | 'decline' | 'pending';
  summary: string;
}

export interface OpportunityCard {
  id: string;
  schemaVersion: 'opportunity-card-v1';
  analysisVersion: 'causal-events-clustered-v2';
  createdAt: number;
  runId: string;
  lane: MarketLane;
  experimentId: string;
  symbol: string;
  benchmark: string;
  mechanism: string;
  precommittedRule: string;
  outcomeDefinition: string;
  disposition: FactoryDisposition;
  reason: string;
  sampleCount: number;
  evidence: WalkForwardEvidence;
  memeRisk?: MemeRiskGate;
  stages: AgentStageEvidence[];
  provenance: SourceProvenance[];
  liveExecution: 'locked';
  paperRouting: 'research_only' | 'eligible_after_independent_validation';
  contentHash: string;
}

export interface RelationshipHypothesis {
  id: string;
  runId: string;
  createdAt: number;
  sourceLane: MarketLane;
  sourceSymbol: string;
  targetLane: MarketLane;
  targetSymbol: string;
  lagBars: number;
  correlation: number;
  sampleCount: number;
  bonferroniAdjustedPUpperBound: number;
  disposition: 'research_hypothesis' | 'declined';
  reason: string;
  liveExecution: 'locked';
}

export interface FactoryRun {
  id: string;
  startedAt: number;
  completedAt: number;
  status: 'completed' | 'degraded' | 'failed';
  universe: Record<MarketLane, string[]>;
  observations: number;
  cards: number;
  relationships: number;
  dispositions: Record<FactoryDisposition, number>;
  errors: string[];
  liveExecution: 'locked';
}
