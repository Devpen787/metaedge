#!/usr/bin/env node
/**
 * MARKET-MAKING SCOUT (Lane #4) — blind, read-only recorder of the two series a
 * realized-spread measurement needs: the QUOTE series (best bid/ask over time)
 * and the TRADE TAPE (executions with taker side). It records; it never quotes
 * or trades. The pessimistic grader comes later and decides whether captured
 * spread beats adverse selection + fees — the only thing that would earn a real
 * market-making build.
 *
 * WHY THESE TWO SERIES (the honest measurement, no queue simulation needed):
 *   Adverse selection is exactly what you can't see from outside the book, so we
 *   measure it the standard microstructure way. For each trade (taker side D:
 *   +1 buy / -1 sell), with mid at trade time and mid T-later:
 *     effective spread = 2·D·(price − mid_t)      (gross a maker gains)
 *     realized  spread = 2·D·(price − mid_{t+T})  (what the maker KEEPS after
 *                                                  the price moves against them)
 *     adverse selection = effective − realized
 *   A market-maker's true edge is REALIZED spread minus maker fees. If that is
 *   negative, quoting loses even though the quoted spread looks positive — the
 *   HFT reality this lane exists to test. Recording quotes + tape lets the grader
 *   compute this per pair at horizons a SLOW player can actually reach (1/5/15m).
 *
 * NO LOOK-AHEAD by construction; the grader only pairs a trade with LATER quotes.
 * GUARDRAIL: no auth, no wallet, no order path. Public Coinbase data (US-reachable
 * from the VM, unlike Binance). Zero money risk.
 *
 * Market-making is high-frequency, so a 3-min snapshot would miss it. This runs as
 * a BATCH job (cron every minute) that internally polls ~4x at ~14s spacing then
 * EXITS — sub-minute cadence without a long-running daemon that could starve the
 * VM (the flywheel lesson). Records to data/market/mm/{quotes,trades}-<date>.jsonl.
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Records quote (bid/ask) and trade-tape series for the top MAX_PAIRS=40 Coinbase USD pairs by real 24h volume (>=$1M floor), 4 polls at ~14s spacing, once a minute.',
  notYet: [
    'Coinbase only — no Kraken/OKX/Binance/Hyperliquid market-making measurement; single-venue by design (this lane tests whether quoting logic itself works, not cross-venue routing).',
    'MAX_PAIRS=40 is a call-volume ceiling (2 calls x 4 polls x 40 pairs must fit inside a 1-min cron window), NOT a universe-size limit — the underlying liquid-pair query (/products/volume-summary) already covers all 402 real Coinbase USD listings and re-derives the top 40 by volume every run.',
    'REST polling only, ~14s resolution — no websocket order-book stream, so a mid-price move faster than 14s is invisible between samples (see mm_grader.mjs\'s own hard self-check, which refuses a verdict when this actually matters).',
  ],
  why: [
    'Universe is liquidity-DERIVED (real 24h volume from one API call), not a hand-picked list — this was hardcoded to 6 pairs originally; the fix reads real volume for all 402 pairs and takes everything above the same $1M/day floor used elsewhere in the codebase.',
    'CONCURRENCY=8 bounded-parallel fetch exists because sequential fetching of 40 pairs measured 2:03 for one poll cycle — too slow for the 1-min cron; this is a latency fix, not a pair-count reduction.',
    'Quote + trade tape (not just quotes) recorded because adverse selection can only be measured from actual executions against the quote series, not from the book alone.',
  ],
};

const B = 'https://api.exchange.coinbase.com';
const DIR = path.join(process.cwd(), 'data', 'market', 'mm');
// Was hardcoded to 6 pairs vs Coinbase's 402 real USD listings. Universe is now
// LIQUIDITY-DERIVED, not a guessed list: /products/volume-summary gives real 24h
// spot volume for every pair in ONE call, and we take everything above a stated
// floor (same $1M/day floor used elsewhere in the codebase for consistency), not
// an arbitrary top-N count. MM_VOL_FLOOR / MM_MAX_PAIRS override for tuning.
const VOL_FLOOR = Number(process.env.MM_VOL_FLOOR || 1e6);
const MAX_PAIRS = Number(process.env.MM_MAX_PAIRS || 40); // real constraint: each pair costs 2 calls x POLLS rounds within a 1-min cron window — this bounds call volume to fit the cadence, not universe size
const POLLS = 4, POLL_GAP_MS = 12000;    // ~36s of polling, leaves headroom for a wider pair set under a 1-min cron
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function liquidPairs() {
  const explicit = process.env.MM_PAIRS;
  if (explicit) return explicit.split(',');
  const r = await fetch(`${B}/products/volume-summary`, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
  if (!r.ok) return ['BTC-USD', 'ETH-USD', 'SOL-USD']; // degrade to a tiny safe set rather than crash
  const rows = await r.json();
  return rows.filter((x) => x.quote_currency === 'USD' && Number(x.spot_volume_24hour) >= VOL_FLOOR)
    .sort((a, b) => Number(b.spot_volume_24hour) - Number(a.spot_volume_24hour))
    .slice(0, MAX_PAIRS).map((x) => x.id);
}

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const PAIRS = await liquidPairs();
  const quotes = [];
  const trades = [];
  const lastId = new Map();   // per-pair max trade_id seen THIS run (across-run dedup is the grader's job)

  // Fetching pairs sequentially was latency-bound, not rate-limit-bound (40 pairs
  // measured 2:03 for one 4-poll cycle — too slow for a 1-min cron). Bounded
  // concurrency fixes the real bottleneck instead of shrinking the pair count
  // back down to another guessed-small number.
  const CONCURRENCY = 8;
  async function fetchPair(pair, t) {
    const tk = await get(`${B}/products/${pair}/ticker`);
    if (tk) {
      const bid = D(tk.bid), ask = D(tk.ask);
      if (bid > 0 && ask > 0 && ask > bid) {
        const mid = (bid + ask) / 2;
        quotes.push({ t, pair, bid, ask, mid, spreadBps: +(((ask - bid) / mid) * 10000).toFixed(2), vol24: D(tk.volume) });
      }
    }
    const tp = await get(`${B}/products/${pair}/trades?limit=100`);
    if (Array.isArray(tp)) {
      const prevMax = lastId.get(pair) || 0;
      let mx = prevMax;
      for (const x of tp) {
        const id = D(x.trade_id);
        if (id == null || id <= prevMax) continue;             // only trades new since this run started
        mx = Math.max(mx, id);
        trades.push({ t: Date.parse(x.time), pair, tradeId: id, price: D(x.price), size: D(x.size), side: x.side });
      }
      lastId.set(pair, mx);
    }
  }

  for (let poll = 0; poll < POLLS; poll++) {
    const t = Date.now();
    for (let i = 0; i < PAIRS.length; i += CONCURRENCY) {
      await Promise.all(PAIRS.slice(i, i + CONCURRENCY).map((pair) => fetchPair(pair, t)));
    }
    if (poll < POLLS - 1) await sleep(POLL_GAP_MS);
  }

  if (quotes.length) fs.appendFileSync(path.join(DIR, `quotes-${day}.jsonl`), quotes.map((q) => JSON.stringify(q)).join('\n') + '\n');
  if (trades.length) fs.appendFileSync(path.join(DIR, `trades-${day}.jsonl`), trades.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const bp = {}; for (const q of quotes) (bp[q.pair] = bp[q.pair] || []).push(q.spreadBps);
  const spreadSummary = Object.entries(bp).map(([p, arr]) => `${p}:${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}bp`).join(' ');
  console.log(`[mm] ${new Date().toISOString()} quotes=${quotes.length} trades=${trades.length} | avg spread ${spreadSummary}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => console.error('[mm] scout failed:', e.message));
}
