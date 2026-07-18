export interface FastPerpUniverseMember {
  symbol: string;
  dayNotionalVolumeUsd: number;
  openInterest: number;
  markPrice: number;
}

export interface FastPerpSourceSession {
  id: string;
  schemaVersion: 1;
  venue: 'hyperliquid';
  sourceVersion: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'stopped';
  at: number;
  symbols: string[];
  reconnectAttempt: number;
  liveExecution: 'locked';
}

export interface FastPerpGap {
  id: string;
  schemaVersion: 1;
  venue: 'hyperliquid';
  sourceVersion: string;
  detectedAt: number;
  kind: 'transport' | 'malformed_message' | 'source_unavailable' | 'stale_stream';
  reason: string;
  symbol: string | null;
  rawHash: string | null;
  liveExecution: 'locked';
}

export interface FastPerpTradeEvent {
  id: string;
  schemaVersion: 1;
  venue: 'hyperliquid';
  sourceVersion: string;
  symbol: string;
  eventTime: number;
  receivedAt: number;
  tradeId: number | null;
  sourceHash: string | null;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  notionalUsd: number;
  liquidation: boolean | null;
  liveExecution: 'locked';
}

export interface FastPerpContextEvent {
  id: string;
  schemaVersion: 1;
  venue: 'hyperliquid';
  sourceVersion: string;
  symbol: string;
  eventTime: number;
  receivedAt: number;
  fundingRate: number;
  openInterest: number;
  markPrice: number;
  oraclePrice: number;
  premium: number | null;
  liveExecution: 'locked';
}

export interface FastPerpBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface FastPerpBookEvent {
  id: string;
  schemaVersion: 1;
  venue: 'hyperliquid';
  sourceVersion: string;
  symbol: string;
  eventTime: number;
  receivedAt: number;
  bids: FastPerpBookLevel[];
  asks: FastPerpBookLevel[];
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spreadBps: number;
  bidDepthUsd: number;
  askDepthUsd: number;
  imbalance: number;
  liveExecution: 'locked';
}

export interface FastPerpRecorderStatus {
  running: boolean;
  connected: boolean;
  symbols: string[];
  reconnectAttempt: number;
  lastMessageAt: number | null;
  startedAt: number | null;
  sourceVersion: string;
  liveExecution: 'locked';
}

export interface OperatorClockHealth {
  id: 'signal_evaluator' | 'outcome_resolver' | 'challenger_research' | 'lifecycle_evaluator';
  cadenceMs: number;
  ageMs: number | null;
  queueDepth: number | null;
  queueLagMs: number | null;
  fresh: boolean;
  bounded: boolean;
  status: 'healthy' | 'degraded' | 'paused' | 'missing';
}

export interface OperatorHealth {
  schemaVersion: 1;
  generatedAt: number;
  operational: boolean;
  status: 'operational' | 'degraded' | 'disabled';
  recorder: FastPerpRecorderStatus;
  eventAgeMs: number | null;
  queueLagMs: number | null;
  apiSummaryAgeMs: number | null;
  apiSummaryStale: boolean;
  diskGrowthBytesPerDay: number | null;
  contractChurn: number;
  unresolvedDecisions: number;
  unresolvedOutcomes: number;
  storageHealthy: boolean;
  clocks: OperatorClockHealth[];
  currentLiveLock: boolean;
  liveExecution: 'locked' | 'enabled';
}
