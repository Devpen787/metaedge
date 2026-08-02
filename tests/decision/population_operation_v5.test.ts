import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-population-operation-v5-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

async function seededPopulation() {
  const { readDatabase, writeDatabase } = await import('../../server/storage.js');
  const { STRATEGY_PLUGINS } = await import('../../server/decision/plugins.js');
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { ensureExperimentPopulationV5 } = await import('../../server/v5/experiments.js');
  const now = Date.now();
  const initial = readDatabase();
  initial.users = {};
  initial.agents = {};
  initial.trades = [];
  initial.auditEvents = [];
  initial.orderIntentsV5 = {};
  initial.orderNonceIndexV5 = {};
  initial.orderEventsV5 = [];
  initial.paperFillsV5 = [];
  initial.experimentsV5 = { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] };
  delete initial.experimentLearningV5;
  delete initial.portfolioAllocatorV5;
  delete initial.populationOperationsV5;
  delete initial.authorityV5;
  writeDatabase(initial);
  (await import('../../server/v5/authority.js')).initializeV5Authority(now - 20);
  ensureExperimentPopulationV5(STRATEGY_PLUGINS.map((plugin) => ({ plugin, strategy: compileFrozenStrategy(plugin, now) })), now);
  const db = readDatabase();
  db.decisionRuntime ||= { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} };
  db.decisionRuntime.lastCycle = { cycleId: 'cycle_population_0', startedAt: now - 10, completedAt: now,
    evaluated: 14, declines: 0, hypotheses: 14, paperCandidates: 0, routed: 0 };
  return { db, now };
}

function healthyClocks(now: number) {
  return ['decision_runtime_v5', 'paper_broker_clock_v5', 'portfolio_allocator_reconciler_v5', 'experiment_outcome_reconciler_v5', 'risk_exit_clock_v5']
    .map((id) => ({ id, enabled: true, cadenceMs: 5_000, lastCompletedAt: now, ageMs: 0, fresh: true }));
}

test('the expanded population is operationally clean only when every continuous clock is fresh', async () => {
  const { db, now } = await seededPopulation();
  const { evaluatePopulationOperationV5 } = await import('../../server/v5/population.js');
  const clean = evaluatePopulationOperationV5(db, now, healthyClocks(now));
  assert.equal(clean.registeredArms, 14);
  assert.ok(clean.mechanismFamilies >= 12);
  assert.equal(clean.clean, true);
  assert.deepEqual(clean.reasons, []);

  const staleClocks = healthyClocks(now);
  staleClocks[2] = { ...staleClocks[2], ageMs: 20_000, fresh: false };
  const stale = evaluatePopulationOperationV5(db, now, staleClocks);
  assert.equal(stale.clean, false);
  assert.ok(stale.reasons.includes('CONTINUOUS_CLOCK_NOT_FRESH'));

  const missing = evaluatePopulationOperationV5(db, now, healthyClocks(now).slice(1));
  assert.ok(missing.reasons.includes('REQUIRED_CONTINUOUS_CLOCK_MISSING'));
});

test('PostgreSQL-style policy key reordering does not manufacture an immutability failure', async () => {
  const { db, now } = await seededPopulation();
  const {
    DEFAULT_POPULATION_OPERATION_POLICY_V5,
    evaluatePopulationOperationV5,
  } = await import('../../server/v5/population.js');
  const reorderedPolicy = Object.fromEntries(
    Object.entries(DEFAULT_POPULATION_OPERATION_POLICY_V5).reverse(),
  ) as typeof DEFAULT_POPULATION_OPERATION_POLICY_V5;
  db.populationOperationsV5 = { policy: reorderedPolicy, samples: [], assuranceRecords: [] };
  assert.doesNotThrow(() => evaluatePopulationOperationV5(db, now, healthyClocks(now)));
});

test('an unresolved order beyond its SLA and any active pre-V5 agent fail the population sample closed', async () => {
  const { db, now } = await seededPopulation();
  db.agents.legacy_intruder = { id: 'legacy_intruder', ownerId: 'owner', name: 'legacy', description: 'fixture',
    assetSymbol: 'BTC', tradeType: 'token', strategyType: 'momentum', leverage: 1, status: 'active', createdAt: 1 } as any;
  db.orderIntentsV5!.unresolved_fixture = {
    authorityVersion: 5, schema: 'order-intent.v5', intentId: 'unresolved_fixture', idempotencyKey: 'fixture',
    userId: 'usr_v5_paper_discovery', agentId: Object.keys(db.agents)[0], assetSymbol: 'BTC', side: 'buy', size: 1,
    tradeType: 'token', leverage: 1, positionEffect: 'increase', status: 'UNRESOLVED', createdAt: 1,
    updatedAt: now - 16 * 60_000, nonce: 'fixture', experimentId: Object.keys(db.experimentsV5!.specs)[0],
  };
  const { evaluatePopulationOperationV5 } = await import('../../server/v5/population.js');
  const sample = evaluatePopulationOperationV5(db, now, healthyClocks(now));
  assert.equal(sample.clean, false);
  assert.ok(sample.reasons.includes('UNRESOLVED_ORDER_BEYOND_SLA'));
  assert.ok(sample.reasons.includes('ACTIVE_AGENT_BELOW_V5'));
});

test('burn-in requires ten distinct clean cycles plus real portfolio, fill, reconciliation, lifecycle, control, and UI evidence', async () => {
  const { db, now } = await seededPopulation();
  const {
    assessPopulationBurnInV5,
    DEFAULT_POPULATION_OPERATION_POLICY_V5,
  } = await import('../../server/v5/population.js');
  const { evaluatePopulationOperationV5 } = await import('../../server/v5/population.js');
  const base = evaluatePopulationOperationV5(db, now, healthyClocks(now));
  const experimentId = Object.keys(db.experimentsV5!.specs)[0];
  const vetoDecision = {
    decisionId: 'portfolio_decision_v5_burnin',
    reservationId: 'portfolio_res_v5_burnin',
    snapshotBeforeHash: 'snapshot_v5_burnin',
    policyHash: (await import('../../server/v5/portfolio.js')).DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5.policyHash,
    accepted: false,
    reasons: ['PORTFOLIO_SYMBOL_CAP'],
  } as any;
  const assuranceInputs = [
    { kind: 'intent_restart_recovery', evidenceIds: ['test_intent_restart'] },
    { kind: 'partial_fill_restart_recovery', evidenceIds: ['test_partial_restart'] },
    { kind: 'outcome_restart_recovery', evidenceIds: ['test_outcome_restart'] },
    { kind: 'stale_data_rejection', evidenceIds: ['test_stale_rejection'] },
    { kind: 'write_failure_injection', evidenceIds: ['test_write_failure'] },
    { kind: 'portfolio_allocator_veto', evidenceIds: [vetoDecision.decisionId, vetoDecision.reservationId,
      vetoDecision.snapshotBeforeHash, vetoDecision.policyHash, ...vetoDecision.reasons] },
    { kind: 'lifecycle_reactivation', evidenceIds: [experimentId, 'lifecycle_ineligible', 'lifecycle_eligible'] },
  ];
  db.populationOperationsV5 = {
    policy: DEFAULT_POPULATION_OPERATION_POLICY_V5,
    samples: Array.from({ length: 10 }, (_, index) => ({
      ...base,
      sampleId: `sample_${index}`,
      decisionCycleId: `cycle_${index}`,
      recordedAt: now + index,
    })),
    assuranceRecords: assuranceInputs.map(({ kind, evidenceIds }, index) => {
      const normalizedEvidenceIds = [...evidenceIds].sort();
      return {
      authorityVersion: 5 as const,
      schema: 'population-assurance-record.v5' as const,
      recordId: `assurance_${index}`,
      kind,
      evidenceIds: normalizedEvidenceIds,
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify({ kind, evidenceIds: normalizedEvidenceIds })).digest('hex'),
      recordedAt: now,
    }; }) as any,
    uiLedgerParityVerifiedAt: now,
  };
  db.portfolioAllocatorV5 = {
    policy: (await import('../../server/v5/portfolio.js')).DEFAULT_PORTFOLIO_ALLOCATOR_POLICY_V5,
    reservations: {},
    decisions: [vetoDecision],
  };
  db.orderEventsV5!.push({ type: 'PARTIALLY_FILLED' } as any);
  db.auditEvents.push({ action: 'RECONCILE_ORDER_EXECUTED_V5' } as any);
  db.experimentsV5!.lifecycleEvents.push(
    { eventId: 'lifecycle_ineligible', experimentId, type: 'regime_ineligible', at: now } as any,
    { eventId: 'lifecycle_eligible', experimentId, type: 'regime_eligible', at: now + 1 } as any,
  );
  db.experimentLearningV5 = {
    policy: (await import('../../server/v5/outcomes.js')).DEFAULT_EXPERIMENT_LEARNING_POLICY_V5,
    trials: {}, assessments: {}, lifecycleAppliedOutcomeIds: {},
    outcomes: { controlled: { noTradeControlPnlUsd: 0, buyHoldControlPnlUsd: 1 } as any },
  };
  const go = assessPopulationBurnInV5(db, now + 20);
  assert.equal(go.verdict, 'go_local_paper_operation', JSON.stringify(go));
  assert.equal(go.consecutiveCleanCycles, 10);

  db.orderEventsV5 = [];
  const noGo = assessPopulationBurnInV5(db, now + 21);
  assert.equal(noGo.verdict, 'no_go');
  assert.ok(noGo.reasons.includes('PARTIAL_FILL_OBSERVED_NOT_PROVEN'));
});

test('Research Fleet parity covers every registered experiment and excludes legacy trades from V5 totals', async () => {
  const { db } = await seededPopulation();
  db.trades.push({ id: 'legacy_history', agentId: 'legacy', userId: 'legacy', assetSymbol: 'BTC', tradeType: 'token',
    side: 'buy', size: 1, price: 100, leverage: 1, timestamp: 1,
    thesis: { signalFamily: 'legacy_family', setup: 'legacy', trigger: 'legacy', invalidation: 'legacy' } });
  const { verifyResearchFleetLedgerParityV5 } = await import('../../server/research.js');
  const parity = verifyResearchFleetLedgerParityV5(db);
  assert.equal(parity.verified, true);
  assert.equal(parity.registeredExperiments, 14);
  assert.equal(parity.visibleV5Families, 14);
  assert.equal(parity.v5LedgerTrades, 0);
  assert.equal(parity.v5MetricTrades, 0);
});
