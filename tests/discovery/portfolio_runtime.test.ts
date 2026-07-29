import assert from 'node:assert/strict';
import test from 'node:test';
import { constructTargetPortfolio, simulateTargetWeights } from '../../server/discovery/portfolio_runtime.js';
import type { PortfolioAssetInput } from '../../server/discovery/portfolio_types.js';

function asset(symbol: string, edge: number, phase: number, eligible = true): PortfolioAssetInput {
  return { symbol, lane: 'spot_crypto', expectedEdgeBps: edge,
    returnsBps: Array.from({ length: 180 }, (_, index) => Math.sin(index / 9 + phase) * 40 + Math.cos(index / 17) * 10),
    capacityUsd: 1_000_000, horizonBars: 6, eligible, blockers: eligible ? [] : ['VALIDATION_BLOCKED'],
    factorExposures: { market: 1, momentum: phase } };
}

test('portfolio construction uses shrunk and factor covariance, weights, scenarios, drawdown, and capacity gates', () => {
  const result = constructTargetPortfolio({ assets: [asset('A', 30, 0), asset('B', 20, 0.7), asset('C', 10, 1.4)],
    factorReturns: { market: Array.from({ length: 180 }, (_, index) => Math.sin(index / 9) * 30),
      momentum: Array.from({ length: 180 }, (_, index) => Math.cos(index / 13) * 20) },
    scenarios: [{ id: 'risk-off', name: 'Risk off', shocksBps: { A: -500, B: -400, C: -300 } }],
    portfolioNavUsd: 100_000, maxGrossExposure: 1, maxPositionWeight: 0.5, maximumTailLossBps: 600,
    remainingDrawdownBudgetBps: 600, allowShort: false });
  assert.equal(result.sampleCovariance.length, 3);
  assert.equal(result.shrunkCovariance.length, 3);
  assert.equal(result.factorCovariance.length, 3);
  assert.equal(result.combinedCovariance.length, 3);
  assert.ok(result.shrinkage >= 0.1 && result.shrinkage <= 0.9);
  assert.ok(Object.values(result.targetWeights).reduce((sum, weight) => sum + Math.abs(weight), 0) <= 1 + 1e-9);
  assert.ok(result.maximumCapacityUsd > 0);
  assert.equal(result.paperOnly, true);
  assert.equal(result.liveExecution, 'locked');
});

test('ineligible evidence blocks portfolio admission regardless of standalone edge', () => {
  const result = constructTargetPortfolio({ assets: [asset('A', 100, 0, false)], factorReturns: {}, scenarios: [],
    portfolioNavUsd: 100_000, maxGrossExposure: 1, maxPositionWeight: 1, maximumTailLossBps: 500,
    remainingDrawdownBudgetBps: 500, allowShort: false });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes('VALIDATION_BLOCKED'));
});

test('weight mode executes targets on the next bar and reconciles cash plus marked positions to NAV', () => {
  const result = simulateTargetWeights({ initialCash: 10_000,
    frames: [{ at: 0, prices: { A: 100, B: 50 } }, { at: 1, prices: { A: 101, B: 50 } },
      { at: 2, prices: { A: 110, B: 45 }, borrowBps: { B: 1 }, fundingBps: { A: 0.5 } }],
    instructions: [{ id: 'target', decidedAt: 0, weights: { A: 0.6, B: -0.2 } }], feeBps: 5, slippageBps: 2 });
  assert.equal(result.ledger[0].instructionId, null);
  assert.equal(result.ledger[1].instructionId, 'target');
  assert.ok(result.totalFeesUsd > 0);
  assert.ok(result.totalBorrowCostUsd > 0);
  assert.ok(result.totalFundingCostUsd > 0);
  assert.ok(result.finalNav !== result.initialCash);
  assert.ok(result.maximumInvariantErrorUsd < 1e-9);
  assert.equal(result.executionTiming, 'next_bar');
  assert.equal(result.liveExecution, 'locked');
});
