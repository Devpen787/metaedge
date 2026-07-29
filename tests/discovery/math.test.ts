import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { edgeStatistics, labelUpswing, netBenchmarkRelativeReturnBps } from '../../server/discovery/math.js';
import { momentumAttentionObservations } from '../../server/discovery/sources.js';
import type { PriceBar } from '../../server/discovery/types.js';

const fixture = JSON.parse(fs.readFileSync('tests/fixtures/opportunity_math_golden.json', 'utf8'));

test('TypeScript opportunity math matches independent golden vectors', () => {
  for (const c of fixture.netReturnCases) {
    const actual = netBenchmarkRelativeReturnBps(c.entry, c.exit, c.benchmarkEntry, c.benchmarkExit, c.roundTripCostBps);
    assert.ok(Math.abs(actual - c.expectedNetRelativeBps) <= fixture.tolerance, c.id);
  }
  for (const c of fixture.statisticsCases) {
    const actual = edgeStatistics(c.valuesBps, c.valuesBps.map(() => 'timeout'), c.alpha, c.trials);
    const mapping: Record<string, keyof typeof actual> = {
      n: 'n', mean: 'meanNetRelativeBps', sample_std: 'sampleStdBps', se: 'standardErrorBps',
      critical_z: 'oneSidedCriticalZ', lcb: 'edgeLowerConfidenceBps',
    };
    for (const [key, expected] of Object.entries(c.expected)) {
      const got = actual[mapping[key]] as number | null;
      if (expected == null) assert.equal(got, null, `${c.id}:${key}`);
      else assert.ok(got != null && Math.abs(got - Number(expected)) <= fixture.tolerance, `${c.id}:${key} got ${got}`);
    }
  }
});

function bars(closes: number[]): PriceBar[] {
  return closes.map((c, i) => ({ t: i * 3_600_000, o: c, h: c, l: c, c, v: 1_000_000 }));
}

test('barrier labeling is cost-aware, benchmark-relative, and conservative about incomplete horizons', () => {
  const upper = labelUpswing(bars([100, 102, 104]), bars([100, 100, 100]), 0,
    { horizonBars: 2, upperBarrierBps: 300, lowerBarrierBps: -200, roundTripCostBps: 20 });
  assert.equal(upper.outcome, 'upper');
  assert.equal(upper.barsObserved, 2);
  const unresolved = labelUpswing(bars([100, 101]), bars([100, 100]), 0,
    { horizonBars: 3, upperBarrierBps: 300, lowerBarrierBps: -200, roundTripCostBps: 20 });
  assert.equal(unresolved.outcome, 'unresolved');
});

test('cost and multiple-testing stress can only reduce the lower confidence edge', () => {
  const outcomes = ['upper', 'upper', 'timeout', 'upper', 'lower'] as const;
  const base = edgeStatistics([100, 120, 80, 110, 90], [...outcomes], 0.05, 1);
  const trials = edgeStatistics([100, 120, 80, 110, 90], [...outcomes], 0.05, 20);
  const costStress = edgeStatistics([80, 100, 60, 90, 70], [...outcomes], 0.05, 1);
  assert.ok((trials.edgeLowerConfidenceBps ?? Infinity) < (base.edgeLowerConfidenceBps ?? -Infinity));
  assert.ok((costStress.edgeLowerConfidenceBps ?? Infinity) < (base.edgeLowerConfidenceBps ?? -Infinity));
});

test('a persistent qualifying condition emits once rather than pseudo-replicating every bar', () => {
  const series = Array.from({ length: 80 }, (_, i) => {
    const c = i < 48 ? 100 : 100 + (i - 47) * 2;
    return { t: i * 3_600_000, o: c, h: c, l: c, c, v: i < 48 ? 100 : 300, qv: (i < 48 ? 100 : 300) * c, trades: i < 48 ? 10 : 30 };
  });
  const observations = momentumAttentionObservations('crypto', 'TEST', 'BTC', series,
    { provider: 'fixture', dataset: 'bars', sourcePath: 'fixture', observedAt: series.at(-1)!.t, retrievedAt: 0, pointInTime: true },
    24, 100, 1.2);
  assert.equal(observations.length, 1);
});
