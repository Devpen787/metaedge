import fs from 'fs';
import path from 'path';

// Real exchange candles, on demand, for any symbol.
//
// WHY THIS EXISTS. We hand-rolled a price recorder that samples CoinGecko every
// 60s and reconstructs approximate hourly bars from those samples. That homemade
// feed had three weaknesses, and instead of fixing the feed we wrote rules to
// live with them:
//   - it only tracked the 11 coins the WEBSITE displays, so screened candidates
//     like ZEC and PAXG were invisible;
//   - it kept closes only, so any rule using highs/lows was inexpressible;
//   - it needed 200 hours of self-collected history before a 200-hour average
//     existed — a 7-day wait to relearn what the exchange already knows.
// Every one of those problems was self-inflicted. The exchange publishes real
// OHLCV candles, free and keyless, for every symbol, instantly.
//
// The decisive advantage is PARITY: scripts/backfill_klines.mjs backtests on
// Binance klines, and this serves the SAME source in the same shape live. A
// backtest fill and a paper fill therefore reference identical bars. The sampled
// recorder could never offer that — its highs/lows were 60s approximations, so
// backtested stop-outs were not reproducible live. Paper evidence only has value
// if it predicts, and it can only predict if it is measured the same way.
//
// The sampled recorder is NOT replaced: it remains our own independent record
// (and Hyperliquid funding/OI has no Binance equivalent). This is the strategy
// FEATURE source, where parity with the backtest is what matters.

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

const CACHE_TTL_MS = 60_000;        // 1h candles change slowly; a minute is plenty
const MAX_LIMIT = 1000;             // Binance per-request ceiling
const cache = new Map<string, { at: number; candles: Candle[] }>();

function backfillFile(symbol: string, interval: string) {
  return path.join(process.cwd(), 'data', 'market', `backfill-${symbol}-${interval}.jsonl`);
}

/**
 * Recent real candles for `symbol`. Returns null (never fabricated bars) when the
 * venue is unreachable or the symbol has no market — callers must DECLINE, which
 * is the one rule from the old recorder worth keeping.
 */
export async function fetchCandles(symbol: string, interval = '1h', limit = 200): Promise<Candle[] | null> {
  const key = `${symbol}:${interval}:${Math.min(limit, MAX_LIMIT)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.candles;
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}USDT&interval=${interval}&limit=${Math.min(limit, MAX_LIMIT)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
    if (!res.ok) return null;                    // 400 = no such market; never guess
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const candles: Candle[] = rows.map((r: any[]) => ({
      t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]),
    })).filter((c) => Number.isFinite(c.c) && c.c > 0);
    if (!candles.length) return null;
    cache.set(key, { at: Date.now(), candles });
    return candles;
  } catch {
    return null;                                 // a gap is honest; a fabricated bar is not
  }
}

/**
 * Candles for BACKTESTING — read from the on-disk backfill so historical runs are
 * reproducible and never depend on a live venue. Same shape as fetchCandles, so
 * one feature implementation serves both offline and online (the parity the old
 * split could not give).
 */
export function readBackfillCandles(symbol: string, interval = '1h'): Candle[] | null {
  const file = backfillFile(symbol, interval);
  if (!fs.existsSync(file)) return null;
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const candles = rows.map((line) => JSON.parse(line) as Candle).filter((c) => Number.isFinite(c.c));
  return candles.length ? candles : null;
}
