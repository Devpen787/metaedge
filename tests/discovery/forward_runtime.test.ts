import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeResolvedForwards, buildLifecycleAndResearchQueue } from '../../server/discovery/forward_runtime.js';
import { buildPredictionForwardObservations } from '../../server/discovery/prediction_forward.js';
import type { AlphaTrial, ForwardObservation } from '../../server/discovery/flywheel_types.js';

test('resolved probability forecasts produce separate calibration and directional attribution', () => {
  const forward: ForwardObservation = { id: 'f1', trialId: 't1', candidateHash: 'c1', lane: 'prediction_markets',
    kind: 'calibration_forecast', forecastAt: 1, resolveAt: 2, status: 'resolved', predictedValue: 0.8,
    realizedValue: 1, netPaperPnlBps: null, executionQuality: null };
  const rows = attributeResolvedForwards([forward]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].directionalHit, true);
  assert.ok(Math.abs((rows[0].calibrationSquaredError ?? 0) - 0.04) < 1e-12);
});

test('thirty negative forward outcomes automatically reopen research', () => {
  const trial: AlphaTrial = { id: 'trial', candidateHash: 'candidate', evidenceFingerprint: 'evidence', lane: 'spot_crypto',
    family: 'momentum', startedAt: 1, completedAt: 2, status: 'candidate', reason: 'PASSED', declaredTrials: 1,
    support: 100, liveExecution: 'locked' };
  const attributions = Array.from({ length: 30 }, (_, index) => ({ id: `a${index}`, forwardObservationId: `f${index}`,
    trialId: trial.id, candidateHash: trial.candidateHash, resolvedAt: index, directionalHit: false,
    calibrationSquaredError: null, netPaperPnlBps: -20, executionQuality: 1 }));
  const result = buildLifecycleAndResearchQueue({ trials: [trial], attributions, existingLifecycle: [] });
  assert.equal(result.lifecycle[0].state, 're_research');
  assert.equal(result.researchQueue.length, 1);
  assert.equal(result.researchQueue[0].status, 'open');
});

test('prediction forwards use one point-in-time forecast per market and only exact resolved outcomes', () => {
  const rows = buildPredictionForwardObservations({ candidateHash: 'candidate', trialId: 'trial', now: 1_000,
    snapshots: [
      { t: 100, id: 'm1', prices: [0.7, 0.3], endDate: new Date(900).toISOString() },
      { t: 200, id: 'm1', prices: [0.9, 0.1], endDate: new Date(900).toISOString() },
      { t: 100, id: 'm2', prices: [0.4, 0.6], endDate: new Date(900).toISOString() },
    ],
    resolutions: [
      { t: 950, id: 'm1', prices: [1, 0], resolvedAt: 950, resolutionStatus: 'resolved' },
      { t: 950, id: 'm2', prices: [0.5, 0.5], resolvedAt: 950, resolutionStatus: 'resolved' },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.predictedValue === 0.7)?.status, 'resolved');
  assert.equal(rows.find((row) => row.predictedValue === 0.7)?.realizedValue, 1);
  assert.equal(rows.find((row) => row.predictedValue === 0.4)?.status, 'pending');
});
