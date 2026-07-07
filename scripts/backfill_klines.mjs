#!/usr/bin/env node
/**
 * Historical backfill — years of public candle data for hypothesis SCREENING.
 * Free, re-fetchable, so it lives locally (data/ is gitignored) and can always
 * be rebuilt. This is the evidence layer that lets us test an idea against
 * 2 years of history tonight instead of waiting weeks for the live recorder.
 *
 * Honest limits (why backfill alone is never enough):
 *   - screening only: survivors must still pass the live-feed forward test
 *   - exchange candles ≠ our feed; fills/slippage are not in this data
 *   - run locally (Binance is geo-blocked from the GCP VM)
 *
 * Usage: node scripts/backfill_klines.mjs [--interval 1h] [--days 730]
 * Output: data/market/backfill-<SYM>-<interval>.jsonl
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const INTERVAL = flag('interval', '1h');
const DAYS = Number(flag('days', 730));

const SYMBOLS = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', LINK: 'LINKUSDT', DOGE: 'DOGEUSDT', BNB: 'BNBUSDT', XRP: 'XRPUSDT', ADA: 'ADAUSDT', AVAX: 'AVAXUSDT', DOT: 'DOTUSDT', MATIC: 'MATICUSDT' };

fs.mkdirSync('data/market', { recursive: true });
const startMs = Date.now() - DAYS * 86_400_000;

for (const [sym, pair] of Object.entries(SYMBOLS)) {
  const out = `data/market/backfill-${sym}-${INTERVAL}.jsonl`;
  const lines = [];
  let from = startMs;
  for (let page = 0; page < 40; page++) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${INTERVAL}&startTime=${from}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) { console.log(`  ${sym}: HTTP ${res.status} — stopping (have ${lines.length})`); break; }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) {
      lines.push(JSON.stringify({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5], qv: +r[7], trades: r[8] }));
    }
    from = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
    await new Promise((r) => setTimeout(r, 250)); // stay polite to the API
  }
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(`  ${sym.padEnd(6)} ${lines.length} candles → ${out}`);
}
console.log('\nBackfill complete. Screening data ready — survivors still owe a live forward test.');
