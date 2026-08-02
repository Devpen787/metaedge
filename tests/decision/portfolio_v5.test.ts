import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-portfolio-v5-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

async function reset() {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.users = {
    portfolio_user: {
      id: 'portfolio_user',
      username: 'portfolio-test',
      profile: { displayName: 'Portfolio Test', avatarUrl: '', updatedAt: 1 },
      createdAt: 1,
      lastActiveAt: 1,
      paperBalance: 1_000_000,
      faucetClaimedCount: 0,
    },
  };
  db.agents = {};
  db.trades = [];
  db.orderIntentsV5 = {};
  db.orderNonceIndexV5 = {};
  db.orderEventsV5 = [];
  db.paperFillsV5 = [];
  db.experimentsV5 = { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] };
  delete db.portfolioAllocatorV5;
  writeDatabase(db);
}

async function seedExperiment(id: string, family: string, agentId = `agent_${id}`, instrument: 'spot' | 'perp' = 'spot') {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.agents[agentId] = {
    authorityVersion: 5,
    schema: 'trading-agent.v5',
    id: agentId,
    name: id,
    description: 'portfolio fixture',
    ownerId: 'portfolio_user',
    assetSymbol: 'MULTI',
    tradeType: instrument === 'perp' ? 'perp' : 'token',
    strategyType: 'custom_ai',
    leverage: 1,
    status: 'active',
    createdAt: 1,
  };
  db.experimentsV5!.specs[id] = {
    authorityVersion: 5,
    schema: 'experiment-spec.v5',
    experimentId: id,
    specHash: `spec_${id}`,
    strategyHash: `strategy_${id}`,
    pluginId: family,
    family,
    label: id,
    version: 1,
    instrument,
    initialPermission: 'paper_discovery',
    initialLifecycleState: 'discovery',
    maximumDiscoveryNotionalUsd: 20_000,
    maximumDiscoveryOrders: 100,
    maximumConcurrentIntents: 10,
    lifecyclePolicy: {
      minimumDwellMs: 1,
      failuresBeforeReduced: 2,
      failuresBeforeRetired: 5,
      minimumEligibleOutcomesBeforeRetired: 5,
      probationSuccessesRequired: 2,
    },
    createdAt: 1,
  };
  writeDatabase(db);
  return { id, family, agentId, strategyHash: `strategy_${id}` };
}

function request(
  experiment: { id: string; family: string; agentId: string; strategyHash: string },
  overrides: Partial<{
    opportunityObservationId: string;
    symbol: string;
    side: 'buy' | 'sell' | 'long' | 'short';
    positionEffect: 'increase' | 'reduce';
    requestedSize: number;
    referencePrice: number;
    requestedNotionalUsd: number;
    regime: string;
    dailyVolumeUsd: number;
  }> = {},
) {
  return {
    userId: 'portfolio_user',
    agentId: experiment.agentId,
    experimentId: experiment.id,
    strategyHash: experiment.strategyHash,
    opportunityObservationId: overrides.opportunityObservationId || `opp_${experiment.id}`,
    symbol: overrides.symbol || 'BTC',
    side: overrides.side || 'buy',
    positionEffect: overrides.positionEffect || 'increase',
    requestedSize: overrides.requestedSize || 1,
    referencePrice: overrides.referencePrice || 100,
    requestedNotionalUsd: overrides.requestedNotionalUsd || 100,
    family: experiment.family,
    regime: overrides.regime || 'other',
    dailyVolumeUsd: overrides.dailyVolumeUsd ?? 1_000_000_000,
  };
}

test('a later same-cycle reservation sees earlier pending symbol risk', async () => {
  await reset();
  const first = await seedExperiment('exp_same_cycle_a', 'family_a');
  const second = await seedExperiment('exp_same_cycle_b', 'family_b');
  const { reservePortfolioRiskV5, portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  const accepted = reservePortfolioRiskV5(request(first, {
    opportunityObservationId: 'opp_same_cycle_a', requestedSize: 18, requestedNotionalUsd: 1_800,
  }), 10);
  assert.equal(accepted.accepted, true);
  const denied = reservePortfolioRiskV5(request(second, {
    opportunityObservationId: 'opp_same_cycle_b', requestedSize: 3, requestedNotionalUsd: 300,
  }), 11);
  assert.equal(denied.accepted, false);
  assert.ok(denied.decision.reasons.includes('PORTFOLIO_SYMBOL_CAP'));
  assert.equal(portfolioAllocatorSnapshotV5(11).risk.pendingGrossExposureUsd, 1_800);
});

test('simultaneous correlated entries cannot exceed the shared factor cap', async () => {
  await reset();
  const momentum = await seedExperiment('exp_factor_momentum', 'momentum_24h');
  const cross = await seedExperiment('exp_factor_cross', 'golden_cross');
  const trend = await seedExperiment('exp_factor_trend', 'trend_breakout');
  const { reservePortfolioRiskV5 } = await import('../../server/v5/portfolio.js');
  assert.equal(reservePortfolioRiskV5(request(momentum, {
    opportunityObservationId: 'opp_factor_1', symbol: 'BTC', requestedSize: 20, requestedNotionalUsd: 2_000, regime: 'trend',
  }), 20).accepted, true);
  assert.equal(reservePortfolioRiskV5(request(cross, {
    opportunityObservationId: 'opp_factor_2', symbol: 'ETH', requestedSize: 20, requestedNotionalUsd: 2_000, regime: 'trend',
  }), 21).accepted, true);
  const denied = reservePortfolioRiskV5(request(trend, {
    opportunityObservationId: 'opp_factor_3', symbol: 'SOL', requestedSize: 2.5, requestedNotionalUsd: 250, regime: 'trend',
  }), 22);
  assert.equal(denied.accepted, false);
  assert.ok(denied.decision.reasons.includes('PORTFOLIO_FACTOR_CAP'));
});

test('reductions are authorized even when the existing book is already over entry caps', async () => {
  await reset();
  const existing = await seedExperiment('exp_reduce', 'momentum_24h');
  const entrant = await seedExperiment('exp_blocked_entry', 'family_new');
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.trades.push({
    id: 'trade_over_cap', agentId: existing.agentId, userId: 'portfolio_user', assetSymbol: 'BTC',
    tradeType: 'token', side: 'buy', size: 120, price: 100, leverage: 1, timestamp: 5,
    experimentId: existing.id, thesis: { signalFamily: existing.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'trend' },
  });
  writeDatabase(db);
  const { reservePortfolioRiskV5 } = await import('../../server/v5/portfolio.js');
  const reduction = reservePortfolioRiskV5(request(existing, {
    opportunityObservationId: 'opp_reduce', side: 'sell', positionEffect: 'reduce',
    requestedSize: 10, requestedNotionalUsd: 1_000, regime: 'trend',
  }), 30);
  assert.equal(reduction.accepted, true);
  assert.deepEqual(reduction.decision.reasons, ['REDUCTION_PRIORITY']);
  const entry = reservePortfolioRiskV5(request(entrant, {
    opportunityObservationId: 'opp_over_cap_entry', symbol: 'ETH', requestedSize: 1, requestedNotionalUsd: 100,
  }), 31);
  assert.equal(entry.accepted, false);
  assert.ok(entry.decision.reasons.includes('PORTFOLIO_GROSS_CAP'));
});

test('gross attribution survives shared-book netting while net exposure remains honest', async () => {
  await reset();
  const long = await seedExperiment('exp_net_long', 'momentum_24h', 'agent_net_long', 'perp');
  const short = await seedExperiment('exp_net_short', 'mean_reversion_24h', 'agent_net_short', 'perp');
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.trades.push(
    { id: 'net_long_fill', agentId: long.agentId, userId: 'portfolio_user', assetSymbol: 'BTC', tradeType: 'perp', side: 'long', size: 10, price: 100, leverage: 1, timestamp: 40, experimentId: long.id, thesis: { signalFamily: long.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'trend' } },
    { id: 'net_short_fill', agentId: short.agentId, userId: 'portfolio_user', assetSymbol: 'BTC', tradeType: 'perp', side: 'short', size: 10, price: 100, leverage: 1, timestamp: 41, experimentId: short.id, thesis: { signalFamily: short.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'mean reverting' } },
  );
  writeDatabase(db);
  const { portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  const risk = portfolioAllocatorSnapshotV5(42).risk;
  assert.equal(risk.netExposureUsd, 0);
  assert.equal(risk.grossExposureUsd, 2_000);
  assert.deepEqual(new Set(risk.exposures.map((line) => line.experimentId)), new Set([long.id, short.id]));
  assert.deepEqual(new Set(risk.exposures.map((line) => line.strategyHash)), new Set([long.strategyHash, short.strategyHash]));
});

test('the information budget counts independent experiment-symbol allocations', async () => {
  await reset();
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  for (let index = 0; index < 40; index += 1) {
    const experiment = await seedExperiment(`exp_info_${index}`, `family_${index}`);
    const db = readDatabase();
    db.trades.push({
      id: `trade_info_${index}`, agentId: experiment.agentId, userId: 'portfolio_user', assetSymbol: `ASSET${index}`,
      tradeType: 'token', side: 'buy', size: 1, price: 100, leverage: 1, timestamp: 100 + index,
      experimentId: experiment.id, thesis: { signalFamily: experiment.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'other' },
    });
    writeDatabase(db);
  }
  const challenger = await seedExperiment('exp_info_challenger', 'funding_carry');
  const { reservePortfolioRiskV5, portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  assert.equal(portfolioAllocatorSnapshotV5(200).risk.informationUnits, 40);
  const denied = reservePortfolioRiskV5(request(challenger, {
    opportunityObservationId: 'opp_info_41', symbol: 'NEWASSET', requestedSize: 1,
    requestedNotionalUsd: 100, regime: 'carry',
  }), 201);
  assert.equal(denied.accepted, false);
  assert.ok(denied.decision.reasons.includes('PORTFOLIO_INFORMATION_BUDGET'));
});

test('experiment intents cannot bypass or alter their allocator reservation', async () => {
  await reset();
  const experimentId = 'exp_intent_gate';
  const managedAgentId = `agt_exp_v5_${`strategy_${experimentId}`.slice(0, 20)}`;
  const experiment = await seedExperiment(experimentId, 'momentum_24h', managedAgentId);
  const { createOrderIntent, rejectOrderIntent } = await import('../../src/secure-core/trading/intents.js');
  assert.throws(() => createOrderIntent('portfolio_user', {
    agentId: experiment.agentId, assetSymbol: 'BTC', side: 'buy', size: 1,
    tradeType: 'token', leverage: 1, nonce: 'omitted_experiment_lineage',
  }), /EXPERIMENT_PORTFOLIO_LINEAGE_REQUIRED/);
  assert.throws(() => createOrderIntent('portfolio_user', {
    agentId: experiment.agentId, assetSymbol: 'BTC', side: 'buy', size: 1,
    tradeType: 'token', leverage: 1, nonce: 'missing_reservation',
    experimentId: experiment.id, opportunityObservationId: 'opp_intent_gate',
  }), /PORTFOLIO_RESERVATION_REQUIRED/);

  const { reservePortfolioRiskV5, reconcilePortfolioReservationsV5 } = await import('../../server/v5/portfolio.js');
  assert.throws(() => reservePortfolioRiskV5(request(experiment, {
    opportunityObservationId: 'opp_mismatched_notional', requestedSize: 2, requestedNotionalUsd: 100,
  }), Date.now()), /PORTFOLIO_RESERVATION_INPUT_INVALID/);
  const allocation = reservePortfolioRiskV5(request(experiment, {
    opportunityObservationId: 'opp_intent_gate', requestedSize: 1, requestedNotionalUsd: 100,
  }), Date.now());
  assert.equal(allocation.accepted, true);
  assert.throws(() => createOrderIntent('portfolio_user', {
    agentId: experiment.agentId, assetSymbol: 'BTC', side: 'buy', size: 2,
    tradeType: 'token', leverage: 1, nonce: 'altered_size',
    experimentId: experiment.id, opportunityObservationId: 'opp_intent_gate',
    portfolioReservationId: allocation.reservation.reservationId,
  }), /PORTFOLIO_RESERVATION_LINEAGE_MISMATCH/);
  const intent = createOrderIntent('portfolio_user', {
    agentId: experiment.agentId, assetSymbol: 'BTC', side: 'buy', size: 1,
    tradeType: 'token', leverage: 1, nonce: 'bound_reservation',
    experimentId: experiment.id, opportunityObservationId: 'opp_intent_gate',
    portfolioReservationId: allocation.reservation.reservationId,
  });
  const { readDatabase } = await import('../../server/storage.js');
  assert.equal(readDatabase().portfolioAllocatorV5?.reservations[allocation.reservation.reservationId].status, 'bound');
  assert.equal(intent.portfolioReservationId, allocation.reservation.reservationId);
  rejectOrderIntent(intent.intentId, 'fixture rejection');
  reconcilePortfolioReservationsV5(Date.now() + 1);
  assert.equal(readDatabase().portfolioAllocatorV5?.reservations[allocation.reservation.reservationId].status, 'released');
});

test('unresolved experiment orders retain pending exposure and consume the unresolved cap', async () => {
  await reset();
  const experiment = await seedExperiment('exp_unresolved', 'momentum_24h');
  const { reservePortfolioRiskV5, reconcilePortfolioReservationsV5, portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  const allocation = reservePortfolioRiskV5(request(experiment, {
    opportunityObservationId: 'opp_unresolved', requestedSize: 5, requestedNotionalUsd: 500,
  }), Date.now());
  const { createOrderIntent, markOrderIntentRiskAccepted, markOrderIntentUnresolved } = await import('../../src/secure-core/trading/intents.js');
  const intent = createOrderIntent('portfolio_user', {
    agentId: experiment.agentId, assetSymbol: 'BTC', side: 'buy', size: 5,
    tradeType: 'token', leverage: 1, nonce: 'unresolved_reservation',
    experimentId: experiment.id, opportunityObservationId: 'opp_unresolved',
    portfolioReservationId: allocation.reservation.reservationId,
  });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  markOrderIntentUnresolved(intent.intentId, 'fixture uncertainty');
  reconcilePortfolioReservationsV5(Date.now() + 1);
  const snapshot = portfolioAllocatorSnapshotV5(Date.now() + 1);
  assert.equal(snapshot.risk.pendingGrossExposureUsd, 500);
  assert.equal(snapshot.risk.unresolvedOrders, 1);
  assert.equal(snapshot.reservations[0].status, 'bound');
});

test('a no-op portfolio reconciliation does not manufacture durable timestamp changes', async () => {
  await reset();
  const { reconcilePortfolioReservationsV5, portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  const first = reconcilePortfolioReservationsV5(1_000);
  const second = reconcilePortfolioReservationsV5(2_000);
  assert.deepEqual(first, { inspected: 0, changed: 0 });
  assert.deepEqual(second, { inspected: 0, changed: 0 });
  assert.equal(portfolioAllocatorSnapshotV5(2_000).lastReconciledAt, null);
});

test('aggregate and family post-cost rolling losses veto new entries but not reductions', async () => {
  await reset();
  const losing = await seedExperiment('exp_daily_loss', 'loss_family');
  const other = await seedExperiment('exp_after_loss', 'other_family');
  const now = Date.now();
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.trades.push(
    { id: 'loss_open', agentId: losing.agentId, userId: 'portfolio_user', assetSymbol: 'BTC', tradeType: 'token', side: 'buy', size: 1, price: 100, leverage: 1, timestamp: now - 2, experimentId: losing.id, feeUsd: 1, thesis: { signalFamily: losing.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'other' } },
    { id: 'loss_close', agentId: losing.agentId, userId: 'portfolio_user', assetSymbol: 'BTC', tradeType: 'token', side: 'sell', size: 1, price: 100, leverage: 1, timestamp: now - 1, experimentId: losing.id, pnl: -500, thesis: { signalFamily: losing.family, setup: 'fixture', trigger: 'fixture', invalidation: 'fixture', regime: 'other' } },
  );
  writeDatabase(db);
  const { reservePortfolioRiskV5, portfolioAllocatorSnapshotV5 } = await import('../../server/v5/portfolio.js');
  const snapshot = portfolioAllocatorSnapshotV5(now).risk;
  assert.equal(snapshot.rolling24hPostCostRealizedPnlUsd, -501);
  assert.equal(snapshot.familyRolling24hPostCostRealizedPnlUsd.loss_family, -501);
  const denied = reservePortfolioRiskV5(request(other, {
    opportunityObservationId: 'opp_after_daily_loss', symbol: 'ETH', requestedSize: 1, requestedNotionalUsd: 100,
  }), now);
  assert.equal(denied.accepted, false);
  assert.ok(denied.decision.reasons.includes('PORTFOLIO_ROLLING_24H_LOSS_CAP'));
  const familyDenied = reservePortfolioRiskV5(request(losing, {
    opportunityObservationId: 'opp_family_after_loss', symbol: 'ETH', side: 'buy', positionEffect: 'increase',
    requestedSize: 1, requestedNotionalUsd: 100,
  }), now);
  assert.equal(familyDenied.accepted, false);
  assert.ok(familyDenied.decision.reasons.includes('PORTFOLIO_FAMILY_ROLLING_24H_LOSS_CAP'));
  const reduction = reservePortfolioRiskV5(request(losing, {
    opportunityObservationId: 'opp_loss_reduction', side: 'sell', positionEffect: 'reduce',
    requestedSize: 1, requestedNotionalUsd: 100,
  }), now + 1);
  assert.equal(reduction.accepted, true);
});
