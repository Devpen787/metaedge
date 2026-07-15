#!/usr/bin/env node
// Stock/ETF scout. Pulls daily OHLCV from Yahoo's public chart API (no key) into
// the SAME bar shape the crypto backfill uses, so stocks flow through the exact
// same walk-forward sweep — one engine, no forked strategy code.
//
//   node scripts/backfill_stocks.mjs                 # default liquid basket, 10y
//   node scripts/backfill_stocks.mjs --symbols AAPL,SPY --range 5y
//
// Output: data/market/backfill-<SYM>-1d.jsonl  (t, o, h, l, c, v) — identical to
// the crypto backfill, so `backtest_sweep --interval 1d --market stock` reads it.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };

// A liquid, survivorship-aware-ish basket: broad ETFs + megacaps + a few high-vol
// names. This is a STARTING universe, not a claim these are the right names — the
// same "no hidden hardcoded universe" rule applies, so --symbols overrides it.
const DEFAULT = 'SPY,QQQ,IWM,DIA,AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,AMD,NFLX,JPM,XOM,UNH,WMT,GLD,SLV,TLT,COIN,MSTR,SMCI,PLTR,MARA';
const symbols = (flag('symbols', DEFAULT)).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const range = flag('range', '10y');

fs.mkdirSync('data/market', { recursive: true });

async function pull(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) { console.log(`  ${sym}: HTTP ${res.status}, skipping`); return 0; }
  const data = await res.json();
  const r = data?.chart?.result?.[0];
  if (!r?.timestamp) { console.log(`  ${sym}: no data (${data?.chart?.error?.description || 'empty'}), skipping`); return 0; }
  const q = r.indicators.quote[0];
  const lines = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i];
    // Yahoo emits nulls on non-trading gaps; never fabricate them into zeros.
    if ([o, h, l, c].some((x) => x == null)) continue;
    lines.push(JSON.stringify({ t: r.timestamp[i] * 1000, o, h, l, c, v: v ?? 0 }));
  }
  if (lines.length < 250) { console.log(`  ${sym}: only ${lines.length} bars, skipping (need ~250+)`); return 0; }
  fs.writeFileSync(path.join('data/market', `backfill-${sym}-1d.jsonl`), lines.join('\n') + '\n');
  console.log(`  ${sym}: ${lines.length} daily bars`);
  return lines.length;
}

let ok = 0;
for (const sym of symbols) {
  try { if (await pull(sym)) ok++; } catch (e) { console.log(`  ${sym}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 400)); // be polite to the public endpoint
}
console.log(`\n${ok}/${symbols.length} stock symbols backfilled → data/market/backfill-<SYM>-1d.jsonl`);
console.log(`Next: node scripts/backtest_sweep.mjs --interval 1d --market stock --train 900 --test 200 --embargo 3 --symbols ${symbols.join(',')}`);
