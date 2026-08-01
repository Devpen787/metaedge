/**
 * MetaEdge V5 Schema and Types Definition
 */

import type {
  FrozenStrategySpec,
  LayeredDecision,
  PaperPermissionV5,
  ValidationRecord,
} from '../server/decision/types';

export interface Profile {
  displayName: string;
  avatarUrl: string;
  bio?: string;
  claimedAt?: number;
  updatedAt: number;
}

export interface User {
  id: string; // Server-authoritative anonymous userId
  username: string;
  profile: Profile;
  createdAt: number;
  lastActiveAt: number;
  paperBalance: number; // Defaults to e.g. 100,000 USD for paper trading
  faucetClaimedCount: number;
  // Set when the user connects THEIR OWN MetaMask Agent Wallet (per-user CLI
  // profile on the server). Connecting is required to compete in the Arena.
  walletAddress?: string;
  walletConnectedAt?: number;
  // The wallet all live actions are pinned to. server/metamask.ts reads and writes
  // this in three places via `(user as any).canonicalWallet` because the field was
  // never declared — so the canonical-wallet guard, a live-money safety check, was
  // entirely untyped.
  canonicalWallet?: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  address?: string;
  chainId?: number;
  balanceEth?: number;
}

export interface FriendRoom {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteToken: string; // Signed/unguessable token for joining
  isInviteDisabled: boolean;
  memberIds: string[];
  createdAt: number;
}

export type AgentStatus = 'active' | 'paused' | 'revoked';

export interface TradingAgent {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  roomId?: string; // Optional room scope
  assetSymbol: string; // e.g., 'BTC', 'ETH', 'SOL'
  tradeType: 'token' | 'perp';
  // Strategy labels map to deterministic plugins in server/decision/plugins.ts.
  // A label alone never authorizes execution; the frozen plugin hash must pass
  // validation and every layered runtime gate.
  strategyType: 'momentum' | 'grid' | 'mean_reversion' | 'custom_ai' | 'rsi_meanrev' | 'golden_cross';
  leverage: number; // For perps (1x to 20x)
  status: AgentStatus;
  createdAt: number;
  lastTradeAt?: number;
  authorityVersion?: 5;
  schema?: 'trading-agent.v5';
  migratedFromPreV5?: boolean;
  // Autopilot: when true (and status active), the server-side autotrader makes
  // this agent trade by itself on live prices via its strategy. Opt-in.
  autopilot?: boolean;
  lastAutoTradeAt?: number;
}

export interface PaperStrategy {
  id: string;
  agentId: string;
  name: string;
  description: string;
  authorId: string;
  roomId?: string; // Room context
  assetSymbol: string;
  tradeType: 'token' | 'perp';
  status: 'active' | 'paused';
  copiedCount: number;
  originalStrategyId?: string; // If copied from another
  createdAt: number;
}

// EdgeOps trade thesis: makes a trade explainable BEFORE it happens, so the
// weekly report can separate signal failure from execution failure. A trade
// only counts as edgeops_complete when the core fields (signalFamily, setup,
// trigger, invalidation) are present — no invalidation, no confidence.
export interface TradeThesis {
  cardId?: string;          // research card this trade tests (e.g. 'momentum-24h-v5')
  decisionId?: string;      // layered decision that authorized this paper candidate
  strategyHash?: string;    // immutable strategy specification used for the decision
  signalFamily: string;     // momentum | mean_reversion | grid | custom_ai | manual | ...
  setup: string;            // the condition that existed
  trigger: string;          // what fired now
  invalidation: string;     // what proves the thesis wrong
  plannedR?: number;        // planned risk unit
  holdingWindow?: string;   // e.g. 'until opposite signal', '1h', '1d'
  regime?: string;          // trending | choppy | unknown
  benchmark?: string;       // benchmark family for the report
}

export type ExperimentLifecycleStateV5 =
  | 'draft'
  | 'research-only'
  | 'discovery'
  | 'confirmed'
  | 'dormant'
  | 'probation'
  | 'reduced'
  | 'retired'
  | 'live-review-locked';

export type ExperimentEligibilityV5 = 'eligible' | 'ineligible' | 'unknown';
export type ExperimentHealthV5 = 'healthy' | 'degraded' | 'failed';

export interface ExperimentLifecyclePolicyV5 {
  minimumDwellMs: number;
  failuresBeforeReduced: number;
  failuresBeforeRetired: number;
  minimumEligibleOutcomesBeforeRetired: number;
  probationSuccessesRequired: number;
}

export interface ExperimentSpecV5 {
  authorityVersion: 5;
  schema: 'experiment-spec.v5';
  experimentId: string;
  specHash: string;
  strategyHash: string;
  pluginId: string;
  family: string;
  label: string;
  version: number;
  instrument: 'spot' | 'perp' | 'prediction';
  initialPermission: PaperPermissionV5;
  initialLifecycleState: ExperimentLifecycleStateV5;
  maximumDiscoveryNotionalUsd: number;
  maximumDiscoveryOrders: number;
  maximumConcurrentIntents: number;
  lifecyclePolicy: ExperimentLifecyclePolicyV5;
  parentExperimentId?: string;
  challengerReason?: string;
  createdAt: number;
}

export interface ExperimentStateV5 {
  authorityVersion: 5;
  schema: 'experiment-state.v5';
  experimentId: string;
  lifecycleState: ExperimentLifecycleStateV5;
  permission: PaperPermissionV5;
  eligibility: ExperimentEligibilityV5;
  health: ExperimentHealthV5;
  lifecycleReason: string;
  stateSince: number;
  eligibleOutcomeCount: number;
  consecutiveEligibleFailures: number;
  consecutiveEligibleSuccesses: number;
  lastEvidenceIds: string[];
  updatedAt: number;
}

export interface ExperimentBudgetV5 {
  authorityVersion: 5;
  schema: 'experiment-budget.v5';
  experimentId: string;
  maximumNotionalUsd: number;
  maximumOrders: number;
  maximumConcurrentIntents: number;
  admittedNotionalUsd: number;
  admittedOrders: number;
  reservedNotionalUsd: number;
  reservations: {
    [observationId: string]: {
      notionalUsd: number;
      status: 'reserved' | 'accepted' | 'released';
      createdAt: number;
      intentId?: string;
      reason?: string;
    };
  };
  updatedAt: number;
}

export type PortfolioFactorV5 = 'trend' | 'mean_reversion' | 'carry' | 'other';
export type PortfolioRegimeBucketV5 = 'trend' | 'mean_reverting' | 'carry' | 'other';
export type PortfolioLiquidityBucketV5 = 'deep' | 'standard' | 'thin';
export type PortfolioReservationStatusV5 = 'reserved' | 'bound' | 'converted' | 'released' | 'denied';

export interface PortfolioAllocatorPolicyV5 {
  authorityVersion: 5;
  schema: 'portfolio-allocator-policy.v5';
  id: string;
  semanticVersion: string;
  policyHash: string;
  maximumGrossExposureUsd: number;
  maximumAbsoluteNetExposureUsd: number;
  maximumSymbolGrossExposureUsd: number;
  maximumFamilyGrossExposureUsd: number;
  maximumFactorGrossExposureUsd: number;
  maximumRegimeGrossExposureUsd: number;
  maximumThinLiquidityGrossExposureUsd: number;
  maximumPerpGrossExposureUsd: number;
  maximumAggregateRolling24hLossUsd: number;
  maximumFamilyRolling24hLossUsd: number;
  maximumUnresolvedOrders: number;
  maximumInformationUnits: number;
  maximumFamilyInformationUnits: number;
  informationUnitNotionalUsd: number;
  maximumDailyVolumeParticipationRate: number;
  unboundReservationLeaseMs: number;
  liveExecution: 'locked';
}

export interface PortfolioReservationV5 {
  authorityVersion: 5;
  schema: 'portfolio-reservation.v5';
  reservationId: string;
  idempotencyKey: string;
  policyId: string;
  policyHash: string;
  userId: string;
  agentId: string;
  experimentId: string;
  strategyHash: string;
  opportunityObservationId: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  positionEffect: 'increase' | 'reduce';
  requestedSize: number;
  referencePrice: number;
  requestedNotionalUsd: number;
  authorizedNotionalUsd: number;
  family: string;
  factor: PortfolioFactorV5;
  regime: PortfolioRegimeBucketV5;
  liquidityBucket: PortfolioLiquidityBucketV5;
  dailyVolumeUsd: number;
  informationUnits: number;
  status: PortfolioReservationStatusV5;
  reasons: string[];
  snapshotHash: string;
  createdAt: number;
  updatedAt: number;
  intentId?: string;
  releasedReason?: string;
}

export interface PortfolioExposureLineV5 {
  source: 'position' | 'pending';
  experimentId: string;
  strategyHash: string;
  agentId: string;
  symbol: string;
  family: string;
  factor: PortfolioFactorV5;
  regime: PortfolioRegimeBucketV5;
  liquidityBucket: PortfolioLiquidityBucketV5;
  instrument: 'spot' | 'perp';
  signedNotionalUsd: number;
  grossNotionalUsd: number;
  informationKey: string;
  intentId?: string;
  reservationId?: string;
}

export interface PortfolioRiskSnapshotV5 {
  authorityVersion: 5;
  schema: 'portfolio-risk-snapshot.v5';
  policyId: string;
  generatedAt: number;
  snapshotHash: string;
  grossExposureUsd: number;
  netExposureUsd: number;
  openGrossExposureUsd: number;
  pendingGrossExposureUsd: number;
  unresolvedOrders: number;
  rolling24hPostCostRealizedPnlUsd: number;
  familyRolling24hPostCostRealizedPnlUsd: { [family: string]: number };
  informationUnits: number;
  familyInformationUnits: { [family: string]: number };
  symbolGrossExposureUsd: { [symbol: string]: number };
  familyGrossExposureUsd: { [family: string]: number };
  factorGrossExposureUsd: { [factor: string]: number };
  regimeGrossExposureUsd: { [regime: string]: number };
  liquidityGrossExposureUsd: { [bucket: string]: number };
  instrumentGrossExposureUsd: { [instrument: string]: number };
  exposures: PortfolioExposureLineV5[];
  liveExecution: 'locked';
}

export interface PortfolioAllocationDecisionV5 {
  authorityVersion: 5;
  schema: 'portfolio-allocation-decision.v5';
  decisionId: string;
  reservationId: string;
  experimentId: string;
  opportunityObservationId: string;
  accepted: boolean;
  requestedNotionalUsd: number;
  authorizedNotionalUsd: number;
  positionEffect: 'increase' | 'reduce';
  reasons: string[];
  snapshotBeforeHash: string;
  policyHash: string;
  decidedAt: number;
}

export interface PopulationOperationPolicyV5 {
  authorityVersion: 5;
  schema: 'population-operation-policy.v5';
  id: string;
  semanticVersion: string;
  policyHash: string;
  minimumRegisteredArms: number;
  maximumRegisteredArms: number;
  minimumMechanismFamilies: number;
  requiredConsecutiveCleanCycles: number;
  unresolvedOrderSlaMs: number;
  liveExecution: 'locked';
}

export interface PopulationClockSampleV5 {
  id: string;
  enabled: boolean;
  cadenceMs: number;
  lastCompletedAt: number | null;
  ageMs: number | null;
  fresh: boolean;
}

export interface PopulationOperationSampleV5 {
  authorityVersion: 5;
  schema: 'population-operation-sample.v5';
  sampleId: string;
  decisionCycleId: string | null;
  recordedAt: number;
  registeredArms: number;
  mechanismFamilies: number;
  observations: number;
  orderIntents: number;
  outcomes: number;
  unresolvedBeyondSla: string[];
  clocks: PopulationClockSampleV5[];
  clean: boolean;
  reasons: string[];
  liveExecution: 'locked';
}

export type PopulationAssuranceKindV5 =
  | 'intent_restart_recovery'
  | 'partial_fill_restart_recovery'
  | 'outcome_restart_recovery'
  | 'stale_data_rejection'
  | 'write_failure_injection'
  | 'portfolio_allocator_veto'
  | 'lifecycle_reactivation';

export interface PopulationAssuranceRecordV5 {
  authorityVersion: 5;
  schema: 'population-assurance-record.v5';
  recordId: string;
  kind: PopulationAssuranceKindV5;
  evidenceIds: string[];
  evidenceHash: string;
  recordedAt: number;
}

export interface PopulationBurnInAssessmentV5 {
  authorityVersion: 5;
  schema: 'population-burn-in-assessment.v5';
  assessedAt: number;
  verdict: 'go_local_paper_operation' | 'no_go';
  consecutiveCleanCycles: number;
  requiredConsecutiveCleanCycles: number;
  evidence: {
    portfolioVetoObserved: boolean;
    partialFillObserved: boolean;
    reconciliationObserved: boolean;
    lifecycleReactivationObserved: boolean;
    controlledOutcomeObserved: boolean;
    uiLedgerParityVerified: boolean;
    intentRestartRecoveryVerified: boolean;
    partialFillRestartRecoveryVerified: boolean;
    outcomeRestartRecoveryVerified: boolean;
    staleDataRejectionVerified: boolean;
    writeFailureInjectionVerified: boolean;
  };
  reasons: string[];
  liveExecution: 'locked';
}

export type DecisionBlockCategoryV5 =
  | 'data_quality'
  | 'universe'
  | 'liquidity'
  | 'regime'
  | 'cost'
  | 'risk'
  | 'portfolio'
  | 'validation'
  | 'no_signal'
  | 'routing'
  | 'other';

export interface DecisionCycleDiagnosticsV5 {
  authorityVersion: 5;
  schema: 'decision-cycle-diagnostics.v5';
  diagnosticId: string;
  diagnosticHash: string;
  cycleId: string;
  completedAt: number;
  evaluated: number;
  organicEvaluated: number;
  organicRouted: number;
  assuranceExcluded: number;
  byOutcome: Record<string, number>;
  byStrategy: Array<{ pluginId: string; evaluated: number; routed: number; topReason: string | null }>;
  bySymbol: Array<{ symbol: string; evaluated: number; routed: number; topReason: string | null }>;
  blockingReasons: Array<{ category: DecisionBlockCategoryV5; reason: string; count: number }>;
  noRouteClassification: 'not_applicable' | 'expected_no_trade' | 'evidence_blocked' | 'risk_vetoed' | 'routing_gap' | 'unclassified';
  explanation: string;
}

export interface ForwardOperationIncidentV5 {
  code: 'CYCLE_ERROR' | 'EVIDENCE_PIPELINE_BLOCKED' | 'ROUTING_GAP' | 'CLOCK_STALE' | 'ORDER_SLA_BREACH';
  severity: 'attention' | 'critical';
  evidenceIds: string[];
  message: string;
}

export interface ForwardOperationCheckpointV5 {
  authorityVersion: 5;
  schema: 'forward-operation-checkpoint.v5';
  checkpointId: string;
  checkpointHash: string;
  cycleId: string;
  recordedAt: number;
  organicRouted: number;
  consecutiveZeroRouteCycles: number;
  noRouteClassification: DecisionCycleDiagnosticsV5['noRouteClassification'];
  incidents: ForwardOperationIncidentV5[];
  liveExecution: 'locked';
}

export interface LocalAcceptanceBundleV5 {
  authorityVersion: 5;
  schema: 'local-acceptance-bundle.v5';
  bundleId: string;
  bundleHash: string;
  generatedAt: number;
  scope: 'isolated_local_mechanics_only';
  mechanicsVerdict: PopulationBurnInAssessmentV5['verdict'];
  economicEdgeProven: false;
  deploymentAuthorized: false;
  liveExecution: 'locked';
  policyHash: string;
  assuranceEvidence: Array<{ recordId: string; kind: PopulationAssuranceKindV5; evidenceHash: string }>;
  cleanCycleIds: string[];
  diagnosticHashes: string[];
  checkpointHashes: string[];
}

export interface OpportunityObservationV5 {
  authorityVersion: 5;
  schema: 'opportunity-observation.v5';
  observationId: string;
  experimentId: string;
  decisionId: string;
  strategyHash: string;
  pluginId: string;
  family: string;
  label: string;
  symbol: string;
  evaluatedAt: number;
  signalAction: 'buy' | 'sell' | 'long' | 'short' | 'hold' | 'none';
  signalStrength: number;
  regime: string;
  eligibility: ExperimentEligibilityV5;
  health: ExperimentHealthV5;
  lifecycleState: ExperimentLifecycleStateV5;
  permission: PaperPermissionV5;
  disposition: 'observed' | 'shadow' | 'admitted' | 'declined';
  reasons: string[];
  featureEvidenceHashes: string[];
  orderIntentId?: string;
}

export interface ExperimentLifecycleEventV5 {
  authorityVersion: 5;
  schema: 'experiment-lifecycle-event.v5';
  eventId: string;
  experimentId: string;
  type:
    | 'regime_ineligible'
    | 'regime_eligible'
    | 'eligible_win'
    | 'eligible_loss'
    | 'health_failure'
    | 'health_recovered'
    | 'promote_confirmed'
    | 'operator_retire';
  actor: 'system' | 'operator' | 'agent';
  reason: string;
  evidenceIds: string[];
  at: number;
}

export type ExperimentControlKindV5 = 'no_trade' | 'buy_hold_same_symbol_same_window';

export interface ExperimentLearningPolicyV5 {
  authorityVersion: 5;
  schema: 'experiment-learning-policy.v5';
  id: 'experiment-learning-policy-v5';
  semanticVersion: string;
  alpha: number;
  minimumIndependentEpisodes: number;
  costStressMultiplier: number;
  episodeClusterMs: number;
  requiredControls: ExperimentControlKindV5[];
  liveExecution: 'locked';
}

export interface ExperimentTrialControlV5 {
  kind: ExperimentControlKindV5;
  definition: string;
  immutable: true;
}

export interface ExperimentTrialV5 {
  authorityVersion: 5;
  schema: 'experiment-trial.v5';
  trialId: string;
  trialHash: string;
  experimentId: string;
  strategyHash: string;
  family: string;
  variant: string;
  familyTrialSequence: number;
  declaredAt: number;
  evidenceCutoffAt: number;
  controls: ExperimentTrialControlV5[];
  policyId: ExperimentLearningPolicyV5['id'];
  immutable: true;
  liveExecution: 'locked';
}

export interface ExperimentEpisodeOutcomeV5 {
  authorityVersion: 5;
  schema: 'experiment-episode-outcome.v5';
  outcomeId: string;
  episodeId: string;
  independentClusterId: string;
  trialId: string;
  experimentId: string;
  strategyHash: string;
  family: string;
  symbol: string;
  direction: 'long' | 'short';
  openedAt: number;
  resolvedAt: number;
  tradeIds: string[];
  orderIntentIds: string[];
  fillIds: string[];
  sourceObservationHashes: string[];
  entryReferenceNotionalUsd: number;
  entryReferencePrice: number;
  exitReferencePrice: number;
  grossReferencePnlUsd: number;
  executionGrossPnlUsd: number;
  signedImplementationShortfallUsd: number;
  conservativeImplementationDragUsd: number;
  feeUsd: number;
  spreadCostUsd: number;
  slippageUsd: number;
  fundingUsd: number;
  borrowUsd: number;
  actualPostCostPnlUsd: number;
  evidencePostCostPnlUsd: number;
  costStressedPnlUsd: number;
  noTradeControlPnlUsd: 0;
  buyHoldControlPnlUsd: number;
  evidenceNetBps: number;
  costStressedNetBps: number;
  noTradeRelativeBps: number;
  benchmarkRelativeBps: number;
  reconciliationErrorUsd: number;
  operationalStatus: 'valid' | 'invalid';
  classification: 'evidence_eligible' | 'quarantined';
  reasons: string[];
  liveExecution: 'locked';
}

export interface ExperimentEvidenceAssessmentV5 {
  authorityVersion: 5;
  schema: 'experiment-evidence-assessment.v5';
  assessmentId: string;
  trialId: string;
  experimentId: string;
  strategyHash: string;
  family: string;
  assessedAt: number;
  outcomeIds: string[];
  validOutcomeCount: number;
  invalidOutcomeCount: number;
  quarantinedOutcomeCount: number;
  independentEpisodeCount: number;
  declaredFamilyTrials: number;
  alpha: number;
  multiplicityAdjustedAlpha: number;
  meanEvidenceNetBps: number | null;
  meanCostStressedNetBps: number | null;
  meanNoTradeRelativeBps: number | null;
  meanBenchmarkRelativeBps: number | null;
  cumulativeEvidencePnlUsd: number;
  continuousBuyHoldControlPnlUsd: number;
  benchmarkRelativePnlUsd: number;
  lowerConfidenceNoTradeRelativeBps: number | null;
  winRate: number | null;
  disposition: 'collecting' | 'blocked' | 'declined' | 'review_candidate';
  promotable: boolean;
  reasons: string[];
  numericalGateNonOverridable: true;
  liveExecution: 'locked';
}

export interface PaperTrade {
  id: string;
  agentId: string;
  userId: string;
  roomId?: string;
  assetSymbol: string;
  tradeType: 'token' | 'perp';
  side: 'buy' | 'sell' | 'long' | 'short';
  size: number; // Amount of asset
  price: number; // Executed paper price
  leverage: number;
  pnl?: number; // Realized PnL for closed trades, or current unrealized
  status?: 'open' | 'closed';
  source?: 'agent' | 'wallet'; // 'wallet' = a MetaMask paper action; marked-to-market live in the arena
  timestamp: number;
  orderIntentId?: string;                    // Durable v5 order lineage
  paperFillId?: string;                      // Durable V5 broker fill lineage
  brokerPolicyId?: string;
  referencePrice?: number;                   // Canonical mid before modeled costs
  referenceObservationHash?: string;
  feeUsd?: number;
  spreadCostUsd?: number;
  slippageUsd?: number;
  fundingUsd?: number;
  borrowUsd?: number;
  holdingMs?: number;
  experimentId?: string;
  experimentLabel?: string;
  opportunityObservationId?: string;
  paperPermission?: PaperPermissionV5;
  thesis?: TradeThesis;                      // EdgeOps: why this trade
  edgeops?: 'complete' | 'thesis_missing';   // EdgeOps: counts toward reports only when complete
  review?: TradeReview;                      // EdgeOps Loop 5: post-trade review (closed trades)
}

// EdgeOps post-trade review — separates signal failure from execution failure,
// regime shift, or plan violation. Only closed trades can be reviewed.
export interface TradeReview {
  thesisFollowed: boolean;
  invalidationHit: boolean;
  outcomeDriver: 'signal' | 'execution' | 'regime' | 'liquidity' | 'behavior';
  lesson: string;
  nextDecision: 'keep_testing' | 'modify' | 'kill' | 'promote_paper_only';
  reviewedAt: number;
}

export interface VaultClub {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: number;
  simulatedTotalContribution: number;
  memberContributions: { [userId: string]: number }; // Map of userId -> simulated funds contribution
  milestones: string[];
}

export interface GraphNode {
  id: string;
  label: string; // 'User' | 'Room' | 'Agent' | 'Strategy' | 'VaultClub'
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string; // 'MEMBER_OF' | 'OWNS' | 'COPIED_FROM' | 'SHARED_IN' | 'CONTRIBUTED_TO'
  properties: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g., 'LOGIN', 'CREATE_ROOM', 'PAPER_TRADE', 'PAUSE_AGENT', 'SWITCH_MODE'
  details: string;
  timestamp: number;
}

export interface GraphEvent {
  id: string;
  type: 'login' | 'profile_update' | 'room_join' | 'agent_creation' | 'paper_action' | 'strategy_share' | 'strategy_copy' | 'vault_action' | 'evaluation' | 'blocked_action' | 'metamask_check' | 'mode_switch' | 'pause_revoke';
  userId: string;
  targetId: string;
  targetType: 'User' | 'Room' | 'Agent' | 'Strategy' | 'VaultClub';
  metadata: Record<string, any>;
  timestamp: number;
}

export interface PredictionMarket {
  id: string;
  question: string;
  category: 'Crypto' | 'Macro' | 'Tech' | 'AI Performance';
  yesPool: number;
  noPool: number;
  resolved: boolean;
  outcome: 'yes' | 'no' | null;
  endTime: number;
  volume: number;
  bets: {
    [userId: string]: {
      yesShares: number;
      noShares: number;
      invested: number;
      firstBetAt?: number; // for fair season/league flooring in the arena
    }
  };
}

// Append-only stake ledger used by seasons and leagues. The aggregate stored on
// PredictionMarket remains the market view; these events are the competition
// authority for deciding which stake belongs inside a player's scoring window.
export interface PredictionBetEvent {
  id: string;
  marketId: string;
  userId: string;
  side: 'yes' | 'no';
  amount: number;
  shares: number;
  timestamp: number;
}

// A competition league in the Agent Arena. The leaderboard is COMPUTED from real
// agent P&L (never stored/faked), so it stays truthful and consistent across users.
export interface ArenaLeague {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  startBalance: number;
  durationDays: number;
  createdAt: number;
  endsAt: number;
  risk: 'Low' | 'Medium' | 'High';
  prize: string;
  status: 'active' | 'ended';
}

export interface ArenaMember {
  id: string;
  leagueId: string;
  userId: string;
  username: string;
  joinedAt: number;
  startBalance: number;
}

// An earned achievement. Badges are derived from real activity (trades, wins,
// streaks, leagues created) and awarded idempotently — never decorative.
export interface ArenaBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: number;
}

// Periodic rank snapshot per board (global or league) powering ▲/▼ movement.
export interface ArenaRankSnapshot {
  at: number;
  ranks: { [userId: string]: number };
  prevAt?: number;
  prevRanks?: { [userId: string]: number };
}

export type OrderIntentStatusV5 =
  | 'PENDING'
  | 'RISK_ACCEPTED'
  | 'BROKER_PENDING'
  | 'PARTIALLY_FILLED'
  | 'EXECUTED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'UNRESOLVED';

export type PaperOrderTypeV5 = 'market' | 'limit' | 'stop' | 'stop_limit';

export interface PaperBrokerPolicyV5 {
  authorityVersion: 5;
  schema: 'paper-broker-policy.v5';
  id: string;
  semanticVersion: string;
  executionTiming: 'next_observation';
  liquidityModel: 'volume_participation_proxy';
  sameObservationFill: 'forbidden';
  feeBps: number;
  halfSpreadBps: number;
  baseSlippageBps: number;
  maximumSlippageBps: number;
  maximumQuoteAgeMs: number;
  defaultTimeInForceMs: number;
  observationIntervalMs: number;
  volumeParticipationRate: number;
  minimumFillNotionalUsd: number;
  perpFundingBpsPerDay: number;
  shortBorrowBpsPerDay: number;
  liveExecution: 'locked';
}

export interface PaperFillV5 {
  authorityVersion: 5;
  schema: 'paper-fill.v5';
  fillId: string;
  intentId: string;
  sequence: number;
  brokerPolicyId: string;
  observationHash: string;
  provider: string;
  venue: string;
  referencePrice: number;
  fillPrice: number;
  quantity: number;
  notionalUsd: number;
  feeUsd: number;
  spreadCostUsd: number;
  slippageUsd: number;
  filledAt: number;
  partial: boolean;
}

export interface OrderIntentV5 {
  authorityVersion: 5;
  schema: 'order-intent.v5';
  intentId: string;
  idempotencyKey: string;
  userId: string;
  agentId: string;
  assetSymbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  size: number;
  tradeType: 'token' | 'perp';
  leverage: number;
  orderType?: PaperOrderTypeV5;
  limitPrice?: number;
  stopPrice?: number;
  expiresAt?: number;
  brokerPolicyId?: string;
  submissionObservationHash?: string;
  lastBrokerObservationHash?: string;
  stopTriggered?: boolean;
  filledSize?: number;
  remainingSize?: number;
  fillIds?: string[];
  tradeIds?: string[];
  positionEffect: 'increase' | 'reduce' | null;
  status: OrderIntentStatusV5;
  createdAt: number;
  updatedAt: number;
  nonce: string;
  roomId?: string;
  thesis?: TradeThesis;
  edgeops?: 'complete' | 'thesis_missing';
  auditAction?: string;
  auditDetailsPrefix?: string;
  experimentId?: string;
  experimentLabel?: string;
  opportunityObservationId?: string;
  paperPermission?: PaperPermissionV5;
  portfolioReservationId?: string;
  tradeId?: string;
  noTradeReason?: string;
  failureReason?: string;
}

export type OrderEventTypeV5 =
  | 'CREATED'
  | 'RISK_ACCEPTED'
  | 'RISK_REJECTED'
  | 'SUBMITTED_TO_BROKER'
  | 'PARTIALLY_FILLED'
  | 'BROKER_REJECTED'
  | 'EXPIRED'
  | 'EXECUTED'
  | 'UNRESOLVED';

export interface OrderEventV5 {
  authorityVersion: 5;
  schema: 'order-event.v5';
  eventId: string;
  intentId: string;
  sequence: number;
  type: OrderEventTypeV5;
  at: number;
  payloadHash: string;
  reason?: string;
  tradeId?: string;
  executedPrice?: number;
  fillId?: string;
  filledSize?: number;
  remainingSize?: number;
  observationHash?: string;
}

export interface MarketObservationV5 {
  authorityVersion: 5;
  schema: 'market-observation.v5';
  symbol: string;
  price: number;
  change24hPct: number | null;
  volume24hUsd: number | null;
  high24h: number | null;
  low24h: number | null;
  marketCapUsd: number | null;
  provider: string;
  venue: string;
  dataset: string;
  observedAt: number;
  receivedAt: number;
  observationHash: string;
  provenance: 'observed' | 'seed';
}

export interface UniverseVersionV5 {
  authorityVersion: 5;
  schema: 'universe-version.v5';
  universeId: string;
  tier: number;
  symbols: string[];
  source: string;
  observedAt: number;
  createdAt: number;
  membershipHash: string;
  gapPolicy: 'do_not_fill';
  crossVenuePolicy: 'preserve_and_flag';
}

export interface MarketCoverageEntryV5 {
  strategyHash: string;
  pluginId: string;
  symbol: string;
  requiredFeatures: string[];
  goodFeatures: string[];
  unavailableFeatures: string[];
  armed: boolean;
}

export interface MarketCoverageMatrixV5 {
  authorityVersion: 5;
  schema: 'market-coverage-matrix.v5';
  matrixId: string;
  universeId: string;
  evaluatedAt: number;
  entries: MarketCoverageEntryV5[];
  ready: number;
  total: number;
  coveragePct: number;
}

export interface DatabaseState {
  users: { [id: string]: User };
  sessions?: { [tokenHash: string]: SessionRecord };
  rooms: { [id: string]: FriendRoom };
  agents: { [id: string]: TradingAgent };
  strategies: { [id: string]: PaperStrategy };
  trades: PaperTrade[];
  vaultClubs: { [id: string]: VaultClub };
  auditEvents: AuditEvent[];
  graphEvents: GraphEvent[];
  predictionMarkets?: { [id: string]: PredictionMarket };
  predictionBetEvents?: PredictionBetEvent[];
  arenaLeagues?: { [id: string]: ArenaLeague };
  arenaMembers?: ArenaMember[];
  arenaBadges?: ArenaBadge[];
  arenaRankSnapshots?: { [boardId: string]: ArenaRankSnapshot };
  // Persisted trailing-stop high-water marks, keyed by `${agentId}:${symbol}`. Survives
  // process restarts so the Risk-OS's trailing peak is never reset to the current price.
  trailingState?: { [key: string]: { highWaterMark: number; trailPct: number; updatedAt: number } };
  // Per-symbol cooldown after an exit, keyed `${agentId}:${symbol}` → epoch ms until which the
  // scanner must not re-enter that symbol (prevents churning back into a fresh loser).
  cooldowns?: { [key: string]: number };
  // V5 paper-order authority. Nonces and intent state are durable so restart
  // cannot replay an already accepted order.
  orderIntentsV5?: { [intentId: string]: OrderIntentV5 };
  orderNonceIndexV5?: { [userNonce: string]: string };
  orderEventsV5?: OrderEventV5[];
  paperFillsV5?: PaperFillV5[];
  experimentsV5?: {
    specs: { [experimentId: string]: ExperimentSpecV5 };
    states: { [experimentId: string]: ExperimentStateV5 };
    budgets: { [experimentId: string]: ExperimentBudgetV5 };
    observations: OpportunityObservationV5[];
    lifecycleEvents: ExperimentLifecycleEventV5[];
  };
  experimentLearningV5?: {
    policy: ExperimentLearningPolicyV5;
    trials: { [trialId: string]: ExperimentTrialV5 };
    outcomes: { [outcomeId: string]: ExperimentEpisodeOutcomeV5 };
    assessments: { [trialId: string]: ExperimentEvidenceAssessmentV5 };
    lifecycleAppliedOutcomeIds: { [outcomeId: string]: string };
    lastReconciledAt?: number;
  };
  portfolioAllocatorV5?: {
    policy: PortfolioAllocatorPolicyV5;
    reservations: { [reservationId: string]: PortfolioReservationV5 };
    decisions: PortfolioAllocationDecisionV5[];
    lastReconciledAt?: number;
  };
  populationOperationsV5?: {
    policy: PopulationOperationPolicyV5;
    samples: PopulationOperationSampleV5[];
    assuranceRecords?: PopulationAssuranceRecordV5[];
    acceptanceBundles?: LocalAcceptanceBundleV5[];
    uiLedgerParityVerifiedAt?: number;
    lastSampledAt?: number;
  };
  marketDataV5?: {
    universeVersions: { [universeId: string]: UniverseVersionV5 };
    activeUniverseId?: string;
    latestCoverage?: MarketCoverageMatrixV5;
    coverageHistory?: MarketCoverageMatrixV5[];
  };
  authorityV5?: {
    authorityVersion: 5;
    schema: 'authority-cutover.v5';
    cutoffAt: number;
    activatedAt: number;
    legacySnapshotHash: string;
    legacyStrategySpecIds: string[];
    legacyAgentIds: string[];
  };
  decisionRuntime?: {
    strategySpecs: { [hash: string]: FrozenStrategySpec };
    validations: { [id: string]: ValidationRecord };
    decisions: LayeredDecision[];
    executedDecisionIds: { [decisionId: string]: string };
    cycleDiagnostics?: DecisionCycleDiagnosticsV5[];
    forwardCheckpoints?: ForwardOperationCheckpointV5[];
    lastCycle?: {
      cycleId: string;
      startedAt: number;
      completedAt: number;
      evaluated: number;
      declines: number;
      hypotheses: number;
      paperCandidates: number;
      routed: number;
      error?: string;
    };
  };
}
