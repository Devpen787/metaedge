#!/usr/bin/env node
/**
 * PRE-REGISTERED TEST — funding-crowding-signal-v1
 * Card: docs/edgeops/cards/funding-crowding-signal-v1.md
 *
 * Primary hypothesis (fixed BEFORE running):
 *   mean 48h forward return of TOP trailing-funding decile
 *   minus that of the BOTTOM decile, pooled across 5 coins,
 *   is NEGATIVE (one-sided, alpha=0.05) AND its magnitude exceeds 20bps.
 *
 * Non-overlapping 48h samples so forward returns are not autocorrelated.
 * Secondary horizons are EXPLORATORY and may not be promoted to a claim.
 */
import fs from 'node:fs';
import { fundingAprPercent } from '../server/units.mjs';

const COINS = ['AVAX', 'BTC', 'DOGE', 'ETH', 'SOL']; // funding history ∩ price bars
const TRAIL_H = 24;          // trailing window for the crowding feature
const PRIMARY_HORIZON = 48;  // hours, chosen a priori
const COST_BPS = 20;         // round-trip economic threshold
const DECILE = 0.1;

const load = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));

function series(coin) {
  const fund = load(`data/market/funding-hist-${coin}.jsonl`);
  const bars = load(`data/market/backfill-${coin}-1h.jsonl`);
  // hour-floor join: funding stamps drift seconds past the hour (per contract)
  const px = new Map();
  for (const b of bars) px.set(Math.floor(b.t / 3_600_000), b.c);
  const rows = [];
  for (const f of fund) {
    const h = Math.floor(f.t / 3_600_000);
    const p = px.get(h);
    if (p != null && typeof f.funding === 'number') rows.push({ h, funding: f.funding, px: p });
  }
  return rows.sort((a, b) => a.h - b.h);
}

// mean, variance, one-sided Welch t-test (H1: mean(a) < mean(b))
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const varr = (a) => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
function welch(a, b) {
  const va = varr(a) / a.length, vb = varr(b) / b.length;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { t, df };
}
// one-sided p from t (normal approx; df here is in the hundreds)
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y; };
const pOneSidedLess = (t) => 0.5 * (1 + erf(t / Math.SQRT2)); // P(T <= t)

function sample(rows, horizon) {
  // trailing funding APR (percent) at i; forward return over `horizon`;
  // step by `horizon` so windows never overlap.
  const out = [];
  for (let i = TRAIL_H; i + horizon < rows.length; i += horizon) {
    const meanHourly = rows.slice(i - TRAIL_H, i).reduce((s, r) => s + r.funding, 0) / TRAIL_H;
    const apr = fundingAprPercent(meanHourly);
    if (apr == null) continue;
    const fwd = (rows[i + horizon].px - rows[i].px) / rows[i].px * 10_000; // bps
    out.push({ apr, fwd });
  }
  return out;
}

function decileSpread(samples) {
  // rank WITHIN coin, then pool — coins have different funding regimes
  const sorted = [...samples].sort((a, b) => a.apr - b.apr);
  const k = Math.max(2, Math.floor(sorted.length * DECILE));
  return { bottom: sorted.slice(0, k).map((s) => s.fwd), top: sorted.slice(-k).map((s) => s.fwd) };
}

function run(horizon, label, confirmatory) {
  const top = [], bottom = [];
  const perCoin = [];
  for (const c of COINS) {
    const s = sample(series(c), horizon);
    const d = decileSpread(s);
    top.push(...d.top); bottom.push(...d.bottom);
    perCoin.push({ coin: c, n: s.length, spread: mean(d.top) - mean(d.bottom) });
  }
  const spread = mean(top) - mean(bottom);
  const { t } = welch(top, bottom);
  const p = pOneSidedLess(t); // H1: top < bottom  => small p supports hypothesis

  console.log(`\n${label}  (n_top=${top.length}, n_bottom=${bottom.length}, non-overlapping ${horizon}h)`);
  console.log(`  mean forward return, TOP funding decile   : ${mean(top).toFixed(1)} bps`);
  console.log(`  mean forward return, BOTTOM funding decile: ${mean(bottom).toFixed(1)} bps`);
  console.log(`  spread (top - bottom)                     : ${spread.toFixed(1)} bps   [predicted: NEGATIVE]`);
  console.log(`  one-sided t = ${t.toFixed(3)},  p = ${p.toFixed(4)}`);

  if (confirmatory) {
    const sig = p < 0.05;
    const econ = Math.abs(spread) > COST_BPS && spread < 0;
    console.log(`\n  falsifier check:`);
    console.log(`    (a) significantly negative at alpha=0.05 one-sided? ${sig && spread < 0 ? 'YES' : 'NO'}`);
    console.log(`    (b) magnitude exceeds ${COST_BPS}bps round-trip cost? ${econ ? 'YES' : 'NO'}`);
    console.log(`\n  VERDICT: ${sig && spread < 0 && econ ? 'SURVIVES — signal exists and is economically meaningful' : 'KILLED by its own pre-committed falsifier'}`);
  } else {
    console.log('  (EXPLORATORY — may not be promoted to a claim)');
  }
  return { spread, p, perCoin };
}

console.log('funding-crowding-signal-v1 — PRE-REGISTERED TEST');
console.log(`universe: ${COINS.join(', ')} | feature: trailing ${TRAIL_H}h mean funding APR (percent)`);

const primary = run(PRIMARY_HORIZON, `PRIMARY (confirmatory): ${PRIMARY_HORIZON}h forward return`, true);

console.log('\n\n--- SECONDARY, EXPLORATORY ONLY (declared in advance; cannot become a claim) ---');
for (const h of [24, 72]) run(h, `exploratory: ${h}h forward return`, false);

console.log('\nper-coin decile spread at the primary horizon (descriptive only):');
for (const c of primary.perCoin) console.log(`  ${c.coin.padEnd(6)} n=${String(c.n).padStart(4)}  spread ${c.spread.toFixed(1).padStart(8)} bps`);
console.log();
