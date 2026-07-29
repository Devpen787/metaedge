#!/usr/bin/env node
/**
 * Cross-sectional funding carry (charter pool #1, variant: RELATIVE not absolute).
 *
 * funding_study.mjs asked "can you TIME one coin's carry?" — answer was no, timing
 * loses to buy-and-hold. This asks the different, canonical question desks actually
 * run: "does holding the HIGHEST-funding names and rotating as funding shifts beat
 * holding the majors?" The edge, if any, is in the DISPERSION of funding across the
 * cross-section — most perps sit at the ~11% base rate, a few pay far more.
 *
 * Trade modeled per coin: delta-neutral carry — long spot + short 1x perp. The short
 * perp RECEIVES funding when funding > 0 (payment for absorbing crowded longs).
 *
 * Honesty (same envelope as funding_study.mjs):
 *   - equal-weight N slots; idle slots earn 0 (capital is still tied up → conservative)
 *   - 40bps per name-episode (4 legs, round trip), charged on rotation and at close
 *   - basis modeled from the RECORDED premium series (entry premium − exit premium)
 *   - CAPITAL_MULTIPLE = 2: a delta-neutral pair ties up ~2x notional (spot + 1x margin),
 *     so APR-on-CAPITAL = APR-on-notional / 2. The falsifier is on CAPITAL.
 *   - margin/liquidation NOT modeled in this screen (needs klines) — survivors only.
 *   - exchange/custody risk on both legs — not backtestable, carried as a limit.
 *
 * Falsifier (pre-committed, matches the carry card): a config PASSES only if, on the
 * TEST half it never trained on, APR-on-capital > 5%, net > 0, AND it beats the
 * always-hold-all benchmark. Train = year 1 (pick params), test = year 2 (judge).
 *
 * Usage: node scripts/funding_xsection.mjs (--coins A,B | --universe-file PATH)
 * Every evaluation is appended to data/edgeops/hypothesis-registry.jsonl.
 */
import fs from 'node:fs';
import { fundingAprPercent, annualizedReturnPercent, HOURS_PER_YEAR } from '../server/units.mjs';
import { explicitUniverse } from './lib/universe.mjs';

const args = process.argv.slice(2);
const COINS = explicitUniverse(args, 'coins');
const COST_EPISODE = 0.004;   // 40bps round trip per name-episode
const CAPITAL_MULTIPLE = 2;   // delta-neutral pair ties up ~2x notional
const TRAIL_N = 24;           // trailing window (hours) for the funding signal

const registry = fs.createWriteStream('data/edgeops/hypothesis-registry.jsonl', { flags: 'a' });
const dstr = new Date().toISOString().slice(0, 10);
const out = []; const p = (s = '') => out.push(s);

// hour -> { funding, premium } per coin
function loadCoin(coin) {
  const rows = fs.readFileSync(`data/market/funding-hist-${coin}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const m = new Map();
  for (const r of rows) m.set(Math.floor(r.t / 3_600_000), { funding: r.funding, premium: r.premium ?? 0 });
  return m;
}

const data = {};
for (const c of COINS) { try { data[c] = loadCoin(c); } catch { /* skip missing */ } }
const pool = COINS.filter((c) => data[c] && data[c].size > 0);

// Common hour window = the span where the MAJORS anchor exists. Rank only coins
// present at each hour, so a short-history coin simply isn't eligible early.
const allHours = new Set();
for (const c of pool) for (const h of data[c].keys()) allHours.add(h);
const hours = [...allHours].sort((a, b) => a - b);
const H0 = hours[0], H1 = hours[hours.length - 1];

function trailingApr(coin, h) {
  const m = data[coin];
  let sum = 0, n = 0;
  for (let k = h - TRAIL_N; k < h; k++) { const r = m.get(k); if (r) { sum += r.funding; n++; } }
  if (n < TRAIL_N * 0.5) return null; // need ≥half the window recorded
  return fundingAprPercent(sum / n);
}

// Run the cross-sectional portfolio over [from,to). Returns net-on-notional and derived APRs.
function simulate(N, rebalHrs, minEntryApr, from, to) {
  const held = new Map();   // coin -> entryPremium
  let accNotional = 0;      // portfolio net on notional, each name weighted 1/N
  let entries = 0;          // rotation count (cost transparency)
  const close = (coin, h) => {
    const r = data[coin].get(h); if (!r) { held.delete(coin); return; }
    const basis = (held.get(coin) ?? 0) - r.premium;   // short perp: sell at entry prem, buy back at exit prem
    accNotional += (basis - COST_EPISODE) / N;
    held.delete(coin);
  };
  for (let h = from; h < to; h++) {
    if ((h - from) % rebalHrs === 0) {
      const ranked = pool
        .map((c) => ({ c, apr: trailingApr(c, h), r: data[c].get(h) }))
        .filter((x) => x.apr != null && x.r && x.apr >= minEntryApr)
        .sort((a, b) => b.apr - a.apr);
      const want = new Set(ranked.slice(0, N).map((x) => x.c));
      for (const c of [...held.keys()]) if (!want.has(c)) close(c, h);
      for (const x of ranked.slice(0, N)) if (!held.has(x.c)) { held.set(x.c, x.r.premium); entries++; }
    }
    for (const c of held.keys()) { const r = data[c].get(h); if (r) accNotional += r.funding / N; }
  }
  for (const c of [...held.keys()]) close(c, to - 1);
  const hoursDeployed = to - from;
  const aprNotional = annualizedReturnPercent(accNotional, hoursDeployed);
  return {
    netNotionalPct: accNotional * 100,
    aprNotional,
    aprCapital: aprNotional / CAPITAL_MULTIPLE,
    entries,
  };
}

p(`# Cross-Sectional Funding Carry — ${dstr}`);
p();
p(`Hold the top-N highest trailing-funding perps delta-neutral (long spot + short 1x perp),`);
p(`rotate every rebalance. Pool: ${pool.join(', ')}. Costs 40bps/name-episode; basis from`);
p(`recorded premium; APR-on-capital = APR-on-notional / ${CAPITAL_MULTIPLE}. Falsifier: test`);
p(`APR-on-capital > 5%, net > 0, beats always-hold-all. Train = yr1, test = yr2.`);
p();

const mid = H0 + Math.floor((H1 - H0) / 2);

// Benchmark: hold the WHOLE pool equal-weight, never rotate (N = pool, one entry/exit).
const benchTest = simulate(pool.length, H1 - mid + 1, -1e9, mid, H1);
p(`## Benchmark — always-hold-all-${pool.length}, equal weight (test half)`);
p(`- net-on-notional ${benchTest.netNotionalPct.toFixed(2)}% · APR-on-notional ${benchTest.aprNotional.toFixed(1)}% · **APR-on-capital ${benchTest.aprCapital.toFixed(1)}%**`);
p();

p(`## Rotation configs — train picks, test judges`);
p(`| N | rebalance | min-entry APR | test net (notional) | test APR-capital | rotations | vs 5% floor | vs bench |`);
p(`|---|---|---|---|---|---|---|---|`);

let evals = 0; let best = null;
for (const N of [1, 2, 3, 5]) {
  for (const rebalHrs of [24, 168]) {
    for (const minEntryApr of [0, 11, 30]) {
      if (N > pool.length) continue;
      const tr = simulate(N, rebalHrs, minEntryApr, H0, mid);
      evals++;
      registry.write(JSON.stringify({ t: Date.now(), family: 'funding_carry_xsection', phase: 'train', params: { N, rebalHrs, minEntryApr, trailN: TRAIL_N }, pool, ...tr }) + '\n');
      if (best == null || tr.netNotionalPct > best.tr.netNotionalPct) best = { N, rebalHrs, minEntryApr, tr };
    }
  }
}
// Judge the train-best config on the test half.
const tst = simulate(best.N, best.rebalHrs, best.minEntryApr, mid, H1);
evals++;
registry.write(JSON.stringify({ t: Date.now(), family: 'funding_carry_xsection', phase: 'test', params: { N: best.N, rebalHrs: best.rebalHrs, minEntryApr: best.minEntryApr, trailN: TRAIL_N }, pool, ...tst }) + '\n');
const passFloor = tst.aprCapital > 5;
const passBench = tst.aprCapital > benchTest.aprCapital;
const pass = passFloor && tst.netNotionalPct > 0 && passBench;
p(`| ${best.N} | ${best.rebalHrs === 24 ? 'daily' : 'weekly'} | ${best.minEntryApr}% | ${tst.netNotionalPct.toFixed(2)}% | **${tst.aprCapital.toFixed(1)}%** | ${tst.entries} | ${passFloor ? 'PASS' : 'fail'} | ${passBench ? 'PASS' : 'fail'} |`);
p();
p(`## Multiple-testing accounting`);
p(`- funding_carry_xsection evaluations this run: ${evals}, appended to the registry.`);
p();
p(`## Verdict`);
p(`- Train-best config: N=${best.N}, ${best.rebalHrs === 24 ? 'daily' : 'weekly'} rebalance, min-entry ${best.minEntryApr}% APR.`);
p(`- **${pass ? 'FORWARD-TEST CANDIDATE' : 'KILL'}** — test APR-on-capital ${tst.aprCapital.toFixed(1)}% vs 5% floor and ${benchTest.aprCapital.toFixed(1)}% benchmark.${pass ? '' : ' Cross-sectional rotation does not clear the capital-adjusted bar.'}`);
p();
p(`## Unmodeled (stated, not hidden)`);
p(`- Margin/liquidation: not in this screen (needs klines) — a survivor gets a full margin check before any capital.`);
p(`- Spot hedgeability: assumes each held name has an accessible spot leg; memes/new listings may not.`);
p(`- Exchange/custody risk on both legs — not backtestable.`);

registry.end();
const outPath = `data/edgeops/funding-xsection-${dstr}.md`;
fs.writeFileSync(outPath, out.join('\n'));
console.log(out.join('\n'));
console.log(`\nWritten to ${outPath}`);
