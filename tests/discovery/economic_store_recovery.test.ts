import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';

test('one malformed economic row preserves valid decisions and creates a quarantine record', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-economic-quarantine-'));
  fs.mkdirSync(root, { recursive: true });
  const valid = { id: 'decision-valid', schemaVersion: 1, contractId: 'contract', strategyVersionId: 'version',
    candidateId: 'candidate', sourceSignalEventIds: ['event'], symbol: 'SOL', side: 'long', cohort: 'taker',
    evidenceMode: 'paper_forward', recordedAt: 2, decidedAt: 1, evidenceCutoffAt: 1, expiresAt: 3,
    horizonMs: 1, latencyMs: 1, requestedNotionalUsd: 1, participationRate: 0.1, referenceMidPrice: 100,
    primaryExecutionPolicy: 'taker_market', decisionLagMs: 1, riskReservationId: 'reservation', liveExecution: 'locked' };
  fs.writeFileSync(path.join(root, 'shadow-decisions.jsonl'), `${JSON.stringify(valid)}\n{malformed\n`);
  const store = new EconomicOperationStore(root);
  assert.deepEqual(store.readShadowDecisions().map((row) => row.id), ['decision-valid']);
  assert.equal(fs.existsSync(path.join(root, 'quarantine', 'malformed-jsonl.jsonl')), true);
});
