import { readDatabase } from '../storage.js';
import { broadFeedState } from '../broad_feed.js';
import { getPriceFeedState } from '../prices.js';
import { riskLoopClockV5 } from '../decision/risk_loop.js';
import { FEATURE_VERSIONS } from '../decision/features.js';
import { STRATEGY_PLUGINS } from '../decision/plugins.js';
import { paperBrokerClockV5 } from '../trades.js';
import { DEFAULT_PAPER_BROKER_POLICY_V5 } from './paper_broker.js';
import {
  DEFAULT_EXPERIMENT_LEARNING_POLICY_V5,
  outcomeReconcilerClockV5,
} from './outcomes.js';
import {
  DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5,
  portfolioAllocatorSnapshotV5,
  portfolioReconcilerClockV5,
} from './portfolio.js';
import { populationOperationSnapshotV5 } from './population.js';
import {
  createActiveArtifactV5,
  METAEDGE_AUTHORITY_SCHEMA,
  METAEDGE_AUTHORITY_VERSION,
  v5AuthorityFlags,
} from './authority.js';

function clock(id: string, cadenceMs: number, lastCompletedAt: number | null | undefined, now: number, enabled: boolean) {
  const ageMs = lastCompletedAt == null ? null : Math.max(0, now - lastCompletedAt);
  return {
    id,
    cadenceMs,
    enabled,
    lastCompletedAt: lastCompletedAt ?? null,
    ageMs,
    fresh: enabled && ageMs != null && ageMs <= cadenceMs * 2,
    status: !enabled ? 'disabled' : ageMs == null ? 'awaiting_first_completion'
      : ageMs <= cadenceMs * 2 ? 'healthy' : 'stale',
  };
}

export function buildV5AuthorityStatus(
  now = Date.now(),
  environment: Record<string, string | undefined> = process.env,
) {
  const db = readDatabase();
  const flags = v5AuthorityFlags(environment);
  const decisionCycle = db.decisionRuntime?.lastCycle;
  const coverage = db.marketDataV5?.latestCoverage;
  const risk = riskLoopClockV5();
  const broker = paperBrokerClockV5();
  const outcomes = outcomeReconcilerClockV5();
  const portfolioClock = portfolioReconcilerClockV5();
  const portfolio = portfolioAllocatorSnapshotV5(now);
  const populationOperation = populationOperationSnapshotV5(now);
  const broad = broadFeedState();
  const primary = getPriceFeedState();
  const nonterminalOrders = Object.values(db.orderIntentsV5 || {})
    .filter((intent) => intent.status === 'PENDING'
      || intent.status === 'RISK_ACCEPTED'
      || intent.status === 'BROKER_PENDING'
      || intent.status === 'PARTIALLY_FILLED').length;
  const currentAgents = Object.values(db.agents).filter((agent) => agent.status !== 'revoked');
  const authorityViolations = currentAgents
    .filter((agent) => agent.authorityVersion !== 5 || agent.schema !== 'trading-agent.v5')
    .map((agent) => `ACTIVE_AGENT_BELOW_V5:${agent.id}`);
  const experimentSpecs = Object.values(db.experimentsV5?.specs || {});
  const experimentStates = Object.values(db.experimentsV5?.states || {});

  const artifacts = [
    ...STRATEGY_PLUGINS.map((plugin) => createActiveArtifactV5({
      schema: 'strategy-plugin.v5',
      id: plugin.id,
      kind: 'strategy',
      state: flags.decisionWriterEnabled ? 'active' : 'disabled',
      writer: false,
      semanticVersion: plugin.version,
    })),
    ...STRATEGY_PLUGINS.map((plugin) => createActiveArtifactV5({
      schema: 'strategy-card.v5',
      id: `${plugin.id}.card.v5`,
      kind: 'card',
      state: flags.decisionWriterEnabled ? 'active' : 'disabled',
      writer: false,
      semanticVersion: plugin.version,
    })),
    ...Object.values(FEATURE_VERSIONS).map((id) => createActiveArtifactV5({
      schema: 'feature-contract.v5',
      id,
      kind: 'feature',
      state: 'active',
      writer: false,
    })),
    createActiveArtifactV5({
      schema: 'portfolio-allocator-policy.v5', id: DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.id, kind: 'policy',
      state: 'active', writer: false,
      semanticVersion: DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.semanticVersion,
    }),
    createActiveArtifactV5({
      schema: 'paper-broker-policy.v5',
      id: DEFAULT_PAPER_BROKER_POLICY_V5.id,
      kind: 'policy',
      state: 'active',
      writer: false,
      semanticVersion: DEFAULT_PAPER_BROKER_POLICY_V5.semanticVersion,
    }),
    createActiveArtifactV5({
      schema: 'experiment-learning-policy.v5',
      id: DEFAULT_EXPERIMENT_LEARNING_POLICY_V5.id,
      kind: 'policy',
      state: 'active',
      writer: false,
      semanticVersion: DEFAULT_EXPERIMENT_LEARNING_POLICY_V5.semanticVersion,
    }),
    createActiveArtifactV5({
      schema: 'capital-policy.v5', id: 'live_capital_lock_v5', kind: 'policy',
      state: flags.liveExecutionEnabled ? 'disabled' : 'active', writer: false,
    }),
    ...currentAgents
      .filter((agent) => agent.authorityVersion === 5 && agent.schema === 'trading-agent.v5')
      .map((agent) => createActiveArtifactV5({
        schema: 'trading-agent.v5',
        id: agent.id,
        kind: 'agent',
        state: agent.status === 'active' ? 'active' : 'disabled',
        writer: false,
      })),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'database_authority_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'decision_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'order_intent_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'paper_fill_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'experiment_registry_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'opportunity_observation_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'experiment_outcome_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'portfolio_reservation_ledger_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'market_evidence_v5', kind: 'store',
      state: 'active', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'canonical-store.v5', id: 'opportunity_operator_v5', kind: 'store',
      state: flags.shadowEnabled ? 'shadow' : 'disabled', writer: false,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'decision_runtime_v5', kind: 'writer',
      state: flags.decisionWriterEnabled ? 'active' : 'disabled',
      writer: flags.decisionWriterEnabled,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'order_intents_v5', kind: 'writer',
      state: flags.paperIntentsEnabled ? 'active' : 'disabled',
      writer: flags.paperIntentsEnabled,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'paper_broker_v5', kind: 'writer',
      state: flags.paperIntentsEnabled ? 'active' : 'disabled',
      writer: flags.paperIntentsEnabled,
      semanticVersion: DEFAULT_PAPER_BROKER_POLICY_V5.semanticVersion,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'market_recorder_v5', kind: 'writer',
      state: 'active', writer: true,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'risk_exit_writer_v5', kind: 'writer',
      state: risk.enabled ? 'active' : 'disabled', writer: risk.enabled,
    }),
    createActiveArtifactV5({
      schema: 'writer-authority.v5', id: 'portfolio_allocator_v5', kind: 'writer',
      state: flags.paperIntentsEnabled ? 'active' : 'disabled', writer: flags.paperIntentsEnabled,
      semanticVersion: DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.semanticVersion,
    }),
    createActiveArtifactV5({
      schema: 'legacy-writer-control.v5', id: 'pre_v5_autonomous_entry_writers', kind: 'writer',
      state: flags.legacyWritersEnabled ? 'shadow' : 'disabled',
      writer: flags.legacyWritersEnabled,
    }),
    createActiveArtifactV5({
      schema: 'operator-envelope.v5', id: 'opportunity_factory_v5_adapter', kind: 'operator',
      state: flags.shadowEnabled ? 'shadow' : 'disabled',
      writer: false,
    }),
  ];

  return {
    authorityVersion: METAEDGE_AUTHORITY_VERSION,
    schema: METAEDGE_AUTHORITY_SCHEMA,
    generatedAt: now,
    commit: environment.GIT_COMMIT || environment.SOURCE_VERSION || 'unknown',
    mode: 'Paper money',
    liveExecution: flags.liveExecutionEnabled ? 'misconfigured_enabled' : 'locked',
    flags,
    cutoff: db.authorityV5 || null,
    authorityViolations,
    writerAuthority: {
      canonical: artifacts.filter((artifact) => artifact.writer && artifact.state === 'active').map((artifact) => artifact.id),
      legacyWriters: flags.legacyWritersEnabled ? 'rollback_enabled' : 'disabled',
      nonterminalOrders,
      paperFills: db.paperFillsV5?.length ?? 0,
      paperBrokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id,
      paperBrokerAssumptions: DEFAULT_PAPER_BROKER_POLICY_V5,
    },
    experimentPopulation: {
      registered: experimentSpecs.length,
      byLifecycleState: Object.fromEntries(
        [...new Set(experimentStates.map((state) => state.lifecycleState))]
          .map((state) => [state, experimentStates.filter((item) => item.lifecycleState === state).length]),
      ),
      byPermission: Object.fromEntries(
        [...new Set(experimentStates.map((state) => state.permission))]
          .map((permission) => [permission, experimentStates.filter((item) => item.permission === permission).length]),
      ),
      observations: db.experimentsV5?.observations.length ?? 0,
      lifecycleEvents: db.experimentsV5?.lifecycleEvents.length ?? 0,
      liveExecution: 'locked',
    },
    experimentLearning: {
      trials: Object.keys(db.experimentLearningV5?.trials || {}).length,
      outcomes: Object.keys(db.experimentLearningV5?.outcomes || {}).length,
      validOutcomes: Object.values(db.experimentLearningV5?.outcomes || {})
        .filter((outcome) => outcome.classification === 'evidence_eligible').length,
      quarantinedOutcomes: Object.values(db.experimentLearningV5?.outcomes || {})
        .filter((outcome) => outcome.classification === 'quarantined').length,
      invalidOutcomes: Object.values(db.experimentLearningV5?.outcomes || {})
        .filter((outcome) => outcome.operationalStatus === 'invalid').length,
      reviewCandidates: Object.values(db.experimentLearningV5?.assessments || {})
        .filter((assessment) => assessment.promotable).length,
      policy: db.experimentLearningV5?.policy || DEFAULT_EXPERIMENT_LEARNING_POLICY_V5,
      lastReconciledAt: db.experimentLearningV5?.lastReconciledAt || null,
      liveExecution: 'locked',
    },
    portfolioAllocator: {
      policy: portfolio.policy,
      risk: portfolio.risk,
      reservations: portfolio.reservations.length,
      activeReservations: portfolio.reservations.filter((reservation) =>
        reservation.status === 'reserved' || reservation.status === 'bound').length,
      deniedReservations: portfolio.reservations.filter((reservation) => reservation.status === 'denied').length,
      decisions: portfolio.decisions.length,
      lastReconciledAt: portfolio.lastReconciledAt,
      liveExecution: 'locked',
    },
    populationOperation,
    clocks: [
      clock('decision_runtime_v5', 5 * 60_000, decisionCycle?.completedAt, now, flags.decisionWriterEnabled),
      clock('market_coverage_v5', 5 * 60_000, coverage?.evaluatedAt, now, true),
      clock(broker.id, broker.cadenceMs, broker.lastCompletedAt, now, broker.enabled),
      clock(outcomes.id, outcomes.cadenceMs, outcomes.lastCompletedAt, now, outcomes.enabled),
      clock(portfolioClock.id, portfolioClock.cadenceMs, portfolioClock.lastCompletedAt, now, portfolioClock.enabled),
      clock(risk.id, risk.cadenceMs, risk.lastCompletedAt, now, risk.enabled),
      clock('broad_market_feed_v5', 30_000, broad.lastRefreshAt, now, true),
    ],
    dataFreshness: {
      primaryPrice: primary,
      broadFeed: broad,
      activeUniverseId: db.marketDataV5?.activeUniverseId || null,
      coverageMatrixId: coverage?.matrixId || null,
      coveragePct: coverage?.coveragePct ?? null,
    },
    artifacts,
  };
}
