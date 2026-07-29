import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assessDatasetDrift, attributeForwardObservation, evaluateForwardLifecycle, makeForwardEvidenceObservation,
} from '../../server/discovery/forward_learning_runtime.js';
import { ForwardLearningStore } from '../../server/discovery/forward_learning_store.js';
import type { ForwardAttributionRecord } from '../../server/discovery/forward_learning_types.js';
import type { ForwardQuarantineEnrollment, LockboxEvaluation } from '../../server/discovery/validation_types.js';

function evaluation(values: Partial<LockboxEvaluation> = {}): LockboxEvaluation {
  return { id: 'evaluation', schemaVersion: 1, lockboxId: 'lockbox', signalArtifactId: 'signal', evaluatedAt: 100,
    researchChoices: [], totalChargedTrials: 1, regimeEvidence: [], requiredPassingRegimes: 3, passingRegimes: 3,
    factorAttribution: { samples: 100, alphaBps: 10, betas: { market: 0.5, momentum: 0.2, volatility: 0.1 },
      rSquared: 0.2, meanStrategyReturnBps: 10, factorDominated: false },
    trainMeanBps: 10, holdoutMeanBps: 10, holdoutDegradationRatio: 1, holdoutEventStudies: [],
    disposition: 'forward_candidate', blockers: [], verifierHash: 'hash', numericalGateNonOverridable: true,
    liveExecution: 'locked', ...values };
}

function enrollment(): ForwardQuarantineEnrollment {
  return { id: 'enrollment', schemaVersion: 1, lockboxEvaluationId: 'evaluation', signalArtifactId: 'signal',
    enrolledAt: 200, evidenceCutoffAt: 150, minimumResolvedObservations: 30, status: 'collecting',
    resolvedObservations: 0, immutableResearchPolicy: true, liveExecution: 'locked' };
}

function observation(index = 0) {
  return makeForwardEvidenceObservation({ lockboxEvaluationId: 'evaluation', quarantineEnrollmentId: 'enrollment',
    signalArtifactId: 'signal', stream: 'stocks', symbol: 'A', observedAt: 201 + index * 2,
    resolvedAt: 202 + index * 2, evidenceCutoffAt: 150, horizonBars: 1, sourceEventIds: [`event_${index}`],
    datasetVersionId: 'dataset_2', universeVersionId: 'universe_1', worldContractId: 'world_1',
    rawSignalReturnBps: 100, benchmarkReturnBps: 20,
    factorReturnsBps: { market: 10, momentum: 5, volatility: 2 },
    factorBetas: { market: 0.5, momentum: 0.6, volatility: 1 },
    costs: { feesBps: 2, slippageBps: 3, borrowBps: 4, fundingBps: 1 },
    execution: { cohort: 'taker', filled: true, impactBps: 3, alphaDecayBps: 2,
      adverseSelectionBps: 1, implementationShortfallBps: 15 },
    reportedNetBps: 55, counterfactualNoTradeBps: 0, status: 'resolved', blockers: [] });
}

function attribution(index: number, netBps: number): ForwardAttributionRecord {
  return { id: `attribution_${index}`, schemaVersion: 1, observationId: `observation_${index}`,
    lockboxEvaluationId: 'evaluation', resolvedAt: 300 + index, rawSignalReturnBps: netBps,
    benchmarkReturnBps: 0, benchmarkRelativeBps: netBps, factorExplainedBps: 0,
    factorResidualBeforeCostsBps: netBps, totalCostBps: 0, executionDragBps: 0,
    reconstructedNetBps: netBps, reportedNetBps: netBps, reconciliationErrorBps: 0,
    counterfactualNoTradeBps: 0, incrementalVsNoTradeBps: netBps,
    directionalHit: netBps > 0, liveExecution: 'locked' };
}

function stableDrift() {
  const values = Array.from({ length: 100 }, (_, index) => index);
  return assessDatasetDrift({ lockboxEvaluationId: 'evaluation', measuredAt: 400,
    referenceDatasetVersionId: 'dataset_1', currentDatasetVersionId: 'dataset_2',
    referenceSourceAuthority: 'source', currentSourceAuthority: 'source',
    referenceFeatures: { feature: values }, currentFeatures: { feature: [...values] } });
}

test('forward attribution reconciles benchmark, factors, costs, execution, and no-trade counterfactual', () => {
  const row = attributeForwardObservation(observation());
  assert.ok(row);
  assert.equal(row.benchmarkRelativeBps, 80);
  assert.equal(row.factorExplainedBps, 10);
  assert.equal(row.factorResidualBeforeCostsBps, 70);
  assert.equal(row.totalCostBps, 10);
  assert.equal(row.executionDragBps, 5);
  assert.equal(row.reconstructedNetBps, 55);
  assert.equal(row.reconciliationErrorBps, 0);
  assert.equal(row.incrementalVsNoTradeBps, 55);
});

test('forward observations must be post-cutoff and cite immutable source events', () => {
  const valid = observation();
  assert.ok(valid.observedAt > valid.evidenceCutoffAt);
  assert.equal(valid.immutable, true);
  assert.throws(() => observation(-26), /FORWARD_OBSERVATION_NOT_AFTER_EVIDENCE_CUTOFF/);
});

test('dataset drift detects stable distributions, population shifts, and source changes', () => {
  assert.equal(stableDrift().status, 'stable');
  const reference = Array.from({ length: 100 }, (_, index) => index);
  const current = Array.from({ length: 100 }, (_, index) => index + 1_000);
  const drift = assessDatasetDrift({ lockboxEvaluationId: 'evaluation',
    measuredAt: 400,
    referenceDatasetVersionId: 'dataset_1', currentDatasetVersionId: 'dataset_2',
    referenceSourceAuthority: 'source_a', currentSourceAuthority: 'source_b',
    referenceFeatures: { feature: reference }, currentFeatures: { feature: current } });
  assert.equal(drift.status, 'breach');
  assert.equal(drift.sourceAuthorityChanged, true);
  assert.ok(drift.features[0].populationStabilityIndex != null && drift.features[0].populationStabilityIndex > 0.25);
});

test('healthy untouched forward evidence becomes review-eligible but never live-authorized', () => {
  const rows = Array.from({ length: 30 }, (_, index) => attribution(index, 12));
  const result = evaluateForwardLifecycle({ evaluation: evaluation(), enrollment: enrollment(),
    attributions: rows, drift: stableDrift(), decidedAt: 500 });
  assert.equal(result.decision.state, 'eligible_for_review');
  assert.equal(result.decision.action, 'paper_review');
  assert.equal(result.decision.liveExecution, 'locked');
  assert.equal(result.researchQueue.length, 0);
});

test('non-positive forward edge reopens research and hard loss kills without threshold weakening', () => {
  const decayed = evaluateForwardLifecycle({ evaluation: evaluation(), enrollment: enrollment(),
    attributions: Array.from({ length: 30 }, (_, index) => attribution(index, -2)), drift: stableDrift(), decidedAt: 500 });
  assert.equal(decayed.decision.state, 're_research');
  assert.equal(decayed.researchQueue[0].trigger, 'NON_POSITIVE_FORWARD_EDGE');
  assert.equal(decayed.researchQueue[0].requiresNewLockbox, true);
  const killed = evaluateForwardLifecycle({ evaluation: evaluation(), enrollment: enrollment(),
    attributions: [attribution(0, -1_500)], drift: stableDrift(), decidedAt: 500 });
  assert.equal(killed.decision.state, 'killed');
  assert.equal(killed.researchQueue[0].trigger, 'HARD_RISK_BREACH');
});

test('forward ledger is append-only and rejects same-id mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-forward-'));
  try {
    const store = new ForwardLearningStore(root); const row = observation();
    store.appendObservations([row]); store.appendObservations([row]);
    assert.equal(store.readObservations().length, 1);
    assert.throws(() => store.appendObservations([{ ...row, reportedNetBps: 54 }]), /IMMUTABLE_FORWARD_ID_COLLISION/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('forward operator summary excludes superseded evaluation lifecycle while retaining history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-forward-current-'));
  try {
    const store = new ForwardLearningStore(root);
    const current = evaluateForwardLifecycle({ evaluation: evaluation(), enrollment: null,
      attributions: [], drift: null, decidedAt: 500 }).decision;
    const superseded = { ...current, id: 'superseded-lifecycle', lockboxEvaluationId: 'superseded-evaluation' };
    store.appendLifecycleDecisions([superseded, current]);
    store.appendAudits([{ id: 'audit', schemaVersion: 1, forwardLearningPolicyVersion: 'forward-learning-policy-v1',
      createdAt: 500, sourceEvaluationIds: [current.lockboxEvaluationId], sourceEnrollmentIds: [], observationIds: [],
      attributionIds: [], driftAssessmentIds: [], lifecycleDecisionIds: [current.id], researchQueueItemIds: [],
      status: 'blocked', blockers: ['NO_FORWARD_CANDIDATE_EVALUATIONS'], liveExecution: 'locked' }]);
    const snapshot = store.snapshot();
    assert.equal(snapshot.counts.lifecycleDecisions, 2);
    assert.deepEqual(snapshot.currentLifecycle.map((row) => row.lockboxEvaluationId), [current.lockboxEvaluationId]);
    assert.equal(snapshot.operatorSummary.blocked, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
