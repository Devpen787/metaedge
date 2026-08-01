import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LegacyV3OperatorSummaryStore, V5OperatorSummaryStore } from '../../server/discovery/operator_snapshot.js';

test('operator cache is atomic, bounded, and reports freshness without rebuilding source ledgers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-operator-cache-'));
  const store = new V5OperatorSummaryStore(root);
  const missing = store.read(1_000);
  assert.equal(missing.stale, true);
  assert.equal(missing.snapshot.verdict.operationStatus, 'degraded');

  store.write({ authorityVersion: 5, schema: 'opportunity-factory-operator.v5', schemaVersion: 5,
    generatedAt: 900, mode: 'Paper research', verdict: {
    operationStatus: 'operational', economicResult: 'no_promoted_alpha', capitalStatus: 'live_locked',
    conclusion: 'no-trade' }, liveExecution: 'locked' });
  const current = store.read(1_000, 200);
  assert.equal(current.stale, false);
  assert.equal(current.ageMs, 100);
  assert.equal(current.snapshot.liveExecution, 'locked');
  assert.equal(fs.readdirSync(root).some((file) => file.endsWith('.tmp')), false);
  assert.equal(store.read(1_200, 200).stale, true);
});

test('legacy v3 operator cache is read-only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-legacy-operator-cache-'));
  const file = path.join(root, 'v3-summary.json');
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, generatedAt: 900 }));
  const store = new LegacyV3OperatorSummaryStore(root);
  assert.equal(store.read()?.schemaVersion, 1);
  assert.equal('write' in store, false);
});
