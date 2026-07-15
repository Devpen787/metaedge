import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildSignalResearchArtifact } from '../../server/discovery/signal_research.js';
import type { SignalInputPoint } from '../../server/discovery/signal_types.js';
import { enrollUntouchedForward, evaluateResearchLockbox, sealResearchLockbox } from '../../server/discovery/validation_runtime.js';
import { ValidationStore } from '../../server/discovery/validation_store.js';
import type { LockboxEvaluation } from '../../server/discovery/validation_types.js';

function inputs(count = 420): SignalInputPoint[] {
  return Array.from({ length: count }, (_, index) => ({ at: index * 1_000, availableAt: index * 1_000 + 500,
    assetReturnBps: Math.sin(index / 11) * 30 + Math.cos(index / 5) * 10,
    benchmarkReturnBps: Math.sin(index / 11) * 20, sourceEventIds: [`event_${index}`] }));
}

function artifact() {
  return buildSignalResearchArtifact({ datasetVersionId: 'dataset', universeVersionId: 'universe', worldContractId: 'world',
    lane: 'stocks', symbol: 'TEST', benchmark: 'SPY', points: inputs(), normalization: 'causal_zscore',
    normalizationWindows: [20, 40], smoothingAlphas: [0.2, 0.5], eventThresholds: [0.5, 1],
    horizons: [1, 5, 20], historicalResearchEligible: false, paperForwardEligible: true,
    blockers: ['HISTORICAL_MEMBERSHIP_UNAVAILABLE'], createdAt: 100 });
}

test('lockbox charges every research choice, enforces budget, and produces a non-overridable numerical evaluation', () => {
  const signal = artifact();
  assert.throws(() => sealResearchLockbox({ artifact: signal, familyId: 'family', maximumTrialBudget: 10 }),
    /RESEARCH_BUDGET_EXCEEDED/);
  const lockbox = sealResearchLockbox({ artifact: signal, familyId: 'family', maximumTrialBudget: 100, sealedAt: 200 });
  assert.equal(lockbox.totalDeclaredTrials, signal.researchChoices.reduce((sum, choice) => sum + choice.trialCost, 0));
  const evaluation = evaluateResearchLockbox({ lockbox, artifact: signal, evaluatedAt: 300 });
  assert.equal(evaluation.disposition, 'blocked');
  assert.equal(evaluation.numericalGateNonOverridable, true);
  assert.equal(evaluation.regimeEvidence.length, 4);
  assert.ok(evaluation.factorAttribution.samples > 20);
  assert.equal(enrollUntouchedForward({ evaluation, artifact: signal }), null);
});

test('write-once store permits one evaluation per lockbox and preserves append-only failed evidence', () => {
  const signal = artifact(); const lockbox = sealResearchLockbox({ artifact: signal, familyId: 'family', maximumTrialBudget: 100 });
  const evaluation = evaluateResearchLockbox({ lockbox, artifact: signal });
  const store = new ValidationStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-validation-')));
  store.appendLockboxes([lockbox, lockbox]); store.appendEvaluations([evaluation, evaluation]);
  assert.throws(() => store.appendEvaluations([{ ...evaluation, id: 'different-evaluation' }]), /LOCKBOX_ALREADY_EVALUATED/);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.counts, { lockboxes: 1, evaluations: 1, forwardQuarantines: 0 });
  assert.deepEqual(snapshot.integrity.multiplyEvaluatedLockboxIds, []);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});

test('only a passing sealed evaluation can enter untouched forward quarantine after its evidence cutoff', () => {
  const signal = artifact();
  const passing = { id: 'evaluation', disposition: 'forward_candidate' } as LockboxEvaluation;
  const cutoff = Math.max(...signal.points.map((point) => point.availableAt));
  assert.throws(() => enrollUntouchedForward({ evaluation: passing, artifact: signal, enrolledAt: cutoff - 1 }),
    /ENROLLMENT_BEFORE_EVIDENCE_CUTOFF/);
  const enrollment = enrollUntouchedForward({ evaluation: passing, artifact: signal, enrolledAt: cutoff });
  assert.equal(enrollment?.status, 'collecting');
  assert.equal(enrollment?.resolvedObservations, 0);
  assert.equal(enrollment?.immutableResearchPolicy, true);
  assert.equal(enrollment?.liveExecution, 'locked');
});

test('operator admission uses only the newest lockbox in each current-policy family lineage', () => {
  const signal = artifact();
  const first = sealResearchLockbox({ artifact: signal, familyId: 'family', maximumTrialBudget: 100, sealedAt: 200 });
  const firstEvaluation = evaluateResearchLockbox({ lockbox: first, artifact: signal, evaluatedAt: 210 });
  const second = { ...first, id: 'newer-lockbox', parentLockboxId: first.id, signalArtifactId: 'newer-signal',
    sealedAt: 300, sealHash: 'newer-seal' };
  const secondEvaluation = { ...firstEvaluation, id: 'newer-evaluation', lockboxId: second.id,
    signalArtifactId: second.signalArtifactId, evaluatedAt: 310 };
  const store = new ValidationStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-validation-lineage-')));
  store.appendLockboxes([first, second]); store.appendEvaluations([firstEvaluation, secondEvaluation]);
  assert.deepEqual(store.readActiveCurrentPolicyEvaluations().map((row) => row.id), [secondEvaluation.id]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.currentPolicy.evaluations, 1);
  assert.equal(snapshot.currentPolicy.supersededEvaluations, 1);
  assert.deepEqual(snapshot.integrity.supersededCurrentPolicyEvaluationIds, [firstEvaluation.id]);
});
