#!/usr/bin/env node
/**
 * Coinbase backfill — EXTENDS backfill_klines.mjs (Binance) to close the real
 * gap found in review: Binance's 452 tradeable pairs is NOT the true universe
 * ceiling, it's just one exchange's listings. The real combined ceiling across
 * Binance+Coinbase+Kraken+OKX is 1,021 unique coins; this script closes the
 * Coinbase-only slice (184 coins Binance doesn't list at all).
 *
 * Same output format as backfill_klines.mjs (data/market/backfill-<SYM>-1h.jsonl)
 * so it needs ZERO changes to the sweep/confluence/portfolio code that reads it —
 * they auto-discover every file in the directory regardless of source exchange.
 *
 * Usage: node scripts/backfill_coinbase.mjs (--symbols A,B | --universe-file PATH) [--days 730]
 */
import fs from 'node:fs';
import { explicitUniverse, flag } from './lib/universe.mjs';

const args = process.argv.slice(2);
const DAYS = Number(flag(args, 'days', 730));
const REQUESTED = explicitUniverse(args, 'symbols');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const productsRes = await fetch('https://api.exchange.coinbase.com/products', { headers: { 'User-Agent': 'MetaEdge/1.0' } });
const products = await productsRes.json();
const usdPairs = new Map(products.filter((p) => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled)
  .map((p) => [p.base_currency, p.id]));
const SYMBOLS = REQUESTED.filter((s) => usdPairs.has(s));
const unsupported = REQUESTED.filter((s) => !usdPairs.has(s));
if (unsupported.length) console.log(`  unsupported Coinbase USD symbols (skipped): ${unsupported.join(',')}`);
if (!SYMBOLS.length) throw new Error('No requested universe members have a Coinbase USD market');

fs.mkdirSync('data/market', { recursive: true });
const startMs = Date.now() - DAYS * 86_400_000;

for (const sym of SYMBOLS) {
  const pair = usdPairs.get(sym);
  const out = `data/market/backfill-${sym}-1h.jsonl`;
  const lines = [];
  let end = Math.floor(Date.now() / 1000);
  const startSec = Math.floor(startMs / 1000);
  for (let page = 0; page < 40 && end > startSec; page++) {
    const start = Math.max(startSec, end - 300 * 3600);        // 300 hourly candles per page (Coinbase's real cap)
    const url = `https://api.exchange.coinbase.com/products/${pair}/candles?granularity=3600&start=${new Date(start * 1000).toISOString()}&end=${new Date(end * 1000).toISOString()}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
    if (!res.ok) { if (res.status === 429) { await sleep(1000); page--; continue; } console.log(`  ${sym}: HTTP ${res.status} — stopping (have ${lines.length})`); break; }
    const rows = await res.json();                             // [ [time, low, high, open, close, volume], ... ] newest-first
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) lines.push(JSON.stringify({ t: r[0] * 1000, o: +r[3], h: +r[2], l: +r[1], c: +r[4], v: +r[5], qv: +r[5] * +r[4], trades: null }));
    end = start;
    await sleep(200);   // Coinbase public rate limit is strict
  }
  const uniq = [...new Map(lines.map((l) => [JSON.parse(l).t, l])).values()].sort((a, b) => JSON.parse(a).t - JSON.parse(b).t);
  fs.writeFileSync(out, uniq.join('\n') + '\n');
  console.log(`  ${sym.padEnd(6)} ${uniq.length} candles → ${out}`);
}
console.log('\nCoinbase backfill complete.');
