import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-decision-store-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

test('strategy, validation, decision, and execution state survive a database reread', async () => {
  const { readDatabase } = await import('../../server/storage.js');
  const { persistStrategySpec, persistValidation, persistDecision, persistDecisions, markDecisionRouted, decisionRuntimeSnapshot } = await import('../../server/decision/store.js');
  const { compileFrozenStrategy } = await import('../../server/decision/specs.js');
  const { rsiMeanReversionV1 } = await import('../../server/decision/plugins.js');
  const spec = persistStrategySpec(compileFrozenStrategy(rsiMeanReversionV1, 100));
  persistValidation({
    id: 'validation_test', strategyHash: spec.hash, status: 'forward_paper_candidate',
    datasetId: 'fixture', datasetHash: 'hash', codeCommit: 'commit', folds: 3,
    costBpsPerSide: 10, benchmark: spec.benchmark, reasons: ['passed fixture'], validatedAt: 200, symbols: ['DOT'],
  });
  persistDecision({
    id: 'decision_test', cycleId: 'cycle', evaluatedAt: 300, symbol: 'DOT', instrument: 'spot',
    strategyHash: spec.hash, pluginId: spec.pluginId, outcome: 'paper_trade_candidate', reason: 'VALIDATED_SIGNAL',
    gates: [], signal: null, featureEvidence: [], validationStatus: 'forward_paper_candidate', queueStatus: 'queued',
  });
  persistDecisions(['A', 'B'].map((symbol) => ({
    id: `decision_batch_${symbol}`, cycleId: 'cycle_batch', evaluatedAt: 301, symbol, instrument: 'spot' as const,
    strategyHash: spec.hash, pluginId: spec.pluginId, outcome: 'decline' as const, reason: 'NO_SIGNAL',
    gates: [], signal: null, featureEvidence: [], validationStatus: 'unvalidated' as const, queueStatus: 'not_queued' as const,
  })));
  markDecisionRouted('decision_test', 'trade_test');
  const db = readDatabase();
  assert.equal(db.decisionRuntime?.strategySpecs[spec.hash].hash, spec.hash);
  assert.equal(db.decisionRuntime?.executedDecisionIds.decision_test, 'trade_test');
  assert.equal(db.decisionRuntime?.decisions.filter((d) => d.cycleId === 'cycle_batch').length, 2);
  assert.equal(decisionRuntimeSnapshot().recentDecisions.find((d) => d.id === 'decision_test')?.queueStatus, 'routed');
  assert.ok(fs.statSync(process.env.DATABASE_URL!).size > 0);
});

test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
