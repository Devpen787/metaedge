import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-order-v5-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

async function seed() {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  const now = Date.now();
  db.users.order_user = {
    id: 'order_user',
    username: 'order-test',
    profile: { displayName: 'Order Test', avatarUrl: '', updatedAt: now },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 10_000,
    faucetClaimedCount: 0,
  };
  db.agents.order_agent = {
    authorityVersion: 5, schema: 'trading-agent.v5',
    id: 'order_agent',
    name: 'Order lifecycle test',
    description: 'fixture',
    ownerId: 'order_user',
    assetSymbol: 'ORDERTEST',
    tradeType: 'token',
    strategyType: 'momentum',
    leverage: 1,
    status: 'active',
    createdAt: now,
  };
  writeDatabase(db);
}

test('durable nonce index rejects replay after a forced database reread', async () => {
  await seed();
  const { DB_FILE } = await import('../../server/storage.js');
  const { createOrderIntent, getOrderEvents, getOrderIntent } = await import('../../src/secure-core/trading/intents.js');
  const input = {
    agentId: 'order_agent',
    assetSymbol: 'ORDERTEST',
    side: 'buy' as const,
    size: 1,
    tradeType: 'token' as const,
    leverage: 1,
    nonce: 'durable-replay-fixture',
  };
  const intent = createOrderIntent('order_user', input);
  assert.equal(getOrderIntent(intent.intentId)?.status, 'PENDING');
  assert.deepEqual(getOrderEvents(intent.intentId).map((event) => event.type), ['CREATED']);

  // Force readDatabase to reload the file instead of serving its object cache.
  const future = new Date(Date.now() + 2_000);
  fs.utimesSync(DB_FILE, future, future);
  assert.throws(() => createOrderIntent('order_user', input), /REPLAY_DETECTED/);
});

test('risk reductions bypass entry balance but cannot exceed the position', async () => {
  const { evaluateOrderRisk } = await import('../../src/secure-core/trading/risk-engine.js');
  const intent: any = {
    authorityVersion: 5,
    schema: 'order-intent.v5',
    intentId: 'risk_reduce_fixture',
    idempotencyKey: 'order_user:risk_reduce_fixture',
    userId: 'order_user',
    agentId: 'order_agent',
    assetSymbol: 'ORDERTEST',
    side: 'sell',
    size: 2,
    tradeType: 'token',
    leverage: 1,
    positionEffect: 'reduce',
    status: 'PENDING',
    createdAt: 1,
    updatedAt: 1,
    nonce: 'risk_reduce_fixture',
  };
  assert.equal(evaluateOrderRisk(intent, {
    userId: 'order_user',
    availableBalance: 0,
    currentPrice: 100,
    positionEffect: 'reduce',
    availablePositionSize: 2,
  }), true);
  assert.throws(() => evaluateOrderRisk({ ...intent, size: 2.1 }, {
    userId: 'order_user',
    availableBalance: 0,
    currentPrice: 100,
    positionEffect: 'reduce',
    availablePositionSize: 2,
  }), /Reduce-only size exceeds position/);
  assert.throws(() => evaluateOrderRisk({ ...intent, side: 'buy' }, {
    userId: 'order_user',
    availableBalance: 0,
    currentPrice: 100,
    positionEffect: 'increase',
    availablePositionSize: 0,
  }), /Insufficient balance/);
});

test('a zero-cash account can durably close an existing spot position', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { placePaperTrade, processPaperBrokerOnce } = await import('../../server/trades.js');
  const { __applyCanonicalPriceForTest } = await import('../../server/prices.js');
  const db = readDatabase();
  db.users.order_user.paperBalance = 0;
  db.trades.push({
    id: 'legacy_entry_fixture',
    agentId: 'order_agent',
    userId: 'order_user',
    assetSymbol: 'BTC',
    tradeType: 'token',
    side: 'buy',
    size: 0.02,
    price: 64_000,
    leverage: 1,
    timestamp: Date.now() - 1_000,
    status: 'open',
  });
  writeDatabase(db);
  const submittedAt = Date.now();
  __applyCanonicalPriceForTest('BTC', 63_100, submittedAt);

  const result = placePaperTrade('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'BTC',
    side: 'sell',
    size: 0.02,
    price: 1, // caller price is deliberately ignored by the V5 broker
    leverage: 1,
    nonce: 'zero-cash-exit-fixture',
  });

  assert.equal(result.ok, true);
  assert.equal(result.pending, true);
  assert.equal(readDatabase().trades.some((trade) => trade.orderIntentId === result.intent?.intentId), false);
  __applyCanonicalPriceForTest('BTC', 63_000, submittedAt + 1_000);
  const cycle = processPaperBrokerOnce(submittedAt + 1_001);
  assert.equal(cycle.filled, 1);
  const after = readDatabase();
  const exit = after.trades.find((trade) => trade.orderIntentId);
  assert.ok(exit?.orderIntentId);
  assert.equal(after.orderIntentsV5?.[exit.orderIntentId].positionEffect, 'reduce');
  assert.equal(after.orderIntentsV5?.[exit.orderIntentId].status, 'EXECUTED');
  assert.ok((exit.referencePrice ?? 0) > 0);
  assert.ok((exit.feeUsd ?? 0) > 0);
  assert.ok(after.users.order_user.paperBalance > 0);
});

test('a partial broker fill survives reconciliation and completes only on a different observation', async () => {
  const { readDatabase } = await import('../../server/storage.js');
  const {
    createOrderIntent,
    markOrderIntentRiskAccepted,
    reconcileOrderIntents,
    submitOrderIntentToBroker,
  } = await import('../../src/secure-core/trading/intents.js');
  const { processPaperBrokerOnce } = await import('../../server/trades.js');
  const { createMarketObservationV5 } = await import('../../server/market_data_v5.js');
  const { DEFAULT_PAPER_BROKER_POLICY_V5 } = await import('../../server/v5/paper_broker.js');
  const base = Date.now() + 10_000;
  const quote = (receivedAt: number) => createMarketObservationV5({
    symbol: 'BTC',
    price: 100,
    change24hPct: 0,
    volume24hUsd: 1_000,
    high24h: 100,
    low24h: 100,
    marketCapUsd: 1_000_000,
    provider: 'integration-test',
    venue: 'integration-test',
    dataset: 'partial_fill_test',
    observedAt: receivedAt,
    receivedAt,
  });
  const submission = quote(base - 1);
  const intent = createOrderIntent('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'BTC',
    side: 'buy',
    size: 2,
    tradeType: 'token',
    leverage: 1,
    nonce: 'partial-restart-fixture',
    submissionObservationHash: submission.observationHash,
  });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  submitOrderIntentToBroker(intent.intentId);
  const policy = {
    ...DEFAULT_PAPER_BROKER_POLICY_V5,
    observationIntervalMs: 86_400_000,
    volumeParticipationRate: 0.1,
    baseSlippageBps: 2,
    maximumSlippageBps: 2,
  };
  const firstObservation = quote(base + 1_000);
  const firstCycle = processPaperBrokerOnce(base + 1_001, () => firstObservation, policy);
  assert.equal(firstCycle.partial, 1);
  assert.equal(readDatabase().orderIntentsV5?.[intent.intentId].status, 'PARTIALLY_FILLED');
  assert.equal(readDatabase().paperFillsV5?.filter((fill) => fill.intentId === intent.intentId).length, 1);

  reconcileOrderIntents();
  assert.equal(readDatabase().orderIntentsV5?.[intent.intentId].status, 'PARTIALLY_FILLED');
  assert.equal(processPaperBrokerOnce(base + 1_002, () => firstObservation, policy).waiting, 1);
  assert.equal(readDatabase().paperFillsV5?.filter((fill) => fill.intentId === intent.intentId).length, 1);

  const secondObservation = quote(base + 2_000);
  assert.equal(processPaperBrokerOnce(base + 2_001, () => secondObservation, policy).filled, 1);
  const completed = readDatabase().orderIntentsV5?.[intent.intentId];
  assert.equal(completed.status, 'EXECUTED');
  assert.equal(completed.filledSize, 2);
  assert.equal(completed.remainingSize, 0);
  assert.equal(completed.fillIds?.length, 2);
  assert.equal(completed.tradeIds?.length, 2);
});

test('multi-fill intent is not mis-marked UNRESOLVED, and an already-mis-marked one is recovered (regression)', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { createOrderIntent, markOrderIntentRiskAccepted, prepareOrderExecution, reconcileOrderIntents } = await import('../../src/secure-core/trading/intents.js');
  // A multi-fill order produces TWO durable trades for one intent; intent.tradeId is the LAST.
  const intent = createOrderIntent('order_user', { agentId: 'order_agent', assetSymbol: 'MULTIFILL', side: 'buy', size: 2, tradeType: 'token', leverage: 1, nonce: 'multifill-regression-fixture' });
  markOrderIntentRiskAccepted(intent.intentId, 'increase');
  const tradeA = prepareOrderExecution(intent.intentId, 100);
  const tradeB = { ...tradeA, id: `${tradeA.id}_b`, price: 101 };   // second fill, same intent lineage
  const db = readDatabase();
  db.trades.push(tradeA, tradeB);
  const it = (db.orderIntentsV5 as any)[intent.intentId];
  // exact prod-broken shape: EXECUTED, tradeId = LAST trade, two trades in lineage, fully filled
  it.status = 'EXECUTED'; it.tradeId = tradeB.id; it.tradeIds = [tradeA.id, tradeB.id]; it.filledSize = 2; it.remainingSize = 0;
  writeDatabase(db);
  // (1) prevention: re-reconciling a valid multi-fill EXECUTED intent must NOT mark it UNRESOLVED
  reconcileOrderIntents();
  assert.equal(readDatabase().orderIntentsV5?.[intent.intentId].status, 'EXECUTED');
  // (2) recovery: an intent already mis-marked UNRESOLVED by the old first-vs-last bug is restored
  const db2 = readDatabase();
  const it2 = (db2.orderIntentsV5 as any)[intent.intentId];
  it2.status = 'UNRESOLVED'; it2.failureReason = 'RECONCILIATION_EXECUTED_TRADE_MISSING_OR_MISMATCHED';
  writeDatabase(db2);
  reconcileOrderIntents();
  const after = readDatabase().orderIntentsV5?.[intent.intentId];
  assert.equal(after?.status, 'EXECUTED');
  assert.equal(after?.failureReason ?? null, null);
});

test('perp short open and close account for fees, funding, and borrow costs', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { agentPosition, placePaperTrade, processPaperBrokerOnce } = await import('../../server/trades.js');
  const { __applyCanonicalPriceForTest } = await import('../../server/prices.js');
  const db = readDatabase();
  db.users.order_user.paperBalance = 10_000;
  db.agents.perp_agent_v5 = {
    authorityVersion: 5,
    schema: 'trading-agent.v5',
    id: 'perp_agent_v5',
    name: 'Perp broker fixture',
    description: 'short accounting fixture',
    ownerId: 'order_user',
    assetSymbol: 'BTC',
    tradeType: 'perp',
    strategyType: 'momentum',
    leverage: 2,
    status: 'active',
    createdAt: Date.now(),
  };
  writeDatabase(db);
  const initialAt = Date.now();
  __applyCanonicalPriceForTest('BTC', 63_000, initialAt);
  const opening = placePaperTrade('order_user', {
    agentId: 'perp_agent_v5',
    assetSymbol: 'BTC',
    side: 'short',
    size: 0.01,
    leverage: 2,
    nonce: 'perp-short-open-fixture',
  });
  assert.equal(opening.pending, true);
  const openFillAt = opening.intent!.createdAt + 1_000;
  __applyCanonicalPriceForTest('BTC', 62_990, openFillAt);
  assert.equal(processPaperBrokerOnce(openFillAt + 1).filled, 1);
  assert.ok(agentPosition('order_user', 'perp_agent_v5', 'BTC').signedSize < 0);
  const heldDb = readDatabase();
  const openingTrade = heldDb.trades.find((trade) => trade.orderIntentId === opening.intent?.intentId);
  assert.ok(openingTrade);
  openingTrade.timestamp -= 86_400_000;
  writeDatabase(heldDb);

  const closeSubmissionAt = openFillAt + 1_000;
  __applyCanonicalPriceForTest('BTC', 62_100, closeSubmissionAt);
  const closing = placePaperTrade('order_user', {
    agentId: 'perp_agent_v5',
    assetSymbol: 'BTC',
    side: 'long',
    size: 0.01,
    leverage: 2,
    nonce: 'perp-short-close-fixture',
  });
  assert.equal(closing.pending, true);
  const closeFillAt = closeSubmissionAt + 1_000;
  __applyCanonicalPriceForTest('BTC', 62_000, closeFillAt);
  assert.equal(processPaperBrokerOnce(closeFillAt + 1).filled, 1);

  const after = readDatabase();
  const closeTrade = after.trades.find((trade) => trade.orderIntentId === closing.intent?.intentId);
  assert.ok(closeTrade);
  assert.ok((closeTrade.pnl ?? 0) > 0);
  assert.ok((closeTrade.feeUsd ?? 0) > 0);
  assert.ok((closeTrade.fundingUsd ?? 0) > 0);
  assert.ok((closeTrade.borrowUsd ?? 0) > 0);
  assert.ok((closeTrade.holdingMs ?? 0) >= 86_400_000);
  assert.equal(agentPosition('order_user', 'perp_agent_v5', 'BTC').signedSize, 0);
});

test('risk rejection and unresolved commit state are durable terminal evidence', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const {
    createOrderIntent,
    finalizeOrderIntentExecution,
    getOrderEvents,
    getOrderIntent,
    markOrderIntentRiskAccepted,
    markOrderIntentUnresolved,
    prepareOrderExecution,
  } = await import('../../src/secure-core/trading/intents.js');
  const { placePaperTrade } = await import('../../server/trades.js');
  const db = readDatabase();
  db.users.order_user.paperBalance = 0;
  db.trades = db.trades.filter((trade) => trade.assetSymbol !== 'REJECTTEST');
  writeDatabase(db);

  const rejected = placePaperTrade('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'REJECTTEST',
    side: 'buy',
    size: 1,
    price: 100,
    leverage: 1,
    nonce: 'risk-rejection-fixture',
  });
  assert.equal(rejected.ok, false);
  const rejectedIntent = Object.values(readDatabase().orderIntentsV5 || {})
    .find((intent) => intent.nonce === 'risk-rejection-fixture');
  assert.equal(rejectedIntent?.status, 'REJECTED');
  assert.deepEqual(
    getOrderEvents(rejectedIntent!.intentId).map((event) => event.type),
    ['CREATED', 'RISK_REJECTED'],
  );

  const intent = createOrderIntent('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'ORDERTEST',
    side: 'sell',
    size: 1,
    tradeType: 'token',
    leverage: 1,
    nonce: 'unresolved-final-commit-fixture',
  });
  markOrderIntentRiskAccepted(intent.intentId, 'reduce');
  const trade = prepareOrderExecution(intent.intentId, 95);
  const commitDb = readDatabase();
  finalizeOrderIntentExecution(commitDb, intent.intentId, trade);
  (commitDb as any).cycle = commitDb;
  assert.throws(() => writeDatabase(commitDb), /Canonical database write failed/);
  markOrderIntentUnresolved(intent.intentId, 'FINAL_TRADE_COMMIT_FAILED:not_committed');

  assert.equal(getOrderIntent(intent.intentId)?.status, 'UNRESOLVED');
  assert.deepEqual(
    getOrderEvents(intent.intentId).map((event) => event.type),
    ['CREATED', 'RISK_ACCEPTED', 'UNRESOLVED'],
  );
});

test('startup reconciliation recovers committed trades and quarantines stranded intents', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const {
    createOrderIntent,
    getOrderEvents,
    getOrderIntent,
    markOrderIntentRiskAccepted,
    prepareOrderExecution,
    reconcileOrderIntents,
  } = await import('../../src/secure-core/trading/intents.js');

  const recovered = createOrderIntent('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'ORDERTEST',
    side: 'sell',
    size: 0.25,
    tradeType: 'token',
    leverage: 1,
    nonce: 'reconcile-committed-fixture',
  });
  markOrderIntentRiskAccepted(recovered.intentId, 'reduce');
  const durableTrade = prepareOrderExecution(recovered.intentId, 91);
  const committed = readDatabase();
  committed.trades.push(durableTrade);
  writeDatabase(committed);

  const stranded = createOrderIntent('order_user', {
    agentId: 'order_agent',
    assetSymbol: 'ORDERTEST',
    side: 'buy',
    size: 0.1,
    tradeType: 'token',
    leverage: 1,
    nonce: 'reconcile-stranded-fixture',
  });

  const result = reconcileOrderIntents();
  assert.equal(result.recoveredExecuted, 1);
  // This suite deliberately left an earlier replay fixture PENDING as well;
  // reconciliation must quarantine every stranded non-terminal intent.
  assert.ok(result.markedUnresolved >= 1);
  assert.equal(getOrderIntent(recovered.intentId)?.status, 'EXECUTED');
  assert.equal(getOrderIntent(recovered.intentId)?.tradeId, durableTrade.id);
  assert.deepEqual(
    getOrderEvents(recovered.intentId).map((event) => event.type),
    ['CREATED', 'RISK_ACCEPTED', 'EXECUTED'],
  );
  assert.equal(getOrderIntent(stranded.intentId)?.status, 'UNRESOLVED');
  assert.deepEqual(
    getOrderEvents(stranded.intentId).map((event) => event.type),
    ['CREATED', 'UNRESOLVED'],
  );
});

test('Golden Cross cleanup keys successful exits by both agent and symbol', async () => {
  const { cleanupSuccessfulStopBreaches, stopBreachKey } = await import('../../server/decision/risk_loop.js');
  const { readDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  const btc = { agentId: 'golden_cross_book', symbol: 'BTC' };
  const eth = { agentId: 'golden_cross_book', symbol: 'ETH' };
  db.trailingState = {
    [stopBreachKey(btc)]: { highWaterMark: 120, trailPct: 15, updatedAt: 1 },
    [stopBreachKey(eth)]: { highWaterMark: 240, trailPct: 15, updatedAt: 1 },
  };
  db.cooldowns = {};

  const changed = cleanupSuccessfulStopBreaches(
    db,
    [btc, eth],
    new Set([stopBreachKey(btc)]),
    123_456,
  );

  assert.equal(changed, true);
  assert.equal(db.trailingState[stopBreachKey(btc)], undefined);
  assert.ok(db.trailingState[stopBreachKey(eth)]);
  assert.equal(db.cooldowns[stopBreachKey(btc)], 123_456);
  assert.equal(db.cooldowns[stopBreachKey(eth)], undefined);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
