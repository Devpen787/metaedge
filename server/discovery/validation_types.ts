import type { EventStudyResult, SignalResearchChoice } from './signal_types.js';

export interface ResearchLockbox {
  id: string;
  schemaVersion: 1;
  familyId: string;
  parentLockboxId: string | null;
  signalArtifactId: string;
  datasetVersionId: string;
  universeVersionId: string;
  worldContractId: string;
  signalResearchPolicyVersion: string;
  validationPolicyVersion: string;
  researchChoiceIds: string[];
  totalDeclaredTrials: number;
  maximumTrialBudget: number;
  sealedAt: number;
  sealHash: string;
  immutable: true;
  evaluationLimit: 1;
  liveExecution: 'locked';
}

export interface RegimeEvidence {
  regime: 'market_up' | 'market_down' | 'high_volatility' | 'low_volatility';
  samples: number;
  meanStrategyReturnBps: number | null;
  edgeLowerConfidenceBps: number | null;
  passed: boolean;
}

export interface FactorAttribution {
  samples: number;
  alphaBps: number | null;
  betas: Record<'market' | 'momentum' | 'volatility', number | null>;
  rSquared: number | null;
  meanStrategyReturnBps: number | null;
  factorDominated: boolean;
}

export interface LockboxEvaluation {
  id: string;
  schemaVersion: 1;
  lockboxId: string;
  signalArtifactId: string;
  evaluatedAt: number;
  researchChoices: SignalResearchChoice[];
  totalChargedTrials: number;
  regimeEvidence: RegimeEvidence[];
  requiredPassingRegimes: number;
  passingRegimes: number;
  factorAttribution: FactorAttribution;
  trainMeanBps: number | null;
  holdoutMeanBps: number | null;
  holdoutDegradationRatio: number | null;
  holdoutEventStudies: EventStudyResult[];
  disposition: 'forward_candidate' | 'declined' | 'blocked';
  blockers: string[];
  verifierHash: string;
  numericalGateNonOverridable: true;
  liveExecution: 'locked';
}

export interface ForwardQuarantineEnrollment {
  id: string;
  schemaVersion: 1;
  lockboxEvaluationId: string;
  signalArtifactId: string;
  enrolledAt: number;
  evidenceCutoffAt: number;
  minimumResolvedObservations: number;
  status: 'collecting' | 'eligible_for_review' | 'failed' | 'expired';
  resolvedObservations: number;
  immutableResearchPolicy: true;
  liveExecution: 'locked';
}
