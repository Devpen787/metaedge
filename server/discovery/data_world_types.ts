import type { FlywheelLane } from './flywheel_types.js';

export type DatasetKind = 'price_bars' | 'funding' | 'prediction_odds' | 'market_ticks' | 'events' | 'unknown';

export interface DatasetFileRecord {
  path: string;
  kind: DatasetKind;
  contentHash: string;
  bytes: number;
  records: number;
  minEventTime: number | null;
  maxEventTime: number | null;
  status: 'valid' | 'quarantined';
  issues: string[];
}

export interface DatasetVersion {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  source: string;
  files: DatasetFileRecord[];
  contentHash: string;
  immutable: true;
  liveExecution: 'locked';
}

export interface DataQuarantineRecord {
  id: string;
  datasetVersionId: string;
  file: string;
  line: number | null;
  reason: string;
  rawHash: string | null;
  detectedAt: number;
  status: 'open' | 'accepted_exception' | 'repaired_in_new_version';
  liveExecution: 'locked';
}

export interface UniverseMembership {
  id: string;
  lane: FlywheelLane;
  symbol: string;
  effectiveFrom: number;
  effectiveTo: number | null;
  knownAt: number;
  sourceVersionId: string;
  authority: string;
  historyStatus: 'historical_membership' | 'current_snapshot_only';
  liveExecution: 'locked';
}

export interface UniverseVersion {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  membershipIds: string[];
  contentHash: string;
  lanes: FlywheelLane[];
  historyStatus: 'historical_membership' | 'current_snapshot_only' | 'mixed';
  survivorshipSafe: boolean;
  immutable: true;
  liveExecution: 'locked';
}

export interface AsOfUniverseView {
  at: number;
  lane: FlywheelLane;
  purpose: 'historical_research' | 'paper_forward';
  eligibleSymbols: string[];
  excluded: Array<{ symbol: string; reason: string }>;
  survivorshipSafe: boolean;
  liveExecution: 'locked';
}
