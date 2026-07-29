#!/usr/bin/env node
/**
 * STOCK MOMENTUM SCOUT — closes the asset-class gap. We scan crypto (600+ coins)
 * and memecoin pools but had NO live stock scanner (just one stale 25-name
 * backtest). This blindly records a wide universe of MOVING US stocks so the same
 * pessimistic grader can test whether stock momentum pays net of costs.
 *
 * Universe = union of Yahoo predefined screeners (most_actives, day_gainers,
 * small_cap_gainers, aggressive_small_caps) — active + small-cap movers, the
 * equity analog of the crypto small-cap tail. Fields per name: 1d change, volume,
 * 3-month avg volume (-> surge), market cap, 52-week change (-> extension).
 *
 * HONEST RAILS (same as the crypto radar):
 *  - EARLY score: rewards today's move + volume surge, PENALIZES already-extended
 *    (52w blown off) — a mover-scanner is a rear-view mirror otherwise.
 *  - RADAR not buy-signal. Stocks are MORE efficient than crypto (our 25-name test
 *    found 0). The grader (forward, net of costs, incl. reversals) is the arbiter.
 *  - Records blind; no auth, no broker, no order path. Zero money risk.
 *
 * Source: Yahoo Finance public API (free, no key; US-reachable from the VM).
 * Records data/market/stocks/scan-<date>.jsonl. Run on the VM by cron ~ every 30m
 * during/around US market hours.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'market', 'stocks');
const SCREENERS = (process.env.STOCK_SCREENERS || 'most_actives,day_gainers,small_cap_gainers,aggressive_small_caps').split(',');
const DOLLAR_VOL_FLOOR = Number(process.env.STOCK_DVOL_FLOOR || 1e6);   // $1M daily dollar volume: tradeable
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const V = (x) => (x && typeof x === 'object' && 'raw' in x ? x.raw : x);   // Yahoo fields are {raw,fmt} OR direct
const N = (x) => { const n = Number(V(x)); return Number.isFinite(n) ? n : null; };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// EARLY-mover score from the screener snapshot fields.
function score(q) {
  const chg1d = N(q.regularMarketChangePercent) || 0;
  const vol = N(q.regularMarketVolume) || 0, avgVol = N(q.averageDailyVolume3Month) || 0;
  const chg52w = N(q.fiftyTwoWeekChangePercent) || 0;
  const surge = avgVol > 0 ? vol / avgVol : 0;
  let s = 0;
  s += Math.min(25, Math.max(0, chg1d) * 3);          // today's move (a 5% stock day is big -> ~15)
  s += Math.min(25, Math.max(0, surge - 1) * 12);     // volume surge vs 3m avg
  s += (chg52w > -30 && chg52w < 150) ? 15 : 0;       // trending but not blown off / not a falling knife
  if (chg52w > 300) s -= 15;                           // already parabolic on the year
  if (chg1d < -2) s -= 10;                             // rolling over today
  return { s: Math.round(Math.max(0, s)), chg1d, surge, chg52w };
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const rows = [];
  for (const sc of SCREENERS) {
    const j = await get(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${sc}&count=100`);
    const quotes = j?.finance?.result?.[0]?.quotes;
    if (!Array.isArray(quotes)) { await sleep(500); continue; }
    for (const q of quotes) {
      if (!q.symbol || seen.has(q.symbol)) continue; seen.add(q.symbol);
      const price = N(q.regularMarketPrice), vol = N(q.regularMarketVolume), mcap = N(q.marketCap);
      if (!(price > 0) || !(vol > 0)) continue;
      if (!((price * vol) >= DOLLAR_VOL_FLOOR)) continue;                 // tradeable dollar volume
      const sr = score(q);
      rows.push({ t, sym: q.symbol, screener: sc, price, mcap, vol, dollarVol: Math.round(price * vol),
        score: sr.s, chg1d: +(sr.chg1d).toFixed(2), surge: +(sr.surge).toFixed(2), chg52w: +(sr.chg52w).toFixed(1) });
    }
    await sleep(800);
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `scan-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const top = rows.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  console.log(`[stocks] ${new Date().toISOString()} universe=${rows.length} tradeable stocks`);
  console.log(`  top movers by score: ${top.map((r) => `${r.sym}(${r.score}|${r.chg1d}%|${r.surge}x vol)`).join('  ')}`);
}
run().catch((e) => console.error('[stocks] scout failed:', e.message));
