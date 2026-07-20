#!/usr/bin/env node
/**
 * STOCK MOMENTUM GRADER — the edge test for the stock radar. Each stock the scout
 * flagged (score >= bar) becomes a pessimistic paper entry; measures forward return
 * net of costs at 1/3/7 trading days, bucketed by score. Only a high-score bucket
 * that nets POSITIVE under an unfair fill earns the signal a place. No broker, no
 * order path.
 *
 * SURVIVORSHIP FIX (same as memecoin/crypto graders): a flagged stock that reverses
 * can drop off the movers screeners and vanish from later scans. So forward marks
 * come from each stock's ACTUAL Yahoo chart history, not from whether it stayed in
 * our scan — the reversals stay in the data, the winner bias does not.
 *
 * PESSIMISTIC FILL: entry at the next daily close AFTER the signal (we are not
 * first), cost-per-side scaled by liquidity (small-caps wider), on entry AND exit.
 *
 * NO LOOK-AHEAD: entry uses only bars after signal; forward marks strictly later.
 * Idempotent: grades each stock's first signal once, when the 7d window is complete.
 *
 * Usage (VM): node scripts/stock_grader.mjs [--score-bar 45] [--max 60] [--mature-days 7]
 */
import fs from 'node:fs';
import path from 'node:path';
import { tStat, T_BAR } from './lib/stats.mjs';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Grades every stock (from either stock_scout.mjs or stock_scout_wide.mjs) that cleared SCORE_BAR (default 45) as a pessimistic paper entry, net-of-cost forward return at 1/3/7 trading days.',
  notYet: [
    'Grades a stock\'s FIRST qualifying signal only per rotation cycle — no re-grading on a later, different-score re-trigger.',
    'Yahoo chart history only — no cross-check against real broker fill data (this system has no live equities execution path at all).',
    'No verdict until n>=30 in a high band with a complete 7d window AND t>=2 — early runs show 0 gradeable, expected accrual.',
  ],
  why: [
    'Entry priced at the next daily close AFTER signal (never at signal) — same never-first discipline as every other directional grader in this codebase.',
    'Cost-per-side scales 0.05%-0.6%+near-zero commission by daily dollar-volume tier — small-caps get a realistically wider cost than large-caps, not one blended average.',
    'Forward marks come from each stock\'s own actual Yahoo history, not from whether it stayed in later scans — a reversing stock can drop off the movers screeners; the reversal must stay in the graded data, not silently vanish (same survivorship fix as the crypto/memecoin graders).',
    'FLAGS requires the 60+ band, n>=30, positive net expectancy, AND a one-sample t-test t>=2 (scripts/lib/stats.mjs) — added after a cross-lane review found no grader checked whether its mean return was distinguishable from noise, only its sign.',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'stocks');
const SCORE_BAR = Number(flag('score-bar', '45'));
const MAX = Number(flag('max', '60'));
const MATURE_DAYS = Number(flag('mature-days', '7'));   // grade once, when 1/3/7d all complete
const HORIZONS = [1, 3, 7];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

// cost-per-side (slippage + fee) scaled by daily dollar-volume (liquidity)
function costPerSide(dvol) {
  const slip = !(dvol > 0) ? 0.01 : dvol > 1e8 ? 0.0005 : dvol > 2e7 ? 0.0015 : dvol > 5e6 ? 0.003 : 0.006;
  return slip + 0.0001;   // near-zero modern commission
}

async function chart(sym) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const ts = res?.timestamp, cl = res?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(ts) || !Array.isArray(cl)) return null;
    const out = [];
    for (let k = 0; k < ts.length; k++) if (cl[k] != null) out.push([ts[k] * 1000, cl[k]]);
    return out.length ? out : null;
  }
  return null;
}

function signals() {
  const first = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('scan-'))) {
    for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (!(r.score >= SCORE_BAR) || !r.sym) continue;
      const prev = first.get(r.sym);
      if (!prev || r.t < prev.t) first.set(r.sym, r);
    }
  }
  return [...first.values()];
}
function loadGraded() {
  const fp = path.join(DIR, 'paper-trades.jsonl');
  const done = new Set();
  if (fs.existsSync(fp)) for (const l of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).sym); } catch { /**/ } }
  return done;
}
const priceAt = (series, tMs) => { let px = null; for (const [t, p] of series) { if (t <= tMs) px = p; else break; } return px; };
const priceAfter = (series, tMs) => { for (const [t, p] of series) if (t >= tMs) return p; return null; };

async function main() {
  if (!fs.existsSync(DIR)) { console.log('no stock scans yet'); return; }
  const done = loadGraded();
  const now = Date.now();
  const cands = signals()
    .filter((s) => !done.has(s.sym))
    .filter((s) => now - s.t >= MATURE_DAYS * DAY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);
  console.log(`\n=== Stock momentum grader — pessimistic fill, net of costs, by score band ===`);
  console.log(`  score bar ${SCORE_BAR} | mature >= ${MATURE_DAYS}d | grading ${cands.length} candidates\n`);

  const graded = [];
  for (const s of cands) {
    const series = await chart(s.sym);
    await sleep(1200);
    if (!series || series.length < 5) continue;
    const entryRaw = priceAfter(series, s.t + DAY);         // next daily close after signal (we are not first)
    if (!(entryRaw > 0)) continue;
    const cps = costPerSide(s.dollarVol);
    const entry = entryRaw * (1 + cps);
    const marks = {};
    for (const h of HORIZONS) {
      const fwd = priceAt(series, s.t + h * DAY);
      if (fwd != null && now - s.t >= h * DAY) marks[`d${h}`] = +(((fwd * (1 - cps)) / entry - 1) * 100).toFixed(1);
    }
    graded.push({ sym: s.sym, score: s.score, dollarVol: s.dollarVol, chg52wAtSignal: s.chg52w, cps: +(cps * 100).toFixed(2), marks });
  }

  if (!graded.length) { console.log('  0 candidates gradeable yet (need a full forward window). Pipeline exercised; verdict awaits accrual.\n'); return; }
  fs.appendFileSync(path.join(DIR, 'paper-trades.jsonl'), graded.map((g) => JSON.stringify({ t: Date.now(), ...g })).join('\n') + '\n');

  const bands = [[SCORE_BAR, 60, `${SCORE_BAR}-60`], [60, 999, '60+']];
  const H = 3;
  console.log(`  ${'band'.padEnd(8)} ${'n'.padStart(4)} ${`exp@${H}d`.padStart(9)} ${'win%'.padStart(6)} ${'avgCost'.padStart(8)} ${'t'.padStart(5)}`);
  let flags = 0;
  for (const [lo, hi, label] of bands) {
    const g = graded.filter((x) => x.score >= lo && x.score < hi && x.marks[`d${H}`] != null);
    if (!g.length) { console.log(`  ${label.padEnd(8)} ${'0'.padStart(4)}       —`); continue; }
    const rets = g.map((x) => x.marks[`d${H}`]);
    const { mean: exp, t } = tStat(rets);
    const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const cost = g.reduce((a, x) => a + x.cps, 0) / g.length;
    const isFlag = lo >= 60 && g.length >= 30 && exp > 0 && t >= T_BAR;
    if (isFlag) flags++;
    console.log(`  ${label.padEnd(8)} ${String(g.length).padStart(4)} ${(exp > 0 ? '+' : '') + exp.toFixed(1) + '%'} ${win.toFixed(0).padStart(5)}% ${cost.toFixed(2).padStart(7)}% ${t.toFixed(1).padStart(5)}${isFlag ? '  <== net positive, t>=2' : ''}`);
  }
  console.log(`\n  exp@${H}d = mean net return after pessimistic fill (entered next close, cost-per-side by liquidity). t = one-sample t-stat vs 0.`);
  console.log(`  Edge = a high-score band (60+) with n>=30, positive net, AND t>=2. Prior: stocks efficient, expect sub-cost.`);
  console.log(`  STOCK GRADER VERDICT ${new Date().toISOString()} graded=${graded.length} FLAGS=${flags}${flags ? '' : ' (no edge yet / insufficient sample)'}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => console.error('[stock-grader] failed:', e.message));
