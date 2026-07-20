#!/usr/bin/env node
/**
 * WIDE MOMENTUM GRADER — the edge test for the momentum radar. Turns each coin the
 * scout flagged (score >= bar) into a pessimistic paper entry and measures the
 * forward return net of costs at 1/3/7 days, bucketed by score. Only a high-score
 * bucket that nets POSITIVE under an unfair fill earns the signal a place as a
 * portfolio engine. No orders.
 *
 * SURVIVORSHIP FIX (same lesson as memecoins): a flagged coin that dumps can fall
 * below the scout's liquidity floor and vanish from later scans. So forward marks
 * come from each coin's ACTUAL price history (CoinGecko market_chart), NOT from
 * whether it stayed in our scan — the dumps stay in the data, the winner bias does not.
 *
 * PESSIMISTIC FILL: small-caps have wide spreads, so cost-per-side scales with how
 * small the coin is (3% under $10M mcap ... 0.2% over $1B), plus a taker fee. Entry
 * pays up, exit pays down. An edge that only exists at mid-price is the small-cap lie.
 *
 * NO LOOK-AHEAD: entry = price at signal time t0; forward marks use only prices
 * strictly after t0. Idempotent: grades each coin's first signal once, when mature.
 *
 * Usage: node scripts/momentum_grader.mjs [--score-bar 60] [--max 40] [--mature-days 1]
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see momentum_scout.mjs for discovery-side scope; this is
// the validation side (what "edge" is allowed to mean here, and why).
export const LEGIBILITY = {
  doing: 'Grades every momentum_scout candidate whose score cleared SCORE_BAR (default 60) as a pessimistic paper entry, measures net-of-cost forward return at 1/3/7d, buckets by score.',
  notYet: [
    'Grades a coin\'s FIRST qualifying signal only — does not re-grade if it re-triggers later at a different score.',
    'Only crypto/USD-denominated CoinGecko price history; no cross-check against actual exchange fill data.',
    'No FLAGS until n>=30 in the 75+ band with a full 7d window — early runs will show 0 candidates gradeable, which is expected accrual, not a bug.',
  ],
  why: [
    'Entry priced ~1h AFTER signal time (`s.t + 3600000`), not at signal — we are never first to a signal, so grading as if we were would flatter the result.',
    'Cost-per-side scales 0.2%-3%+fee by market-cap tier (`costPerSide`) because small-cap slippage is real and a mid-price backtest is the small-cap lie this grader exists to catch.',
    'FLAGS only fires on the 75+ band with n>=30 and positive net expectancy — the 60-75 band is tracked but never counted as a verdict on its own (insufficient bar to trust).',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'momentum');
const SCORE_BAR = Number(flag('score-bar', '60'));
const MAX = Number(flag('max', '40'));
// Grade once, when ALL horizons are complete (dedup is by coin), so maturity = the
// LONGEST horizon (7d). Grading earlier would capture 1d but lock out 3d/7d marks.
const MATURE_DAYS = Number(flag('mature-days', '7'));
const FEE = 0.002;                                          // taker fee per side
const HORIZONS = [1, 3, 7];                                  // days
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const DAY = 86400000;

// cost-per-side (slippage + fee) scaled by how small/illiquid the coin is
function costPerSide(mcap) {
  const slip = !(mcap > 0) ? 0.05 : mcap < 1e7 ? 0.03 : mcap < 1e8 ? 0.015 : mcap < 1e9 ? 0.005 : 0.002;
  return slip + FEE;
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

// first snapshot per coin where score >= bar = the signal
function signals() {
  const first = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('scan-'))) {
    for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (!(r.score >= SCORE_BAR) || !r.id) continue;
      const prev = first.get(r.id);
      if (!prev || r.t < prev.t) first.set(r.id, r);
    }
  }
  return [...first.values()];
}

function loadGraded() {
  const fp = path.join(DIR, 'paper-trades.jsonl');
  const done = new Set();
  if (fs.existsSync(fp)) for (const l of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).id); } catch { /**/ } }
  return done;
}
const priceAt = (series, tMs) => { let px = null; for (const [t, p] of series) { if (t <= tMs) px = p; else break; } return px; };

async function main() {
  const done = loadGraded();
  const now = Date.now();
  const cands = signals()
    .filter((s) => !done.has(s.id))
    .filter((s) => now - s.t >= MATURE_DAYS * DAY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);
  console.log(`\n=== Momentum grader — pessimistic fill, net of costs, by score band ===`);
  console.log(`  score bar ${SCORE_BAR} | mature >= ${MATURE_DAYS}d | grading ${cands.length} candidates\n`);

  const graded = [];
  for (const s of cands) {
    const j = await cg(`https://api.coingecko.com/api/v3/coins/${s.id}/market_chart?vs_currency=usd&days=10`);
    await sleep(2500);
    const series = j && Array.isArray(j.prices) ? j.prices : null;
    if (!series || series.length < 12) continue;
    const entryRaw = priceAt(series, s.t + 3600000);         // ~1h after signal (we are not first)
    if (!(entryRaw > 0)) continue;
    const cps = costPerSide(s.mcap);
    const entry = entryRaw * (1 + cps);                       // pay up on entry
    const marks = {};
    for (const h of HORIZONS) {
      const fwd = priceAt(series, s.t + h * DAY);
      if (fwd != null && now - s.t >= h * DAY) marks[`d${h}`] = +(((fwd * (1 - cps)) / entry - 1) * 100).toFixed(1);
    }
    graded.push({ id: s.id, sym: s.sym, score: s.score, mcap: s.mcap, d7AtSignal: s.d7, cps: +(cps * 100).toFixed(1), marks });
  }

  if (!graded.length) { console.log('  0 candidates gradeable yet (need a full forward window). Pipeline exercised; verdict awaits accrual.\n'); return; }
  fs.appendFileSync(path.join(DIR, 'paper-trades.jsonl'), graded.map((g) => JSON.stringify({ t: Date.now(), ...g })).join('\n') + '\n');

  const bands = [[SCORE_BAR, 75, `${SCORE_BAR}-75`], [75, 200, '75+']];
  const H = 3;
  console.log(`  ${'band'.padEnd(8)} ${'n'.padStart(4)} ${`exp@${H}d`.padStart(9)} ${'win%'.padStart(6)} ${'avgCost'.padStart(8)}`);
  let flags = 0;
  for (const [lo, hi, label] of bands) {
    const g = graded.filter((x) => x.score >= lo && x.score < hi && x.marks[`d${H}`] != null);
    if (!g.length) { console.log(`  ${label.padEnd(8)} ${'0'.padStart(4)}       —`); continue; }
    const rets = g.map((x) => x.marks[`d${H}`]);
    const exp = rets.reduce((a, b) => a + b, 0) / rets.length;
    const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const cost = g.reduce((a, x) => a + x.cps, 0) / g.length;
    const isFlag = lo >= 75 && g.length >= 30 && exp > 0;
    if (isFlag) flags++;
    console.log(`  ${label.padEnd(8)} ${String(g.length).padStart(4)} ${(exp > 0 ? '+' : '') + exp.toFixed(1) + '%'} ${win.toFixed(0).padStart(5)}% ${cost.toFixed(1).padStart(7)}%${isFlag ? '  <== net positive' : ''}`);
  }
  console.log(`\n  exp@${H}d = mean net return after pessimistic fill (entered ~1h late, cost-per-side by mcap tier).`);
  console.log(`  Edge = a high-score band (75+) with n>=30 and positive net. Small-cap tail is the untested bet.`);
  console.log(`  MOMENTUM GRADER VERDICT ${new Date().toISOString()} graded=${graded.length} FLAGS=${flags}${flags ? '' : ' (no edge yet / insufficient sample)'}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => console.error('[momentum-grader] failed:', e.message));
