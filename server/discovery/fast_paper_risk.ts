import type { PaperTradeContract } from './economic_types.js';

export interface PaperPortfolioRiskState {
  aggregateOpenExposureUsd: number;
  symbolOpenExposureUsd: number;
  dailyNetPnlUsd: number;
  strategyDrawdownUsd: number;
  maximumPairwiseCorrelation: number | null;
  remainingCapacityUsd: number;
  killed: boolean;
}

export function evaluatePaperRiskReservation(input: { contract: PaperTradeContract; requestedNotionalUsd: number;
  state: PaperPortfolioRiskState; maximumDailyLossUsd?: number; maximumCorrelation?: number }): string[] {
  const { contract, state } = input; const requested = input.requestedNotionalUsd; const blockers: string[] = [];
  if (state.killed) blockers.push('CONTRACT_KILLED');
  if (!(requested > 0) || requested > contract.riskLimits.maximumPositionUsd
    || state.symbolOpenExposureUsd + requested > contract.riskLimits.maximumPositionUsd) blockers.push('POSITION_LIMIT');
  if (requested * contract.killRule.maximumForwardLossBps / 10_000 > contract.riskLimits.maximumLossPerTradeUsd) {
    blockers.push('MAXIMUM_LOSS_PER_TRADE_LIMIT');
  }
  if (state.aggregateOpenExposureUsd + requested > contract.riskLimits.maximumGrossExposureUsd) blockers.push('AGGREGATE_EXPOSURE_LIMIT');
  if (state.dailyNetPnlUsd <= -(input.maximumDailyLossUsd ?? contract.riskLimits.maximumStrategyDrawdownUsd)) {
    blockers.push('DAILY_LOSS_LIMIT');
  }
  if (state.strategyDrawdownUsd >= contract.riskLimits.maximumStrategyDrawdownUsd) blockers.push('STRATEGY_DRAWDOWN_LIMIT');
  if (state.maximumPairwiseCorrelation == null) blockers.push('CORRELATION_EVIDENCE_MISSING');
  else if (Math.abs(state.maximumPairwiseCorrelation) > (input.maximumCorrelation ?? 0.8)) blockers.push('CORRELATION_LIMIT');
  if (requested > state.remainingCapacityUsd || requested > contract.capacity.deployableUsd) blockers.push('CAPACITY_LIMIT');
  return [...new Set(blockers)].sort();
}
