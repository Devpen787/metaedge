import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-decision-router-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

test('a validated queued decision routes exactly once through the canonical paper ledger', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { persistDecision } = await import('../../server/decision/store.js');
  const { routePaperDecision } = await import('../../server/decision/runtime.js');
  const { processPaperBrokerOnce } = await import('../../server/trades.js');
  const { __applyCanonicalPriceForTest } = await import('../../server/prices.js');
  const now = Date.now();
  const db = readDatabase();
  db.users.user_test = {
    id: 'user_test', username: 'test', profile: { displayName: 'Test', avatarUrl: '', updatedAt: now },
    createdAt: now, lastActiveAt: now, paperBalance: 10_000, faucetClaimedCount: 0,
  };
  db.agents.agent_test = {
    authorityVersion: 5, schema: 'trading-agent.v5',
    id: 'agent_test', name: 'Validated fixture', description: 'fixture', ownerId: 'user_test',
    assetSymbol: 'BTC', tradeType: 'token', strategyType: 'momentum', leverage: 1,
    status: 'active', createdAt: now, autopilot: true,
  };
  writeDatabase(db);
  const decision = persistDecision({
    authorityVersion: 5, schema: 'layered-decision.v5',
    id: 'decision_router_fixture', cycleId: 'cycle_fixture', evaluatedAt: now, symbol: 'BTC', instrument: 'spot',
    strategyHash: 'strategy_fixture_hash', pluginId: 'fixture', outcome: 'paper_trade_candidate', reason: 'VALIDATED_SIGNAL',
    gates: [], signal: { action: 'buy', strength: 1, setup: 'fixture', trigger: 'fixture trigger', invalidation: 'fixture invalidation', regime: 'fixture' },
    featureEvidence: [], validationStatus: 'forward_paper_candidate', paperPermission: 'paper_confirmed',
    queueStatus: 'queued', ownerId: 'user_test', agentId: 'agent_test',
  });
  const context: any = {
    routing: { ownerId: 'user_test', agentId: 'agent_test' },
    features: { 'price.v5': { value: 63_000 } },
    limits: { requestedNotionalUsd: 250 },
  };
  __applyCanonicalPriceForTest('BTC', 63_000, now);
  assert.equal(routePaperDecision(decision, context), true);
  assert.equal(routePaperDecision(decision, context), false);
  const pending = readDatabase();
  assert.equal(pending.trades.length, 0);
  const intentId = Object.values(pending.orderIntentsV5 || {})[0]?.intentId;
  assert.ok(intentId);
  assert.equal(pending.orderIntentsV5?.[intentId].status, 'BROKER_PENDING');
  __applyCanonicalPriceForTest('BTC', 63_010, now + 1_000);
  assert.equal(processPaperBrokerOnce(now + 1_001).filled, 1);
  const after = readDatabase();
  assert.equal(after.trades.length, 1);
  assert.equal(after.trades[0].thesis?.decisionId, decision.id);
  assert.equal(after.trades[0].thesis?.strategyHash, decision.strategyHash);
  assert.equal(after.decisionRuntime?.decisions[0].queueStatus, 'routed');
  assert.ok(after.auditEvents.some((event) => event.action === 'LAYERED_PAPER_TRADE'));
  assert.equal(after.orderIntentsV5?.[intentId].status, 'EXECUTED');
  assert.deepEqual(
    after.orderEventsV5?.filter((event) => event.intentId === intentId).map((event) => event.type),
    ['CREATED', 'RISK_ACCEPTED', 'SUBMITTED_TO_BROKER', 'EXECUTED'],
  );
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
