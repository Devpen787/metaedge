import { controlPlaneSnapshot } from './control_cycle.js';
import { FlywheelControlStore } from './control_store.js';
import { CouncilStore } from './council_store.js';
import { DataWorldStore } from './data_world_store.js';
import { EconomicOperationStore } from './economic_store.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import { fastPerpRecorderStatus } from './fast_perp_recorder.js';
import { MetaMaskLiveReviewStore } from './metamask_live_review.js';
import { FlywheelLedger } from './flywheel_store.js';
import { ForwardLearningStore } from './forward_learning_store.js';
import { LaneSignalStore } from './lane_signal_store.js';
import { PortfolioOperationStore } from './portfolio_operation_store.js';
import { SignalResearchStore } from './signal_store.js';
import { ValidationStore } from './validation_store.js';
import { WorldStore } from './world_store.js';

export class V3OperatorSummaryStore {
  readonly file: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator')) {
    this.file = path.join(root, 'v3-summary.json');
  }
  write(snapshot: Record<string, any>): void {
    fs.mkdirSync(this.root, { recursive: true });
    const temporary = `${this.file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot)); fs.renameSync(temporary, this.file);
  }
  read(now = Date.now(), maximumAgeMs = 30_000): { snapshot: Record<string, any>; ageMs: number | null; stale: boolean } {
    try {
      const snapshot = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, any>;
      const ageMs = Math.max(0, now - Number(snapshot.generatedAt));
      return { snapshot, ageMs, stale: !Number.isFinite(ageMs) || ageMs > maximumAgeMs };
    } catch {
      return { snapshot: { schemaVersion: 1, generatedAt: null, mode: 'Paper research',
        verdict: { operationStatus: 'degraded', economicResult: 'no_promoted_alpha', capitalStatus: 'live_locked',
          conclusion: 'Operator summary is not available yet; fast-perp operation remains disabled or degraded.' },
        stale: true, liveExecution: 'locked' }, ageMs: null, stale: true };
    }
  }
}

export function materializeV3OperatorSnapshot(options: Parameters<typeof buildV3OperatorSnapshot>[0] = {}) {
  const snapshot = buildV3OperatorSnapshot(options); new V3OperatorSummaryStore().write(snapshot); return snapshot;
}

function integrityReport(name: string, integrity: Record<string, unknown>) {
  const failures: string[] = []; const warnings: string[] = [];
  for (const [key, value] of Object.entries(integrity)) {
    if (key === 'allLiveExecutionLocked') { if (value !== true) failures.push(`${name}:${key}:false`); continue; }
    if (!Array.isArray(value) || !value.length) continue;
    if (key.startsWith('legacy') || key.startsWith('superseded')) warnings.push(`${name}:${key}:${value.length}`);
    else failures.push(`${name}:${key}:${value.length}`);
  }
  return { failures, warnings };
}

export function buildV3OperatorSnapshot(options: {
  control?: FlywheelControlStore; dataWorld?: DataWorldStore; world?: WorldStore; signals?: SignalResearchStore;
  lanes?: LaneSignalStore; council?: CouncilStore; validation?: ValidationStore; portfolio?: PortfolioOperationStore;
  forward?: ForwardLearningStore; economics?: EconomicOperationStore; fastPerps?: FastPerpEvidenceStore;
  liveReview?: MetaMaskLiveReviewStore; flywheel?: FlywheelLedger; now?: number;
} = {}) {
  const control = controlPlaneSnapshot(options.control ?? new FlywheelControlStore(), undefined, options.now ?? Date.now());
  const dataWorld = (options.dataWorld ?? new DataWorldStore()).snapshot();
  const world = (options.world ?? new WorldStore()).snapshot();
  const signals = (options.signals ?? new SignalResearchStore()).snapshot();
  const lanes = (options.lanes ?? new LaneSignalStore()).snapshot();
  const council = (options.council ?? new CouncilStore()).snapshot();
  const validation = (options.validation ?? new ValidationStore()).snapshot();
  const portfolio = (options.portfolio ?? new PortfolioOperationStore()).snapshot();
  const forward = (options.forward ?? new ForwardLearningStore()).snapshot();
  const economics = (options.economics ?? new EconomicOperationStore()).snapshot();
  const fastPerps = (options.fastPerps ?? new FastPerpEvidenceStore()).snapshot(options.now ?? Date.now());
  const inProcessRecorder = fastPerpRecorderStatus();
  const recorder = inProcessRecorder.running || !fastPerps.latestSession ? inProcessRecorder : {
    running: fastPerps.latestSession.status === 'connected' && fastPerps.freshness.current,
    connected: fastPerps.latestSession.status === 'connected' && fastPerps.freshness.current,
    symbols: fastPerps.latestSession.symbols,
    reconnectAttempt: fastPerps.latestSession.reconnectAttempt,
    lastMessageAt: fastPerps.freshness.latestBookAt ?? fastPerps.freshness.latestTradeAt,
    startedAt: null,
    sourceVersion: fastPerps.latestSession.sourceVersion,
    liveExecution: 'locked' as const,
  };
  const liveReview = (options.liveReview ?? new MetaMaskLiveReviewStore()).snapshot();
  const flywheel = (options.flywheel ?? new FlywheelLedger()).snapshot();
  const auditedUniverse = dataWorld.universeVersions.find((row) => row.id === world.latestAudit?.universeVersionId) ?? null;
  const stageIntegrity = { control: control.integrity, dataWorld: dataWorld.integrity, world: world.integrity,
    signals: signals.integrity, lanes: lanes.integrity, council: council.integrity, validation: validation.integrity,
    portfolio: portfolio.integrity, forward: forward.integrity, economics: economics.integrity, fastPerps: fastPerps.integrity,
    liveReview: liveReview.integrity };
  const reports = Object.entries(stageIntegrity).map(([name, integrity]) => integrityReport(name, integrity));
  const criticalFailures = reports.flatMap((row) => row.failures); const legacyWarnings = reports.flatMap((row) => row.warnings);
  const completedLoops = new Set(control.runs.filter((run) => run.outcome === 'completed').map((run) => run.loopId));
  const latestGovernance = control.runs.filter((run) => run.loopId === 'research_governance' && run.outcome === 'completed')
    .sort((left, right) => right.completedAt - left.completedAt)[0] ?? null;
  const operationOperational = completedLoops.size === control.config.loops.length && criticalFailures.length === 0
    && control.locks.length === 0 && control.openEscalations.length === 0;
  const activeValidation = validation.currentPolicy;
  const economicEdgeProven = activeValidation.forwardCandidates > 0 && council.operatorSummary.paperObserve > 0
    && (portfolio.latest?.status === 'operational') && forward.operatorSummary.eligibleForReview > 0;
  return { schemaVersion: 1, generatedAt: options.now ?? Date.now(), mode: 'Paper research',
    verdict: { operationStatus: operationOperational ? 'operational' : 'degraded',
      economicResult: economicEdgeProven ? 'forward_edge_eligible_for_paper_review' : 'no_promoted_alpha',
      capitalStatus: liveReview.liveExecution === 'locked' ? 'live_locked' : 'live_enabled',
      conclusion: economicEdgeProven
        ? 'At least one strategy cleared numerical, portfolio, execution, and untouched-forward paper gates; live capital remains locked.'
        : 'The research operation is running, but no strategy has cleared the active untouched-forward promotion path; the correct action remains no-trade.' },
    streams: lanes.current.map((packet) => ({ stream: packet.stream, evidenceStatus: packet.evidenceStatus,
      researchDisposition: packet.researchDisposition, candidateAction: packet.candidateAction,
      observedSymbols: packet.observedSymbols.length, qualityScore: packet.quality.score, blockers: packet.blockers })),
    research: { currentSignalArtifacts: signals.currentSignals.map((artifact) => ({ id: artifact.id, lane: artifact.lane,
      symbol: artifact.symbol, declaredTrials: artifact.declaredTrials,
      methodDisposition: artifact.methodDisposition, promotionDisposition: artifact.promotionDisposition,
      plateauRobust: artifact.plateauRobust })), council: council.operatorSummary,
      activeValidation, cumulativeValidation: validation.operatorSummary },
    portfolioExecution: { status: portfolio.latest?.status ?? 'blocked', blockers: portfolio.latest?.blockers
      ?? ['PORTFOLIO_EXECUTION_AUDIT_MISSING'], targetPortfolioCreated: portfolio.latest?.targetPortfolio != null,
      weightSimulationCreated: portfolio.latest?.weightSimulation != null,
      orderSimulationCreated: portfolio.latest?.orderSimulation != null,
      executionCohortStatus: portfolio.latest?.cohortStudy.status ?? 'blocked' },
    forwardLearning: { ...forward.operatorSummary, auditStatus: forward.latestAudit?.status ?? 'blocked',
      blockers: forward.latestAudit?.blockers ?? ['FORWARD_LEARNING_AUDIT_MISSING'] },
    economics: { objective: economics.objectivePolicy.description, scoreUnit: economics.objectivePolicy.scoreUnit,
      counts: economics.counts,
      topCandidates: economics.topEconomicCandidates.map((row) => ({ id: row.contract.id,
        candidateId: row.contract.candidateId, strategyFamilyId: row.contract.strategyFamilyId,
        lane: row.contract.lane, speedTier: row.contract.speedTier, instrument: row.contract.instrument,
        venue: row.contract.venue, currentState: row.currentState, killed: row.killed,
        edgeHalfLifeMs: row.contract.edgeHalfLifeMs,
        executionPolicy: row.contract.executionPolicy,
        predictedGrossEdgeBps: row.contract.predictedGrossEdgeBps,
        totalCostBps: row.contract.costs.totalBps,
        uncertaintyBufferBps: row.contract.uncertaintyBufferBps,
        conservativeNetEdgeBps: row.contract.conservativeNetEdgeBps,
        lowerBoundNetEdgeBps: row.contract.confidence.lowerBoundNetEdgeBps,
        opportunitiesPerDay: row.contract.economics.opportunitiesPerDay,
        conservativeNetUsdPerDay: row.contract.economics.conservativeNetUsdPerDay,
        objectiveScoreUsdPerDay: row.contract.economics.objectiveScoreUsdPerDay,
        lifecycleBlockers: row.contract.lifecycleBlockers,
        killRule: row.contract.killRule, latestLifecycleEvent: row.latestLifecycleEvent })),
      recentShadowDecisions: economics.recentShadowDecisions,
      recentShadowOutcomes: economics.recentShadowOutcomes,
      liveExecution: economics.liveExecution },
    fastPerps: { recorder, counts: fastPerps.counts, symbols: fastPerps.symbols,
      freshness: fastPerps.freshness, recentGaps: fastPerps.recentGaps, liveExecution: fastPerps.liveExecution },
    speedTiers: {
      microstructure: { cadence: '60s research over 1-2.5s horizons', activeContracts: economics.counts.microstructure },
      fastEvent: { cadence: '60s research over 5-30s horizons', activeContracts: economics.counts.fast_event },
      hourlyDaily: { cadence: '6h governed research plus forward resolution',
        activeSignalArtifacts: signals.currentSignals.length, currentPolicy: activeValidation.validationVersion },
    },
    metaMaskLiveReview: { counts: liveReview.counts, recentPreparations: liveReview.recentPreparations,
      authorizationModel: 'fresh signal + current quote + exact human approval + one use + canonical wallet',
      executionDestination: '/api/mm/live-review/perps/open', liveExecution: liveReview.liveExecution },
    world: { latestCollectedDatasetVersionId: dataWorld.latestDatasetVersion?.id ?? null,
      latestCollectedUniverseVersionId: dataWorld.latestUniverseVersion?.id ?? null,
      auditedDatasetVersionId: world.latestAudit?.datasetVersionId ?? null,
      auditedUniverseVersionId: world.latestAudit?.universeVersionId ?? null,
      researchWorldCurrent: Boolean(world.latestAudit
        && world.latestAudit.datasetVersionId === dataWorld.latestDatasetVersion?.id
        && world.latestAudit.universeVersionId === dataWorld.latestUniverseVersion?.id),
      newEvidenceBufferedForNextResearchCadence: Boolean(world.latestAudit
        && (world.latestAudit.datasetVersionId !== dataWorld.latestDatasetVersion?.id
          || world.latestAudit.universeVersionId !== dataWorld.latestUniverseVersion?.id)),
      latestCollectedUniverseSurvivorshipSafe: dataWorld.latestUniverseVersion?.survivorshipSafe ?? false,
      auditedUniverseSurvivorshipSafe: auditedUniverse?.survivorshipSafe ?? false,
      parityStatus: world.latestAudit?.parityStatus ?? null,
      historicalResearchEligible: world.latestAudit?.historicalResearchEligible ?? false,
      paperForwardEligible: world.latestAudit?.paperForwardEligible ?? false,
      blockers: world.latestAudit?.blockers ?? ['WORLD_PARITY_AUDIT_MISSING'] },
    control: { configuredLoops: control.config.loops.length, completedLoops: completedLoops.size,
      runs: control.runs.length, activeLocks: control.locks.length, openEscalations: control.openEscalations.length,
      latestGovernance: latestGovernance?.reason ?? null },
    baselineComparison: flywheel.operatorSummary.measuredChangeFromV1,
    integrity: { criticalFailures, legacyWarnings,
      allLiveExecutionLocked: Object.values(stageIntegrity).every((integrity) => integrity.allLiveExecutionLocked === true) },
    liveExecution: liveReview.liveExecution };
}
import fs from 'node:fs';
import path from 'node:path';
