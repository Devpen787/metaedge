import path from 'node:path';
import { controlPlaneSnapshot, executeControlledLoop } from './control_cycle.js';
import { evidenceManifestFingerprint, readFlywheelControlConfig } from './control_runtime.js';
import { FlywheelControlStore } from './control_store.js';
import type { ResearchLoopId } from './control_types.js';
import { CouncilStore } from './council_store.js';
import { DataWorldStore } from './data_world_store.js';
import { FlywheelLedger } from './flywheel_store.js';
import { ForwardLearningStore } from './forward_learning_store.js';
import { LaneSignalStore } from './lane_signal_store.js';
import { PortfolioOperationStore } from './portfolio_operation_store.js';
import { runFlywheelCycle } from './flywheel_runtime.js';
import { runOpportunityFactory } from './runtime.js';
import { SignalResearchStore } from './signal_store.js';
import { runStageScript, type StageScriptRunner } from './stage_runner.js';
import { contentHash } from './store.js';
import { ValidationStore } from './validation_store.js';
import { WorldStore } from './world_store.js';

function manifest(roots: string[], configFiles: string[] = []): string {
  return evidenceManifestFingerprint({ roots: roots.map((root) => path.join(process.cwd(), root)),
    configFiles: configFiles.map((file) => path.join(process.cwd(), file)) });
}

function integrityFailures(snapshot: { integrity: Record<string, unknown> }): string[] {
  return Object.entries(snapshot.integrity).flatMap(([key, value]) => {
    if (key.startsWith('legacy') || key.startsWith('superseded')) return [];
    if (key === 'allLiveExecutionLocked') return value === true ? [] : [`${key}:false`];
    return Array.isArray(value) && value.length ? [`${key}:${value.length}`] : [];
  });
}

function integrityWarnings(snapshot: { integrity: Record<string, unknown> }): string[] {
  return Object.entries(snapshot.integrity).flatMap(([key, value]) =>
    (key.startsWith('legacy') || key.startsWith('superseded')) && Array.isArray(value) && value.length
      ? [`${key}:${value.length}`] : []);
}

export async function runControlledFlywheelCycle(options: {
  controlStore?: FlywheelControlStore;
  ledger?: FlywheelLedger;
  now?: () => number;
  stageRunner?: StageScriptRunner;
} = {}) {
  const controlStore = options.controlStore ?? new FlywheelControlStore();
  const ledger = options.ledger ?? new FlywheelLedger();
  const config = readFlywheelControlConfig();
  const clock = options.now ?? Date.now;
  const stage = options.stageRunner ?? runStageScript;
  const startedAt = clock();
  const results = {} as Record<ResearchLoopId, Awaited<ReturnType<typeof executeControlledLoop<unknown>>>>;

  const sourceBefore = manifest(['data/market'], ['config/research/opportunity-factory-v1.json']);
  const acquisitionDefinition = config.loops.find((loop) => loop.id === 'market_data_health');
  if (!acquisitionDefinition) throw new Error('MARKET_DATA_HEALTH_LOOP_MISSING');
  results.market_data_health = await executeControlledLoop({ loopId: 'market_data_health',
    evidenceFingerprint: contentHash({ sourceBefore, cadenceBucket: Math.floor(startedAt / acquisitionDefinition.cadenceMs) }),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const baseline = await runOpportunityFactory();
      const dataAudit = await stage('scripts/data_world_audit.ts');
      const sourceAfter = manifest(['data/market'], ['config/research/opportunity-factory-v1.json']);
      return { value: { baseline, dataAudit },
        reason: baseline.status === 'failed' ? 'MARKET_REFRESH_RECORDED_FAILURE' : 'MARKET_AND_DATA_AUDIT_COMPLETE',
        itemsFound: baseline.observations + Number(dataAudit.output.records ?? 0), actionsTaken: 0,
        newEvidence: sourceBefore !== sourceAfter };
    } });

  const laneBefore = new LaneSignalStore().snapshot();
  const gaps = [...new Set(laneBefore.current.flatMap((packet) => packet.blockers))].sort();
  results.evidence_gap_acquisition = await executeControlledLoop({ loopId: 'evidence_gap_acquisition',
    evidenceFingerprint: contentHash({ packetIds: laneBefore.current.map((row) => row.id), gaps }),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: () => ({ value: { rankedEvidenceGaps: gaps },
      reason: gaps.length ? 'EVIDENCE_GAPS_RANKED_FOR_HUMAN_REVIEW' : 'NO_EVIDENCE_GAPS',
      itemsFound: gaps.length, actionsTaken: 0, newEvidence: true }) });

  const researchFingerprint = manifest(['data/market', 'data/opportunity-factory-v3/data-world'],
    ['config/research/opportunity-factory-v1.json', 'config/research/flywheel-v3-control.json']);
  const currentContracts = ledger.snapshot().operatorSummary.currentCandidateContracts;
  results.signal_discovery = await executeControlledLoop({ loopId: 'signal_discovery',
    evidenceFingerprint: researchFingerprint,
    requestedTrials: Math.min(config.budget.maxDeclaredTrialsPerCycle, Math.max(1, currentContracts || 250)),
    requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const flywheel = await runFlywheelCycle({ refreshBaseline: false, ledger });
      const world = await stage('scripts/world_parity_audit.ts');
      const signals = await stage('scripts/signal_research_audit.ts');
      const lanes = await stage('scripts/lane_signal_audit.ts');
      const council = await stage('scripts/council_audit.ts');
      return { value: { flywheel, world, signals, lanes, council }, reason: 'V3_DISCOVERY_AND_COUNCIL_COMPLETE',
        itemsFound: flywheel.operatorSummary.currentCandidateContracts, actionsTaken: 0, newEvidence: true };
    } });

  results.numerical_verification = await executeControlledLoop({ loopId: 'numerical_verification',
    evidenceFingerprint: manifest(['data/opportunity-factory-v3/signals', 'data/opportunity-factory-v3/council']),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const validation = await stage('scripts/validation_lockbox_audit.ts');
      return { value: validation, reason: 'SEALED_NUMERICAL_VERIFICATION_COMPLETE',
        itemsFound: Number(validation.output.currentPolicy && (validation.output.currentPolicy as { evaluations?: number }).evaluations || 0),
        actionsTaken: 0, newEvidence: true };
    } });

  results.forward_quarantine = await executeControlledLoop({ loopId: 'forward_quarantine',
    evidenceFingerprint: manifest(['data/market/predictions', 'data/opportunity-factory-v3/validation']),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const resolutions = await stage('scripts/record_prediction_resolutions.ts');
      const flywheel = await runFlywheelCycle({ refreshBaseline: false, ledger });
      return { value: { resolutions, flywheel }, reason: 'AUTHORITATIVE_FORWARD_RESOLUTION_CHECK_COMPLETE',
        itemsFound: Number(resolutions.output.recorded ?? 0), actionsTaken: 0,
        newEvidence: Number(resolutions.output.recorded ?? 0) > 0 };
    } });

  results.portfolio_risk = await executeControlledLoop({ loopId: 'portfolio_risk',
    evidenceFingerprint: manifest(['data/opportunity-factory-v3/validation', 'data/opportunity-factory-v3/forward-learning']),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const portfolio = await stage('scripts/portfolio_execution_audit.ts');
      return { value: portfolio, reason: 'TARGET_PORTFOLIO_RISK_AUDIT_COMPLETE',
        itemsFound: Number(portfolio.output.forwardCandidateEvaluations ?? 0), actionsTaken: 0, newEvidence: true };
    } });

  results.execution_calibration = await executeControlledLoop({ loopId: 'execution_calibration',
    evidenceFingerprint: manifest(['data/opportunity-factory-v3/portfolio-execution', 'data/opportunity-factory-v3/world']),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const execution = await stage('scripts/portfolio_execution_audit.ts');
      const cohort = execution.output.executionCohorts as { outcomes?: number } | undefined;
      return { value: execution, reason: 'PAPER_EXECUTION_COHORT_AUDIT_COMPLETE', itemsFound: Number(cohort?.outcomes ?? 0),
        actionsTaken: 0, newEvidence: true };
    } });

  results.attribution_research = await executeControlledLoop({ loopId: 'attribution_research',
    evidenceFingerprint: manifest(['data/opportunity-factory-v3/forward-learning', 'data/opportunity-factory-v3/validation']),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    store: controlStore, config, now: clock, action: async () => {
      const forward = await stage('scripts/forward_learning_audit.ts');
      const summary = forward.output.operatorSummary as { attributedObservations?: number; openResearchQueue?: number } | undefined;
      return { value: forward, reason: 'FORWARD_ATTRIBUTION_DRIFT_AND_LIFECYCLE_AUDIT_COMPLETE',
        itemsFound: Number(summary?.attributedObservations ?? 0) + Number(summary?.openResearchQueue ?? 0),
        actionsTaken: 0, newEvidence: true };
    } });

  const governanceSnapshots = { dataWorld: new DataWorldStore().snapshot(), world: new WorldStore().snapshot(),
    signals: new SignalResearchStore().snapshot(), lanes: new LaneSignalStore().snapshot(),
    council: new CouncilStore().snapshot(), validation: new ValidationStore().snapshot(),
    portfolio: new PortfolioOperationStore().snapshot(), forward: new ForwardLearningStore().snapshot() };
  const governanceFailures = Object.entries(governanceSnapshots).flatMap(([stageName, snapshot]) =>
    integrityFailures(snapshot as { integrity: Record<string, unknown> }).map((failure) => `${stageName}:${failure}`));
  const governanceWarnings = Object.entries(governanceSnapshots).flatMap(([stageName, snapshot]) =>
    integrityWarnings(snapshot as { integrity: Record<string, unknown> }).map((warning) => `${stageName}:${warning}`));
  const lastGovernance = controlStore.readRuns().filter((row) => row.loopId === 'research_governance')
    .sort((left, right) => right.completedAt - left.completedAt)[0];
  const correctingPriorException = lastGovernance?.reason === 'GOVERNANCE_INTEGRITY_EXCEPTIONS_RECORDED'
    && governanceFailures.length === 0;
  results.research_governance = await executeControlledLoop({ loopId: 'research_governance',
    evidenceFingerprint: contentHash({ loopRunIds: controlStore.readRuns().map((row) => row.id),
      stageAuditIds: { portfolio: new PortfolioOperationStore().readAudits().map((row) => row.id),
        forward: new ForwardLearningStore().readAudits().map((row) => row.id) } }),
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0,
    forwardResolutionChanged: correctingPriorException,
    store: controlStore, config, now: clock, action: () => {
      return { value: { failures: governanceFailures, warnings: governanceWarnings, stageSnapshots: governanceSnapshots },
        reason: governanceFailures.length ? 'GOVERNANCE_INTEGRITY_EXCEPTIONS_RECORDED'
          : governanceWarnings.length ? 'GOVERNANCE_CLEAN_WITH_LEGACY_WARNINGS' : 'GOVERNANCE_READINESS_AND_DRIFT_AUDIT_CLEAN',
        itemsFound: governanceFailures.length + governanceWarnings.length, actionsTaken: 0, newEvidence: true };
    } });

  const flywheel = ledger.snapshot();
  return { mode: 'Paper research' as const, loops: results,
    acquisition: results.market_data_health, discovery: results.signal_discovery, flywheel,
    stageSnapshots: { dataWorld: new DataWorldStore().snapshot(), world: new WorldStore().snapshot(),
      signals: new SignalResearchStore().snapshot(), lanes: new LaneSignalStore().snapshot(),
      council: new CouncilStore().snapshot(), validation: new ValidationStore().snapshot(),
      portfolio: new PortfolioOperationStore().snapshot(), forward: new ForwardLearningStore().snapshot() },
    control: controlPlaneSnapshot(controlStore, config, clock()), liveExecution: 'locked' as const };
}
