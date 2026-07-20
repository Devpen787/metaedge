#!/usr/bin/env node
/**
 * UNIVERSE REFRESH — closes the real gap found in review: backfill was a
 * one-off manual script, so a coin that ages into eligibility (2yr old + listed)
 * or gets newly listed never entered the backtest universe unless someone
 * noticed and re-ran things by hand. This makes eligibility a RECURRING,
 * self-updating computation instead of a static list someone has to remember
 * to refresh.
 *
 * WHAT THIS DOES NOT DO (stated plainly, not hidden): it does not reach every
 * token that exists. It reaches every coin currently listed on Binance or
 * Coinbase (the two exchanges we have fast, reliable, free candle sources for).
 * Kraken/OKX-only coins and DEX-only/pre-2yr-old coins are a separate, known
 * gap (see the review commit) — CoinGecko's broader aggregate history exists in
 * principle but rate-limits hard on bulk pulls at our tier. LIVE detection
 * (momentum_scout, memecoin_scout) already reaches the full current market —
 * this script is about the SEPARATE deep-history-backtest universe only.
 *
 * Idempotent: re-running costs almost nothing once caught up (only pulls the
 * delta). Run weekly (backfill is a heavy one-time-per-coin pull, not a live
 * scan — no need for a tighter cadence).
 *
 * Usage: node scripts/refresh_universe.mjs
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const DIR = 'data/market';
const STABLE = new Set(['USDC', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'EUR', 'USD1', 'USDE', 'PYUSD', 'GUSD', 'ZUSD']);
const gj = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0' } }); return r.ok ? r.json() : null; };

fs.mkdirSync(DIR, { recursive: true });
const have = new Set(fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).map((f) => f.slice('backfill-'.length, -'-1h.jsonl'.length)));
console.log(`[refresh] currently backfilled: ${have.size} coins`);

const bn = await gj('https://api.binance.com/api/v3/exchangeInfo');
const binance = new Set(bn.symbols.filter((x) => x.status === 'TRADING' && x.quoteAsset === 'USDT' && x.isSpotTradingAllowed !== false).map((x) => x.baseAsset).filter((s) => !STABLE.has(s)));
const cb = await gj('https://api.exchange.coinbase.com/products');
const coinbase = new Set(cb.filter((p) => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled).map((p) => p.base_currency).filter((s) => !STABLE.has(s)));

const newBinance = [...binance].filter((s) => !have.has(s));
const newCoinbase = [...coinbase].filter((s) => !have.has(s) && !binance.has(s)); // prefer Binance if listed on both

console.log(`[refresh] Binance eligible: ${binance.size} (${newBinance.length} new) | Coinbase eligible: ${coinbase.size} (${newCoinbase.length} new, not already on Binance)`);

if (newBinance.length) {
  console.log(`[refresh] backfilling ${newBinance.length} new Binance-listed coins...`);
  execSync(`node scripts/backfill_klines.mjs --symbols "${newBinance.join(',')}" --interval 1h --days 730`, { stdio: 'inherit' });
}
if (newCoinbase.length) {
  console.log(`[refresh] backfilling ${newCoinbase.length} new Coinbase-only coins...`);
  execSync(`node scripts/backfill_coinbase.mjs --symbols "${newCoinbase.join(',')}" --days 730`, { stdio: 'inherit' });
}
if (!newBinance.length && !newCoinbase.length) console.log('[refresh] nothing new — universe already current.');

const nowHave = fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).length;
console.log(`[refresh] done. backfilled universe: ${nowHave} coins (was ${have.size}).`);
