import assert from 'node:assert/strict';
import test from 'node:test';
import { runExecutionCohortStudy } from '../../server/discovery/execution_cohorts.js';
import type { ExecutionDecisionPoint } from '../../server/discovery/execution_cohort_types.js';

function decisions(count: number): ExecutionDecisionPoint[] {
  return Array.from({ length: count }, (_, index) => ({ id: `decision_${index}`, signalAt: index * 10,
    symbol: 'A', side: index % 2 ? 'sell' : 'buy', quantity: 1, referencePrice: 100,
    bars: [{ symbol: 'A', openAt: index * 10 + 1, closeAt: index * 10 + 2, open: 100, high: 101, low: 99, close: 100.5, volume: 100 },
      { symbol: 'A', openAt: index * 10 + 3, closeAt: index * 10 + 4, open: 100.5, high: 102, low: 99.5, close: 101, volume: 100 },
      { symbol: 'A', openAt: index * 10 + 5, closeAt: index * 10 + 6, open: 101, high: 103, low: 100, close: 102, volume: 100 }] }));
}

test('execution cohorts deterministically balance maker, taker, delayed, and no-trade outcomes with attribution', () => {
  const study = runExecutionCohortStudy({ decisions: decisions(120), sourceEvaluationIds: ['evaluation'], seed: 42,
    makerOffsetBps: 5, feeBps: 5, slippageBps: 3, participationRate: 0.1,
    minimumOutcomesPerCohort: 30, createdAt: 100 });
  assert.equal(study.status, 'sufficient');
  for (const cohort of ['maker', 'taker', 'delayed', 'no_trade'] as const) assert.equal(study.aggregates[cohort].assigned, 30);
  assert.equal(study.aggregates.no_trade.fills, 0);
  assert.ok(study.aggregates.maker.fills > 0);
  assert.ok(study.aggregates.taker.meanImpactBps != null);
  assert.ok(study.outcomes.every((row) => Number.isFinite(row.implementationShortfallBps)));
  assert.ok(study.outcomes.every((row) => row.liveExecution === 'locked'));
});

test('cohort study remains blocked without a numerically promoted forward evaluation', () => {
  const study = runExecutionCohortStudy({ decisions: [], sourceEvaluationIds: [], seed: 42,
    makerOffsetBps: 5, feeBps: 5, slippageBps: 3, participationRate: 0.1 });
  assert.equal(study.status, 'blocked');
  assert.ok(study.blockers.includes('NO_FORWARD_CANDIDATE_EVALUATIONS'));
  assert.ok(study.blockers.includes('NO_FORWARD_EXECUTION_DECISIONS'));
  assert.equal(study.liveExecution, 'locked');
});
