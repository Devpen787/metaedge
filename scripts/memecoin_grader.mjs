#!/usr/bin/env node
/**
 * MEMECOIN POP-GRADER — the measurement gate for Lane #3.
 *
 * Reads the blind scout snapshots (data/market/memecoin/pools-*.jsonl), turns
 * each pool into a point-in-time CANDIDATE, scores it, opens a DELIBERATELY
 * PESSIMISTIC paper entry, then grades what actually happened — and only a
 * positive expectancy UNDER THAT UNFAIR MODEL earns any further work (paid data,
 * execution, capital). No orders, no wallet: pure measurement.
 *
 * THE CORRECTNESS FIX THAT MAKES THIS HONEST (survivorship):
 *   The scout only records the top-20 new + top-20 trending pools, so a pool that
 *   pops-and-DIES vanishes from the snapshots (measured: 53% seen once in 18 min).
 *   Grading forward marks from snapshots alone would therefore keep only the pools
 *   that SURVIVED (trended) — a survivorship bias that manufactures a fake edge.
 *   FIX: forward marks come from each pool's per-pool minute OHLCV
 *   (/networks/{chain}/pools/{addr}/ohlcv/minute), which retains the candles of
 *   pools that rugged. The dump is in the data; the winner bias is not.
 *
 * NO LOOK-AHEAD: the signal uses only the snapshot's own fields; the entry and
 * every forward mark use only OHLCV candles STRICTLY AFTER the signal time.
 *
 * Usage (run where OHLCV is reachable — VM or Mac):
 *   node scripts/memecoin_grader.mjs [--days 2026-07-18] [--max 60] [--paper-usd 500]
 */
import fs from 'node:fs';
import path from 'node:path';
import { tStat, T_BAR } from './lib/stats.mjs';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Turns each pool\'s first qualifying snapshot into a pessimistic paper entry (LAG_SEC=90s late fill, liquidity-banded slippage on BOTH entry and exit, 1% flat round-trip DEX/priority fee), grades net return at 5/15/30/60min.',
  notYet: [
    'MAX_CANDIDATES=60 per run is a rate-limit budget, not a coverage cap — candidates beyond that wait for the next cron cycle, they are not dropped.',
    'FEE_FLAT_RT=1% (swap fee + priority-fee equivalent) is an estimate, not sourced from real DEX fee schedules per chain/aggregator — worth refining with real numbers once this lane has enough accrual to matter.',
    'Grades only pools old enough for a full forward window — early runs will show 0 gradeable candidates, which is expected accrual.',
  ],
  why: [
    'Forward marks come from each pool\'s own per-pool minute OHLCV, never from whether the pool stayed in later scout snapshots — the scout only records top-20 new + top-20 trending, so a pool that pops-and-dies (measured: 53% seen once in 18min) would otherwise silently vanish from a survivorship-biased sample.',
    'LAG_SEC=90 models that we are never first to a signal — an instant-fill backtest on a 45min-old-max pop would flatter the result relative to any real execution path.',
    'Exit pays the SAME liquidity-tiered slippage() as entry, not a flat rate — a real gap flagged during a cross-lane legibility review: this was previously the crudest exit-cost model of any grader (flat 2% regardless of pool liquidity) on the highest-exit-risk asset class (a memecoin pool\'s exit liquidity can be worse than its entry liquidity if it\'s rugging). Fixed to match the discipline momentum_grader.mjs already had on both sides.',
    'FLAGS requires the 60+ score band, n>=30, positive expectancy, AND a one-sample t-test t>=2 (scripts/lib/stats.mjs) — added after a cross-lane review found no grader checked whether its mean return was distinguishable from noise, only its sign.',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'memecoin');
const OHLCV_BASE = 'https://api.geckoterminal.com/api/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ---- deliberately conservative model constants (sensitivity-test these) ----
const LAG_SEC = 90;                 // we fill LATE: skip ~1.5 min after signal (latency honesty)
const HORIZONS = [5, 15, 30, 60];   // minutes to grade forward return at
// FEE_FLAT_RT is the part of round-trip cost that does NOT scale with
// liquidity (DEX swap fee + priority-fee equivalent, ~2 swaps). Previously
// this constant (as FEE_RT=0.02) ALSO absorbed exit-side slippage "for v1
// simplicity" — meaning exit slippage was flat regardless of pool liquidity,
// while entry slippage was properly liquidity-tiered. That was backwards: a
// memecoin pool's exit liquidity can evaporate faster than its entry
// liquidity (a rug dumps AFTER you're in), so the riskier side of the trade
// had the cruder model. Fixed: exit now pays the SAME liquidity-tiered
// slippage() as entry, and FEE_FLAT_RT drops to just the swap-fee component.
const FEE_FLAT_RT = 0.01;           // round-trip DEX swap fee + priority-fee equivalent only
const PAPER_USD = Number(flag('paper-usd', '500'));
const MAX_CANDIDATES = Number(flag('max', '60'));   // rate-limit budget per run
// slippage as a function of liquidity band (small notional eats more on thin
// books) — applied on BOTH entry and exit as of this fix, same function
// (a pool doesn't get MORE liquid just because you're now trying to leave).
function slippage(liqUsd) {
  if (!(liqUsd > 0)) return 0.25;
  if (liqUsd < 10000) return 0.08;
  if (liqUsd < 50000) return 0.04;
  if (liqUsd < 250000) return 0.02;
  return 0.01;
}
// ---- trigger: is this snapshot a candidate at all? (only signal-time fields) ----
const LIQ_FLOOR = 3000, VOL5_FLOOR = 500, MAX_AGE_MIN = 45;
function isCandidate(s) {
  if (!(s.liqUsd >= LIQ_FLOOR)) return false;            // untradeable / rug-thin
  if (!(s.ageMin != null && s.ageMin <= MAX_AGE_MIN)) return false;  // a POP, not an old coin
  const v5 = s.volUsd?.m5, tx5 = s.tx?.m5;
  if (!(v5 >= VOL5_FLOOR)) return false;                 // real recent activity
  if (!(tx5 && tx5.buyers >= 1)) return false;
  return true;
}
// ---- composite score 0..100 (simple v1; the data will say which parts matter) ----
function score(s) {
  const v5 = s.volUsd?.m5 || 0, tx5 = s.tx?.m5 || {};
  const buyers = tx5.buyers || 0, sellers = tx5.sellers || 0, buys = tx5.buys || 0, sells = tx5.sells || 0;
  const turnover = s.liqUsd > 0 ? v5 / s.liqUsd : 0;                       // volume vs liquidity
  const volScore = Math.min(25, turnover * 100);                          // 0..25
  const buyDom = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;
  const buyerAccel = (buyers + sellers) > 0 ? buyers / (buyers + sellers) : 0.5;
  const flowScore = Math.min(25, (buyDom * 0.5 + buyerAccel * 0.5) * 50 - 15); // rewards >50% buy
  const liqScore = Math.min(20, Math.log10(Math.max(1, s.liqUsd / LIQ_FLOOR)) * 12); // 0..20
  const chg5 = s.priceChgPct?.m5 || 0;
  const extPenalty = chg5 > 60 ? Math.min(20, (chg5 - 60) / 10) : 0;       // already-parabolic penalty
  const early = 15 - extPenalty;                                           // 0..15, prefer not extended
  return Math.max(0, Math.round(volScore + flowScore + liqScore + early));
}
const SCORE_BAR = 45;

async function ohlcv(chain, pool) {
  const url = `${OHLCV_BASE}/networks/${chain}/pools/${pool}/ohlcv/minute?aggregate=1&limit=200`;
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) return null;
    const j = await r.json();
    const list = j.data?.attributes?.ohlcv_list;   // [ [sec,o,h,l,c,v], ... ] newest-first
    return Array.isArray(list) ? list.map((c) => ({ t: c[0] * 1000, o: +c[1], h: +c[2], l: +c[3], c: +c[4], v: +c[5] })).sort((a, b) => a.t - b.t) : null;
  }
  return null;
}

// pick each pool's FIRST snapshot that qualifies as a candidate (the signal)
function signals(days) {
  const first = new Map();
  for (const day of days) {
    const fp = path.join(DIR, `pools-${day}.jsonl`);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) {
      let s; try { s = JSON.parse(line); } catch { continue; }
      if (!s.pool || !isCandidate(s)) continue;
      const key = `${s.chain}:${s.pool}`;
      const prev = first.get(key);
      if (!prev || s.t < prev.t) first.set(key, s);      // earliest qualifying snapshot
    }
  }
  return [...first.values()];
}

// nearest candle at-or-before a target time; and forward return at a horizon
function priceAt(candles, tMs) {
  let px = null;
  for (const c of candles) { if (c.t <= tMs) px = c.c; else break; }
  return px;
}

// pools already graded (grade each exactly once — safe to re-run on a cron)
function loadGraded() {
  const fp = path.join(DIR, 'paper-trades.jsonl');
  const done = new Set();
  if (fs.existsSync(fp)) for (const line of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(line); done.add(`${r.chain}:${r.pool}`); } catch { /* skip */ }
  }
  return done;
}

async function main() {
  const MATURE_MIN = Number(flag('mature-min', '60'));   // only grade a full forward window (0 = test mode)
  let days = flag('days', '');
  days = days ? days.split(',') : fs.readdirSync(DIR).filter((f) => f.startsWith('pools-')).map((f) => f.slice(6, -6)).sort();
  const done = loadGraded();
  const now = Date.now();
  const cands = signals(days)
    .filter((s) => !done.has(`${s.chain}:${s.pool}`))                 // grade once
    .filter((s) => now - s.t >= MATURE_MIN * 60000);                 // window complete
  cands.sort((a, b) => score(b) - score(a));
  const take = cands.slice(0, MAX_CANDIDATES);
  console.log(`\n=== Memecoin pop-grader — pessimistic fill (lag ${LAG_SEC}s, fee ${FEE_FLAT_RT * 100}% RT, slip by liq band on ENTRY AND EXIT) ===`);
  console.log(`  days: ${days.join(', ')} | candidates: ${cands.length} | grading top ${take.length} by score | paper $${PAPER_USD}\n`);

  const graded = [];
  for (const s of take) {
    const candles = await ohlcv(s.chain, s.pool);
    await sleep(2500);                                   // free-tier pacing
    if (!candles || candles.length < 3) { continue; }
    const entryT = s.t + LAG_SEC * 1000;
    // pessimistic entry: close of the first candle strictly after the lagged time
    const entryCandle = candles.find((c) => c.t >= entryT);
    if (!entryCandle) continue;
    const rawEntry = entryCandle.c;
    const entry = rawEntry * (1 + slippage(s.liqUsd));   // pay up on the buy
    if (!(entry > 0)) continue;

    const marks = {};
    for (const h of HORIZONS) {
      const px = priceAt(candles, s.t + h * 60000);
      if (px != null && candles.some((c) => c.t >= s.t + h * 60000 - 60000)) {
        // exit pays the SAME liquidity-tiered slippage as entry (not a flat
        // rate) — the pool's liquidity at exit time is what determines exit
        // cost, and it can be worse than at entry if the pool is dying.
        const exitPx = px * (1 - slippage(s.liqUsd));
        marks[`m${h}`] = +(((exitPx / entry) - 1 - FEE_FLAT_RT) * 100).toFixed(1);
      }
    }
    // peak / max-adverse across the graded window; death = price collapse to <15% of entry
    const win = candles.filter((c) => c.t > entryCandle.t && c.t <= s.t + 60 * 60000);
    const peak = win.length ? +((Math.max(...win.map((c) => c.h)) / entry - 1) * 100).toFixed(1) : null;
    const mae = win.length ? +((Math.min(...win.map((c) => c.l)) / entry - 1) * 100).toFixed(1) : null;
    const died = win.some((c) => c.c < entry * 0.15);
    graded.push({ chain: s.chain, pool: s.pool, name: s.name, score: score(s), liqUsd: s.liqUsd,
      ageMin: s.ageMin, entry, marks, peak, mae, died });
  }

  if (!graded.length) {
    console.log('  0 candidates had gradeable OHLCV yet (need pools old enough for a forward window).');
    console.log('  This is expected early — the scout must accrue. Pipeline is exercised; verdict awaits data.\n');
    return;
  }

  // paper-trade log (append-only) for later analysis
  fs.appendFileSync(path.join(DIR, 'paper-trades.jsonl'),
    graded.map((g) => JSON.stringify({ t: Date.now(), ...g })).join('\n') + '\n');

  // bucket by score band and report EV under the pessimistic model
  const bands = [[0, 45, 'reject <45'], [45, 60, '45-60'], [60, 75, '60-75'], [75, 101, '75+']];
  const H = 15; // headline horizon for the verdict
  console.log(`  ${'score band'.padEnd(12)} ${'n'.padStart(4)} ${`exp@${H}m`.padStart(9)} ${'win%'.padStart(6)} ${'died%'.padStart(6)} ${'avgPeak'.padStart(8)} ${'t'.padStart(5)}`);
  let flags = 0;
  for (const [lo, hi, label] of bands) {
    const g = graded.filter((x) => x.score >= lo && x.score < hi && x.marks[`m${H}`] != null);
    if (!g.length) { console.log(`  ${label.padEnd(12)} ${'0'.padStart(4)}       —`); continue; }
    const rets = g.map((x) => x.marks[`m${H}`]);
    const { mean: exp, t } = tStat(rets);
    const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const died = 100 * g.filter((x) => x.died).length / g.length;
    const peak = g.map((x) => x.peak).filter((v) => v != null);
    const avgPeak = peak.length ? peak.reduce((a, b) => a + b, 0) / peak.length : 0;
    const isFlag = lo >= 60 && g.length >= 30 && exp > 0 && t >= T_BAR;   // real bar: high-score, n>=30, positive after costs, t>=2
    if (isFlag) flags++;
    console.log(`  ${label.padEnd(12)} ${String(g.length).padStart(4)} ${(exp > 0 ? '+' : '') + exp.toFixed(1) + '%'} ${win.toFixed(0).padStart(5)}% ${died.toFixed(0).padStart(5)}% ${(avgPeak > 0 ? '+' : '') + avgPeak.toFixed(0) + '%'} ${t.toFixed(1).padStart(5)}${isFlag ? '  <== positive EV, t>=2' : ''}`);
  }
  console.log(`\n  Reading: exp@${H}m = mean net return after ${FEE_FLAT_RT * 100}% fee + liq-band slippage on BOTH sides, entered ${LAG_SEC}s LATE. t = one-sample t-stat vs 0.`);
  console.log(`  A real edge = a high-score band (60+) with n>=30, positive expectancy, AND t>=2 under this unfair fill.`);
  console.log(`  MEMECOIN GRADER VERDICT ${new Date().toISOString()} graded=${graded.length} FLAGS=${flags}${flags ? '' : ' (no edge yet / insufficient sample)'}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => console.error('[memecoin-grader] failed:', e.message));
