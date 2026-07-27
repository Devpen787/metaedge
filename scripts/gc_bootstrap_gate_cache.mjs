#!/usr/bin/env node
/**
 * GATE DAILY-HISTORY BOOTSTRAP — writes the daily cache the golden-cross scanner needs, sourced
 * from GATE (the VM's live feed venue), so 50/200 history and the live feed are venue-consistent.
 * Fetches ~1000 daily bars for every LIQUID Gate USDT pair and writes gccache-multi/{BASE}.json
 * in the format daily_features.load() expects ({t,p,hi,lo,v}). Idempotent, resumable.
 *
 * Usage: node scripts/gc_bootstrap_gate_cache.mjs [--min-vol 1000000] [--limit 1000] [--max N]
 *        [--out data/market/momentum/gccache-multi] [--sleep 150] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MIN_VOL = Number(flag('min-vol', '1000000'));
const LIMIT = Number(flag('limit', '1000'));
const MAX = Number(flag('max', '99999'));
const SLEEP = Number(flag('sleep', '150'));
const FORCE = args.includes('--force');
const OUT = flag('out', path.join(process.cwd(), 'data', 'market', 'momentum', 'gccache-multi'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(u) { try { const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } }); return r.ok ? r.json() : null; } catch { return null; } }

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tickers = await j('https://api.gateio.ws/api/v4/spot/tickers');
  if (!Array.isArray(tickers)) { console.error('gate tickers failed'); process.exit(1); }
  const liquid = tickers
    .filter((t) => t.currency_pair.endsWith('_USDT') && Number(t.quote_volume) >= MIN_VOL)
    .map((t) => ({ base: t.currency_pair.slice(0, -5), pair: t.currency_pair }))
    .slice(0, MAX);
  console.log(`gate liquid (>=$${(MIN_VOL / 1e6).toFixed(1)}M 24h): ${liquid.length} symbols → ${OUT}`);
  let ok = 0, skip = 0, fail = 0;
  for (const { base, pair } of liquid) {
    const dest = path.join(OUT, `${base}.json`);
    if (!FORCE && fs.existsSync(dest)) { skip++; continue; }
    const k = await j(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=1d&limit=${LIMIT}`);
    await sleep(SLEEP);
    if (!Array.isArray(k) || k.length < 40) { fail++; continue; }
    // gate candlestick: [ts(s), quoteVol, close, high, low, open, baseVol, ...]
    const bars = k.map((c) => ({ t: Number(c[0]) * 1000, p: Number(c[2]), hi: Number(c[3]), lo: Number(c[4]), v: Number(c[1]) })).filter((d) => d.p > 0);
    if (bars.length < 40) { fail++; continue; }
    fs.writeFileSync(dest, JSON.stringify(bars));
    ok++;
    if (ok % 50 === 0) console.log(`  ${ok} written…`);
  }
  const has200 = fs.readdirSync(OUT).filter((f) => f.endsWith('.json')).filter((f) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, f))).length >= 200; } catch { return false; } }).length;
  console.log(`done: ${ok} written, ${skip} skipped(existing), ${fail} failed/short | files with >=200 daily bars: ${has200}`);
})();
