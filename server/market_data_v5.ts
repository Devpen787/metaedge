import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from './storage.js';
import type {
  MarketCoverageEntryV5,
  MarketCoverageMatrixV5,
  MarketObservationV5,
  UniverseVersionV5,
} from '../src/types';

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function createMarketObservationV5(input: {
  symbol: string;
  price: number;
  change24hPct?: number | null;
  volume24hUsd?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  marketCapUsd?: number | null;
  provider: string;
  venue: string;
  dataset: string;
  observedAt: number;
  receivedAt: number;
  provenance?: MarketObservationV5['provenance'];
}): MarketObservationV5 {
  const payload = {
    authorityVersion: 5 as const,
    schema: 'market-observation.v5' as const,
    symbol: input.symbol.toUpperCase(),
    price: input.price,
    change24hPct: finiteOrNull(input.change24hPct),
    volume24hUsd: finiteOrNull(input.volume24hUsd),
    high24h: finiteOrNull(input.high24h),
    low24h: finiteOrNull(input.low24h),
    marketCapUsd: finiteOrNull(input.marketCapUsd),
    provider: input.provider,
    venue: input.venue,
    dataset: input.dataset,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt,
    provenance: input.provenance || 'observed',
  };
  return {
    ...payload,
    observationHash: digest(payload),
  };
}

export function verifyMarketObservationV5(observation: MarketObservationV5): boolean {
  if (observation.authorityVersion !== 5 || observation.schema !== 'market-observation.v5') return false;
  if (!(Number.isFinite(observation.price) && observation.price > 0)) return false;
  const rebuilt = createMarketObservationV5({
    symbol: observation.symbol,
    price: observation.price,
    change24hPct: observation.change24hPct,
    volume24hUsd: observation.volume24hUsd,
    high24h: observation.high24h,
    low24h: observation.low24h,
    marketCapUsd: observation.marketCapUsd,
    provider: observation.provider,
    venue: observation.venue,
    dataset: observation.dataset,
    observedAt: observation.observedAt,
    receivedAt: observation.receivedAt,
    provenance: observation.provenance,
  });
  return rebuilt.observationHash === observation.observationHash;
}

export function createUniverseVersionV5(
  symbols: string[],
  observedAt: number,
  source = 'coingecko.volume_desc',
  tier = 1,
): UniverseVersionV5 {
  const normalized = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort();
  const membershipHash = digest({ tier, symbols: normalized, source });
  return {
    authorityVersion: 5,
    schema: 'universe-version.v5',
    // Membership versions are content-addressed. Re-fetching unchanged
    // membership must not manufacture hundreds of nominal versions per day.
    universeId: `universe_v5_${membershipHash.slice(0, 24)}`,
    tier,
    symbols: normalized,
    source,
    observedAt,
    createdAt: Date.now(),
    membershipHash,
    gapPolicy: 'do_not_fill',
    crossVenuePolicy: 'preserve_and_flag',
  };
}

export function activateUniverseVersionV5(version: UniverseVersionV5): UniverseVersionV5 {
  const db = readDatabase();
  const market = (db.marketDataV5 ||= { universeVersions: {}, coverageHistory: [] });
  market.universeVersions[version.universeId] ||= version;
  market.activeUniverseId = version.universeId;
  writeDatabase(db, ['marketDataV5']);
  return market.universeVersions[version.universeId];
}

export function activeUniverseVersionV5(): UniverseVersionV5 | undefined {
  const market = readDatabase().marketDataV5;
  return market?.activeUniverseId ? market.universeVersions[market.activeUniverseId] : undefined;
}

export function coverageEntryV5(input: {
  strategyHash: string;
  pluginId: string;
  symbol: string;
  requiredFeatures: string[];
  features: Record<string, { quality: string } | undefined>;
}): MarketCoverageEntryV5 {
  const goodFeatures = input.requiredFeatures.filter((id) => input.features[id]?.quality === 'good');
  const unavailableFeatures = input.requiredFeatures.filter((id) => input.features[id]?.quality !== 'good');
  return {
    strategyHash: input.strategyHash,
    pluginId: input.pluginId,
    symbol: input.symbol,
    requiredFeatures: [...input.requiredFeatures],
    goodFeatures,
    unavailableFeatures,
    armed: unavailableFeatures.length === 0,
  };
}

export function persistCoverageMatrixV5(
  universeId: string,
  entries: MarketCoverageEntryV5[],
  evaluatedAt = Date.now(),
): MarketCoverageMatrixV5 {
  const ordered = [...entries].sort((left, right) =>
    `${left.strategyHash}:${left.symbol}`.localeCompare(`${right.strategyHash}:${right.symbol}`));
  const ready = ordered.filter((entry) => entry.armed).length;
  const payload = { universeId, evaluatedAt, entries: ordered, ready, total: ordered.length };
  const matrix: MarketCoverageMatrixV5 = {
    authorityVersion: 5,
    schema: 'market-coverage-matrix.v5',
    matrixId: `coverage_v5_${digest(payload).slice(0, 24)}`,
    ...payload,
    coveragePct: ordered.length ? Number(((ready / ordered.length) * 100).toFixed(2)) : 0,
  };
  const db = readDatabase();
  const market = (db.marketDataV5 ||= { universeVersions: {}, coverageHistory: [] });
  market.latestCoverage = matrix;
  const history = (market.coverageHistory ||= []);
  if (!history.some((item) => item.matrixId === matrix.matrixId)) history.push(matrix);
  if (history.length > 50) history.splice(0, history.length - 50);
  writeDatabase(db, ['marketDataV5']);
  return matrix;
}
