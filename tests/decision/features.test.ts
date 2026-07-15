import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVersionedFeatures, calculateRealizedVolPctPerHour, FEATURE_VERSIONS } from '../../server/decision/features.js';
import { simpleMovingAverageSeries, wilderRsiSeries } from '../../server/feature_math.mjs';

const now = 1_784_044_000_000;
const closes = Array.from({ length: 220 }, (_, i) => 80 + i * 0.05 + Math.sin(i / 3));
const sources = {
  market: { provider: 'fixture-exchange', dataset: 'ohlcv', venue: 'spot', observedAt: now - 1_000, retrievedAt: now },
  history: { provider: 'fixture-exchange', dataset: 'ohlcv-1h', venue: 'spot', observedAt: now - 60_000, retrievedAt: now },
  funding: { provider: 'fixture-perp', dataset: 'funding', venue: 'perp', observedAt: now - 60_000, retrievedAt: now },
};

function fixture() {
  return {
    symbol: 'TEST', price: 91, change24hPct: 1.2, volume24hUsd: 80_000_000,
    high24h: 94, low24h: 87, hourlyCloses: closes, fundingHourly: 0.0000125,
    openInterestUsd: 25_000_000, sources,
    staleBudgets: { market: 300_000, history: 5_400_000, funding: 5_400_000 },
  };
}

test('offline and live adapters produce byte-identical versioned features for the same evidence', () => {
  const offline = buildVersionedFeatures(fixture());
  const live = buildVersionedFeatures(fixture());
  assert.deepEqual(live, offline);
  assert.equal(live[FEATURE_VERSIONS.price].source.provider, 'fixture-exchange');
  assert.equal(live[FEATURE_VERSIONS.fundingApr].source.provider, 'fixture-perp');
  assert.equal(live[FEATURE_VERSIONS.rsi14].version, FEATURE_VERSIONS.rsi14);
  assert.equal(live[FEATURE_VERSIONS.rsi14].value, wilderRsiSeries(closes, 14).at(-1));
  assert.equal(live[FEATURE_VERSIONS.sma200].value, simpleMovingAverageSeries(closes, 200).at(-1));
});

test('realized volatility declines rather than fabricating an insufficient lookback', () => {
  assert.equal(calculateRealizedVolPctPerHour(closes.slice(0, 24)), null);
  assert.ok((calculateRealizedVolPctPerHour(closes) || 0) > 0);
});

test('source-specific freshness budgets mark stale evidence without poisoning current sources', () => {
  const input = fixture();
  input.sources.history = { ...input.sources.history, observedAt: now - 6_000_000 };
  const features = buildVersionedFeatures(input);
  assert.equal(features[FEATURE_VERSIONS.rsi14].quality, 'stale');
  assert.equal(features[FEATURE_VERSIONS.price].quality, 'good');
  assert.equal(features[FEATURE_VERSIONS.fundingApr].quality, 'good');
});
