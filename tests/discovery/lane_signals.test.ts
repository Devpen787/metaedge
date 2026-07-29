import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildLaneSignalPackets } from '../../server/discovery/lane_signals.js';
import { LaneSignalStore } from '../../server/discovery/lane_signal_store.js';
import type { FlywheelSnapshot } from '../../server/discovery/flywheel_types.js';
import type { WorldParityAudit } from '../../server/discovery/world_types.js';

test('lane packets expose all money streams at once and keep incomplete streams at research-only or no-trade', () => {
  const lanes = {
    stocks: { status: 'partial', observations: 10, trials: 1, blockers: ['SIGNED_SURPRISE_FEATURES_MISSING'] },
    spot_crypto: { status: 'partial', observations: 10, trials: 1, blockers: ['ORDER_FLOW_HISTORY_MISSING'] },
    perpetuals: { status: 'partial', observations: 2, trials: 1, blockers: ['DEPTH_HISTORY_MISSING'] },
    memecoins: { status: 'blocked', observations: 0, trials: 1, blockers: ['HOLDER_GRAPH_MISSING'] },
    prediction_markets: { status: 'partial', observations: 2, trials: 1, blockers: ['RESOLVED_OUTCOME_LABELS_MISSING'] },
    cross_chain: { status: 'blocked', observations: 0, trials: 1, blockers: ['EXECUTABLE_SYNCHRONIZED_QUOTES_MISSING'] },
  } as const;
  const flywheel = { states: [{ id: 'state-stock', contentHash: 'hash', lane: 'stocks', symbol: 'AAPL', observedAt: 10,
    decisionAt: 20, features: [{ key: 'close', value: 100, observedAt: 10, availableAt: 20, pointInTime: true }],
    valid: true, blockers: [], liveExecution: 'locked' }], candidates: [{ id: 'relationship', contentHash: 'relationship',
    lane: 'spot_crypto', family: 'cross_market_relationship', scopeSymbols: ['AAPL', 'BTC'], lookbackBars: 1,
    horizonBars: 1, roundTripCostBps: 10, declaredTrials: 1, targetKind: 'benchmark_relative_return', rule: 'test',
    liveExecution: 'locked' }], trials: [], forwardObservations: [], coverage: { generatedAt: 20, lanes,
    liveExecution: 'locked' }, validations: [], novelty: [], executionDecisions: [], portfolioDecisions: [], attributions: [],
    lifecycle: [], researchQueue: [], integrity: { orphanTrialIds: [], orphanValidationIds: [], invalidStateIds: [],
      allLiveExecutionLocked: true }, operatorSummary: {}, mode: 'Paper research', liveExecution: 'locked' } as unknown as FlywheelSnapshot;
  const worldAudit = { datasetVersionId: 'dataset', universeVersionId: 'universe', contractId: 'world',
    paperForwardEligible: true } as WorldParityAudit;
  const packets = buildLaneSignalPackets({ flywheel, signalArtifacts: [], worldAudit, createdAt: 100 });
  assert.equal(packets.length, 7);
  assert.deepEqual(packets.map((packet) => packet.stream).sort(),
    ['cross_chain', 'cross_market_quant', 'memecoins', 'perpetuals', 'prediction_markets', 'spot_crypto', 'stocks']);
  assert.equal(packets.find((packet) => packet.stream === 'cross_chain')?.candidateAction, 'no_trade');
  assert.equal(packets.find((packet) => packet.stream === 'stocks')?.candidateAction, 'research_only');
  assert.equal(packets.find((packet) => packet.stream === 'cross_market_quant')?.candidateAction, 'research_only');
  assert.ok(packets.every((packet) => packet.liveExecution === 'locked'));
  const store = new LaneSignalStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-lane-signals-')));
  store.appendPackets([...packets, ...packets]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.streams, 7);
  assert.deepEqual(snapshot.integrity.invalidPacketIds, []);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});
