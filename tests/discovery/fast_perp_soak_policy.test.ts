import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticPauseReason } from '../../scripts/fast_perp_soak_policy.mjs';

function healthySample() {
  return {
    health: { operational: true, currentLiveLock: true, eventAgeMs: 100, clocks: [],
      researchBatch: { status: 'failed', affectsContinuousOperation: false } },
    v3: { liveExecution: 'locked', criticalFailures: 0 },
  };
}

test('the soak guard pauses fail-closed as soon as operator health is false', () => {
  const sample = healthySample(); sample.health.operational = false;
  assert.equal(automaticPauseReason({ stage: 'final', sample, recent: [sample], intervalMs: 15_000,
    projectedTotalKbPerDay: 0, v3p95Ms: 10 }), 'OPERATIONAL_HEALTH_DEGRADED');
});

test('the soak guard leaves a healthy bounded sample unpaused', () => {
  const sample = healthySample();
  assert.equal(automaticPauseReason({ stage: 'final', sample, recent: [sample], intervalMs: 15_000,
    projectedTotalKbPerDay: 0, v3p95Ms: 10 }), null);
});

test('a failed research batch cannot globally pause healthy continuous paper clocks', () => {
  const sample = healthySample();
  assert.equal(sample.health.researchBatch.affectsContinuousOperation, false);
  assert.equal(automaticPauseReason({ stage: 'final', sample, recent: [sample], intervalMs: 15_000,
    projectedTotalKbPerDay: 0, v3p95Ms: 10 }), null);
});
