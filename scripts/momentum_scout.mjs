#!/usr/bin/env node
/**
 * WIDE MOMENTUM SCOUT — the "don't miss the mover" radar. Blindly records the
 * whole liquid crypto universe (hundreds of coins, far beyond our 37 backfilled
 * or the new-pool memecoin scout) with multi-window momentum, so a pessimistic
 * grader can later measure whether catching emerging movers EARLY pays net of
 * costs and the many that pump-then-dump.
 *
 * THE GAP THIS FILLS: coins like ATLAS ($5M mcap, +71%/7d) — established small-caps
 * that run — are invisible to both our backtest-37 and the new-pool scout. This
 * watches that whole tier.
 *
 * HONEST RAILS:
 *  - A "+X% already" reading is HINDSIGHT. The score rewards EARLY + accelerating
 *    + real participation, and PENALIZES already-extended (bought-the-top) names.
 *  - This SURFACES candidates; it is not edge. Momentum is the crowded game and
 *    we measured gross-edge < costs on majors. The untested bet is the small-cap
 *    tail. The grader (forward, pessimistic, net of costs) is the only edge test.
 *  - Records blind (no look-ahead); no auth, no wallet, no orders.
 *
 * Source: CoinGecko public API (free, no key), /coins/markets paged by market cap.
 * Records data/market/momentum/scan-<date>.jsonl. Run on the VM by cron ~ every 30m.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'market', 'momentum');
const PAGES = Number(process.env.MOM_PAGES || 10);      // 250/page -> ~2500 coins; reaches the ~$5M-mcap tail (ATLAS-tier)
const VOL_FLOOR = Number(process.env.MOM_VOL_FLOOR || 100000);   // $100k 24h vol: tradeable small-cap, not a micro-rug
const MCAP_FLOOR = Number(process.env.MOM_MCAP_FLOOR || 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    if (r.status === 429) { await sleep(4000); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// EARLY-mover score: reward acceleration + participation, punish already-extended.
function score(c) {
  const h1 = N(c.price_change_percentage_1h_in_currency) || 0;
  const h24 = N(c.price_change_percentage_24h_in_currency) || 0;
  const d7 = N(c.price_change_percentage_7d_in_currency) || 0;
  const d30 = N(c.price_change_percentage_30d_in_currency) || 0;
  const turnover = c.market_cap > 0 ? (c.total_volume / c.market_cap) : 0;   // participation
  // acceleration: 24h pace strong relative to the 7d average daily pace (fresh leg, not stale drift)
  const dailyPace7 = d7 / 7;
  const accel = h24 - dailyPace7;                 // >0 = accelerating today vs the week
  let s = 0;
  s += Math.min(25, Math.max(0, h24) * 1.5);      // today's move (0..25)
  s += Math.min(20, Math.max(0, accel) * 1.5);    // acceleration (0..20)
  s += Math.min(25, turnover * 60);               // participation / turnover (0..25)
  s += (d7 > 5 && d7 < 80) ? 15 : 0;              // in a run but NOT blown off (the early sweet spot)
  // extension penalties (already ran = likely buying the top)
  if (d7 > 120) s -= Math.min(25, (d7 - 120) / 10);
  if (d30 > 300) s -= 15;
  if (h1 < -3) s -= 10;                            // already rolling over intraday
  return { s: Math.round(Math.max(0, s)), h1, h24, d7, d30, turnover, accel };
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&price_change_percentage=1h,24h,7d,30d`;
    const arr = await get(url);
    if (arr === null) { await sleep(3000); continue; }   // rate-limited: skip this page, the cron re-covers it
    if (!arr.length) break;                                // genuine end of data
    for (const c of arr) {
      if (seen.has(c.id)) continue; seen.add(c.id);
      if (!(c.total_volume >= VOL_FLOOR) || !(c.market_cap >= MCAP_FLOOR)) continue;   // tradeable only
      const sc = score(c);
      rows.push({ t, id: c.id, sym: (c.symbol || '').toUpperCase(), price: N(c.current_price),
        mcap: N(c.market_cap), vol24: N(c.total_volume), score: sc.s,
        h1: +sc.h1.toFixed(1), h24: +sc.h24.toFixed(1), d7: +sc.d7.toFixed(1), d30: +sc.d30.toFixed(1),
        turnover: +sc.turnover.toFixed(3), accel: +sc.accel.toFixed(1) });
    }
    await sleep(2500);   // free-tier pacing
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `scan-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const top = rows.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  console.log(`[momentum] ${new Date().toISOString()} universe=${rows.length} tradeable coins`);
  console.log(`  top emerging movers by score: ${top.map((r) => `${r.sym}(${r.score}|24h ${r.h24}%|7d ${r.d7}%)`).join('  ')}`);
}
run().catch((e) => console.error('[momentum] scout failed:', e.message));
