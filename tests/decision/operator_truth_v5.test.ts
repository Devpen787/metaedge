import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { LayeredDecision } from '../../server/decision/types.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-operator-truth-v5-'));
process.env.DATABASE_URL = path.join(dir, 'db.json');

function decision(overrides: Partial<LayeredDecision> = {}): LayeredDecision {
  return {
    authorityVersion: 5,
    schema: 'layered-decision.v5',
    id: 'decision_organic',
    cycleId: 'cycle_truth',
    evaluatedAt: 100,
    symbol: 'BTC',
    instrument: 'spot',
    strategyHash: 'strategy_hash',
    pluginId: 'momentum_24h_v5',
    outcome: 'decline',
    reason: 'NO_SIGNAL',
    gates: [],
    signal: { action: 'hold', strength: 0, setup: 'none', trigger: 'none', invalidation: 'none', regime: 'trend' },
    featureEvidence: [],
    validationStatus: 'unvalidated',
    paperPermission: 'observe_only',
    queueStatus: 'not_queued',
    ...overrides,
  };
}

const summary = { cycleId: 'cycle_truth', startedAt: 90, completedAt: 110,
  evaluated: 2, declines: 2, hypotheses: 0, paperCandidates: 0, routed: 0 };

test('zero-route diagnostics explain expected restraint and exclude assurance fixtures', async () => {
  const { buildDecisionCycleDiagnosticsV5 } = await import('../../server/v5/operator_truth.js');
  const result = buildDecisionCycleDiagnosticsV5([
    decision(),
    decision({ id: 'decision_assurance_fixture', reason: 'ASSURANCE_NO_SIGNAL' }),
  ], summary);
  assert.equal(result.organicEvaluated, 1);
  assert.equal(result.assuranceExcluded, 1);
  assert.equal(result.organicRouted, 0);
  assert.equal(result.noRouteClassification, 'expected_no_trade');
  assert.match(result.explanation, /standing down is expected/);
  assert.equal(result.blockingReasons[0].category, 'no_signal');
});

test('diagnostics distinguish evidence blocks, risk vetoes, and routing gaps', async () => {
  const { buildDecisionCycleDiagnosticsV5 } = await import('../../server/v5/operator_truth.js');
  const evidence = buildDecisionCycleDiagnosticsV5([
    decision({ reason: 'FEATURE_STALE', gates: [{ layer: 'data_quality', status: 'decline', reason: 'FEATURE_STALE', evidence: {} }] }),
  ], { ...summary, evaluated: 1, declines: 1 });
  assert.equal(evidence.noRouteClassification, 'evidence_blocked');

  const risk = buildDecisionCycleDiagnosticsV5([
    decision({ reason: 'PORTFOLIO_SYMBOL_CAP', gates: [{ layer: 'portfolio', status: 'decline', reason: 'PORTFOLIO_SYMBOL_CAP', evidence: {} }] }),
  ], { ...summary, evaluated: 1, declines: 1 });
  assert.equal(risk.noRouteClassification, 'risk_vetoed');

  const routing = buildDecisionCycleDiagnosticsV5([
    decision({ outcome: 'paper_trade_candidate', reason: 'VALIDATED_SIGNAL', signal: { action: 'buy', strength: 1,
      setup: 'momentum', trigger: 'breakout', invalidation: 'breakdown', regime: 'trend' } }),
  ], { ...summary, evaluated: 1, declines: 0, paperCandidates: 1 });
  assert.equal(routing.noRouteClassification, 'routing_gap');
});

test('acceptance bundles are content addressed and never claim economic or deployment approval', async () => {
  const { readDatabase } = await import('../../server/storage.js');
  const { DEFAULT_POPULATION_OPERATION_POLICY_V5 } = await import('../../server/v5/population.js');
  const { buildLocalAcceptanceBundleV5 } = await import('../../server/v5/operator_truth.js');
  const db = readDatabase();
  db.populationOperationsV5 = { policy: DEFAULT_POPULATION_OPERATION_POLICY_V5, samples: [], assuranceRecords: [] };
  const first = buildLocalAcceptanceBundleV5(db, 1_000);
  const second = buildLocalAcceptanceBundleV5(db, 1_000);
  assert.equal(first.bundleHash, second.bundleHash);
  assert.equal(first.economicEdgeProven, false);
  assert.equal(first.deploymentAuthorized, false);
  assert.equal(first.liveExecution, 'locked');
  const evidenceIds = ['evidence'];
  db.populationOperationsV5.assuranceRecords!.push({
    authorityVersion: 5, schema: 'population-assurance-record.v5', recordId: 'record', kind: 'stale_data_rejection',
    evidenceIds, evidenceHash: crypto.createHash('sha256').update(JSON.stringify({ kind: 'stale_data_rejection', evidenceIds })).digest('hex'), recordedAt: 1,
  });
  assert.notEqual(buildLocalAcceptanceBundleV5(db, 1_000).bundleHash, first.bundleHash);
});
