export type ResearchLoopId =
  | 'market_data_health'
  | 'evidence_gap_acquisition'
  | 'signal_discovery'
  | 'fast_event_research'
  | 'fast_event_shadow'
  | 'numerical_verification'
  | 'forward_quarantine'
  | 'execution_calibration'
  | 'portfolio_risk'
  | 'attribution_research'
  | 'research_governance';

export type ResearchLoopLevel = 'L1_report' | 'L2_assisted' | 'L3_deterministic';
export type ResearchLoopOutcome = 'completed' | 'no_op' | 'report_only' | 'blocked' | 'escalated' | 'failed';

export interface ResearchLoopDefinition {
  id: ResearchLoopId;
  goal: string;
  nonGoals: string[];
  cadenceMs: number;
  level: ResearchLoopLevel;
  earlyExitWithoutNewEvidence: boolean;
  numericalGateRequired: boolean;
  humanGates: string[];
  writeScopes: string[];
}

export interface FlywheelControlBudget {
  maxRunsPerDay: number;
  maxEstimatedTokensPerDay: number;
  reportOnlyAtFraction: number;
  maxAgentActionsPerDay: number;
  maxDeclaredTrialsPerCycle: number;
  maxAttemptsPerEvidence: number;
  maxConsecutiveFailures: number;
  maxRuntimeMs: number;
}

export interface FlywheelControlConfig {
  schemaVersion: 1;
  liveExecution: 'locked';
  pauseAll: boolean;
  lockTtlMs: number;
  constraints: string[];
  budget: FlywheelControlBudget;
  loops: ResearchLoopDefinition[];
}

export interface ResearchLoopRun {
  id: string;
  loopId: ResearchLoopId;
  startedAt: number;
  completedAt: number;
  evidenceFingerprint: string;
  outcome: ResearchLoopOutcome;
  reason: string;
  itemsFound: number;
  actionsTaken: number;
  declaredTrials: number;
  estimatedTokens: number;
  errorSignature: string | null;
  newEvidence: boolean;
  liveExecution: 'locked';
}

export interface ResearchEscalation {
  id: string;
  loopId: ResearchLoopId;
  createdAt: number;
  evidenceFingerprint: string;
  reason: string;
  status: 'open' | 'acknowledged' | 'resolved';
  liveExecution: 'locked';
}

export interface ResearchLoopState {
  schemaVersion: 1;
  updatedAt: number;
  pauseAll: boolean;
  currentEvidenceFingerprint: string | null;
  highPriority: string[];
  watch: string[];
  recentNoise: string[];
  humanInbox: string[];
  liveExecution: 'locked';
}

export interface ControlGateInput {
  loopId: ResearchLoopId;
  evidenceFingerprint: string;
  requestedTrials: number;
  requestedAgentActions: number;
  estimatedTokens: number;
  forwardResolutionChanged: boolean;
  now?: number;
}

export interface ControlGateDecision {
  allowed: boolean;
  mode: 'full' | 'report_only' | 'no_op' | 'paused' | 'escalate';
  blockers: string[];
  dailyRuns: number;
  dailyEstimatedTokens: number;
  attemptsOnEvidence: number;
  consecutiveFailures: number;
  liveExecution: 'locked';
}

export interface ResearchLock {
  owner: ResearchLoopId;
  resources: string[];
  acquiredAt: number;
  expiresAt: number;
  liveExecution: 'locked';
}

export interface HumanGateApproval {
  id: string;
  loopId: ResearchLoopId;
  gate: string;
  evidenceFingerprint: string;
  grantedAt: number;
  expiresAt: number;
  grantedBy: 'human';
  liveExecution: 'locked';
}

export interface HumanGateConsumption {
  id: string;
  approvalId: string;
  loopId: ResearchLoopId;
  gate: string;
  evidenceFingerprint: string;
  consumedAt: number;
  liveExecution: 'locked';
}
