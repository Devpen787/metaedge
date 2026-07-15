import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createDatasetVersion, createUniverseVersion, makeCurrentMembership, selectAsOfUniverse,
} from '../../server/discovery/data_world.js';
import { DataWorldStore } from '../../server/discovery/data_world_store.js';
import type { UniverseMembership } from '../../server/discovery/data_world_types.js';

test('dataset versions are content-addressed and quarantine invalid bars without rewriting evidence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-data-world-'));
  const file = path.join(root, 'backfill-TEST-1d.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ t: 1, o: 10, h: 11, l: 9, c: 10.5, v: 100 }),
    JSON.stringify({ t: 2, o: 10, h: 9, l: 11, c: 10, v: -1 }),
  ].join('\n') + '\n');
  const first = createDatasetVersion({ files: [file], source: 'test', createdAt: 100 });
  const second = createDatasetVersion({ files: [file], source: 'test', createdAt: 200 });
  assert.equal(first.version.id, second.version.id);
  assert.equal(first.version.files[0].status, 'quarantined');
  assert.ok(first.version.files[0].issues.includes('BAR_HIGH_BELOW_LOW'));
  assert.ok(first.quarantines.some((row) => row.reason === 'BAR_VOLUME_NEGATIVE'));
  assert.equal(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length, 2);
});

test('current constituent snapshots cannot masquerade as historical membership', () => {
  const current = makeCurrentMembership({ lane: 'stocks', symbols: ['AAPL'], at: 200,
    sourceVersionId: 'dataset', authority: 'current liquidity screen' });
  const historicalView = selectAsOfUniverse(current, 'stocks', 100);
  const currentView = selectAsOfUniverse(current, 'stocks', 200);
  assert.deepEqual(historicalView.eligibleSymbols, []);
  assert.equal(historicalView.excluded[0].reason, 'MEMBERSHIP_NOT_KNOWN_AS_OF_DATE');
  assert.deepEqual(currentView.eligibleSymbols, []);
  assert.equal(currentView.excluded[0].reason, 'CURRENT_MEMBERSHIP_NOT_HISTORICAL_EVIDENCE');
  assert.equal(currentView.survivorshipSafe, false);
  const forwardView = selectAsOfUniverse(current, 'stocks', 200, 'paper_forward');
  assert.deepEqual(forwardView.eligibleSymbols, ['AAPL']);
  assert.equal(forwardView.survivorshipSafe, true);
});

test('funding audit accepts both historical and point-in-time snapshot schemas', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-funding-schema-'));
  const historical = path.join(root, 'funding-hist-BTC.jsonl');
  const snapshot = path.join(root, 'funding-2026-07-15.jsonl');
  fs.writeFileSync(historical, `${JSON.stringify({ t: 1, funding: 0.0001 })}\n`);
  fs.writeFileSync(snapshot, `${JSON.stringify({ t: 2, sym: 'BTC', fundingHourly: 0.00001 })}\n`);
  const result = createDatasetVersion({ files: [historical, snapshot], source: 'test' });
  assert.equal(result.quarantines.length, 0);
  assert.ok(result.version.files.every((file) => file.status === 'valid'));
});

test('as-of universe accepts only effective historical memberships known by the decision time', () => {
  const base = { lane: 'spot_crypto' as const, symbol: 'ETH', effectiveFrom: 100, effectiveTo: 300,
    knownAt: 90, sourceVersionId: 'universe-v1', authority: 'historical venue screen',
    historyStatus: 'historical_membership' as const, liveExecution: 'locked' as const };
  const memberships: UniverseMembership[] = [{ id: 'membership', ...base }];
  assert.deepEqual(selectAsOfUniverse(memberships, 'spot_crypto', 200).eligibleSymbols, ['ETH']);
  assert.deepEqual(selectAsOfUniverse(memberships, 'spot_crypto', 400).eligibleSymbols, []);
});

test('data-world store is append-only and idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-data-world-store-'));
  const file = path.join(root, 'backfill-TEST-1d.jsonl');
  fs.writeFileSync(file, `${JSON.stringify({ t: 1, o: 10, h: 11, l: 9, c: 10.5, v: 100 })}\n`);
  const result = createDatasetVersion({ files: [file], source: 'test', createdAt: 100 });
  const store = new DataWorldStore(path.join(root, 'store'));
  store.appendDatasetVersions([result.version, result.version]);
  store.appendQuarantines(result.quarantines);
  const memberships = makeCurrentMembership({ lane: 'stocks', symbols: ['TEST'], at: 100,
    sourceVersionId: result.version.id, authority: 'test snapshot' });
  const universe = createUniverseVersion(memberships, 100);
  store.appendMemberships(memberships);
  store.appendUniverseVersions([universe, universe]);
  assert.equal(store.readDatasetVersions().length, 1);
  assert.equal(store.readQuarantines().length, 0);
  assert.equal(store.readUniverseVersions().length, 1);
  assert.equal(store.snapshot().integrity.invalidUniverseVersionIds.length, 0);
  assert.equal(store.snapshot().latestUniverseVersion?.survivorshipSafe, false);
});

test('universe versions are content-addressed and become survivorship-safe only with historical membership', () => {
  const current = makeCurrentMembership({ lane: 'stocks', symbols: ['AAPL'], at: 200,
    sourceVersionId: 'dataset', authority: 'current snapshot' });
  const currentVersion = createUniverseVersion(current, 200);
  assert.equal(currentVersion.historyStatus, 'current_snapshot_only');
  assert.equal(currentVersion.survivorshipSafe, false);
  const historical: UniverseMembership[] = current.map((row) => ({ ...row, id: 'historical-membership',
    effectiveFrom: 100, knownAt: 90, historyStatus: 'historical_membership' }));
  const historicalVersion = createUniverseVersion(historical, 200);
  assert.equal(historicalVersion.historyStatus, 'historical_membership');
  assert.equal(historicalVersion.survivorshipSafe, true);
  assert.notEqual(currentVersion.id, historicalVersion.id);
});
