// BROAD FEED — live price + 24h volume for the WHOLE USDT universe (~2-3k coins), so the
// runtime and Risk-OS are no longer blind to the long-tail tokens the Volume-Confirmed Golden
// Cross trades. serverPrices covers only 11 majors; this fills in everything else.
//
// It is ONE bulk-ticker request per venue per refresh (Binance /ticker/24hr returns ~700 USDT
// pairs, Gate /spot/tickers returns ~2000, each in a single call) — not thousands of requests.
// So watching the whole universe is a light poll, decoupled from the decision engine, vCPU-safe.
//
// Keyed by BASE asset (uppercase). getSpotPrice() falls back here for non-major symbols.
import { createMarketObservationV5 } from './market_data_v5.js';
import type { MarketObservationV5 } from '../src/types';

const BROAD_FEED_MS = Math.max(10_000, Number(process.env.BROAD_FEED_MS) || 30_000);

export type BroadTickV5 = {
  price: number;
  vol24hUsd: number;
  venue: string;
  ts: number;
  observation: MarketObservationV5;
};
const feed = new Map<string, BroadTickV5>();
let lastRefreshAt = 0;

async function getJson(url: string): Promise<unknown> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// Merge a venue's tickers in, keeping whichever venue reports the deeper 24h volume for a base.
function upsert(base: string, price: number, vol24hUsd: number, venue: string, ts: number) {
  if (!base || !(price > 0)) return;
  const prev = feed.get(base);
  if (!prev || vol24hUsd >= prev.vol24hUsd) {
    feed.set(base, {
      price,
      vol24hUsd,
      venue,
      ts,
      observation: createMarketObservationV5({
        symbol: base,
        price,
        volume24hUsd: vol24hUsd,
        provider: venue,
        venue,
        dataset: 'spot_ticker_24h',
        observedAt: ts,
        receivedAt: ts,
      }),
    });
  }
}

export async function refreshBroadFeed(): Promise<{ symbols: number; venues: string[] }> {
  const ts = Date.now();
  const venues: string[] = [];
  const [bin, gate] = await Promise.all([
    getJson('https://api.binance.com/api/v3/ticker/24hr'),         // ~700 USDT pairs, one call
    getJson('https://api.gateio.ws/api/v4/spot/tickers'),          // ~2000 USDT pairs, one call
  ]);
  if (Array.isArray(bin)) {
    venues.push('binance');
    for (const t of bin as any[]) { const s = String(t.symbol || ''); if (s.endsWith('USDT')) upsert(s.slice(0, -4), Number(t.lastPrice), Number(t.quoteVolume), 'binance', ts); }
  }
  if (Array.isArray(gate)) {
    venues.push('gate');
    for (const t of gate as any[]) { const p = String(t.currency_pair || ''); if (p.endsWith('_USDT')) upsert(p.slice(0, -5), Number(t.last), Number(t.quote_volume), 'gate', ts); }
  }
  if (venues.length) lastRefreshAt = ts;
  return { symbols: feed.size, venues };
}

// Live price + 24h USD volume for a base asset (uppercase), or null if the feed hasn't seen it.
export function getBroadTick(base: string): BroadTickV5 | null {
  return feed.get((base || '').toUpperCase()) || null;
}
export function getBroadObservation(base: string): MarketObservationV5 | null {
  return getBroadTick(base)?.observation || null;
}
export function getBroadPrice(base: string): number | null {
  const t = getBroadTick(base);
  return t ? t.price : null;
}
// All base assets the feed currently knows (for the golden-cross scanner to iterate).
export function listBroadSymbols(): string[] { return [...feed.keys()]; }
export function broadFeedState() {
  return { symbols: feed.size, lastRefreshAt, ageSec: lastRefreshAt ? Math.round((Date.now() - lastRefreshAt) / 1000) : null, stale: !lastRefreshAt || Date.now() - lastRefreshAt > BROAD_FEED_MS * 3 };
}

// Test hook: injects the same provenance-bearing object produced by venue
// refreshes without making a network request.
export function __setBroadTickForTest(
  base: string,
  price: number,
  vol24hUsd: number,
  venue: string,
  observedAt: number,
): void {
  upsert(base.toUpperCase(), price, vol24hUsd, venue, observedAt);
}

export function startBroadFeed() {
  if (process.env.BROAD_FEED_DISABLED === 'true') { console.log('[broad-feed] disabled via BROAD_FEED_DISABLED'); return; }
  refreshBroadFeed().then((r) => console.log(`[broad-feed] armed — ${r.symbols} symbols from ${r.venues.join('+')}, refresh every ${Math.round(BROAD_FEED_MS / 1000)}s`)).catch(() => {});
  setInterval(() => { refreshBroadFeed().catch((e) => console.warn('[broad-feed] refresh failed:', e?.message)); }, BROAD_FEED_MS).unref();
}
