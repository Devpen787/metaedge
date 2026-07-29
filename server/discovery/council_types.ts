import type { ResearchStream } from './lane_signal_types.js';

export type CouncilRole = 'quant_analyst' | 'market_structure_analyst' | 'catalyst_analyst' | 'risk_reviewer';

export interface CouncilClaim {
  id: string;
  text: string;
  stance: 'support' | 'oppose' | 'insufficient_evidence';
  evidenceIds: string[];
  falsifier: string;
}

export interface SpecialistCouncilPacket {
  role: CouncilRole;
  modelVersion: string;
  evidenceIds: string[];
  claims: CouncilClaim[];
  conclusion: 'support' | 'oppose' | 'insufficient_evidence';
}

export interface CouncilDebateCase {
  side: 'bull' | 'bear';
  claims: CouncilClaim[];
  unresolvedDissent: string[];
  conclusion: 'supported' | 'unsupported' | 'insufficient_evidence';
}

export interface CouncilSynthesis {
  proposedAction: 'observe_forward' | 'research_only' | 'no_trade';
  thesis: string;
  supportingClaimIds: string[];
  opposingClaimIds: string[];
  unresolvedDissent: string[];
}

export interface NumericalCouncilGate {
  passed: boolean;
  blockers: string[];
  nonOverridable: true;
  liveExecution: 'locked';
}

export interface CouncilManagerDecision {
  decision: 'paper_observe' | 'research_only' | 'no_trade';
  reason: string;
  humanGateRequiredForAnyPromotion: true;
  liveExecution: 'locked';
}

export interface CouncilRun {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  stream: ResearchStream;
  laneSignalPacketId: string;
  datasetVersionId: string | null;
  universeVersionId: string | null;
  worldContractId: string | null;
  graphVersion: string;
  promptVersion: string;
  decisionPolicyVersion: string;
  specialists: SpecialistCouncilPacket[];
  bullCase: CouncilDebateCase;
  bearCase: CouncilDebateCase;
  synthesis: CouncilSynthesis;
  numericalGate: NumericalCouncilGate;
  manager: CouncilManagerDecision;
  liveExecution: 'locked';
}
