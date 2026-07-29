import assert from 'node:assert/strict';
import test from 'node:test';
import { alphaSpending, blockBootstrapLowerBound, chooseBlockLength } from '../../server/discovery/fast_statistics.js';

test('repeated lifecycle looks spend the declared alpha schedule', () => {
  assert.equal(alphaSpending(1), 0.025);
  assert.equal(alphaSpending(2), 0.05 / 6);
  assert.ok(alphaSpending(3) < alphaSpending(2));
});

test('block selection is never shorter than five edge half-lives', () => {
  const result = chooseBlockLength({ values: [1, -1, 1, -1, 1, -1], times: [0, 1_000, 2_000, 3_000, 4_000, 5_000],
    edgeHalfLifeMs: 2_000 });
  assert.ok(result.blockLengthMs >= 10_000);
  assert.ok(result.blockLengthSamples >= 10);
});

test('deterministic block bootstrap does not manufacture uncertainty for a constant edge', () => {
  assert.equal(blockBootstrapLowerBound(Array(100).fill(4), 5, alphaSpending(1)), 4);
});
