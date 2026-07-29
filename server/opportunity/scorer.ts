import type { MarketSnapshot, FundingSnapshot, ScoreTerm, ScanRecord, Pool } from './types.js';

// OpportunityScorer. Two rules, structurally enforced:
//
//  1. Each pool is scored SEPARATELY. There is no blended "AI score" — a single
//     number across pools would be the indicator-as-strategy failure in disguise.
//  2. Only NORMALIZED terms may be summed. Raw values keep their units for audit
//     but never enter the sum. This is what makes `funding_apr + liquidity` safe:
//     both are percentiles in [0,1] by the time they meet. (2026-07-08 units bug.)

function percentile(value: number | null, batch: number[]): number {
  if (value == null || batch.length === 0) return 0;
  const atOrBelow = batch.filter((x) => x <= value).length;
  return atOrBelow / batch.length;
}

// The only summation permitted anywhere in the scanner.
function compositeScore(terms: ScoreTerm[]): number {
  return terms.reduce((sum, term) => sum + term.normalized, 0);
}

function baseRecord(symbol: string, pool: Pool, terms: ScoreTerm[]): ScanRecord {
  return {
    t: Date.now(),
    symbol,
    pool,
    terms,
    score: compositeScore(terms),
    decision: 'candidate',
    reason: 'scored',
    blockedBy: [],
    // Carry legs span two venues → operator-only ceiling, per funding-basis-v2.
    allowedFor: pool === 'funding_basis'
      ? ['paper_forward', 'operator_live_only']
      : ['paper_forward'],
  };
}

// Energy/liquidity is a TRADABILITY score, not an edge. A high score means
// "worth considering", never "likely to go up".
//
// A symbol with no recorded history DECLINES (INSUFFICIENT_HISTORY). It is not
// scored as zero: absence of history is not evidence of low volatility, and a
// coin that just entered the universe has none by definition.
export function scoreEnergyLiquidity(snaps: MarketSnapshot[]): ScanRecord[] {
  const withHistory = snaps.filter((s) => s.realizedVol24h != null);
  const volumes = withHistory.map((s) => s.volume24h);
  const atrs = withHistory.map((s) => s.atrPercent);
  const rvols = withHistory.map((s) => s.realizedVol24h as number);

  return snaps.map((s) => {
    if (s.realizedVol24h == null) {
      const rec = baseRecord(s.symbol, 'energy_liquidity', []);
      rec.decision = 'decline';
      rec.reason = 'INSUFFICIENT_HISTORY';
      rec.blockedBy = ['INSUFFICIENT_HISTORY'];
      return rec;
    }
    return baseRecord(s.symbol, 'energy_liquidity', [
      { name: 'liquidity', rawValue: s.volume24h, unit: 'USD', normalized: percentile(s.volume24h, volumes) },
      { name: 'range_atr', rawValue: s.atrPercent, unit: 'percent', normalized: percentile(s.atrPercent, atrs) },
      { name: 'realized_vol', rawValue: s.realizedVol24h, unit: 'percent/hour', normalized: percentile(s.realizedVol24h, rvols) },
    ]);
  });
}

// Funding/basis eligibility. Symbols with no captured funding DECLINE — they are
// not scored as zero, because absence of data is not evidence of low funding.
export function scoreFundingBasis(funds: FundingSnapshot[]): ScanRecord[] {
  // A record is usable only if BOTH funding and a comparable USD notional exist.
  // Absence of either is a DECLINE, never a zero score.
  const withData = funds.filter((f) => f.fundingApr != null && f.openInterestUsd != null);
  const aprs = withData.map((f) => f.fundingApr as number);
  const ois = withData.map((f) => f.openInterestUsd as number);

  return funds.map((f) => {
    if (f.fundingApr == null || f.openInterestUsd == null) {
      const rec = baseRecord(f.symbol, 'funding_basis', []);
      rec.decision = 'decline';
      rec.reason = 'NO_FUNDING_DATA';
      rec.blockedBy = ['NO_FUNDING_DATA'];
      return rec;
    }
    return baseRecord(f.symbol, 'funding_basis', [
      { name: 'funding_apr', rawValue: f.fundingApr, unit: 'percent', normalized: percentile(f.fundingApr, aprs) },
      { name: 'open_interest_usd', rawValue: f.openInterestUsd, unit: 'USD notional', normalized: percentile(f.openInterestUsd, ois) },
    ]);
  });
}
