import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateOrders } from '../../server/discovery/order_runtime.js';
import type { OrderBar, PaperOrder } from '../../server/discovery/execution_types.js';

function order(overrides: Partial<PaperOrder> = {}): PaperOrder {
  return { id: 'order', submittedAt: 0, symbol: 'A', side: 'buy', quantity: 10, type: 'market',
    participationRate: 1, timeInForceBars: 3, reduceOnly: false, ...overrides };
}
function bar(openAt: number, overrides: Partial<OrderBar> = {}): OrderBar {
  return { symbol: 'A', openAt, closeAt: openAt + 1, open: 100, high: 105, low: 95, close: 102, volume: 100,
    ...overrides };
}

test('order mode enforces next-bar timing, fill-level fees/slippage, positions, cash, and NAV identity', () => {
  const result = simulateOrders({ initialCash: 10_000, orders: [order()], bars: [bar(0), bar(1)],
    feeBps: 5, slippageBps: 10, maxGrossExposure: 1, initialMarginRate: 0.5,
    maintenanceMarginRate: 0.25, allowShort: false });
  assert.equal(result.fills.length, 1);
  assert.equal(result.fills[0].filledAt, 1);
  assert.ok(result.fills[0].price > 100);
  assert.ok(result.totalFeesUsd > 0);
  assert.equal(result.orderStatus.order.status, 'filled');
  assert.ok(result.maximumInvariantErrorUsd < 1e-9);
  assert.equal(result.executionTiming, 'next_bar');
  assert.equal(result.liveExecution, 'locked');
});

test('volume participation creates explicit partial fills across bars', () => {
  const result = simulateOrders({ initialCash: 10_000,
    orders: [order({ quantity: 12, type: 'limit', limitPrice: 100, participationRate: 0.5 })],
    bars: [bar(1, { volume: 10 }), bar(2, { volume: 10 }), bar(3, { volume: 10 })], feeBps: 0, slippageBps: 0,
    maxGrossExposure: 1, initialMarginRate: 0.5, maintenanceMarginRate: 0.25, allowShort: false });
  assert.deepEqual(result.fills.map((fill) => fill.quantity), [5, 5, 2]);
  assert.equal(result.fills[0].partial, true);
  assert.equal(result.fills.at(-1)?.partial, false);
  assert.equal(result.orderStatus.order.status, 'filled');
});

test('stop-limit uses conservative stop-before-limit semantics and cannot choose a favorable OHLC path', () => {
  const result = simulateOrders({ initialCash: 10_000,
    orders: [order({ type: 'stop_limit', stopPrice: 103, limitPrice: 104 })], bars: [bar(1, { high: 106, low: 99 })],
    feeBps: 0, slippageBps: 0, maxGrossExposure: 1, initialMarginRate: 0.5,
    maintenanceMarginRate: 0.25, allowShort: false });
  assert.equal(result.fills[0].price, 104);
  assert.equal(result.sameBarPathPolicy, 'stop_before_limit');
});

test('fill-time risk rejects unauthorized shorts and accounts borrow/funding for allowed positions', () => {
  const rejected = simulateOrders({ initialCash: 10_000, orders: [order({ side: 'sell', quantity: 20 })], bars: [bar(1)],
    feeBps: 0, slippageBps: 0, maxGrossExposure: 1, initialMarginRate: 0.5,
    maintenanceMarginRate: 0.25, allowShort: false });
  assert.equal(rejected.orderStatus.order.status, 'rejected');
  assert.equal(rejected.orderStatus.order.reason, 'SHORT_NOT_ALLOWED');
  const allowed = simulateOrders({ initialCash: 10_000, orders: [order({ side: 'sell', quantity: 20 })],
    bars: [bar(1), bar(2, { borrowBps: 2, fundingBps: -1 })], feeBps: 0, slippageBps: 0,
    maxGrossExposure: 1, initialMarginRate: 0.5, maintenanceMarginRate: 0.25, allowShort: true });
  assert.ok(allowed.totalBorrowCostUsd > 0);
  assert.ok(allowed.totalFundingCostUsd > 0);
  assert.ok(allowed.maximumInvariantErrorUsd < 1e-9);
});
