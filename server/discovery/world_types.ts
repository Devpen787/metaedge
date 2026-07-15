import type { FlywheelLane } from './flywheel_types.js';

export type WorldMode = 'historical_replay' | 'paper_forward';
export type WorldEventKind = 'bar' | 'funding' | 'prediction_odds' | 'filing' | 'news' | 'universe_membership' | 'execution_quote';

export interface WorldEvent<T = unknown> {
  id: string;
  kind: WorldEventKind;
  lane: FlywheelLane;
  symbol: string | null;
  eventTime: number;
  availableAt: number;
  observedAt: number;
  sourceVersionId: string;
  payloadHash: string;
  payload: T;
  liveExecution: 'locked';
}

export interface WorldContract {
  id: string;
  schemaVersion: 1;
  datasetVersionId: string;
  universeVersionId: string;
  calendarVersion: string;
  seed: number;
  executionTiming: 'next_bar';
  missingBarPolicy: 'freeze_last_mark_no_new_order';
  sameBarPathPolicy: 'stop_before_limit';
  correctionPolicy: 'new_world_version';
  liveExecution: 'locked';
}

export interface WorldSnapshot {
  asOf: number;
  consumedEventCount: number;
  consumedEventHash: string;
  consumedEventIds?: string[];
  latestEventIds: Record<string, string>;
  stateHash: string;
  liveExecution: 'locked';
}

export interface WorldTrace {
  mode: WorldMode;
  contractId: string;
  consumedEventIds: string[];
  snapshots: WorldSnapshot[];
  parityHash: string;
  finalStateHash: string;
  liveExecution: 'locked';
}

export interface WorldParityAudit {
  id: string;
  schemaVersion: 1;
  auditedAt: number;
  contractId: string;
  datasetVersionId: string;
  universeVersionId: string;
  eventCount: number;
  minAvailableAt: number | null;
  maxAvailableAt: number | null;
  historicalTrace: WorldTrace;
  paperTrace: WorldTrace;
  parityStatus: 'pass' | 'fail';
  historicalResearchEligible: boolean;
  paperForwardEligible: boolean;
  paperForwardEligibleAt: number | null;
  blockers: string[];
  liveExecution: 'locked';
}

export interface ExecutionBar {
  symbol: string;
  openAt: number;
  closeAt: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
