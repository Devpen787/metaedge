// Opportunity screener — shared types (read-only selection layer).
// Implements docs/edgeops/cards/opportunity-screener-v1.md. NO EXECUTION.

export type Tier = 0 | 1 | 2 | 3;
export type Pool = 'funding_basis' | 'energy_liquidity';

export interface UniverseMember {
  symbol: string;
  tier: Tier;
  included: boolean;
  reason: string;
}

export interface MarketSnapshot {
  t: number;
  symbol: string;
  price: number;
  change24h: number;             // percent
  volume24h: number;             // USD
  atrPercent: number;            // (hi24h - lo24h) / price * 100
  realizedVol24h: number | null; // percent/hour stdev of hourly log returns; null if insufficient history
  dataAgeS: number;              // seconds since source updated (0 = live tick)
}

export interface FundingSnapshot {
  t: number;
  symbol: string;
  fundingHourly: number | null;    // FRACTION (annualize ×24×365×100 before any % compare)
  fundingApr: number | null;       // PERCENT (derived)
  // Hyperliquid reports openInterest in BASE-COIN units, NOT USD. Comparing coin
  // counts across symbols is meaningless (38k BTC vs 5.3M SOL). Only the notional
  // (coin × markPx) is cross-symbol comparable, so that is the only field exposed.
  openInterestUsd: number | null;  // USD notional (derived: openInterest × markPx)
}

// A scored term. rawValue keeps its unit for audit; `normalized` in [0,1] is the
// ONLY field the scorer is allowed to sum (units-bug lesson).
export interface ScoreTerm {
  name: string;
  rawValue: number | null;
  unit: string;
  normalized: number; // [0,1] percentile within the current scan batch
}

export type ScanDecision = 'candidate' | 'decline';

export interface ScanRecord {
  t: number;
  symbol: string;
  pool: Pool;
  terms: ScoreTerm[];
  score: number;        // dimensionless sum of normalized terms
  decision: ScanDecision;
  reason: string;
  blockedBy: string[];
  allowedFor: string[]; // e.g. ['paper_forward','operator_live_only']
}

export interface ScanSummary {
  t: number;
  scanned: number;
  candidatesByPool: Record<string, number>;
  declinesByReason: Record<string, number>;
}
