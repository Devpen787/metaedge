import { contentHash } from './store.js';
import type {
  OrderBar, OrderLedgerEntry, OrderSimulationResult, PaperFill, PaperOrder, PaperPosition,
} from './execution_types.js';

function validateOrder(order: PaperOrder): void {
  if (!(order.quantity > 0)) throw new Error(`ORDER_QUANTITY_INVALID:${order.id}`);
  if (!(order.participationRate > 0 && order.participationRate <= 1)) throw new Error(`ORDER_PARTICIPATION_INVALID:${order.id}`);
  if (!Number.isInteger(order.timeInForceBars) || order.timeInForceBars < 1) throw new Error(`ORDER_TIF_INVALID:${order.id}`);
  if ((order.type === 'limit' || order.type === 'stop_limit') && !(Number(order.limitPrice) > 0)) throw new Error(`ORDER_LIMIT_MISSING:${order.id}`);
  if ((order.type === 'stop' || order.type === 'stop_limit') && !(Number(order.stopPrice) > 0)) throw new Error(`ORDER_STOP_MISSING:${order.id}`);
}

function candidatePrice(order: PaperOrder, bar: OrderBar, slippageBps: number): number | null {
  const side = order.side === 'buy' ? 1 : -1;
  if (order.type === 'market') return bar.open * (1 + side * slippageBps / 10_000);
  if (order.type === 'limit') {
    if (order.side === 'buy' && bar.low <= Number(order.limitPrice)) return Math.min(bar.open, Number(order.limitPrice));
    if (order.side === 'sell' && bar.high >= Number(order.limitPrice)) return Math.max(bar.open, Number(order.limitPrice));
    return null;
  }
  if (order.type === 'stop') {
    if (order.side === 'buy' && bar.high >= Number(order.stopPrice)) return Math.max(bar.open, Number(order.stopPrice)) * (1 + slippageBps / 10_000);
    if (order.side === 'sell' && bar.low <= Number(order.stopPrice)) return Math.min(bar.open, Number(order.stopPrice)) * (1 - slippageBps / 10_000);
    return null;
  }
  // Conservative OHLC convention: the stop is considered triggered before the
  // limit is checked. A same-bar fill occurs only if both levels were tradable,
  // and uses the limit rather than a favorable intrabar path.
  if (order.side === 'buy' && bar.high >= Number(order.stopPrice) && bar.low <= Number(order.limitPrice)) return Number(order.limitPrice);
  if (order.side === 'sell' && bar.low <= Number(order.stopPrice) && bar.high >= Number(order.limitPrice)) return Number(order.limitPrice);
  return null;
}

function updatePosition(position: PaperPosition | undefined, signedQuantity: number, price: number): PaperPosition {
  const current = position ?? { quantity: 0, averageEntryPrice: 0, realizedPnlUsd: 0 };
  if (!current.quantity || Math.sign(current.quantity) === Math.sign(signedQuantity)) {
    const quantity = current.quantity + signedQuantity;
    const averageEntryPrice = quantity ? (Math.abs(current.quantity) * current.averageEntryPrice
      + Math.abs(signedQuantity) * price) / Math.abs(quantity) : 0;
    return { quantity, averageEntryPrice, realizedPnlUsd: current.realizedPnlUsd };
  }
  const closing = Math.min(Math.abs(current.quantity), Math.abs(signedQuantity));
  const realizedPnlUsd = current.realizedPnlUsd + closing * (price - current.averageEntryPrice) * Math.sign(current.quantity);
  const quantity = current.quantity + signedQuantity;
  return { quantity, averageEntryPrice: !quantity ? 0 : Math.sign(quantity) === Math.sign(current.quantity)
    ? current.averageEntryPrice : price, realizedPnlUsd };
}

export function simulateOrders(input: { initialCash: number; orders: PaperOrder[]; bars: OrderBar[];
  feeBps: number; slippageBps: number; maxGrossExposure: number; initialMarginRate: number;
  maintenanceMarginRate: number; allowShort: boolean }): OrderSimulationResult {
  if (!(input.initialCash > 0)) throw new Error('ORDER_SIM_INITIAL_CASH_INVALID');
  for (const order of input.orders) validateOrder(order);
  const bars = [...input.bars].sort((left, right) => left.openAt - right.openAt || left.symbol.localeCompare(right.symbol));
  const orders = [...input.orders].sort((left, right) => left.submittedAt - right.submittedAt || left.id.localeCompare(right.id));
  const positions = new Map<string, PaperPosition>(); const lastMarks = new Map<string, number>();
  const filled = new Map<string, number>(); const barsSeen = new Map<string, number>(); const rejected = new Map<string, string>();
  const fills: PaperFill[] = []; const ledger: OrderLedgerEntry[] = []; let cash = input.initialCash;
  for (const bar of bars) {
    if (![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite) || !(bar.open > 0 && bar.close > 0 && bar.volume >= 0)) {
      throw new Error(`ORDER_BAR_INVALID:${bar.symbol}:${bar.openAt}`);
    }
    lastMarks.set(bar.symbol, bar.open);
    const existingPosition = positions.get(bar.symbol);
    const borrowCostUsd = existingPosition && existingPosition.quantity < 0
      ? Math.abs(existingPosition.quantity * bar.open) * (bar.borrowBps ?? 0) / 10_000 : 0;
    const fundingCostUsd = existingPosition ? existingPosition.quantity * bar.open * (bar.fundingBps ?? 0) / 10_000 : 0;
    cash -= borrowCostUsd + fundingCostUsd;
    let feesUsd = 0; const riskEvents: string[] = [];
    for (const order of orders.filter((item) => item.symbol === bar.symbol && item.submittedAt < bar.openAt
      && !rejected.has(item.id) && (filled.get(item.id) ?? 0) < item.quantity)) {
      const seen = (barsSeen.get(order.id) ?? 0) + 1; barsSeen.set(order.id, seen);
      if (seen > order.timeInForceBars) continue;
      const price = candidatePrice(order, bar, input.slippageBps); if (price == null) continue;
      const remaining = order.quantity - (filled.get(order.id) ?? 0);
      const quantity = Math.min(remaining, bar.volume * order.participationRate);
      if (!(quantity > 0)) continue;
      const signedQuantity = order.side === 'buy' ? quantity : -quantity;
      const current = positions.get(order.symbol) ?? { quantity: 0, averageEntryPrice: 0, realizedPnlUsd: 0 };
      if (!input.allowShort && current.quantity + signedQuantity < -1e-9) {
        rejected.set(order.id, 'SHORT_NOT_ALLOWED'); riskEvents.push(`SHORT_NOT_ALLOWED:${order.id}`); continue;
      }
      if (order.reduceOnly && Math.abs(current.quantity + signedQuantity) > Math.abs(current.quantity)) {
        rejected.set(order.id, 'REDUCE_ONLY_WOULD_INCREASE_POSITION'); riskEvents.push(`REDUCE_ONLY:${order.id}`); continue;
      }
      const marks = new Map(lastMarks); marks.set(order.symbol, price);
      const proposed = new Map(positions); proposed.set(order.symbol, updatePosition(current, signedQuantity, price));
      const markedValue = [...proposed.entries()].reduce((sum, [symbol, position]) => sum + position.quantity * (marks.get(symbol) ?? 0), 0);
      const currentNav = cash + [...positions.entries()].reduce((sum, [symbol, position]) =>
        sum + position.quantity * (marks.get(symbol) ?? 0), 0);
      const gross = [...proposed.entries()].reduce((sum, [symbol, position]) =>
        sum + Math.abs(position.quantity * (marks.get(symbol) ?? 0)), 0);
      if (gross > Math.max(0, currentNav) * input.maxGrossExposure + 1e-6) {
        rejected.set(order.id, 'PRE_TRADE_GROSS_EXPOSURE_LIMIT'); riskEvents.push(`GROSS_LIMIT:${order.id}`); continue;
      }
      const feeUsd = quantity * price * input.feeBps / 10_000;
      cash -= signedQuantity * price + feeUsd; positions.set(order.symbol, proposed.get(order.symbol) as PaperPosition);
      const filledQuantity = (filled.get(order.id) ?? 0) + quantity; filled.set(order.id, filledQuantity); feesUsd += feeUsd;
      const reference = order.type === 'market' ? bar.open : order.type === 'limit' || order.type === 'stop_limit'
        ? Number(order.limitPrice) : Number(order.stopPrice);
      const slippageUsd = (price - reference) * signedQuantity;
      const fillIdentity = { orderId: order.id, filledAt: bar.openAt, quantity, price, priorFilled: filledQuantity - quantity };
      fills.push({ id: `paper_fill_${contentHash(fillIdentity).slice(0, 20)}`, orderId: order.id, symbol: order.symbol,
        side: order.side, filledAt: bar.openAt, quantity, price, feeUsd, slippageUsd,
        partial: filledQuantity < order.quantity, reason: order.type });
    }
    lastMarks.set(bar.symbol, bar.close);
    const markedPositionValue = [...positions.entries()].reduce((sum, [symbol, position]) =>
      sum + position.quantity * (lastMarks.get(symbol) ?? 0), 0);
    const grossExposureUsd = [...positions.entries()].reduce((sum, [symbol, position]) =>
      sum + Math.abs(position.quantity * (lastMarks.get(symbol) ?? 0)), 0);
    const nav = cash + markedPositionValue; const marginUsedUsd = grossExposureUsd * input.initialMarginRate;
    if (nav < grossExposureUsd * input.maintenanceMarginRate) riskEvents.push('MAINTENANCE_MARGIN_BREACH');
    const invariantErrorUsd = nav - (cash + markedPositionValue);
    ledger.push({ at: bar.closeAt, cash, positions: Object.fromEntries([...positions.entries()].sort()),
      markedPositionValue, nav, grossExposureUsd, marginUsedUsd, feesUsd, borrowCostUsd, fundingCostUsd,
      invariantErrorUsd, riskEvents });
  }
  const orderStatus: OrderSimulationResult['orderStatus'] = Object.fromEntries(orders.map((order) => {
    const filledQuantity = filled.get(order.id) ?? 0; const seen = barsSeen.get(order.id) ?? 0;
    const status: OrderSimulationResult['orderStatus'][string]['status'] = rejected.has(order.id) ? 'rejected' : filledQuantity >= order.quantity - 1e-9 ? 'filled'
      : filledQuantity > 0 ? 'partial' : 'expired';
    const reason = rejected.get(order.id) ?? (status === 'expired' && seen < 1 ? 'NO_LATER_BAR' : status.toUpperCase());
    return [order.id, { submittedQuantity: order.quantity, filledQuantity, status, reason }];
  }));
  const totalFeesUsd = fills.reduce((sum, fill) => sum + fill.feeUsd, 0);
  const totalBorrowCostUsd = ledger.reduce((sum, row) => sum + row.borrowCostUsd, 0);
  const totalFundingCostUsd = ledger.reduce((sum, row) => sum + row.fundingCostUsd, 0);
  const maximumInvariantErrorUsd = Math.max(0, ...ledger.map((row) => Math.abs(row.invariantErrorUsd)));
  const finalNav = ledger.at(-1)?.nav ?? input.initialCash;
  const identity = { initialCash: input.initialCash, orderStatus, fillIds: fills.map((fill) => fill.id),
    finalNav, totalFeesUsd, totalBorrowCostUsd, totalFundingCostUsd };
  return { id: `order_sim_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, fills, ledger, orderStatus,
    finalNav, totalFeesUsd, totalBorrowCostUsd, totalFundingCostUsd, maximumInvariantErrorUsd,
    executionTiming: 'next_bar', sameBarPathPolicy: 'stop_before_limit', liveExecution: 'locked' };
}
