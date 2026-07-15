import type { ResearchStream } from './lane_signal_types.js';

export type ForwardLifecycleState = 'blocked' | 'collecting' | 'paper_shadow' | 'decaying'
  | 'eligible_for_review' | 're_research' | 'killed';

export interface ForwardCostComponents {
  feesBps: number;
  slippageBps: number;
  borrowBps: number;
  fundingBps: number;
}

export interface ForwardExecutionComponents {
  cohort: 'maker' | 'taker' | 'delayed' | 'no_trade';
  filled: boolean;
  impactBps: number;
  alphaDecayBps: number;
  adverseSelectionBps: number;
  implementationShortfallBps: number;
}

export interface ForwardEvidenceObservation {
  id: string;
  schemaVersion: 1;
  forwardLearningPolicyVersion: string;
  lockboxEvaluationId: string;
  quarantineEnrollmentId: string;
  signalArtifactId: string;
  stream: ResearchStream;
  symbol: string;
  observedAt: number;
  resolvedAt: number;
  evidenceCutoffAt: number;
  horizonBars: number;
  sourceEventIds: string[];
  datasetVersionId: string;
  universeVersionId: string;
  worldContractId: string;
  rawSignalReturnBps: number;
  benchmarkReturnBps: number;
  factorReturnsBps: Record<'market' | 'momentum' | 'volatility', number>;
  factorBetas: Record<'market' | 'momentum' | 'volatility', number>;
  costs: ForwardCostComponents;
  execution: ForwardExecutionComponents;
  reportedNetBps: number;
  counterfactualNoTradeBps: number;
  status: 'resolved' | 'expired' | 'quarantined';
  blockers: string[];
  immutable: true;
  liveExecution: 'locked';
}

export interface ForwardAttributionRecord {
  id: string;
  schemaVersion: 1;
  observationId: string;
  lockboxEvaluationId: string;
  resolvedAt: number;
  rawSignalReturnBps: number;
  benchmarkReturnBps: number;
  benchmarkRelativeBps: number;
  factorExplainedBps: number;
  factorResidualBeforeCostsBps: number;
  totalCostBps: number;
  executionDragBps: number;
  reconstructedNetBps: number;
  reportedNetBps: number;
  reconciliationErrorBps: number;
  counterfactualNoTradeBps: number;
  incrementalVsNoTradeBps: number;
  directionalHit: boolean;
  liveExecution: 'locked';
}

export interface DriftFeatureAssessment {
  feature: string;
  referenceSamples: number;
  currentSamples: number;
  referenceMissingFraction: number;
  currentMissingFraction: number;
  missingnessDelta: number;
  referenceMean: number | null;
  currentMean: number | null;
  referenceStd: number | null;
  currentStd: number | null;
  standardizedMeanShift: number | null;
  standardDeviationRatio: number | null;
  populationStabilityIndex: number | null;
  status: 'stable' | 'watch' | 'breach' | 'insufficient';
  reasons: string[];
}

export interface DatasetDriftAssessment {
  id: string;
  schemaVersion: 1;
  forwardLearningPolicyVersion: string;
  lockboxEvaluationId: string;
  measuredAt: number;
  referenceDatasetVersionId: string;
  currentDatasetVersionId: string;
  referenceSourceAuthority: string;
  currentSourceAuthority: string;
  datasetVersionChanged: boolean;
  sourceAuthorityChanged: boolean;
  features: DriftFeatureAssessment[];
  status: 'stable' | 'watch' | 'breach' | 'insufficient';
  reasons: string[];
  numericalGateNonOverridable: true;
  liveExecution: 'locked';
}

export interface ForwardLifecycleDecision {
  id: string;
  schemaVersion: 1;
  forwardLearningPolicyVersion: string;
  lockboxEvaluationId: string;
  quarantineEnrollmentId: string | null;
  decidedAt: number;
  state: ForwardLifecycleState;
  resolvedObservations: number;
  expectedNetEdgeBps: number | null;
  meanForwardNetBps: number | null;
  forwardNetLowerConfidenceBps: number | null;
  alphaDecayRatio: number | null;
  driftAssessmentId: string | null;
  action: 'hold_blocked' | 'continue_collecting' | 'continue_shadow' | 'paper_review'
    | 'stop_and_research' | 'kill';
  reasons: string[];
  numericalGateNonOverridable: true;
  liveExecution: 'locked';
}

export interface ForwardResearchQueueItem {
  id: string;
  schemaVersion: 1;
  lifecycleDecisionId: string;
  sourceLockboxEvaluationId: string;
  trigger: 'DATASET_DRIFT' | 'ALPHA_DECAY' | 'NON_POSITIVE_FORWARD_EDGE' | 'HARD_RISK_BREACH';
  status: 'open' | 'superseded' | 'completed';
  createdAt: number;
  reason: string;
  requiresNewLockbox: true;
  liveExecution: 'locked';
}

export interface ForwardLearningAuditRecord {
  id: string;
  schemaVersion: 1;
  forwardLearningPolicyVersion: string;
  createdAt: number;
  sourceEvaluationIds: string[];
  sourceEnrollmentIds: string[];
  observationIds: string[];
  attributionIds: string[];
  driftAssessmentIds: string[];
  lifecycleDecisionIds: string[];
  researchQueueItemIds: string[];
  status: 'operational' | 'collecting' | 'blocked';
  blockers: string[];
  liveExecution: 'locked';
}
