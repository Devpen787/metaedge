import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  makeWorldContract, makeWorldEvent, makeWorldParityAudit, runHistoricalWorld, runPaperWorld,
} from '../../server/discovery/world_runtime.js';
import { WorldStore } from '../../server/discovery/world_store.js';

test('world store persists an idempotent parity proof with clean integrity and live locked', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-world-store-'));
  const contract = makeWorldContract({ datasetVersionId: 'dataset-v1', universeVersionId: 'universe-v1',
    calendarVersion: '24x7-v1', seed: 42, executionTiming: 'next_bar',
    missingBarPolicy: 'freeze_last_mark_no_new_order', sameBarPathPolicy: 'stop_before_limit',
    correctionPolicy: 'new_world_version' });
  const event = makeWorldEvent({ kind: 'bar', lane: 'spot_crypto', symbol: 'ETH', eventTime: 10,
    availableAt: 20, observedAt: 30, sourceVersionId: contract.datasetVersionId, payload: { close: 100 } });
  const historicalTrace = runHistoricalWorld(contract, [event]);
  const paperTrace = runPaperWorld(contract, [event]);
  const audit = makeWorldParityAudit({ contract, events: [event], historicalTrace, paperTrace,
    historicalResearchEligible: false, paperForwardEligible: true, paperForwardEligibleAt: 20,
    blockers: ['HISTORICAL_MEMBERSHIP_UNAVAILABLE'], auditedAt: 100 });
  const store = new WorldStore(root);
  store.appendContracts([contract, contract]);
  store.appendEvents([event, event]);
  store.appendAudits([audit, audit]);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.counts, { contracts: 1, events: 1, parityAudits: 1 });
  assert.deepEqual(snapshot.integrity.invalidContractIds, []);
  assert.deepEqual(snapshot.integrity.invalidEventIds, []);
  assert.deepEqual(snapshot.integrity.orphanAuditIds, []);
  assert.deepEqual(snapshot.integrity.divergentAuditIds, []);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
  assert.equal(snapshot.latestAudit?.historicalResearchEligible, false);
});
