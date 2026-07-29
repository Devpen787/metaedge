import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPriceAlphaSamples,
  generatePriceCandidateSpecs,
  purgedTemporalSplit,
  validateAlphaCandidate,
} from '../../server/discovery/alpha_factory.js';
import type { AlphaSample } from '../../server/discovery/flywheel_types.js';
import type { PriceBar } from '../../server/discovery/types.js';

test('alpha grammar generates unique accountable trials across mechanism families', () => {
  const specs = generatePriceCandidateSpecs({
    lane: 'stocks', symbols: ['A', 'B', 'C'], lookbacks: [1, 5], horizons: [1, 2], roundTripCostBps: 20,
  });
  // Six core families for every lookback/horizon plus two explicit state-transition
  // families for each horizon at lookback 1. Duplication is intentional and later
  // measured rather than silently treated as independent alpha.
  assert.equal(specs.length, 28);
  assert.equal(new Set(specs.map((spec) => spec.id)).size, specs.length);
  assert.ok(specs.every((spec) => spec.declaredTrials === specs.length));
  assert.ok(specs.some((spec) => spec.family === 'state_transition_continuation'));
  assert.ok(specs.some((spec) => spec.family === 'cross_sectional_reversal'));
  assert.ok(specs.every((spec) => spec.liveExecution === 'locked'));
});

function samples(values: number[]): AlphaSample[] {
  return values.map((netReturnBps, index) => ({
    id: `sample_${index}`, symbol: 'TEST', enteredAt: index * 10, labelAt: index * 10 + 5,
    score: Math.abs(netReturnBps), grossReturnBps: netReturnBps + 10, netReturnBps, capacityUsd: 10_000,
  }));
}

test('purged temporal splits prevent a training or validation label from crossing the next boundary', () => {
  const split = purgedTemporalSplit(samples(Array.from({ length: 100 }, () => 20)), 3);
  assert.ok(Math.max(...split.train.map((row) => row.labelAt)) < Math.min(...split.validation.map((row) => row.enteredAt)));
  assert.ok(Math.max(...split.validation.map((row) => row.labelAt)) < Math.min(...split.holdout.map((row) => row.enteredAt)));
  assert.ok(split.purged > 0);
});

test('validation declines an in-sample winner that fails untouched validation and holdout', () => {
  const spec = generatePriceCandidateSpecs({ lane: 'stocks', symbols: ['TEST'], lookbacks: [1], horizons: [1], roundTripCostBps: 10 })[0];
  const values = [...Array(70).fill(80), ...Array(50).fill(-80)];
  const result = validateAlphaCandidate(spec, samples(values), { alpha: 0.05, minimumSplitSamples: 20, stressedExtraCostBps: 20, requestedNotionalUsd: 250 });
  assert.equal(result.disposition, 'declined');
  assert.ok(['VALIDATION_EDGE_NOT_POSITIVE', 'HOLDOUT_EDGE_NOT_POSITIVE', 'WALK_FORWARD_ROBUSTNESS_FAILED'].includes(result.reason));
  assert.ok((result.train.meanNetReturnBps ?? 0) > 0);
  assert.ok((result.holdout.meanNetReturnBps ?? 0) < 0);
});

test('validation reports direction, calibration, net EV, capacity, folds, and cost stress separately', () => {
  const spec = generatePriceCandidateSpecs({ lane: 'spot_crypto', symbols: ['TEST'], lookbacks: [1], horizons: [1], roundTripCostBps: 10 })[0];
  const result = validateAlphaCandidate(spec, samples(Array.from({ length: 180 }, (_, index) => 50 + (index % 7))),
    { alpha: 0.05, minimumSplitSamples: 20, stressedExtraCostBps: 20, requestedNotionalUsd: 250 });
  assert.equal(result.disposition, 'candidate');
  assert.equal(result.validation.directionalAccuracy, 1);
  assert.ok(result.validation.brierScore != null);
  assert.ok((result.holdout.meanNetReturnBps ?? 0) > 0);
  assert.ok((result.stressedHoldoutEdgeLcbBps ?? 0) > 0);
  assert.equal(result.positiveWalkForwardFoldRatio, 1);
  assert.equal(result.holdout.minimumCapacityUsd, 10_000);
  assert.equal(result.liveExecution, 'locked');
});

function bars(closes: number[], volume = 1_000_000): PriceBar[] {
  return closes.map((close, index) => ({ t: index * 3_600_000, o: close, h: close, l: close, c: close, v: volume, qv: volume * close }));
}

test('price alpha compiler turns a precommitted momentum rule into non-overlapping post-cost samples', () => {
  const specs = generatePriceCandidateSpecs({ lane: 'spot_crypto', symbols: ['UP'], lookbacks: [1], horizons: [2], roundTripCostBps: 5 });
  const spec = specs.find((candidate) => candidate.family === 'momentum')!;
  const asset = bars(Array.from({ length: 80 }, (_, index) => 100 * (1.01 ** index)));
  const benchmark = bars(Array.from({ length: 80 }, () => 100));
  const compiled = buildPriceAlphaSamples(spec, new Map([['UP', { asset, benchmark }]]));
  assert.ok(compiled.length > 20);
  assert.ok(compiled.every((sample) => sample.labelAt > sample.enteredAt));
  assert.ok(compiled.every((sample) => sample.netReturnBps < sample.grossReturnBps));
  assert.ok(compiled.every((sample, index) => index === 0 || sample.enteredAt >= compiled[index - 1].labelAt));
});
