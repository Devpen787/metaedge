import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-experiments-v5-'));
process.env.DATABASE_URL = path.join(root, 'db.json');

test('the frozen population includes separate Golden Cross variants and registry-managed execution identities', async () => {
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const {
    goldenCrossParticipateV5,
    goldenCrossStrictV5,
    momentum24hV5,
  } = await import('../../server/decision/plugins.js');
  const { ensureExperimentPopulationV5 } = await import('../../server/v5/experiments.js');
  const { readDatabase } = await import('../../server/storage.js');
  const entries = [goldenCrossStrictV5, goldenCrossParticipateV5, momentum24hV5]
    .map((plugin) => ({ plugin, strategy: compileFrozenStrategy(plugin, 100) }));
  const registered = ensureExperimentPopulationV5(entries, 100);
  assert.equal(registered.length, 3);
  assert.notEqual(registered[0].spec.experimentId, registered[1].spec.experimentId);
  assert.equal(registered[0].spec.label, 'Golden Cross · Strict V5');
  assert.equal(registered[1].spec.label, 'Golden Cross · Participate V5');
  assert.ok(registered.every((item) => item.state.permission === 'paper_discovery'));
  assert.ok(registered.every((item) => item.execution.agent.authorityVersion === 5));
  assert.ok(registered.every((item) => item.execution.agent.autopilot === false));
  assert.ok(readDatabase().users.usr_v5_paper_discovery);
});

test('the first V5 population predeclares 14 arms across at least 12 mechanism families', async () => {
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { STRATEGY_PLUGINS } = await import('../../server/decision/plugins.js');
  const { ensureExperimentPopulationV5 } = await import('../../server/v5/experiments.js');
  const { ensureExperimentTrialsV5 } = await import('../../server/v5/outcomes.js');
  assert.equal(STRATEGY_PLUGINS.length, 14);
  assert.equal(new Set(STRATEGY_PLUGINS.map((plugin) => plugin.id)).size, 14);
  assert.equal(new Set(STRATEGY_PLUGINS.map((plugin) => plugin.mechanism)).size, 14);
  assert.ok(STRATEGY_PLUGINS.every((plugin) => plugin.authorityVersion === 5
    && plugin.requiredFeatures.length >= 3
    && plugin.benchmark.length > 0
    && plugin.falsifier.length > 0
    && plugin.expectedFailureRegimes.length >= 3));
  const registered = ensureExperimentPopulationV5(STRATEGY_PLUGINS.map((plugin) => ({
    plugin,
    strategy: compileFrozenStrategy(plugin, 500),
  })), 500);
  assert.equal(registered.length, 14);
  assert.ok(new Set(registered.map((item) => item.spec.family)).size >= 12);
  assert.equal(registered.filter((item) => item.state.permission === 'paper_discovery').length, 13);
  assert.equal(registered.filter((item) => item.state.permission === 'observe_only').length, 1);
  const trials = ensureExperimentTrialsV5(501);
  assert.ok(registered.every((item) => trials.some((trial) => trial.experimentId === item.spec.experimentId)));
  assert.ok(trials.every((trial) => trial.controls.length === 2 && trial.liveExecution === 'locked'));
});

test('an unvalidated but valid signal can consume only a capped paper-discovery budget', async () => {
  const { buildVersionedFeatures } = await import('../../server/decision/features.js');
  const { evaluateLayeredDecision } = await import('../../server/decision/engine.js');
  const { momentum24hV5 } = await import('../../server/decision/plugins.js');
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { persistDecision } = await import('../../server/decision/store.js');
  const {
    buildOpportunityObservationV5,
    ensureExperimentPopulationV5,
    persistOpportunityObservationsV5,
    routeExperimentObservationV5,
  } = await import('../../server/v5/experiments.js');
  const { __applyCanonicalPriceForTest } = await import('../../server/prices.js');
  const { readDatabase } = await import('../../server/storage.js');
  const now = Date.now();
  const source = { provider: 'fixture', dataset: 'fixture-v5', venue: 'fixture', observedAt: now, retrievedAt: now };
  const features = buildVersionedFeatures({
    symbol: 'BTC',
    price: 100,
    change24hPct: 2,
    volume24hUsd: 100_000_000,
    high24h: 102,
    low24h: 98,
    hourlyCloses: Array.from({ length: 220 }, (_, index) => 80 + index / 10),
    fundingHourly: 0,
    openInterestUsd: 100_000_000,
    sources: { market: source, history: source, funding: source },
    staleBudgets: { market: 300_000, history: 300_000, funding: 300_000 },
  });
  const strategy = compileFrozenStrategy(momentum24hV5, now);
  const registered = ensureExperimentPopulationV5([{ plugin: momentum24hV5, strategy }], now)[0];
  const context = {
    cycleId: 'cycle_discovery',
    evaluatedAt: now,
    symbol: 'BTC',
    instrument: 'spot' as const,
    universe: { tier: 1, included: true, reason: 'fixture', observedAt: now, quality: 'good' as const },
    features,
    position: { holding: false, openNotionalUsd: 0, averageEntryPrice: 0 },
    limits: {
      liquidityFloorUsd: 50_000_000,
      staleBudgetMs: 300_000,
      modeledRoundTripCostBps: 20,
      maxRoundTripCostBps: 40,
      requestedNotionalUsd: 250,
      riskBudgetUsd: 250,
      portfolioOpenNotionalUsd: 0,
      portfolioMaxNotionalUsd: 2_500,
    },
    routing: { ownerId: registered.execution.ownerId, agentId: registered.execution.agent.id },
  };
  const decision = persistDecision(evaluateLayeredDecision(context, momentum24hV5, strategy));
  assert.equal(decision.outcome, 'research_hypothesis');
  assert.equal(decision.paperPermission, 'paper_discovery');
  const observation = buildOpportunityObservationV5(registered, decision, momentum24hV5, context);
  persistOpportunityObservationsV5([observation]);
  __applyCanonicalPriceForTest('BTC', 100, now);
  const routed = routeExperimentObservationV5({ registered, observation, decision, context });
  assert.equal(routed.routed, true);
  assert.equal(routed.reason, 'paper_discovery');
  const db = readDatabase();
  const intent = db.orderIntentsV5?.[routed.intentId!];
  assert.equal(intent?.experimentId, registered.spec.experimentId);
  assert.equal(intent?.opportunityObservationId, observation.observationId);
  assert.equal(intent?.paperPermission, 'paper_discovery');
  assert.equal(db.experimentsV5?.budgets[registered.spec.experimentId].admittedOrders, 1);
  assert.ok((db.experimentsV5?.budgets[registered.spec.experimentId].admittedNotionalUsd || 0) <= 250);
  assert.equal(db.experimentsV5?.observations[0].disposition, 'admitted');
});

test('Golden Cross strict uses the same V5 opportunity, intent, risk, and broker ledger', async () => {
  const { buildVersionedFeatures } = await import('../../server/decision/features.js');
  const { evaluateLayeredDecision } = await import('../../server/decision/engine.js');
  const { goldenCrossStrictV5 } = await import('../../server/decision/plugins.js');
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { persistDecision } = await import('../../server/decision/store.js');
  const {
    buildOpportunityObservationV5,
    ensureExperimentPopulationV5,
    persistOpportunityObservationsV5,
    routeExperimentObservationV5,
  } = await import('../../server/v5/experiments.js');
  const { __applyCanonicalPriceForTest } = await import('../../server/prices.js');
  const { readDatabase } = await import('../../server/storage.js');
  const now = Date.now();
  const source = { provider: 'fixture', dataset: 'daily-v5', venue: 'fixture', observedAt: now, retrievedAt: now };
  const features = buildVersionedFeatures({
    symbol: 'ETH',
    price: 101,
    change24hPct: 2,
    volume24hUsd: 200_000_000,
    high24h: 102,
    low24h: 98,
    hourlyCloses: Array.from({ length: 220 }, (_, index) => 80 + index / 10),
    fundingHourly: 0,
    openInterestUsd: 100_000_000,
    daily: {
      sma50: 101,
      sma200: 100,
      sma50Previous: 99,
      sma200Previous: 100,
      volume50AverageUsd: 100_000_000,
      return30dPct: 5,
      source,
      staleBudgetMs: 300_000,
    },
    sources: { market: source, history: source, funding: source },
    staleBudgets: { market: 300_000, history: 300_000, funding: 300_000 },
  });
  const strategy = compileFrozenStrategy(goldenCrossStrictV5, now);
  const registered = ensureExperimentPopulationV5([{ plugin: goldenCrossStrictV5, strategy }], now)[0];
  const context = {
    cycleId: 'cycle_golden_cross_strict',
    evaluatedAt: now,
    symbol: 'ETH',
    instrument: 'spot' as const,
    universe: { tier: 1, included: true, reason: 'fixture', observedAt: now, quality: 'good' as const },
    features,
    position: { holding: false, openNotionalUsd: 0, averageEntryPrice: 0 },
    limits: {
      liquidityFloorUsd: 50_000_000,
      staleBudgetMs: 300_000,
      modeledRoundTripCostBps: 20,
      maxRoundTripCostBps: 40,
      requestedNotionalUsd: 250,
      riskBudgetUsd: 250,
      portfolioOpenNotionalUsd: 0,
      portfolioMaxNotionalUsd: 2_500,
    },
    routing: { ownerId: registered.execution.ownerId, agentId: registered.execution.agent.id },
  };
  const decision = persistDecision(evaluateLayeredDecision(context, goldenCrossStrictV5, strategy));
  assert.equal(decision.signal?.action, 'buy');
  const observation = buildOpportunityObservationV5(registered, decision, goldenCrossStrictV5, context);
  persistOpportunityObservationsV5([observation]);
  __applyCanonicalPriceForTest('ETH', 101, now);
  const result = routeExperimentObservationV5({ registered, observation, decision, context });
  assert.equal(result.routed, true);
  const intent = readDatabase().orderIntentsV5?.[result.intentId!];
  assert.equal(intent?.schema, 'order-intent.v5');
  assert.equal(intent?.experimentLabel, 'Golden Cross · Strict V5');
  assert.equal(intent?.brokerPolicyId, 'paper-broker-conservative-v5');
  assert.equal(intent?.status, 'BROKER_PENDING');

  const exitFeatures = structuredClone(features);
  exitFeatures['daily_sma_50.v5'].value = 99;
  exitFeatures['daily_sma_200.v5'].value = 100;
  const exitDecision = evaluateLayeredDecision({
    ...context,
    cycleId: 'cycle_golden_cross_exit',
    evaluatedAt: now + 1,
    features: exitFeatures,
    position: { holding: true, openNotionalUsd: 250, averageEntryPrice: 101, heldSince: now },
  }, goldenCrossStrictV5, strategy);
  assert.equal(exitDecision.gates.find((gate) => gate.layer === 'regime')?.status, 'pass');
  assert.equal(exitDecision.signal?.action, 'sell');
});

test('lifecycle uses dormancy and probation, and one eligible loss never retires a strategy', async () => {
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { meanReversion24hV5 } = await import('../../server/decision/plugins.js');
  const {
    ensureExperimentPopulationV5,
    persistOpportunityObservationsV5,
    reconcileExperimentEligibilityV5,
    reduceExperimentLifecycleV5,
  } = await import('../../server/v5/experiments.js');
  const { readDatabase } = await import('../../server/storage.js');
  const strategy = compileFrozenStrategy(meanReversion24hV5, 200);
  const registered = ensureExperimentPopulationV5([{ plugin: meanReversion24hV5, strategy }], 200)[0];
  const event = (type: any, at: number, actor: 'system' | 'operator' | 'agent' = 'system') => ({
    authorityVersion: 5 as const,
    schema: 'experiment-lifecycle-event.v5' as const,
    eventId: `event_${type}_${at}`,
    experimentId: registered.spec.experimentId,
    type,
    actor,
    reason: type,
    evidenceIds: ['evidence'],
    at,
  });
  const oneLoss = reduceExperimentLifecycleV5(
    registered.state,
    registered.spec,
    event('eligible_loss', 300),
  );
  assert.notEqual(oneLoss.lifecycleState, 'retired');
  assert.equal(oneLoss.consecutiveEligibleFailures, 1);

  const dormant = reduceExperimentLifecycleV5(
    oneLoss,
    registered.spec,
    event('regime_ineligible', 400),
  );
  assert.equal(dormant.lifecycleState, 'dormant');
  const tooSoon = reduceExperimentLifecycleV5(
    dormant,
    registered.spec,
    event('regime_eligible', 401),
  );
  assert.equal(tooSoon.lifecycleState, 'dormant');
  const probation = reduceExperimentLifecycleV5(
    dormant,
    registered.spec,
    event('regime_eligible', 400 + registered.spec.lifecyclePolicy.minimumDwellMs),
  );
  assert.equal(probation.lifecycleState, 'probation');

  let repeated = registered.state;
  for (let index = 0; index < registered.spec.lifecyclePolicy.failuresBeforeRetired; index++) {
    repeated = reduceExperimentLifecycleV5(
      repeated,
      registered.spec,
      event('eligible_loss', 1_000 + index),
    );
  }
  assert.equal(repeated.lifecycleState, 'retired');
  assert.equal(repeated.permission, 'observe_only');
  assert.throws(
    () => reduceExperimentLifecycleV5(
      registered.state,
      registered.spec,
      event('promote_confirmed', 500, 'agent'),
    ),
    /AGENT_CANNOT_SELF_PROMOTE/,
  );

  const ineligibleObservation = {
    authorityVersion: 5 as const,
    schema: 'opportunity-observation.v5' as const,
    observationId: 'opp_v5_ineligible_fixture',
    experimentId: registered.spec.experimentId,
    decisionId: 'decision_ineligible_fixture',
    strategyHash: registered.spec.strategyHash,
    pluginId: registered.spec.pluginId,
    family: registered.spec.family,
    label: registered.spec.label,
    symbol: 'BTC',
    evaluatedAt: 10_000,
    signalAction: 'hold' as const,
    signalStrength: 0,
    regime: 'regime_mismatch',
    eligibility: 'ineligible' as const,
    health: 'healthy' as const,
    lifecycleState: 'discovery' as const,
    permission: 'paper_discovery' as const,
    disposition: 'declined' as const,
    reasons: ['REGIME_NOT_ELIGIBLE'],
    featureEvidenceHashes: [],
  };
  persistOpportunityObservationsV5([ineligibleObservation]);
  reconcileExperimentEligibilityV5([ineligibleObservation], 10_000);
  const reconciled = readDatabase().experimentsV5!;
  assert.equal(reconciled.states[registered.spec.experimentId].lifecycleState, 'dormant');
  assert.equal(
    reconciled.observations.find((item) => item.observationId === ineligibleObservation.observationId)?.disposition,
    'shadow',
  );
});

test('active specs are immutable and changes create a versioned challenger', async () => {
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { momentum24hV5 } = await import('../../server/decision/plugins.js');
  const {
    ensureExperimentPopulationV5,
    proposeExperimentChallengerV5,
  } = await import('../../server/v5/experiments.js');
  const { readDatabase } = await import('../../server/storage.js');
  const parentStrategy = compileFrozenStrategy(momentum24hV5, 300);
  const parent = ensureExperimentPopulationV5([{ plugin: momentum24hV5, strategy: parentStrategy }], 300)[0];
  const challengerPlugin = {
    ...momentum24hV5,
    version: '5.0.1',
    parameters: { thresholdPct: 1.25 },
  };
  const challengerStrategy = compileFrozenStrategy(challengerPlugin, 400);
  const challenger = proposeExperimentChallengerV5({
    parentExperimentId: parent.spec.experimentId,
    challengerStrategy,
    label: '24h Momentum V5 challenger 1.25%',
    reason: 'test a higher frozen threshold without mutating the active parent',
    actor: 'system',
    now: 400,
  });
  assert.notEqual(challenger.experimentId, parent.spec.experimentId);
  assert.equal(challenger.parentExperimentId, parent.spec.experimentId);
  assert.equal(challenger.version, parent.spec.version + 1);
  assert.equal(readDatabase().experimentsV5?.specs[parent.spec.experimentId].specHash, parent.spec.specHash);
  assert.throws(() => proposeExperimentChallengerV5({
    parentExperimentId: parent.spec.experimentId,
    challengerStrategy,
    label: 'agent mutation',
    reason: 'forbidden',
    actor: 'agent',
    now: 500,
  }), /AGENT_CANNOT_MUTATE/);
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
