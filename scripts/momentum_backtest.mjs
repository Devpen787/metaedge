#!/usr/bin/env node
/**
 * MOMENTUM BACKTEST — the FAST verdict. Instead of waiting a week for forward data,
 * reconstruct the scanner's signal on ~90 days of HISTORICAL price/volume for the
 * wide universe and grade forward returns net of costs, today.
 *
 * HONEST CAVEATS (stated in the output too):
 *  - SURVIVORSHIP: the universe is TODAY's coins, so coins that pumped-then-died and
 *    delisted are absent. This biases the result OPTIMISTICALLY. Therefore: no edge
 *    here = decisive (no edge even with the bias in our favor); edge here = suggestive,
 *    needs the blind forward scout (which records the dyers) to confirm.
 *  - Point-in-time features from historical prices/mcaps/volumes (no look-ahead:
 *    signal at day i uses prices <= i; forward marks use days > i only).
 *  - Daily granularity (the live scout is 30-min).
 *  - BASELINE: reports the all-coins forward return too, so a high-score bucket has
 *    to BEAT the universe drift, not just ride it.
 *
 * Usage (VM, where the scan + CoinGecko reach): node scripts/momentum_backtest.mjs [--max 120] [--score-bar 60]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'momentum');
const MAX = Number(flag('max', '120'));
const SCORE_BAR = Number(flag('score-bar', '60'));
const FEE = 0.002;
const HORIZONS = [1, 3, 7];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const costPerSide = (mcap) => (!(mcap > 0) ? 0.05 : mcap < 1e7 ? 0.03 : mcap < 1e8 ? 0.015 : mcap < 1e9 ? 0.005 : 0.002) + FEE;

// same shape as momentum_scout.score (daily: no 1h term)
function score({ h24, d7, d30, turnover }) {
  const dailyPace7 = d7 / 7, accel = h24 - dailyPace7;
  let s = 0;
  s += Math.min(25, Math.max(0, h24) * 1.5);
  s += Math.min(20, Math.max(0, accel) * 1.5);
  s += Math.min(25, turnover * 60);
  s += (d7 > 5 && d7 < 80) ? 15 : 0;
  if (d7 > 120) s -= Math.min(25, (d7 - 120) / 10);
  if (d30 > 300) s -= 15;
  return Math.round(Math.max(0, s));
}

async function cg(url) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    if (r.status === 429) { await sleep(4000); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// universe: distinct coins from the most recent scan (id + a representative mcap)
function universe() {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith('scan-')).sort();
  const map = new Map();
  for (const f of files) for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(l); if (r.id) map.set(r.id, { id: r.id, sym: r.sym, mcap: r.mcap }); } catch { /**/ }
  }
  return [...map.values()];
}

// Granularity-agnostic daily series: bucket every point by UTC day, keep the last
// obs per day. Works whether CoinGecko returns hourly (days<=90) or daily points —
// the previous stride-by-24 assumed hourly and silently discarded daily data.
function daily(chart) {
  if (!chart || !Array.isArray(chart.prices) || chart.prices.length < 30) return null;
  const mc = chart.market_caps || [], tv = chart.total_volumes || [];
  const byDay = new Map();
  for (let i = 0; i < chart.prices.length; i++) {
    const [t, p] = chart.prices[i];
    byDay.set(Math.floor(t / 86400000), { t, p, mc: mc[i] ? mc[i][1] : null, v: tv[i] ? tv[i][1] : null });
  }
  const out = [...byDay.values()].sort((a, b) => a.t - b.t);
  return out.length > 40 ? out : null;
}

(async () => {
  const coins = universe().slice(0, MAX);
  console.log(`\n=== Momentum BACKTEST (historical, fast verdict) — ${coins.length} coins, score bar ${SCORE_BAR} ===`);
  const byBand = { base: {}, mid: {}, high: {} };   // {dH: [rets]}
  for (const h of HORIZONS) { byBand.base[`d${h}`] = []; byBand.mid[`d${h}`] = []; byBand.high[`d${h}`] = []; }
  // cache each coin's daily series so repeated runs accumulate coverage past the
  // free-tier rate limit (fetch what we can each run; re-use everything already banked).
  const CACHE = path.join(DIR, 'histcache');
  fs.mkdirSync(CACHE, { recursive: true });
  let signals = 0, coinsUsed = 0, fetched = 0, cached = 0;
  for (const c of coins) {
    const cf = path.join(CACHE, `${c.id}.json`);
    let s = null;
    if (fs.existsSync(cf)) { try { s = JSON.parse(fs.readFileSync(cf, 'utf8')); cached++; } catch { /**/ } }
    if (!s) {
      const chart = await cg(`https://api.coingecko.com/api/v3/coins/${c.id}/market_chart?vs_currency=usd&days=90&interval=daily`);
      await sleep(2200);
      s = daily(chart);
      if (s) { fs.writeFileSync(cf, JSON.stringify(s)); fetched++; }
    }
    if (!s) continue; coinsUsed++;
    for (let i = 30; i < s.length - 7; i++) {
      if (!(s[i].p > 0) || !(s[i - 30].p > 0)) continue;
      const h24 = (s[i].p / s[i - 1].p - 1) * 100;
      const d7 = (s[i].p / s[i - 7].p - 1) * 100;
      const d30 = (s[i].p / s[i - 30].p - 1) * 100;
      const turnover = (s[i].v > 0 && s[i].mc > 0) ? s[i].v / s[i].mc : 0;
      const sc = score({ h24, d7, d30, turnover });
      const mcap = s[i].mc || c.mcap;
      const cps = costPerSide(mcap);
      const entry = s[i].p * (1 + cps);
      // baseline = EVERY day/coin; mid/high = score bands
      for (const h of HORIZONS) {
        const fwd = s[i + h]?.p; if (!(fwd > 0)) continue;
        const net = ((fwd * (1 - cps)) / entry - 1) * 100;
        byBand.base[`d${h}`].push(net);
        if (sc >= 75) byBand.high[`d${h}`].push(net);
        else if (sc >= SCORE_BAR) byBand.mid[`d${h}`].push(net);
      }
      if (sc >= SCORE_BAR) signals++;
    }
  }
  const stat = (arr) => arr.length ? { n: arr.length, exp: arr.reduce((a, b) => a + b, 0) / arr.length, win: 100 * arr.filter((r) => r > 0).length / arr.length } : { n: 0 };
  console.log(`  coins with usable history: ${coinsUsed} | score>=${SCORE_BAR} signals: ${signals}\n`);
  console.log(`  ${'band'.padEnd(14)} ${'horizon'.padStart(8)} ${'n'.padStart(7)} ${'net exp'.padStart(9)} ${'win%'.padStart(6)} ${'vs baseline'.padStart(12)}`);
  let flags = 0;
  for (const h of HORIZONS) {
    const base = stat(byBand.base[`d${h}`]);
    for (const [name, band] of [['baseline (all)', 'base'], [`${SCORE_BAR}-75`, 'mid'], ['75+ (high)', 'high']]) {
      const st = stat(byBand[band][`d${h}`]); if (!st.n) continue;
      const edge = name.startsWith('baseline') ? 0 : st.exp - base.exp;
      const isFlag = band === 'high' && st.n >= 100 && st.exp > 0 && edge > 0;
      if (isFlag) flags++;
      console.log(`  ${name.padEnd(14)} ${(h + 'd').padStart(8)} ${String(st.n).padStart(7)} ${(st.exp > 0 ? '+' : '') + st.exp.toFixed(2) + '%'} ${st.win.toFixed(0).padStart(5)}% ${name.startsWith('baseline') ? '—'.padStart(12) : ((edge > 0 ? '+' : '') + edge.toFixed(2) + '%').padStart(12)}${isFlag ? '  <==' : ''}`);
    }
  }
  console.log(`\n  net exp = mean forward return after pessimistic cost-per-side (by mcap tier), entered at close.`);
  console.log(`  'vs baseline' = does the score band BEAT the all-coins drift? Positive AND beating baseline = real signal.`);
  console.log(`  CAVEAT: survivorship-biased OPTIMISTIC (today's coins). No edge here = decisive; edge here needs forward confirm.`);
  console.log(`  MOMENTUM BACKTEST VERDICT ${new Date().toISOString()} coins=${coinsUsed} FLAGS=${flags}${flags ? '' : ' (no edge that beats baseline after costs)'}\n`);
})();
