import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertWorldParity, DeterministicWorld, makeWorldContract, makeWorldEvent, nextExecutionBar,
  runHistoricalWorld, runPaperWorld, SeededRandom,
} from '../../server/discovery/world_runtime.js';

const contract = makeWorldContract({ datasetVersionId: 'dataset-v1', universeVersionId: 'universe-v1',
  calendarVersion: '24x7-v1', seed: 42, executionTiming: 'next_bar',
  missingBarPolicy: 'freeze_last_mark_no_new_order', sameBarPathPolicy: 'stop_before_limit',
  correctionPolicy: 'new_world_version' });

function event(eventTime: number, availableAt: number, value: number) {
  return makeWorldEvent({ kind: 'bar', lane: 'spot_crypto', symbol: 'ETH', eventTime, availableAt,
    observedAt: 1_000, sourceVersionId: contract.datasetVersionId, payload: { close: value } });
}

test('historical replay and paper ingestion produce identical world traces', () => {
  const events = [event(10, 20, 100), event(20, 30, 101),
    makeWorldEvent({ kind: 'funding', lane: 'perpetuals', symbol: 'ETH', eventTime: 20, availableAt: 30,
      observedAt: 1_000, sourceVersionId: contract.datasetVersionId, payload: { funding: 0.0001 } })];
  const historical = runHistoricalWorld(contract, [...events].reverse());
  const paper = runPaperWorld(contract, events);
  assertWorldParity(historical, paper);
  assert.equal(historical.parityHash, paper.parityHash);
  assert.deepEqual(historical.consumedEventIds, paper.consumedEventIds);
});

test('world exposes evidence by availability time, not event time or ingestion hindsight', () => {
  const first = event(10, 100, 100);
  const delayedPublication = makeWorldEvent({ kind: 'filing', lane: 'stocks', symbol: 'AAPL', eventTime: 20,
    availableAt: 200, observedAt: 1_000, sourceVersionId: contract.datasetVersionId, payload: { surprise: 1 } });
  const world = new DeterministicWorld(contract, 'historical_replay', [delayedPublication, first]);
  const at150 = world.advanceTo(150);
  assert.equal(at150.consumedEventCount, 1);
  assert.ok(at150.consumedEventHash);
  assert.equal(at150.latestEventIds['filing:stocks:AAPL'], undefined);
  const at200 = world.advanceTo(200);
  assert.equal(at200.latestEventIds['filing:stocks:AAPL'], delayedPublication.id);
});

test('paper world rejects backdated corrections after its clock has advanced', () => {
  const world = new DeterministicWorld(contract, 'paper_forward');
  world.append(event(10, 100, 100)); world.advanceTo(100);
  assert.throws(() => world.append(event(20, 99, 90)), /LATE_EVENT_REQUIRES_NEW_WORLD_VERSION/);
});

test('world contracts reject tampered payloads and mismatched dataset versions', () => {
  const valid = event(10, 20, 100);
  const tampered = { ...valid, payload: { close: 999 } };
  assert.throws(() => new DeterministicWorld(contract, 'historical_replay', [tampered]), /PAYLOAD_HASH_MISMATCH/);
  const otherSource = { ...valid, id: 'other', sourceVersionId: 'dataset-v2' };
  assert.throws(() => new DeterministicWorld(contract, 'historical_replay', [otherSource]), /SOURCE_VERSION_MISMATCH/);
  const wrongUniverseSource = makeWorldEvent({ kind: 'universe_membership', lane: 'spot_crypto', symbol: 'ETH',
    eventTime: 10, availableAt: 20, observedAt: 1_000, sourceVersionId: contract.datasetVersionId,
    payload: { member: true } });
  assert.throws(() => new DeterministicWorld(contract, 'historical_replay', [wrongUniverseSource]), /SOURCE_VERSION_MISMATCH/);
});

test('execution timing always chooses a later bar and never the decision bar', () => {
  const bars = [
    { symbol: 'ETH', openAt: 100, closeAt: 199, open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { symbol: 'ETH', openAt: 200, closeAt: 299, open: 11, high: 13, low: 10, close: 12, volume: 100 },
  ];
  assert.equal(nextExecutionBar(bars, 100)?.openAt, 200);
  assert.equal(nextExecutionBar(bars, 199)?.openAt, 200);
  assert.equal(nextExecutionBar(bars, 200), null);
});

test('seeded world randomness is reproducible and seed-sensitive', () => {
  const left = new SeededRandom(42); const right = new SeededRandom(42); const other = new SeededRandom(43);
  const a = Array.from({ length: 5 }, () => left.next());
  assert.deepEqual(a, Array.from({ length: 5 }, () => right.next()));
  assert.notDeepEqual(a, Array.from({ length: 5 }, () => other.next()));
});
