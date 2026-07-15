import type { FlywheelLane } from './flywheel_types.js';

export interface PortfolioAssetInput {
  symbol: string;
  lane: FlywheelLane;
  expectedEdgeBps: number;
  returnsBps: number[];
  capacityUsd: number;
  horizonBars: number;
  eligible: boolean;
  blockers: string[];
  factorExposures: Record<string, number>;
}

export interface PortfolioScenario {
  id: string;
  name: string;
  shocksBps: Record<string, number>;
}

export interface PortfolioConstructionResult {
  id: string;
  schemaVersion: 1;
  symbols: string[];
  sampleCovariance: number[][];
  shrunkCovariance: number[][];
  factorCovariance: number[][];
  combinedCovariance: number[][];
  shrinkage: number;
  targetWeights: Record<string, number>;
  cashWeight: number;
  expectedPortfolioEdgeBps: number;
  expectedVolatilityBps: number;
  scenarioPnlBps: Array<{ scenarioId: string; pnlBps: number }>;
  worstScenarioLossBps: number;
  maximumCapacityUsd: number;
  allowed: boolean;
  blockers: string[];
  paperOnly: true;
  liveExecution: 'locked';
}

export interface PriceFrame {
  at: number;
  prices: Record<string, number>;
  borrowBps?: Record<string, number>;
  fundingBps?: Record<string, number>;
}

export interface TargetWeightInstruction {
  id: string;
  decidedAt: number;
  weights: Record<string, number>;
}

export interface WeightLedgerEntry {
  at: number;
  instructionId: string | null;
  cash: number;
  positions: Record<string, number>;
  markedPositionValue: number;
  nav: number;
  turnoverUsd: number;
  feesUsd: number;
  borrowCostUsd: number;
  fundingCostUsd: number;
  invariantErrorUsd: number;
}

export interface WeightSimulationResult {
  id: string;
  schemaVersion: 1;
  initialCash: number;
  ledger: WeightLedgerEntry[];
  totalFeesUsd: number;
  totalBorrowCostUsd: number;
  totalFundingCostUsd: number;
  finalNav: number;
  maximumInvariantErrorUsd: number;
  executionTiming: 'next_bar';
  liveExecution: 'locked';
}
