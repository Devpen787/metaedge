import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';
import { agentPosition, placePaperTrade } from '../trades.js';
import { v5AuthorityFlags } from './authority.js';
import type {
  ExperimentBudgetV5,
  ExperimentLifecycleEventV5,
  ExperimentSpecV5,
  ExperimentStateV5,
  OpportunityObservationV5,
  TradingAgent,
} from '../../src/types.js';
import type {
  DecisionContext,
  FrozenStrategySpec,
  LayeredDecision,
  PaperPermissionV5,
  StrategyPlugin,
} from '../decision/types.js';
import {
  DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5,
  portfolioAllocatorSnapshotV5,
  releasePortfolioReservationV5,
  reservePortfolioRiskV5,
} from './portfolio.js';

const SYSTEM_OWNER_ID = 'usr_v5_paper_discovery';
// Opportunity observations explain recent routing and no-trade decisions.
// Resolved learning survives separately in experimentLearningV5, so bound this
// hot rewritten segment instead of allowing a few hours of cycles to turn it
// into a request-blocking multi-dozen-megabyte payload.
const MAX_OBSERVATIONS = 2_000;
export const POPULATION_PAPER_MAX_OPEN_NOTIONAL_USD_V5 = DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.maximumGrossExposureUsd;
const DEFAULT_LIFECYCLE_POLICY = {
  minimumDwellMs: 6 * 60 * 60_000,
  failuresBeforeReduced: 2,
  failuresBeforeRetired: 5,
  minimumEligibleOutcomesBeforeRetired: 5,
  probationSuccessesRequired: 2,
} as const;

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function experiments(db: ReturnType<typeof readDatabase>) {
  return (db.experimentsV5 ||= {
    specs: {},
    states: {},
    budgets: {},
    observations: [],
    lifecycleEvents: [],
  });
}

function strategyType(pluginId: string): TradingAgent['strategyType'] {
  if (pluginId === 'rsi_mean_reversion') return 'rsi_meanrev';
  if (pluginId === 'momentum_24h') return 'momentum';
  if (pluginId === 'mean_reversion_24h') return 'mean_reversion';
  if (pluginId === 'grid_deviation') return 'grid';
  if (pluginId.startsWith('golden_cross_')) return 'golden_cross';
  return 'custom_ai';
}

function experimentId(strategyHash: string): string {
  return `exp_v5_${strategyHash.slice(0, 20)}`;
}

function executionAgentId(strategyHash: string): string {
  return `agt_exp_v5_${strategyHash.slice(0, 20)}`;
}

function experimentLabel(pluginId: string): string {
  const labels: Record<string, string> = {
    rsi_mean_reversion: 'RSI Mean Reversion V5',
    momentum_24h: '24h Momentum V5',
    mean_reversion_24h: '24h Mean Reversion V5',
    grid_deviation: 'Grid Deviation V5',
    funding_carry: 'Funding Carry V5',
    golden_cross_strict: 'Golden Cross · Strict V5',
    golden_cross_participate: 'Golden Cross · Participate V5',
  };
  return labels[pluginId] || `${pluginId.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())} V5`;
}

function family(pluginId: string): string {
  if (pluginId.startsWith('golden_cross_')) return 'golden_cross';
  return pluginId;
}

function initialPermission(plugin: StrategyPlugin): PaperPermissionV5 {
  // Funding carry is not executable until the required delta-neutral spot leg
  // can be admitted atomically with the perp leg.
  return plugin.id === 'funding_carry' ? 'observe_only' : 'paper_discovery';
}

function createExperimentSpec(
  plugin: StrategyPlugin,
  strategy: FrozenStrategySpec,
  now: number,
): ExperimentSpecV5 {
  const permission = initialPermission(plugin);
  const body = {
    authorityVersion: 5 as const,
    schema: 'experiment-spec.v5' as const,
    experimentId: experimentId(strategy.hash),
    strategyHash: strategy.hash,
    pluginId: plugin.id,
    family: family(plugin.id),
    label: experimentLabel(plugin.id),
    version: 1,
    instrument: plugin.instrument,
    initialPermission: permission,
    initialLifecycleState: permission === 'observe_only' ? 'research-only' as const : 'discovery' as const,
    maximumDiscoveryNotionalUsd: 2_000,
    maximumDiscoveryOrders: 8,
    maximumConcurrentIntents: 1,
    lifecyclePolicy: { ...DEFAULT_LIFECYCLE_POLICY },
  };
  return {
    ...body,
    specHash: digest(body),
    createdAt: now,
  };
}

function createExperimentState(spec: ExperimentSpecV5, now: number): ExperimentStateV5 {
  return {
    authorityVersion: 5,
    schema: 'experiment-state.v5',
    experimentId: spec.experimentId,
    lifecycleState: spec.initialLifecycleState,
    permission: spec.initialPermission,
    eligibility: 'unknown',
    health: 'healthy',
    lifecycleReason: 'FROZEN_EXPERIMENT_REGISTERED',
    stateSince: now,
    eligibleOutcomeCount: 0,
    consecutiveEligibleFailures: 0,
    consecutiveEligibleSuccesses: 0,
    lastEvidenceIds: [],
    updatedAt: now,
  };
}

function createBudget(spec: ExperimentSpecV5, now: number): ExperimentBudgetV5 {
  return {
    authorityVersion: 5,
    schema: 'experiment-budget.v5',
    experimentId: spec.experimentId,
    maximumNotionalUsd: spec.maximumDiscoveryNotionalUsd,
    maximumOrders: spec.maximumDiscoveryOrders,
    maximumConcurrentIntents: spec.maximumConcurrentIntents,
    admittedNotionalUsd: 0,
    admittedOrders: 0,
    reservedNotionalUsd: 0,
    reservations: {},
    updatedAt: now,
  };
}

function ensureSystemOwner(db: ReturnType<typeof readDatabase>, now: number) {
  if (db.users[SYSTEM_OWNER_ID]) return;
  db.users[SYSTEM_OWNER_ID] = {
    id: SYSTEM_OWNER_ID,
    username: 'v5-paper-discovery',
    profile: {
      displayName: 'V5 Paper Discovery',
      avatarUrl: '',
      bio: 'System-owned paper-only experiment population. Live money is locked.',
      updatedAt: now,
    },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 1_000_000,
    faucetClaimedCount: 0,
  };
}

function ensureExecutionAgent(
  db: ReturnType<typeof readDatabase>,
  plugin: StrategyPlugin,
  spec: ExperimentSpecV5,
  now: number,
): TradingAgent {
  const id = executionAgentId(spec.strategyHash);
  const existing = db.agents[id];
  if (existing) {
    if (existing.authorityVersion !== 5 || existing.schema !== 'trading-agent.v5') {
      throw new Error(`EXPERIMENT_AGENT_BELOW_V5:${id}`);
    }
    return existing;
  }
  const agent: TradingAgent = {
    authorityVersion: 5,
    schema: 'trading-agent.v5',
    id,
    name: spec.label,
    description: `Registry-managed ${spec.initialPermission} execution identity for ${spec.experimentId}.`,
    ownerId: SYSTEM_OWNER_ID,
    assetSymbol: 'MULTI',
    tradeType: plugin.instrument === 'perp' ? 'perp' : 'token',
    strategyType: strategyType(plugin.id),
    leverage: 1,
    status: 'active',
    createdAt: now,
    autopilot: false,
  };
  db.agents[id] = agent;
  return agent;
}

export interface RegisteredExperimentV5 {
  spec: ExperimentSpecV5;
  state: ExperimentStateV5;
  budget: ExperimentBudgetV5;
  execution: { ownerId: string; agent: TradingAgent };
}

export function ensureExperimentPopulationV5(
  entries: Array<{ plugin: StrategyPlugin; strategy: FrozenStrategySpec }>,
  now = Date.now(),
): RegisteredExperimentV5[] {
  const db = readDatabase();
  const registry = experiments(db);
  ensureSystemOwner(db, now);
  const registered: RegisteredExperimentV5[] = [];
  for (const { plugin, strategy } of entries) {
    const candidate = createExperimentSpec(plugin, strategy, now);
    const existing = registry.specs[candidate.experimentId];
    if (existing && existing.specHash !== candidate.specHash) {
      throw new Error(`EXPERIMENT_SPEC_IMMUTABLE:${candidate.experimentId}`);
    }
    const spec = existing || candidate;
    registry.specs[spec.experimentId] = spec;
    registry.states[spec.experimentId] ||= createExperimentState(spec, now);
    registry.budgets[spec.experimentId] ||= createBudget(spec, now);
    const agent = ensureExecutionAgent(db, plugin, spec, now);
    registered.push({
      spec,
      state: registry.states[spec.experimentId],
      budget: registry.budgets[spec.experimentId],
      execution: { ownerId: SYSTEM_OWNER_ID, agent },
    });
  }
  writeDatabase(db, ['users', 'agents', 'experimentsV5']);
  return registered;
}

function featureHash(feature: LayeredDecision['featureEvidence'][number]): string {
  return digest({
    id: feature.id,
    version: feature.version,
    value: feature.value,
    quality: feature.quality,
    observationHash: feature.source.observationHash,
  });
}

export function buildOpportunityObservationV5(
  registered: RegisteredExperimentV5,
  decision: LayeredDecision,
  plugin: StrategyPlugin,
  context?: DecisionContext,
): OpportunityObservationV5 {
  const regime = plugin.regimeGate(context || {
    cycleId: decision.cycleId,
    evaluatedAt: decision.evaluatedAt,
    symbol: decision.symbol,
    instrument: decision.instrument,
    universe: { tier: 1, included: true, reason: 'decision-evidence', observedAt: decision.evaluatedAt, quality: 'good' },
    features: Object.fromEntries(decision.featureEvidence.map((item) => [item.id, item])),
    position: { holding: false, openNotionalUsd: 0, averageEntryPrice: 0 },
    limits: {
      liquidityFloorUsd: 0,
      staleBudgetMs: 0,
      modeledRoundTripCostBps: 0,
      maxRoundTripCostBps: 0,
      requestedNotionalUsd: 0,
      riskBudgetUsd: 0,
      portfolioOpenNotionalUsd: 0,
      portfolioMaxNotionalUsd: 0,
    },
  });
  const gateDeclines = decision.gates.filter((gate) => gate.status === 'decline');
  const eligibility = regime.eligible && gateDeclines.length === 0 ? 'eligible' : 'ineligible';
  const state = registered.state;
  const blockedLifecycle = state.lifecycleState === 'dormant'
    || state.lifecycleState === 'research-only'
    || state.lifecycleState === 'retired';
  const reasons = [
    ...gateDeclines.map((gate) => gate.reason),
    ...(regime.eligible ? [] : [regime.reason]),
    ...(decision.validationStatus === 'rejected' ? ['VALIDATION_REJECTED'] : []),
    ...(blockedLifecycle ? [`LIFECYCLE_${state.lifecycleState.toUpperCase().replace('-', '_')}`] : []),
  ];
  const idBody = {
    experimentId: registered.spec.experimentId,
    decisionId: decision.id,
    symbol: decision.symbol,
    evaluatedAt: decision.evaluatedAt,
  };
  return {
    authorityVersion: 5,
    schema: 'opportunity-observation.v5',
    observationId: `opp_v5_${digest(idBody).slice(0, 24)}`,
    experimentId: registered.spec.experimentId,
    decisionId: decision.id,
    strategyHash: decision.strategyHash,
    pluginId: decision.pluginId,
    family: registered.spec.family,
    label: registered.spec.label,
    symbol: decision.symbol,
    evaluatedAt: decision.evaluatedAt,
    signalAction: decision.signal?.action || 'none',
    signalStrength: decision.signal?.strength || 0,
    regime: decision.signal?.regime || regime.reason,
    eligibility,
    health: state.health,
    lifecycleState: state.lifecycleState,
    permission: decision.validationStatus === 'forward_paper_candidate'
      ? 'paper_confirmed'
      : state.permission,
    disposition: reasons.length
      ? 'declined'
      : blockedLifecycle || state.permission === 'observe_only'
        ? 'shadow'
        : 'observed',
    reasons,
    featureEvidenceHashes: decision.featureEvidence.map(featureHash),
  };
}

export function persistOpportunityObservationsV5(observations: OpportunityObservationV5[]): void {
  if (!observations.length) return;
  const db = readDatabase();
  const registry = experiments(db);
  const indexes = new Map(registry.observations.map((item, index) => [item.observationId, index]));
  for (const observation of observations) {
    const index = indexes.get(observation.observationId);
    if (index == null) {
      indexes.set(observation.observationId, registry.observations.length);
      registry.observations.push(observation);
    } else {
      registry.observations[index] = observation;
    }
  }
  if (registry.observations.length > MAX_OBSERVATIONS) {
    registry.observations.splice(0, registry.observations.length - MAX_OBSERVATIONS);
  }
  writeDatabase(db, ['experimentsV5']);
}

export function reconcileExperimentEligibilityV5(
  observations: OpportunityObservationV5[],
  at = Date.now(),
): void {
  const db = readDatabase();
  const registry = experiments(db);
  const byExperiment = new Map<string, OpportunityObservationV5[]>();
  for (const observation of observations) {
    const group = byExperiment.get(observation.experimentId) || [];
    group.push(observation);
    byExperiment.set(observation.experimentId, group);
  }
  for (const [id, group] of byExperiment) {
    const spec = registry.specs[id];
    const current = registry.states[id];
    if (!spec || !current || current.lifecycleState === 'research-only' || current.lifecycleState === 'retired') continue;
    const anyEligible = group.some((item) => item.eligibility === 'eligible');
    const evidenceIds = group.map((item) => item.observationId);
    const event: ExperimentLifecycleEventV5 = {
      authorityVersion: 5,
      schema: 'experiment-lifecycle-event.v5',
      eventId: `lifecycle_v5_${digest({ id, at, anyEligible, evidenceIds }).slice(0, 24)}`,
      experimentId: id,
      type: anyEligible ? 'regime_eligible' : 'regime_ineligible',
      actor: 'system',
      reason: anyEligible ? 'AT_LEAST_ONE_UNIVERSE_MEMBER_ELIGIBLE' : 'NO_UNIVERSE_MEMBER_REGIME_ELIGIBLE',
      evidenceIds,
      at,
    };
    const next = reduceExperimentLifecycleV5(current, spec, event);
    registry.states[id] = next;
    for (const item of group) {
      const stored = registry.observations.find((observation) => observation.observationId === item.observationId);
      if (!stored) continue;
      stored.lifecycleState = next.lifecycleState;
      stored.permission = next.permission;
      if (next.lifecycleState === 'dormant' && stored.eligibility === 'ineligible') {
        stored.disposition = 'shadow';
        stored.reasons = [...new Set([...stored.reasons, 'LIFECYCLE_DORMANT'])];
      }
    }
    if (!registry.lifecycleEvents.some((item) => item.eventId === event.eventId)) {
      registry.lifecycleEvents.push(event);
    }
  }
  if (registry.lifecycleEvents.length > 5_000) {
    registry.lifecycleEvents.splice(0, registry.lifecycleEvents.length - 5_000);
  }
  writeDatabase(db, ['experimentsV5']);
}

function updateObservation(
  observationId: string,
  update: Pick<OpportunityObservationV5, 'disposition' | 'reasons'> & {
    orderIntentId?: string;
    lifecycleState?: OpportunityObservationV5['lifecycleState'];
    permission?: OpportunityObservationV5['permission'];
  },
): void {
  const db = readDatabase();
  const observation = experiments(db).observations.find((item) => item.observationId === observationId);
  if (!observation) throw new Error(`OPPORTUNITY_OBSERVATION_NOT_FOUND:${observationId}`);
  Object.assign(observation, update);
  writeDatabase(db, ['experimentsV5']);
}

export function routeExperimentObservationV5(input: {
  registered: RegisteredExperimentV5;
  observation: OpportunityObservationV5;
  decision: LayeredDecision;
  context: DecisionContext;
  deferDeclinePersistence?: boolean;
}): { routed: boolean; reason: string; intentId?: string } {
  const { registered, observation, decision, context } = input;
  const flags = v5AuthorityFlags();
  const db = readDatabase();
  const registry = experiments(db);
  let currentState = registry.states[registered.spec.experimentId];
  const currentSpec = registry.specs[registered.spec.experimentId];
  const decline = (reason: string) => {
    const update: Pick<OpportunityObservationV5, 'disposition' | 'reasons'> = {
      disposition: reason.startsWith('LIFECYCLE_') || reason === 'NO_SIGNAL' ? 'shadow' : 'declined',
      reasons: [...new Set([...observation.reasons, reason])],
    };
    if (input.deferDeclinePersistence) {
      const stored = registry.observations.find((item) => item.observationId === observation.observationId);
      if (!stored) throw new Error(`OPPORTUNITY_OBSERVATION_NOT_FOUND:${observation.observationId}`);
      Object.assign(stored, update);
      Object.assign(observation, update);
    } else {
      updateObservation(observation.observationId, update);
    }
    return { routed: false, reason };
  };
  if (flags.liveExecutionEnabled) return decline('LIVE_EXECUTION_MUST_REMAIN_LOCKED');
  if (!flags.paperIntentsEnabled) return decline('V5_PAPER_INTENTS_DISABLED');
  if (!currentState || !currentSpec) return decline('EXPERIMENT_REGISTRY_ENTRY_MISSING');
  if (!decision.signal || decision.signal.action === 'hold') return decline('NO_SIGNAL');
  if (decision.validationStatus === 'rejected') return decline('VALIDATION_REJECTED');
  if (decision.validationStatus === 'forward_paper_candidate' && currentState.permission !== 'paper_confirmed') {
    const promotion: ExperimentLifecycleEventV5 = {
      authorityVersion: 5,
      schema: 'experiment-lifecycle-event.v5',
      eventId: `lifecycle_v5_${digest({
        experimentId: currentState.experimentId,
        type: 'promote_confirmed',
        decisionId: decision.id,
      }).slice(0, 24)}`,
      experimentId: currentState.experimentId,
      type: 'promote_confirmed',
      actor: 'system',
      reason: 'MATCHING_FORWARD_PAPER_VALIDATION',
      evidenceIds: [decision.id],
      at: decision.evaluatedAt,
    };
    currentState = reduceExperimentLifecycleV5(currentState, currentSpec, promotion);
    registry.states[currentState.experimentId] = currentState;
    if (!registry.lifecycleEvents.some((item) => item.eventId === promotion.eventId)) {
      registry.lifecycleEvents.push(promotion);
    }
    writeDatabase(db, ['experimentsV5']);
  }
  if (observation.eligibility !== 'eligible') return decline('REGIME_OR_GATE_INELIGIBLE');
  if (currentState.health === 'failed') return decline('EXPERIMENT_HEALTH_FAILED');
  if (!['discovery', 'confirmed', 'probation', 'reduced'].includes(currentState.lifecycleState)) {
    return decline(`LIFECYCLE_${currentState.lifecycleState.toUpperCase().replace('-', '_')}`);
  }
  const effectivePermission: PaperPermissionV5 = decision.validationStatus === 'forward_paper_candidate'
    ? 'paper_confirmed'
    : currentState.permission;
  if (effectivePermission === 'observe_only') return decline('PAPER_PERMISSION_OBSERVE_ONLY');
  if (context.instrument !== currentSpec.instrument) return decline('INSTRUMENT_MISMATCH');
  const price = Number(context.features['price.v5']?.value);
  if (!(price > 0)) return decline('PRICE_UNAVAILABLE');
  if (context.limits.modeledRoundTripCostBps > context.limits.maxRoundTripCostBps) {
    return decline('COST_BUDGET_EXCEEDED');
  }

  const budget = registry.budgets[registered.spec.experimentId];
  const agent = db.agents[registered.execution.agent.id];
  if (!budget || !agent || agent.ownerId !== SYSTEM_OWNER_ID) return decline('EXPERIMENT_EXECUTION_IDENTITY_MISSING');
  const activeIntents = Object.values(db.orderIntentsV5 || {}).filter((intent) =>
    intent.experimentId === registered.spec.experimentId
    && ['PENDING', 'RISK_ACCEPTED', 'BROKER_PENDING', 'PARTIALLY_FILLED', 'UNRESOLVED'].includes(intent.status));
  if (activeIntents.length >= budget.maximumConcurrentIntents) return decline('EXPERIMENT_CONCURRENT_INTENT_CAP');

  const position = agentPosition(SYSTEM_OWNER_ID, agent.id, decision.symbol);
  const actionSign = decision.signal.action === 'buy' || decision.signal.action === 'long' ? 1 : -1;
  const positionEffect: 'increase' | 'reduce' = position.signedSize !== 0 && Math.sign(position.signedSize) !== actionSign
    ? 'reduce'
    : 'increase';
  const entry = positionEffect === 'increase';
  const requestedNotional = currentState.lifecycleState === 'reduced'
    ? context.limits.requestedNotionalUsd / 2
    : context.limits.requestedNotionalUsd;
  const size = entry
    ? Number((requestedNotional / price).toFixed(6))
    : position.size;
  if (!(size > 0)) return decline(entry ? 'INVALID_DISCOVERY_SIZE' : 'NO_EXPERIMENT_POSITION_TO_REDUCE');
  const notional = size * price;
  if (entry && budget.admittedOrders >= budget.maximumOrders) return decline('EXPERIMENT_ORDER_BUDGET_EXHAUSTED');
  if (entry && budget.admittedNotionalUsd + budget.reservedNotionalUsd + notional > budget.maximumNotionalUsd + 1e-9) {
    return decline('EXPERIMENT_NOTIONAL_BUDGET_EXHAUSTED');
  }
  const dailyVolumeUsd = Number(context.features['volume_24h_usd.v5']?.value);
  if (!(dailyVolumeUsd >= 0)) return decline('PORTFOLIO_LIQUIDITY_EVIDENCE_UNAVAILABLE');
  const allocation = reservePortfolioRiskV5({
    userId: SYSTEM_OWNER_ID,
    agentId: agent.id,
    experimentId: currentSpec.experimentId,
    strategyHash: currentSpec.strategyHash,
    opportunityObservationId: observation.observationId,
    symbol: decision.symbol,
    side: decision.signal.action,
    positionEffect,
    requestedSize: size,
    referencePrice: price,
    requestedNotionalUsd: notional,
    family: currentSpec.family,
    regime: observation.regime,
    dailyVolumeUsd,
  });
  if (!allocation.accepted) return decline(allocation.decision.reasons.join('|') || 'PORTFOLIO_RESERVATION_DENIED');

  if (entry) {
    const reservedDb = readDatabase();
    const reservedBudget = experiments(reservedDb).budgets[registered.spec.experimentId];
    if (!reservedBudget) {
      releasePortfolioReservationV5(allocation.reservation.reservationId, 'EXPERIMENT_BUDGET_MISSING_AFTER_ALLOCATION');
      return decline('EXPERIMENT_BUDGET_MISSING_AFTER_ALLOCATION');
    }
    reservedBudget.reservations[observation.observationId] = {
      notionalUsd: notional,
      status: 'reserved',
      createdAt: Date.now(),
    };
    reservedBudget.reservedNotionalUsd += notional;
    reservedBudget.updatedAt = Date.now();
    try {
      writeDatabase(reservedDb, ['experimentsV5']);
    } catch (error) {
      releasePortfolioReservationV5(allocation.reservation.reservationId, 'EXPERIMENT_BUDGET_RESERVATION_WRITE_FAILED');
      throw error;
    }
  }

  const result = placePaperTrade(SYSTEM_OWNER_ID, {
    agentId: agent.id,
    assetSymbol: decision.symbol,
    side: decision.signal.action,
    size,
    price,
    nonce: `experiment_${observation.observationId}`,
    experimentId: registered.spec.experimentId,
    experimentLabel: registered.spec.label,
    opportunityObservationId: observation.observationId,
    paperPermission: effectivePermission,
    portfolioReservationId: allocation.reservation.reservationId,
    thesis: {
      cardId: decision.pluginId,
      decisionId: decision.id,
      strategyHash: decision.strategyHash,
      signalFamily: registered.spec.family,
      setup: decision.signal.setup,
      trigger: decision.signal.trigger,
      invalidation: decision.signal.invalidation,
      regime: decision.signal.regime,
      benchmark: registered.spec.pluginId,
      holdingWindow: 'frozen-strategy-defined',
    },
  }, {
    action: 'V5_EXPERIMENT_PAPER_INTENT',
    detailsPrefix: `${registered.spec.label} admitted ${effectivePermission}`,
  });

  const after = readDatabase();
  const afterBudget = experiments(after).budgets[registered.spec.experimentId];
  const reservation = afterBudget?.reservations[observation.observationId];
  if (!result.ok || !result.intent) {
    releasePortfolioReservationV5(allocation.reservation.reservationId, result.error || 'ORDER_NOT_ACCEPTED');
    if (reservation?.status === 'reserved') {
      afterBudget.reservedNotionalUsd = Math.max(0, afterBudget.reservedNotionalUsd - reservation.notionalUsd);
      reservation.status = 'released';
      reservation.reason = result.error || 'ORDER_NOT_ACCEPTED';
      afterBudget.updatedAt = Date.now();
      writeDatabase(after, ['experimentsV5']);
    }
    return decline(result.error || 'ORDER_NOT_ACCEPTED');
  }
  if (reservation?.status === 'reserved') {
    afterBudget.reservedNotionalUsd = Math.max(0, afterBudget.reservedNotionalUsd - reservation.notionalUsd);
    afterBudget.admittedNotionalUsd += reservation.notionalUsd;
    afterBudget.admittedOrders += 1;
    reservation.status = 'accepted';
    reservation.intentId = result.intent.intentId;
    afterBudget.updatedAt = Date.now();
    writeDatabase(after, ['experimentsV5']);
  }
  updateObservation(observation.observationId, {
    disposition: 'admitted',
    reasons: [effectivePermission === 'paper_confirmed' ? 'PAPER_CONFIRMED_ADMITTED' : 'PAPER_DISCOVERY_ADMITTED'],
    orderIntentId: result.intent.intentId,
    lifecycleState: currentState.lifecycleState,
    permission: effectivePermission,
  });
  return { routed: true, reason: effectivePermission, intentId: result.intent.intentId };
}

export function flushExperimentObservationUpdatesV5(): void {
  const db = readDatabase();
  writeDatabase(db, ['experimentsV5']);
}

export function reduceExperimentLifecycleV5(
  current: ExperimentStateV5,
  spec: ExperimentSpecV5,
  event: ExperimentLifecycleEventV5,
): ExperimentStateV5 {
  if (event.experimentId !== current.experimentId || event.experimentId !== spec.experimentId) {
    throw new Error('EXPERIMENT_LIFECYCLE_ID_MISMATCH');
  }
  if (event.actor === 'agent' && (event.type === 'promote_confirmed' || event.type === 'operator_retire')) {
    throw new Error('AGENT_CANNOT_SELF_PROMOTE_OR_RETIRE');
  }
  const next = structuredClone(current);
  const policy = spec.lifecyclePolicy;
  const setState = (state: ExperimentStateV5['lifecycleState'], reason: string) => {
    if (next.lifecycleState !== state) next.stateSince = event.at;
    next.lifecycleState = state;
    next.lifecycleReason = reason;
  };
  if (current.lifecycleState === 'retired' && event.type !== 'operator_retire') {
    return current;
  }
  if (event.type === 'regime_ineligible') {
    next.eligibility = 'ineligible';
    setState('dormant', event.reason || 'REGIME_INELIGIBLE');
  } else if (event.type === 'regime_eligible') {
    next.eligibility = 'eligible';
    if (current.lifecycleState === 'dormant'
      && event.at - current.stateSince >= policy.minimumDwellMs) {
      setState('probation', event.reason || 'REGIME_RETURNED_AFTER_DWELL');
      next.consecutiveEligibleSuccesses = 0;
      next.consecutiveEligibleFailures = 0;
    }
  } else if (event.type === 'eligible_loss') {
    next.eligibility = 'eligible';
    next.eligibleOutcomeCount += 1;
    next.consecutiveEligibleFailures += 1;
    next.consecutiveEligibleSuccesses = 0;
    if (next.consecutiveEligibleFailures >= policy.failuresBeforeRetired
      && next.eligibleOutcomeCount >= policy.minimumEligibleOutcomesBeforeRetired) {
      setState('retired', event.reason || 'REPEATED_ELIGIBLE_FAILURE');
      next.permission = 'observe_only';
    } else if (next.consecutiveEligibleFailures >= policy.failuresBeforeReduced) {
      setState('reduced', event.reason || 'ELIGIBLE_FAILURES_REDUCED');
    } else {
      next.lifecycleReason = event.reason || 'SINGLE_ELIGIBLE_LOSS_RECORDED';
    }
  } else if (event.type === 'eligible_win') {
    next.eligibility = 'eligible';
    next.eligibleOutcomeCount += 1;
    next.consecutiveEligibleSuccesses += 1;
    next.consecutiveEligibleFailures = 0;
    if (current.lifecycleState === 'probation'
      && next.consecutiveEligibleSuccesses >= policy.probationSuccessesRequired) {
      setState(next.permission === 'paper_confirmed' ? 'confirmed' : 'discovery', 'PROBATION_EVIDENCE_SUFFICIENT');
    } else {
      next.lifecycleReason = event.reason || 'ELIGIBLE_WIN_RECORDED';
    }
  } else if (event.type === 'health_failure') {
    next.health = 'failed';
    setState('reduced', event.reason || 'HEALTH_FAILURE');
  } else if (event.type === 'health_recovered') {
    next.health = 'healthy';
    next.lifecycleReason = event.reason || 'HEALTH_RECOVERED';
  } else if (event.type === 'promote_confirmed') {
    if (!event.evidenceIds.length) throw new Error('CONFIRMED_PROMOTION_REQUIRES_EVIDENCE');
    next.permission = 'paper_confirmed';
    setState('confirmed', event.reason || 'CONFIRMED_WITH_EVIDENCE');
  } else if (event.type === 'operator_retire') {
    if (event.actor !== 'operator') throw new Error('RETIREMENT_REQUIRES_OPERATOR');
    next.permission = 'observe_only';
    setState('retired', event.reason || 'OPERATOR_RETIRED');
  }
  next.lastEvidenceIds = [...new Set([...next.lastEvidenceIds, ...event.evidenceIds])].slice(-20);
  next.updatedAt = event.at;
  return next;
}

export function applyExperimentLifecycleEventV5(event: ExperimentLifecycleEventV5): ExperimentStateV5 {
  const db = readDatabase();
  const registry = experiments(db);
  const spec = registry.specs[event.experimentId];
  const current = registry.states[event.experimentId];
  if (!spec || !current) throw new Error(`EXPERIMENT_NOT_FOUND:${event.experimentId}`);
  if (registry.lifecycleEvents.some((item) => item.eventId === event.eventId)) return current;
  const next = reduceExperimentLifecycleV5(current, spec, event);
  registry.states[event.experimentId] = next;
  registry.lifecycleEvents.push(event);
  writeDatabase(db, ['experimentsV5']);
  return next;
}

export function proposeExperimentChallengerV5(input: {
  parentExperimentId: string;
  challengerStrategy: FrozenStrategySpec;
  label: string;
  reason: string;
  actor: 'system' | 'operator' | 'agent';
  now?: number;
}): ExperimentSpecV5 {
  if (input.actor === 'agent') throw new Error('AGENT_CANNOT_MUTATE_ACTIVE_EXPERIMENT');
  const now = input.now ?? Date.now();
  const db = readDatabase();
  const registry = experiments(db);
  const parent = registry.specs[input.parentExperimentId];
  if (!parent) throw new Error(`EXPERIMENT_NOT_FOUND:${input.parentExperimentId}`);
  const body = {
    authorityVersion: 5 as const,
    schema: 'experiment-spec.v5' as const,
    experimentId: experimentId(input.challengerStrategy.hash),
    strategyHash: input.challengerStrategy.hash,
    pluginId: input.challengerStrategy.pluginId,
    family: parent.family,
    label: input.label,
    version: parent.version + 1,
    instrument: input.challengerStrategy.instrument,
    initialPermission: 'paper_discovery' as const,
    initialLifecycleState: 'draft' as const,
    maximumDiscoveryNotionalUsd: parent.maximumDiscoveryNotionalUsd,
    maximumDiscoveryOrders: parent.maximumDiscoveryOrders,
    maximumConcurrentIntents: parent.maximumConcurrentIntents,
    lifecyclePolicy: structuredClone(parent.lifecyclePolicy),
    parentExperimentId: parent.experimentId,
    challengerReason: input.reason,
  };
  const challenger: ExperimentSpecV5 = { ...body, specHash: digest(body), createdAt: now };
  const existing = registry.specs[challenger.experimentId];
  if (existing && existing.specHash !== challenger.specHash) {
    throw new Error(`EXPERIMENT_SPEC_IMMUTABLE:${challenger.experimentId}`);
  }
  registry.specs[challenger.experimentId] = existing || challenger;
  registry.states[challenger.experimentId] ||= createExperimentState(challenger, now);
  registry.budgets[challenger.experimentId] ||= createBudget(challenger, now);
  writeDatabase(db, ['experimentsV5']);
  return registry.specs[challenger.experimentId];
}

export function experimentPopulationSnapshotV5() {
  const db = readDatabase();
  const registry = experiments(db);
  const portfolio = portfolioAllocatorSnapshotV5();
  return {
    mode: 'Paper money',
    liveExecution: 'locked',
    portfolioOpenAndReservedNotionalUsd: portfolio.risk.grossExposureUsd,
    portfolioMaximumNotionalUsd: portfolio.policy.maximumGrossExposureUsd,
    specs: Object.values(registry.specs),
    states: Object.values(registry.states),
    budgets: Object.values(registry.budgets),
    recentObservations: registry.observations.slice(-250).reverse(),
    recentLifecycleEvents: registry.lifecycleEvents.slice(-100).reverse(),
  };
}
