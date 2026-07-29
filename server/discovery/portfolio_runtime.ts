import { contentHash } from './store.js';
import type {
  PortfolioAssetInput, PortfolioConstructionResult, PortfolioScenario, PriceFrame, TargetWeightInstruction,
  WeightLedgerEntry, WeightSimulationResult,
} from './portfolio_types.js';

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function covariance(left: number[], right: number[]): number {
  const count = Math.min(left.length, right.length); if (count < 2) return 0;
  const a = left.slice(-count); const b = right.slice(-count); const am = mean(a); const bm = mean(b);
  return a.reduce((sum, value, index) => sum + (value - am) * (b[index] - bm), 0) / (count - 1);
}
function matrixFor(series: number[][]): number[][] {
  return series.map((left) => series.map((right) => covariance(left, right)));
}
function solve(matrix: number[][], vector: number[]): number[] | null {
  const size = matrix.length; const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < size; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row++) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    if (Math.abs(augmented[pivot][pivot]) < 1e-9) augmented[pivot][pivot] += 1e-6;
    const scale = augmented[pivot][pivot]; if (Math.abs(scale) < 1e-12) return null;
    for (let column = pivot; column <= size; column++) augmented[pivot][column] /= scale;
    for (let row = 0; row < size; row++) if (row !== pivot) {
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column++) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[size]);
}

function factorCovariance(assets: PortfolioAssetInput[], factorReturns: Record<string, number[]>): number[][] {
  const factors = Object.keys(factorReturns).sort();
  if (!factors.length) return assets.map((_asset, i) => assets.map((_other, j) => i === j ? 1e-6 : 0));
  const factorMatrix = matrixFor(factors.map((factor) => factorReturns[factor]));
  return assets.map((asset) => assets.map((other) => {
    let value = 0;
    for (let i = 0; i < factors.length; i++) for (let j = 0; j < factors.length; j++) {
      value += (asset.factorExposures[factors[i]] ?? 0) * factorMatrix[i][j] * (other.factorExposures[factors[j]] ?? 0);
    }
    return value;
  }));
}

export function constructTargetPortfolio(input: { assets: PortfolioAssetInput[]; factorReturns: Record<string, number[]>;
  scenarios: PortfolioScenario[]; portfolioNavUsd: number; maxGrossExposure: number; maxPositionWeight: number;
  maximumTailLossBps: number; remainingDrawdownBudgetBps: number; allowShort: boolean }): PortfolioConstructionResult {
  const assets = [...input.assets].sort((left, right) => left.symbol.localeCompare(right.symbol));
  if (!assets.length) throw new Error('PORTFOLIO_ASSETS_EMPTY');
  const symbols = assets.map((asset) => asset.symbol);
  const sampleCovariance = matrixFor(assets.map((asset) => asset.returnsBps));
  const observations = Math.min(...assets.map((asset) => asset.returnsBps.length));
  const shrinkage = Math.max(0.1, Math.min(0.9, assets.length / Math.max(assets.length, observations)));
  const shrunkCovariance = sampleCovariance.map((row, i) => row.map((value, j) => i === j ? value : value * (1 - shrinkage)));
  const factors = factorCovariance(assets, input.factorReturns);
  const combinedCovariance = shrunkCovariance.map((row, i) => row.map((value, j) => 0.5 * value + 0.5 * factors[i][j]
    + (i === j ? 1e-6 : 0)));
  const raw = solve(combinedCovariance, assets.map((asset) => asset.expectedEdgeBps))
    ?? assets.map((asset, index) => asset.expectedEdgeBps / Math.max(1e-6, combinedCovariance[index][index]));
  const directional = raw.map((value) => input.allowShort ? value : Math.max(0, value));
  const gross = directional.reduce((sum, value) => sum + Math.abs(value), 0);
  const preliminary = directional.map((value) => gross > 0 ? value / gross * input.maxGrossExposure : 0);
  const weights = preliminary.map((weight, index) => {
    const capacityWeight = assets[index].capacityUsd / input.portfolioNavUsd;
    return Math.sign(weight) * Math.min(Math.abs(weight), input.maxPositionWeight, capacityWeight);
  });
  const targetWeights = Object.fromEntries(symbols.map((symbol, index) => [symbol, weights[index]]));
  const expectedPortfolioEdgeBps = weights.reduce((sum, weight, index) => sum + weight * assets[index].expectedEdgeBps, 0);
  const variance = weights.reduce((sum, left, i) => sum + weights.reduce((inner, right, j) =>
    inner + left * right * combinedCovariance[i][j], 0), 0);
  const expectedVolatilityBps = Math.sqrt(Math.max(0, variance));
  const scenarioPnlBps = input.scenarios.map((scenario) => ({ scenarioId: scenario.id,
    pnlBps: weights.reduce((sum, weight, index) => sum + weight * (scenario.shocksBps[symbols[index]] ?? 0), 0) }));
  const worstScenarioLossBps = Math.max(0, -Math.min(0, ...scenarioPnlBps.map((scenario) => scenario.pnlBps)));
  const maximumCapacityUsd = Math.min(...assets.map((asset, index) => Math.abs(weights[index]) > 1e-12
    ? asset.capacityUsd / Math.abs(weights[index]) : Infinity));
  const blockers = [...new Set(assets.flatMap((asset) => asset.eligible ? [] : asset.blockers))];
  if (assets.some((asset) => asset.returnsBps.length < 60)) blockers.push('COVARIANCE_HISTORY_BELOW_60');
  if (!(expectedPortfolioEdgeBps > 0)) blockers.push('EXPECTED_PORTFOLIO_EDGE_NOT_POSITIVE');
  if (worstScenarioLossBps > input.maximumTailLossBps) blockers.push('SCENARIO_TAIL_LIMIT_EXCEEDED');
  if (worstScenarioLossBps > input.remainingDrawdownBudgetBps) blockers.push('DRAWDOWN_BUDGET_EXCEEDED');
  if (weights.every((weight) => Math.abs(weight) < 1e-12)) blockers.push('TARGET_PORTFOLIO_EMPTY');
  const uniqueBlockers = [...new Set(blockers)].sort();
  const identity = { symbols, sampleCovariance, shrunkCovariance, factorCovariance: factors, combinedCovariance,
    shrinkage, targetWeights, scenarioPnlBps, blockers: uniqueBlockers };
  return { id: `target_portfolio_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, symbols,
    sampleCovariance, shrunkCovariance, factorCovariance: factors, combinedCovariance, shrinkage, targetWeights,
    cashWeight: 1 - weights.reduce((sum, value) => sum + value, 0), expectedPortfolioEdgeBps,
    expectedVolatilityBps, scenarioPnlBps, worstScenarioLossBps,
    maximumCapacityUsd: Number.isFinite(maximumCapacityUsd) ? maximumCapacityUsd : 0,
    allowed: uniqueBlockers.length === 0, blockers: uniqueBlockers, paperOnly: true, liveExecution: 'locked' };
}

export function simulateTargetWeights(input: { initialCash: number; frames: PriceFrame[];
  instructions: TargetWeightInstruction[]; feeBps: number; slippageBps: number }): WeightSimulationResult {
  if (!(input.initialCash > 0)) throw new Error('WEIGHT_SIM_INITIAL_CASH_INVALID');
  const frames = [...input.frames].sort((left, right) => left.at - right.at);
  const instructions = [...input.instructions].sort((left, right) => left.decidedAt - right.decidedAt);
  const applied = new Set<string>(); const positions = new Map<string, number>(); let cash = input.initialCash;
  const ledger: WeightLedgerEntry[] = [];
  for (const frame of frames) {
    let borrowCostUsd = 0; let fundingCostUsd = 0;
    for (const [symbol, quantity] of positions) {
      const price = frame.prices[symbol]; if (!(price > 0)) continue;
      if (quantity < 0) borrowCostUsd += Math.abs(quantity * price) * (frame.borrowBps?.[symbol] ?? 0) / 10_000;
      fundingCostUsd += quantity * price * (frame.fundingBps?.[symbol] ?? 0) / 10_000;
    }
    cash -= borrowCostUsd + fundingCostUsd;
    const due = instructions.filter((instruction) => instruction.decidedAt < frame.at && !applied.has(instruction.id)).at(-1);
    let turnoverUsd = 0; let feesUsd = 0; let instructionId: string | null = null;
    if (due) {
      const beforeTradePositionValue = [...positions.entries()].reduce((sum, [symbol, quantity]) =>
        sum + quantity * (frame.prices[symbol] ?? 0), 0);
      const beforeTradeNav = cash + beforeTradePositionValue;
      for (const [symbol, weight] of Object.entries(due.weights)) {
        const price = frame.prices[symbol]; if (!(price > 0)) throw new Error(`WEIGHT_SIM_PRICE_MISSING:${symbol}:${frame.at}`);
        const current = positions.get(symbol) ?? 0; const desired = beforeTradeNav * weight / price;
        const delta = desired - current; const executionPrice = price * (1 + Math.sign(delta) * input.slippageBps / 10_000);
        const notional = delta * executionPrice; const fee = Math.abs(notional) * input.feeBps / 10_000;
        cash -= notional + fee; positions.set(symbol, desired); turnoverUsd += Math.abs(notional); feesUsd += fee;
      }
      for (const instruction of instructions.filter((instruction) => instruction.decidedAt <= due.decidedAt)) applied.add(instruction.id);
      instructionId = due.id;
    }
    const markedPositionValue = [...positions.entries()].reduce((sum, [symbol, quantity]) =>
      sum + quantity * (frame.prices[symbol] ?? 0), 0);
    const nav = cash + markedPositionValue; const invariantErrorUsd = nav - (cash + markedPositionValue);
    ledger.push({ at: frame.at, instructionId, cash, positions: Object.fromEntries([...positions.entries()].sort()),
      markedPositionValue, nav, turnoverUsd, feesUsd, borrowCostUsd, fundingCostUsd, invariantErrorUsd });
  }
  const totalFeesUsd = ledger.reduce((sum, row) => sum + row.feesUsd, 0);
  const totalBorrowCostUsd = ledger.reduce((sum, row) => sum + row.borrowCostUsd, 0);
  const totalFundingCostUsd = ledger.reduce((sum, row) => sum + row.fundingCostUsd, 0);
  const finalNav = ledger.at(-1)?.nav ?? input.initialCash;
  const maximumInvariantErrorUsd = Math.max(0, ...ledger.map((row) => Math.abs(row.invariantErrorUsd)));
  const identity = { initialCash: input.initialCash, frames: frames.map((frame) => frame.at), instructions,
    ledger: ledger.map((row) => ({ at: row.at, nav: row.nav, positions: row.positions })) };
  return { id: `weight_sim_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, initialCash: input.initialCash,
    ledger, totalFeesUsd, totalBorrowCostUsd, totalFundingCostUsd, finalNav, maximumInvariantErrorUsd,
    executionTiming: 'next_bar', liveExecution: 'locked' };
}
