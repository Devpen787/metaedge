import fs from 'fs';
import path from 'path';

// Research price/volume feed — DECOUPLED from `server/prices.ts`.
//
// server/prices.ts is the PRODUCT CATALOG: it carries name, description,
// marketCap and supply because the UI renders them. That coupling is why the
// research universe froze at 11 tokens — adding a coin for research meant
// writing marketing copy. A research universe needs price, volume and range.
// Nothing else. This module supplies exactly that, selected by the criterion in
// docs/data_requirements_and_contracts.md (metaedge-universe).

export const SCANNER_DIR = path.join(process.cwd(), 'data', 'edgeops', 'scanner');

export interface FeedRow {
  symbol: string;
  price: number;
  change24h: number; // percent
  volume24h: number; // USD
  high24h: number;
  low24h: number;
  marketCap: number; // USD
}

export interface FeedExclusion { symbol: string; reason: string; }
export interface ResearchFeed { t: number; included: FeedRow[]; excluded: FeedExclusion[]; stale?: boolean; }

const CACHE_FILE = path.join(SCANNER_DIR, 'universe-feed.json');
const CACHE_TTL_MS = 10 * 60 * 1000;

// Criterion constants — every one is evidence-derived (see the contract).
//
// FETCH_N is a FETCH BOUND, not a criterion. Membership is decided by the
// liquidity floor + quality filters below. An earlier draft used a top-40 rank
// cutoff and silently excluded DOT (rank 52, $67M volume) — our only directional
// survivor — for no reason other than an arbitrary round number. Rank cutoffs are
// the same unexamined-default failure as the 1h timeframe. One call still returns
// all 100 rows, so widening the bound costs nothing.
const FETCH_N = 100;
const VOLUME_FLOOR_USD = 50_000_000;
const WASH_VOL_MCAP_RATIO = 0.5;  // majors observed 0.01-0.13; SHEB 92,283
const STABLE_PRICE_BAND = 0.02;   // |price - 1|
const STABLE_RANGE_FRAC = 0.01;   // (high - low) / price

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

// Returns an exclusion reason, or null if the asset is eligible.
// Stablecoins are detected STRUCTURALLY (peg + no range), not by denylist — a
// hand-maintained list missed USDG on its first draft.
function excludeReason(r: FeedRow): string | null {
  if (!(r.price > 0) || !(r.high24h > 0) || !(r.low24h > 0) || !(r.marketCap > 0)) return 'BROKEN_FEED';
  const pegged = Math.abs(r.price - 1) < STABLE_PRICE_BAND;
  const flat = (r.high24h - r.low24h) / r.price < STABLE_RANGE_FRAC;
  if (pegged && flat) return 'STABLECOIN';
  if (r.volume24h / r.marketCap > WASH_VOL_MCAP_RATIO) return 'WASH_ADJACENT';
  if (r.volume24h < VOLUME_FLOOR_USD) return 'LIQUIDITY_FLOOR';
  return null;
}

function readCache(allowStale = false): ResearchFeed | null {
  try {
    const feed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as ResearchFeed;
    const stale = Date.now() - feed.t >= CACHE_TTL_MS;
    if (!stale || allowStale) return { ...feed, stale };
  } catch { /* no usable cache */ }
  return null;
}

// A stale cache may be used only to produce explicit STALE declines and runtime
// diagnostics. It is never silently treated as current membership.
export function readCachedResearchUniverse(): ResearchFeed | null {
  return readCache(true);
}

function writeCache(feed: ResearchFeed) {
  try {
    fs.mkdirSync(SCANNER_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(feed));
  } catch { /* cache is best-effort */ }
}

// One call returns the whole ranked set. Returns null on failure — callers must
// DECLINE rather than fall back to the product catalog (that would silently
// resurrect the convenience universe).
export async function fetchResearchUniverse(): Promise<ResearchFeed | null> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=${FETCH_N}&page=1&price_change_percentage=24h`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const rows = await res.json() as Record<string, unknown>[];
    if (!Array.isArray(rows)) return null;

    const included: FeedRow[] = [];
    const excluded: FeedExclusion[] = [];
    for (const raw of rows) {
      const row: FeedRow = {
        symbol: String(raw.symbol ?? '').toUpperCase(),
        price: num(raw.current_price),
        change24h: num(raw.price_change_percentage_24h),
        volume24h: num(raw.total_volume),
        high24h: num(raw.high_24h),
        low24h: num(raw.low_24h),
        marketCap: num(raw.market_cap),
      };
      if (!row.symbol) continue;
      const reason = excludeReason(row);
      if (reason) excluded.push({ symbol: row.symbol, reason });
      else included.push(row);
    }
    const feed: ResearchFeed = { t: Date.now(), included, excluded };
    writeCache(feed);
    return feed;
  } catch {
    return null;
  }
}
