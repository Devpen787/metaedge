import { fundingAprPercent } from '../units.mjs';
import { realizedVolPctPerHour, simpleMovingAverageSeries, wilderRsiSeries } from '../feature_math.mjs';
import type { FeatureQuality, FeatureSource, VersionedFeature } from './types.js';

export const FEATURE_VERSIONS = {
  price: 'price.v1',
  change24h: 'change_24h_pct.v1',
  volume24h: 'volume_24h_usd.v1',
  rangeAtr: 'range_atr_pct.v1',
  realizedVol: 'realized_vol_pct_per_hour.v1',
  fundingApr: 'funding_apr_pct.v1',
  openInterest: 'open_interest_usd.v1',
  rsi14: 'rsi_wilder_14.v1',
  sma200: 'sma_200.v1',
} as const;

export interface FeatureInput {
  symbol: string;
  price: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  high24h: number | null;
  low24h: number | null;
  hourlyCloses: number[];
  fundingHourly: number | null;
  openInterestUsd: number | null;
  sources: {
    market: FeatureSource;
    history: FeatureSource;
    funding: FeatureSource;
  };
  staleBudgets: { market: number; history: number; funding: number };
  // Historical replay may supply values computed once over the same causal
  // prefix. This keeps offline evaluation linear without changing the feature
  // ids, units, quality, or source contract used online.
  precomputed?: { realizedVolPctPerHour?: number | null; rsi14?: number | null; sma200?: number | null };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function quality(value: unknown, observedAt: number, retrievedAt: number, staleBudgetMs: number): FeatureQuality {
  if (value == null) return 'missing';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'invalid';
  if (retrievedAt - observedAt > staleBudgetMs) return 'stale';
  return 'good';
}

function feature(
  id: string,
  value: VersionedFeature['value'],
  unit: string,
  source: FeatureSource,
  staleBudgetMs: number,
): VersionedFeature {
  return { id, version: id, value, unit, quality: quality(value, source.observedAt, source.retrievedAt, staleBudgetMs), source };
}

export function calculateRangeAtrPercent(price: number | null, high: number | null, low: number | null): number | null {
  if (!finite(price) || price <= 0 || !finite(high) || !finite(low) || high < low) return null;
  return ((high - low) / price) * 100;
}

export function calculateRealizedVolPctPerHour(closes: number[]): number | null {
  const clean = closes.filter((x) => finite(x) && x > 0);
  return realizedVolPctPerHour(clean);
}

export function calculateWilderRsi(closes: number[], period = 14): number | null {
  const clean = closes.filter((x) => finite(x) && x > 0);
  return wilderRsiSeries(clean, period).at(-1) ?? null;
}

export function calculateSimpleMovingAverage(closes: number[], period: number): number | null {
  const clean = closes.filter((x) => finite(x) && x > 0);
  return simpleMovingAverageSeries(clean, period).at(-1) ?? null;
}

export function buildVersionedFeatures(input: FeatureInput): Record<string, VersionedFeature> {
  const values: Array<[string, VersionedFeature['value'], string, FeatureSource, number]> = [
    [FEATURE_VERSIONS.price, input.price, 'USD', input.sources.market, input.staleBudgets.market],
    [FEATURE_VERSIONS.change24h, input.change24hPct, 'percent', input.sources.market, input.staleBudgets.market],
    [FEATURE_VERSIONS.volume24h, input.volume24hUsd, 'USD', input.sources.market, input.staleBudgets.market],
    [FEATURE_VERSIONS.rangeAtr, calculateRangeAtrPercent(input.price, input.high24h, input.low24h), 'percent', input.sources.market, input.staleBudgets.market],
    [FEATURE_VERSIONS.realizedVol, input.precomputed?.realizedVolPctPerHour ?? calculateRealizedVolPctPerHour(input.hourlyCloses), 'percent/hour', input.sources.history, input.staleBudgets.history],
    [FEATURE_VERSIONS.fundingApr, input.fundingHourly == null ? null : fundingAprPercent(input.fundingHourly), 'percent APR', input.sources.funding, input.staleBudgets.funding],
    [FEATURE_VERSIONS.openInterest, input.openInterestUsd, 'USD notional', input.sources.funding, input.staleBudgets.funding],
    [FEATURE_VERSIONS.rsi14, input.precomputed?.rsi14 ?? calculateWilderRsi(input.hourlyCloses, 14), 'index', input.sources.history, input.staleBudgets.history],
    [FEATURE_VERSIONS.sma200, input.precomputed?.sma200 ?? calculateSimpleMovingAverage(input.hourlyCloses, 200), 'USD', input.sources.history, input.staleBudgets.history],
  ];
  return Object.fromEntries(values.map(([id, value, unit, source, staleBudget]) => [id, feature(id, value, unit, source, staleBudget)]));
}
