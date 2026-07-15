import type { FlywheelLane } from './flywheel_types.js';

export type ResearchStream = FlywheelLane | 'cross_market_quant';

export interface LaneSignalPacket {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  stream: ResearchStream;
  datasetVersionId: string | null;
  universeVersionId: string | null;
  worldContractId: string | null;
  asOf: number | null;
  observedSymbols: string[];
  sourceArtifactIds: string[];
  measurements: Record<string, number | null>;
  quality: {
    pointInTimeStateFraction: number;
    resolvedForwardFraction: number;
    evidenceCompleteness: number;
    score: number;
  };
  evidenceStatus: 'measured' | 'partial' | 'blocked';
  researchDisposition: 'forward_candidate' | 'rejected' | 'insufficient' | 'blocked';
  candidateAction: 'observe_forward' | 'research_only' | 'no_trade';
  blockers: string[];
  liveExecution: 'locked';
}
