#!/usr/bin/env node
/**
 * MEMECOIN POP-SCOUT — blind, read-only recorder of new/trending pools across
 * chains. The direct parallel to kalshi_scout.mjs: it CAPTURES the raw candidate
 * stream so a later grader can measure whether high-score pops actually pay after
 * costs and a deliberately unfair fill. It scores nothing and trades nothing.
 *
 * WHY BLIND RECORDING FIRST (the whole discipline):
 *   We do NOT build the execution factory (Birdeye WS, Helius paid, co-located
 *   snipers, MEV protection) until the edge is proven to survive a pessimistic
 *   fill model. That proof needs data recorded WITHOUT a strategy watching — so
 *   the forward outcome is untouched. This is that recorder. Free-tier data is
 *   slightly slow and incomplete ON PURPOSE: an edge that survives degraded data
 *   + pessimistic fills is a robust edge, not a latency mirage.
 *
 * HOW THE FORWARD MARKS COME FOR FREE:
 *   Polling every few minutes re-records the SAME pools over time. A pool's price
 *   5/15/30/60 min after we first saw it is just its price in later snapshots.
 *   The grader reconstructs paper trades from this time series — exactly how the
 *   Kalshi quotes-over-time became calibration evidence. No look-ahead: entry is
 *   a snapshot; forward marks are strictly later snapshots.
 *
 * GUARDRAIL: no auth, no wallet, no order path by construction. Public market
 * data only → zero money risk. Execution lives in a separate module that stays
 * OFF until the grader returns positive EV after modeled cost + latency.
 *
 * Source: GeckoTerminal public API (free, no key). new_pools = discovery of just
 * -created pools; trending_pools = where volume is concentrating now. Both are
 * recorded, tagged by source, so the grader sees takers AND rejects.
 *
 * Records to data/market/memecoin/pools-<date>.jsonl, one row per pool per cycle.
 * Run on the VM by cron every ~3 minutes (light, like the Kalshi scout), guarded
 * by flock, appending stdout to data/market/memecoin/scout.log. (Cron cadence
 * written out to avoid the star-slash token closing this comment.)
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Records new + trending pools on solana/base/eth/bsc via GeckoTerminal, up to MAX_PAGES=10 (~200 pools) per (chain,source) per cycle, every ~3min.',
  notYet: [
    'Only 4 chains (solana, base, eth, bsc) — GeckoTerminal supports more networks than this covers; the 4 were chosen for memecoin activity concentration, not because they are the only ones reachable.',
    'Only "new" and "trending" pool feeds — a pool that never enters either feed (e.g., stays flat, low-volume) is structurally invisible to this scout, by GeckoTerminal\'s own API design, not a filter we chose.',
    'Records and scores nothing — this file captures blind; memecoin_grader.mjs is the only place a candidate becomes a pessimistic paper trade.',
  ],
  why: [
    'MAX_PAGES=10 is a verified live measurement (pages 1/5/10 return pools, page 15 errors) — the real depth ceiling of the free tier, not a "seems wide enough" guess.',
    'Recording is deliberately blind (no strategy watching) so the forward outcome is untouched by our own scoring — an edge that survives degraded free-tier data + a pessimistic fill is real, not a latency mirage.',
    'CHAINS defaults are env-overridable (MEME_CHAINS) specifically so widening chain coverage never requires a code change, only a config one.',
  ],
};

const CHAINS = (process.env.MEME_CHAINS || 'solana,base,eth,bsc').split(',');
const BASE = 'https://api.geckoterminal.com/api/v2';
const DIR = path.join(process.cwd(), 'data', 'market', 'memecoin');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function get(url) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    if (r.status === 429) { await sleep(3000); continue; }      // free-tier rate limit → one back-off, then skip
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 429 };   // missed this endpoint this cycle; the 3-min cron re-samples it next time
}

// Collapse one GeckoTerminal pool into a compact, replayable snapshot. Every
// input the score will ever use is captured point-in-time; nothing is derived
// here (the grader derives, so the model can change without re-collecting).
function snap(t, chain, source, p) {
  const a = p.attributes || {};
  const rel = p.relationships || {};
  const tokId = (r) => (r && r.data && r.data.id) || null;
  const w = (o) => o ? { m5: N(o.m5), m15: N(o.m15), m30: N(o.m30), h1: N(o.h1), h6: N(o.h6), h24: N(o.h24) } : null;
  const tx = (o) => {
    if (!o) return null; const out = {};
    for (const k of ['m5', 'm15', 'm30', 'h1', 'h24']) if (o[k]) out[k] = { buys: N(o[k].buys), sells: N(o[k].sells), buyers: N(o[k].buyers), sellers: N(o[k].sellers) };
    return out;
  };
  return {
    t, chain, source, pool: a.address, name: a.name,
    baseToken: tokId(rel.base_token), quoteToken: tokId(rel.quote_token), dex: tokId(rel.dex),
    createdAt: a.pool_created_at,
    ageMin: a.pool_created_at ? Math.round((t - Date.parse(a.pool_created_at)) / 60000) : null,
    priceUsd: N(a.base_token_price_usd), liqUsd: N(a.reserve_in_usd),
    fdvUsd: N(a.fdv_usd), mcapUsd: N(a.market_cap_usd),
    volUsd: w(a.volume_usd), priceChgPct: w(a.price_change_percentage), tx: tx(a.transactions),
  };
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const rows = [];
  const seen = new Set(); // one row per pool per cycle even if it's both new AND trending

  // MAX_PAGES=10 is not a guess: verified live (pages 1/5/10 return 20 pools each,
  // page 15 errors) — this is the real depth ceiling of the free tier, not a
  // "wide enough" number picked out of habit. 10x more coverage per (chain,source)
  // than the old page=1-only version (20 -> up to 200 pools).
  const MAX_PAGES = 10;
  for (const chain of CHAINS) {
    for (const [source, ep] of [['new', 'new_pools'], ['trending', 'trending_pools']]) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const j = await get(`${BASE}/networks/${chain}/${ep}?page=${page}`);
        if (j.__err) { if (page === 1) console.error(`[meme] ${chain}/${ep} HTTP ${j.__err}`); break; } // hit the real ceiling or a transient error — stop, don't fake more pages
        const got = j.data || [];
        if (!got.length) break;                              // ran dry before MAX_PAGES — natural end
        for (const p of got) {
          const key = `${chain}:${p.attributes?.address}`;
          if (seen.has(key)) continue; seen.add(key);
          const s = snap(t, chain, source, p);
          if (s.pool && s.priceUsd != null) rows.push(s);
        }
        await sleep(1500);  // paced for the higher call volume; free tier trips on bursts well under 30/min
      }
    }
  }

  if (rows.length) fs.appendFileSync(path.join(DIR, `pools-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const byChain = {};
  for (const r of rows) byChain[r.chain] = (byChain[r.chain] || 0) + 1;
  console.log(`[meme] ${new Date().toISOString()} recorded=${rows.length} ${Object.entries(byChain).map(([k, v]) => k + '=' + v).join(' ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => console.error('[meme] scout failed:', e.message));
}
