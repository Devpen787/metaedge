import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runDecisionCouncil } from '../../server/discovery/council_runtime.js';
import { CouncilStore } from '../../server/discovery/council_store.js';
import type { LaneSignalPacket } from '../../server/discovery/lane_signal_types.js';

function packet(overrides: Partial<LaneSignalPacket> = {}): LaneSignalPacket {
  return { id: 'packet', schemaVersion: 1, createdAt: 10, stream: 'stocks', datasetVersionId: 'dataset',
    universeVersionId: 'universe', worldContractId: 'world', asOf: 10, observedSymbols: ['AAPL'],
    sourceArtifactIds: ['signal'], measurements: { robustParameterSurfaces: 1, resolvedForwards: 0 },
    quality: { pointInTimeStateFraction: 1, resolvedForwardFraction: 0, evidenceCompleteness: 0.8, score: 0.6 },
    evidenceStatus: 'partial', researchDisposition: 'forward_candidate', candidateAction: 'observe_forward',
    blockers: ['UNTOUCHED_FORWARD_OUTCOMES_NOT_YET_OBSERVED'], liveExecution: 'locked', ...overrides };
}

test('council preserves dissent but numerical gate alone controls paper observation', () => {
  const run = runDecisionCouncil(packet(), 100);
  assert.equal(run.specialists.length, 4);
  assert.ok(run.bullCase.unresolvedDissent.length > 0);
  assert.ok(run.bearCase.unresolvedDissent.length > 0);
  assert.equal(run.numericalGate.nonOverridable, true);
  assert.equal(run.numericalGate.passed, true);
  assert.equal(run.manager.decision, 'paper_observe');
  assert.equal(run.manager.liveExecution, 'locked');
});

test('council cannot talk a blocked numerical packet into a trade', () => {
  const run = runDecisionCouncil(packet({ id: 'blocked', researchDisposition: 'blocked', candidateAction: 'research_only',
    blockers: ['PARAMETER_PLATEAU_NOT_ROBUST'] }), 100);
  assert.equal(run.numericalGate.passed, false);
  assert.ok(run.numericalGate.blockers.includes('UPSTREAM_NUMERICAL_DISPOSITION_NOT_FORWARD_CANDIDATE'));
  assert.equal(run.manager.decision, 'research_only');
  assert.equal(run.liveExecution, 'locked');
  const store = new CouncilStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-council-')));
  store.appendRuns([run, run]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.counts.runs, 1);
  assert.deepEqual(snapshot.integrity.invalidRunIds, []);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});
