export type PaperOrderType = 'market' | 'limit' | 'stop' | 'stop_limit';

export interface PaperOrder {
  id: string;
  submittedAt: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  type: PaperOrderType;
  limitPrice?: number;
  stopPrice?: number;
  participationRate: number;
  timeInForceBars: number;
  reduceOnly: boolean;
}

export interface OrderBar {
  symbol: string;
  openAt: number;
  closeAt: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fundingBps?: number;
  borrowBps?: number;
}

export interface PaperFill {
  id: string;
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  filledAt: number;
  quantity: number;
  price: number;
  feeUsd: number;
  slippageUsd: number;
  partial: boolean;
  reason: PaperOrderType;
}

export interface PaperPosition {
  quantity: number;
  averageEntryPrice: number;
  realizedPnlUsd: number;
}

export interface OrderLedgerEntry {
  at: number;
  cash: number;
  positions: Record<string, PaperPosition>;
  markedPositionValue: number;
  nav: number;
  grossExposureUsd: number;
  marginUsedUsd: number;
  feesUsd: number;
  borrowCostUsd: number;
  fundingCostUsd: number;
  invariantErrorUsd: number;
  riskEvents: string[];
}

export interface OrderSimulationResult {
  id: string;
  schemaVersion: 1;
  fills: PaperFill[];
  ledger: OrderLedgerEntry[];
  orderStatus: Record<string, { submittedQuantity: number; filledQuantity: number; status: 'filled' | 'partial' | 'expired' | 'rejected'; reason: string }>;
  finalNav: number;
  totalFeesUsd: number;
  totalBorrowCostUsd: number;
  totalFundingCostUsd: number;
  maximumInvariantErrorUsd: number;
  executionTiming: 'next_bar';
  sameBarPathPolicy: 'stop_before_limit';
  liveExecution: 'locked';
}
