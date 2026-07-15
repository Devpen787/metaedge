export type DecisionOutcome = 'decline' | 'research_hypothesis' | 'paper_trade_candidate';

export type DecisionLayer =
  | 'data_quality'
  | 'universe'
  | 'liquidity'
  | 'regime'
  | 'cost'
  | 'risk'
  | 'portfolio';

export type FeatureQuality = 'good' | 'stale' | 'missing' | 'invalid';

export interface FeatureSource {
  provider: string;
  dataset: string;
  venue?: string;
  observedAt: number;
  retrievedAt: number;
}

export interface VersionedFeature {
  id: string;
  version: string;
  value: number | string | boolean | null;
  unit: string;
  quality: FeatureQuality;
  source: FeatureSource;
}

export interface DecisionPosition {
  holding: boolean;
  openNotionalUsd: number;
  averageEntryPrice: number;
  heldSince?: number;
}

export interface DecisionLimits {
  liquidityFloorUsd: number;
  staleBudgetMs: number;
  modeledRoundTripCostBps: number;
  maxRoundTripCostBps: number;
  requestedNotionalUsd: number;
  riskBudgetUsd: number;
  portfolioOpenNotionalUsd: number;
  portfolioMaxNotionalUsd: number;
}

export interface DecisionContext {
  cycleId: string;
  evaluatedAt: number;
  symbol: string;
  instrument: 'spot' | 'perp' | 'prediction';
  universe: { tier: number; included: boolean; reason: string; observedAt: number; quality: 'good' | 'stale' | 'missing' };
  features: Record<string, VersionedFeature>;
  position: DecisionPosition;
  limits: DecisionLimits;
  routing?: { ownerId: string; agentId: string };
}

export interface GateResult {
  layer: DecisionLayer;
  status: 'pass' | 'decline' | 'skipped';
  reason: string;
  evidence: Record<string, number | string | boolean | null>;
}

export interface StrategySignal {
  action: 'buy' | 'sell' | 'long' | 'short' | 'hold';
  strength: number;
  setup: string;
  trigger: string;
  invalidation: string;
  regime: string;
}

export interface StrategyPlugin<Params extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  version: string;
  mechanism: string;
  instrument: DecisionContext['instrument'];
  requiredFeatures: string[];
  parameters: Params;
  benchmark: string;
  falsifier: string;
  expectedFailureRegimes: string[];
  regimeGate(context: DecisionContext): { eligible: boolean; reason: string };
  generateSignal(context: DecisionContext): StrategySignal;
}

export type ValidationStatus = 'unvalidated' | 'rejected' | 'inconclusive' | 'forward_paper_candidate';

export interface FrozenStrategySpec {
  id: string;
  hash: string;
  pluginId: string;
  pluginVersion: string;
  mechanism: string;
  instrument: DecisionContext['instrument'];
  requiredFeatures: string[];
  parameters: Record<string, unknown>;
  benchmark: string;
  falsifier: string;
  expectedFailureRegimes: string[];
  createdAt: number;
}

export interface ValidationRecord {
  id: string;
  strategyHash: string;
  status: ValidationStatus;
  datasetId: string;
  datasetHash: string;
  codeCommit: string;
  folds: number;
  costBpsPerSide: number;
  benchmark: string;
  reasons: string[];
  validatedAt: number;
  configHash?: string;
  symbols?: string[];
  featureVersions?: string[];
  metrics?: {
    trades: number;
    expectancyPct: number;
    profitFactor: number;
    maxDrawdownPct: number;
    tstat: number;
    positiveFoldRatio: number;
    totalReturnPct: number;
    benchmarkReturnPct: number;
  };
  foldMetrics?: Array<{
    symbol: string;
    fold: number;
    split: 'validation' | 'holdout';
    trades: number;
    expectancyPct: number;
    profitFactor: number;
    totalReturnPct: number;
    benchmarkReturnPct: number;
  }>;
}

export interface LayeredDecision {
  id: string;
  cycleId: string;
  evaluatedAt: number;
  symbol: string;
  instrument: DecisionContext['instrument'];
  strategyHash: string;
  pluginId: string;
  outcome: DecisionOutcome;
  reason: string;
  gates: GateResult[];
  signal: StrategySignal | null;
  featureEvidence: VersionedFeature[];
  validationStatus: ValidationStatus;
  queueStatus: 'not_queued' | 'queued' | 'routed' | 'expired';
  routedTradeId?: string;
  ownerId?: string;
  agentId?: string;
}
