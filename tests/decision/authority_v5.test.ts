import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-authority-v5-'));
process.env.DATABASE_URL = path.join(root, 'db.json');

test('v5 authority rejects active pre-v5 artifacts and makes legacy adapters non-routable', async () => {
  const {
    adaptLegacyArtifact,
    assertActiveArtifactV5,
    assertArtifactRoutable,
  } = await import('../../server/v5/authority.js');

  assert.throws(() => assertActiveArtifactV5({
    authorityVersion: 4,
    schema: 'strategy-plugin.v4',
    id: 'legacy-active',
    state: 'active',
  }), /ACTIVE_ARTIFACT_BELOW_V5/);

  const adapter = adaptLegacyArtifact({ id: 'historical-v3', observations: [1, 2] }, 'v3');
  assert.equal(adapter.authorityVersion, 5);
  assert.equal(adapter.readOnly, true);
  assert.equal(adapter.routable, false);
  assert.deepEqual(adapter.artifact, { id: 'historical-v3', observations: [1, 2] });
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(Object.isFrozen(adapter.artifact), true);
  assert.throws(() => assertArtifactRoutable(adapter), /LEGACY_OR_NONACTIVE_ARTIFACT_CANNOT_ROUTE/);
});

test('v5 cutover migrates only current agents and preserves historical records byte-for-byte', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  const now = Date.UTC(2026, 6, 30, 12);
  db.users.v5_user = {
    id: 'v5_user',
    username: 'v5-user',
    profile: { displayName: 'V5 User', avatarUrl: '', updatedAt: now },
    createdAt: now,
    lastActiveAt: now,
    paperBalance: 10_000,
    faucetClaimedCount: 0,
  };
  db.agents.legacy_current = {
    id: 'legacy_current',
    name: 'Legacy current agent',
    description: 'migrates at cutoff',
    ownerId: 'v5_user',
    assetSymbol: 'BTC',
    tradeType: 'token',
    strategyType: 'momentum',
    leverage: 1,
    status: 'active',
    createdAt: now - 10_000,
  };
  db.agents.legacy_revoked = {
    id: 'legacy_revoked',
    name: 'Legacy revoked agent',
    description: 'historical only',
    ownerId: 'v5_user',
    assetSymbol: 'ETH',
    tradeType: 'token',
    strategyType: 'mean_reversion',
    leverage: 1,
    status: 'revoked',
    createdAt: now - 20_000,
  };
  (db.decisionRuntime!.strategySpecs as Record<string, unknown>).historical_spec_v3 = {
    id: 'historical_spec_v3',
    schemaVersion: 3,
    pluginId: 'historical-plugin-v3',
    createdAt: now - 30_000,
  };
  db.trades.push({
    id: 'historical_trade_v3',
    agentId: 'legacy_revoked',
    userId: 'v5_user',
    assetSymbol: 'ETH',
    tradeType: 'token',
    side: 'buy',
    size: 1,
    price: 2_000,
    leverage: 1,
    timestamp: now - 20_000,
    status: 'closed',
  });
  writeDatabase(db);

  const historicalBefore = JSON.stringify({
    spec: db.decisionRuntime!.strategySpecs.historical_spec_v3,
    trade: db.trades.find((trade) => trade.id === 'historical_trade_v3'),
    revoked: db.agents.legacy_revoked,
  });

  const { initializeV5Authority } = await import('../../server/v5/authority.js');
  const cutoff = initializeV5Authority(now);
  const after = readDatabase();
  assert.equal(cutoff.authorityVersion, 5);
  assert.equal(cutoff.schema, 'authority-cutover.v5');
  assert.deepEqual(cutoff.legacyAgentIds, ['legacy_current', 'legacy_revoked']);
  assert.deepEqual(cutoff.legacyStrategySpecIds, ['historical_spec_v3']);
  assert.equal(after.agents.legacy_current.authorityVersion, 5);
  assert.equal(after.agents.legacy_current.schema, 'trading-agent.v5');
  assert.equal(after.agents.legacy_current.migratedFromPreV5, true);
  assert.equal(after.agents.legacy_revoked.authorityVersion, undefined);
  assert.equal(JSON.stringify({
    spec: after.decisionRuntime!.strategySpecs.historical_spec_v3,
    trade: after.trades.find((trade) => trade.id === 'historical_trade_v3'),
    revoked: after.agents.legacy_revoked,
  }), historicalBefore);
  assert.deepEqual(initializeV5Authority(now + 60_000), cutoff);
});

test('canonical v5 status inventories only v5 active artifacts and exposes authority clocks and flags', async () => {
  const { buildV5AuthorityStatus } = await import('../../server/v5/status.js');
  const status = buildV5AuthorityStatus(Date.UTC(2026, 6, 30, 12, 1), {});
  assert.equal(status.authorityVersion, 5);
  assert.equal(status.schema, 'metaedge-authority.v5');
  assert.equal(status.liveExecution, 'locked');
  assert.equal(status.flags.legacyWritersEnabled, false);
  assert.equal(status.flags.paperIntentsEnabled, true);
  assert.equal(status.writerAuthority.legacyWriters, 'disabled');
  assert.equal(status.writerAuthority.paperBrokerAssumptions.executionTiming, 'next_observation');
  assert.equal(status.writerAuthority.paperBrokerAssumptions.sameObservationFill, 'forbidden');
  assert.equal(status.writerAuthority.paperBrokerAssumptions.liveExecution, 'locked');
  assert.equal(status.authorityViolations.length, 0);
  assert.ok(status.commit);
  assert.ok(status.cutoff);
  assert.ok(status.clocks.some((clock) => clock.id === 'decision_runtime_v5'));
  assert.ok(status.clocks.some((clock) => clock.id === 'risk_exit_clock_v5'));
  assert.ok(status.dataFreshness);
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'strategy'));
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'policy'));
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'feature'));
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'card'));
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'agent'));
  assert.ok(status.artifacts.some((artifact) => artifact.kind === 'store'));
  assert.ok(status.artifacts.every((artifact) =>
    artifact.authorityVersion === 5 && artifact.schema.endsWith('.v5')));
});

test('an agent introduced below v5 after cutoff cannot create an order intent or trade', async () => {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const db = readDatabase();
  db.agents.rogue_v4 = {
    id: 'rogue_v4',
    name: 'Rogue V4',
    description: 'must not route',
    ownerId: 'v5_user',
    assetSymbol: 'BTC',
    tradeType: 'token',
    strategyType: 'momentum',
    leverage: 1,
    status: 'active',
    createdAt: Date.now(),
  };
  const intentsBefore = Object.keys(db.orderIntentsV5 || {}).length;
  const tradesBefore = db.trades.length;
  writeDatabase(db);

  const { placePaperTrade } = await import('../../server/trades.js');
  const result = placePaperTrade('v5_user', {
    agentId: 'rogue_v4',
    assetSymbol: 'BTC',
    side: 'buy',
    size: 0.001,
    price: 100_000,
    leverage: 1,
    nonce: 'rogue-v4-must-not-route',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.match(result.error || '', /read-only/);
  assert.equal(Object.keys(readDatabase().orderIntentsV5 || {}).length, intentsBefore);
  assert.equal(readDatabase().trades.length, tradesBefore);

  const { buildV5AuthorityStatus } = await import('../../server/v5/status.js');
  assert.deepEqual(
    buildV5AuthorityStatus(Date.now(), {}).authorityViolations,
    ['ACTIVE_AGENT_BELOW_V5:rogue_v4'],
  );
});

test('legacy autonomous entry writers cannot bypass their disabled startup path', async () => {
  const { readDatabase } = await import('../../server/storage.js');
  const agentsBefore = Object.keys(readDatabase().agents).length;
  const { ensureGoldenCrossBook, scanOnce } = await import('../../server/decision/golden_cross_scanner.js');
  assert.throws(() => ensureGoldenCrossBook(), /LEGACY_WRITER_DISABLED:GOLDEN_CROSS_DIRECT_ENTRY/);
  assert.throws(() => scanOnce(), /LEGACY_WRITER_DISABLED:GOLDEN_CROSS_DIRECT_ENTRY/);
  assert.equal(Object.keys(readDatabase().agents).length, agentsBefore);

  const { runOpportunityFactory } = await import('../../server/discovery/runtime.js');
  await assert.rejects(runOpportunityFactory(), /LEGACY_WRITER_DISABLED:OPPORTUNITY_FACTORY_V3/);
});
