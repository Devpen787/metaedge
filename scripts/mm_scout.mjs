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

const PAIRS = (process.env.MM_PAIRS || 'BTC-USD,ETH-USD,SOL-USD,LINK-USD,AVAX-USD,DOGE-USD').split(',');
const B = 'https://api.exchange.coinbase.com';
const DIR = path.join(process.cwd(), 'data', 'market', 'mm');
const POLLS = 4, POLL_GAP_MS = 14000;    // ~42s of polling, safely under a 1-min cron
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

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
  const quotes = [];
  const trades = [];
  const lastId = new Map();   // per-pair max trade_id seen THIS run (across-run dedup is the grader's job)

  for (let poll = 0; poll < POLLS; poll++) {
    const t = Date.now();
    for (const pair of PAIRS) {
      const tk = await get(`${B}/products/${pair}/ticker`);
      if (tk) {
        const bid = D(tk.bid), ask = D(tk.ask);
        if (bid > 0 && ask > 0 && ask > bid) {
          const mid = (bid + ask) / 2;
          quotes.push({ t, pair, bid, ask, mid, spreadBps: +(((ask - bid) / mid) * 10000).toFixed(2), vol24: D(tk.volume) });
        }
      }
      await sleep(120);
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
      await sleep(120);
    }
    if (poll < POLLS - 1) await sleep(POLL_GAP_MS);
  }

  if (quotes.length) fs.appendFileSync(path.join(DIR, `quotes-${day}.jsonl`), quotes.map((q) => JSON.stringify(q)).join('\n') + '\n');
  if (trades.length) fs.appendFileSync(path.join(DIR, `trades-${day}.jsonl`), trades.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const bp = {}; for (const q of quotes) (bp[q.pair] = bp[q.pair] || []).push(q.spreadBps);
  const spreadSummary = Object.entries(bp).map(([p, arr]) => `${p}:${(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)}bp`).join(' ');
  console.log(`[mm] ${new Date().toISOString()} quotes=${quotes.length} trades=${trades.length} | avg spread ${spreadSummary}`);
}

run().catch((e) => console.error('[mm] scout failed:', e.message));
