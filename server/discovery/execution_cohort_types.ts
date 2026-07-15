import type { OrderBar } from './execution_types.js';

export type ExecutionCohort = 'maker' | 'taker' | 'delayed' | 'no_trade';

export interface ExecutionDecisionPoint {
  id: string;
  signalAt: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  referencePrice: number;
  bars: OrderBar[];
}

export interface ExecutionCohortOutcome {
  id: string;
  decisionId: string;
  cohort: ExecutionCohort;
  filled: boolean;
  fillPrice: number | null;
  fillDelayBars: number | null;
  grossAlphaBps: number;
  realizedNetBps: number;
  alphaDecayBps: number;
  adverseSelectionBps: number;
  impactBps: number;
  implementationShortfallBps: number;
  liveExecution: 'locked';
}

export interface ExecutionCohortStudy {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  sourceEvaluationIds: string[];
  seed: number;
  outcomes: ExecutionCohortOutcome[];
  aggregates: Record<ExecutionCohort, { assigned: number; fills: number; fillRate: number | null;
    meanNetBps: number | null; meanAlphaDecayBps: number | null; meanAdverseSelectionBps: number | null;
    meanImpactBps: number | null; meanShortfallBps: number | null }>;
  minimumOutcomesPerCohort: number;
  status: 'collecting' | 'sufficient' | 'blocked';
  blockers: string[];
  liveExecution: 'locked';
}
