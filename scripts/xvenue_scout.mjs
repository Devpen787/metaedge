#!/usr/bin/env node
/**
 * CROSS-VENUE GAP SCOUT (Lane #6) — blind, read-only recorder of the SAME asset's
 * best bid/ask on two exchanges (Coinbase + Kraken) at the same instant, and the
 * best capturable gross gap between them. Measures whether a cross-venue arbitrage
 * even EXISTS before anyone builds the cross-venue execution it would require
 * (two funded accounts, transfer/settlement latency, inventory on both sides).
 *
 * THE HONEST QUESTION: to capture a gap you BUY on the cheap venue's ask and SELL
 * on the rich venue's bid. Gross gap = max(krBid - cbAsk, cbBid - krAsk). A real
 * arb needs that gap to exceed BOTH venues' taker fees (~25-40bp each) plus the
 * latency/transfer cost — and to persist long enough to act on. Cross-CEX arb is
 * HFT/MEV-dominated, so the expected honest answer is "gaps sit inside costs" — a
 * cheap, fast no. But we measure it rather than assume it.
 *
 * GUARDRAIL: no auth, no wallet, no order path. Public tickers only. Zero risk.
 * A gap seen here is INDICATIVE (top-of-book, no depth) — an upper bound on a real
 * capturable one, which is exactly why we check existence first, precision later.
 *
 * Records data/market/xvenue/gaps-<date>.jsonl. Run on the VM by cron.
 */
import fs from 'node:fs';
import path from 'node:path';

// Coinbase product -> Kraken ticker key
const PAIRS = { 'BTC-USD': 'XXBTZUSD', 'ETH-USD': 'XETHZUSD', 'SOL-USD': 'SOLUSD', 'LINK-USD': 'LINKUSD', 'AVAX-USD': 'AVAXUSD' };
const DIR = path.join(process.cwd(), 'data', 'market', 'xvenue');
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } }); return r.ok ? r.json() : null; } catch { return null; }
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  // Kraken batches all pairs in one call; grab it once, then Coinbase per pair (close in time).
  const kr = await get(`https://api.kraken.com/0/public/Ticker?pair=${Object.values(PAIRS).join(',')}`);
  const krRes = kr && kr.result ? kr.result : {};
  const rows = [];
  for (const [cbPair, krKey] of Object.entries(PAIRS)) {
    const t = Date.now();
    const cb = await get(`https://api.exchange.coinbase.com/products/${cbPair}/ticker`);
    const krk = krRes[krKey] || krRes[krKey.replace(/^X|Z(USD)$/g, '')]; // Kraken sometimes renames keys
    if (!cb || !krk) { await sleep(100); continue; }
    const cbBid = N(cb.bid), cbAsk = N(cb.ask), krBid = N(krk.b?.[0]), krAsk = N(krk.a?.[0]);
    if (!(cbBid > 0 && cbAsk > 0 && krBid > 0 && krAsk > 0)) { await sleep(100); continue; }
    const mid = (cbBid + cbAsk + krBid + krAsk) / 4;
    // best capturable gross gap: buy Coinbase / sell Kraken, or buy Kraken / sell Coinbase
    const buyCbSellKr = krBid - cbAsk;
    const buyKrSellCb = cbBid - krAsk;
    const gross = Math.max(buyCbSellKr, buyKrSellCb);
    const dir = buyCbSellKr >= buyKrSellCb ? 'buyCB_sellKR' : 'buyKR_sellCB';
    rows.push({ t, pair: cbPair, cbBid, cbAsk, krBid, krAsk, mid,
      grossGapBps: +((gross / mid) * 10000).toFixed(2), dir });
    await sleep(120);
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `gaps-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const summ = rows.map((r) => `${r.pair.split('-')[0]}:${r.grossGapBps}bp`).join(' ');
  console.log(`[xvenue] ${new Date().toISOString()} pairs=${rows.length} | gross gap ${summ}`);
}
run().catch((e) => console.error('[xvenue] scout failed:', e.message));
