#!/usr/bin/env node
/**
 * MARKET-MAKING GRADER (Lane #4 gate) — realized-spread decomposition with a HARD
 * self-check that refuses to report an edge it cannot honestly measure.
 *
 * Per trade (taker side D: +1 buy / -1 sell), with mid at trade time and T-later:
 *   effective half = D·(price − mid_t)/mid_t        (gross a maker gains ~ half spread)
 *   realized  half = D·(price − mid_{t+T})/mid_t     (what the maker KEEPS post-move)
 *   adverse sel.   = effective − realized            (informed-flow cost)
 * A market-maker's edge is realized half-spread minus maker fee.
 *
 * THE HARD SELF-CHECK (why this exists): measuring effective spread needs the mid
 * at the TRADE INSTANT. Our REST scout samples the book only every ~14s, so a stale
 * mid swamps the signal. If the measured effective half-spread does NOT reproduce
 * the quoted half-spread (within tolerance), the mid-sync is too poor and any
 * adverse-selection number is noise — so the grader REFUSES a verdict for that pair
 * rather than lie. Passing this check is the precondition for trusting anything else.
 *
 * Usage: node scripts/mm_grader.mjs [--days ...] [--tol-ms 8000] [--fee-bps 0]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'mm');
const TOL = Number(flag('tol-ms', '8000'));     // a trade must have a quote within this to be measured
const FEE_BPS = Number(flag('fee-bps', '0'));   // maker fee (bps) subtracted from realized half-spread
const HORIZONS = [1, 5, 15];                     // minutes; horizons a slow player can actually reach
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

let days = flag('days', '');
days = days ? days.split(',') : fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.startsWith('quotes-')).map((f) => f.slice(7, -6)).sort() : [];

// load quote series per pair (sorted by t) and deduped trades
const quotes = {}; const trades = [];
for (const day of days) {
  const qf = path.join(DIR, `quotes-${day}.jsonl`), tf = path.join(DIR, `trades-${day}.jsonl`);
  if (fs.existsSync(qf)) for (const l of fs.readFileSync(qf, 'utf8').split('\n').filter(Boolean)) { try { const q = JSON.parse(l); (quotes[q.pair] = quotes[q.pair] || []).push(q); } catch { /**/ } }
  if (fs.existsSync(tf)) for (const l of fs.readFileSync(tf, 'utf8').split('\n').filter(Boolean)) { try { trades.push(JSON.parse(l)); } catch { /**/ } }
}
for (const p in quotes) quotes[p].sort((a, b) => a.t - b.t);
const seen = new Set();
const uniqTrades = trades.filter((x) => { const k = `${x.pair}:${x.tradeId}`; if (seen.has(k)) return false; seen.add(k); return true; });

// nearest quote to a time within TOL (binary search)
function midAt(pair, tt, tol = TOL) {
  const arr = quotes[pair]; if (!arr || !arr.length) return null;
  let lo = 0, hi = arr.length - 1, best = null, bd = Infinity;
  while (lo <= hi) { const m = (lo + hi) >> 1; const d = arr[m].t - tt; if (Math.abs(d) < bd) { bd = Math.abs(d); best = arr[m]; } if (d < 0) lo = m + 1; else hi = m - 1; }
  return bd <= tol ? best : null;
}

console.log(`\n=== Market-making grader — realized-spread decomposition (tol ${TOL}ms, fee ${FEE_BPS}bp) ===`);
console.log(`  days: ${days.join(', ')} | quotes: ${Object.values(quotes).reduce((s, a) => s + a.length, 0)} | trades: ${uniqTrades.length}\n`);

const pairs = [...new Set(uniqTrades.map((x) => x.pair))].sort();
console.log(`  ${'pair'.padEnd(9)} ${'n'.padStart(5)} ${'quotedHf'.padStart(9)} ${'measEffHf'.padStart(10)} ${'check'.padStart(6)}  | ${'realHf@5m'.padStart(10)} ${'advSel'.padStart(8)} ${'net'.padStart(8)}`);
let flags = 0;
for (const pair of pairs) {
  const tr = uniqTrades.filter((x) => x.pair === pair);
  // side convention D: measure avg (price-mid) for buys; if buys sit above mid, buy=taker (D=+1)
  const rel = { buy: [], sell: [] };
  const eff = []; const realized = { 1: [], 5: [], 15: [] };
  let quotedHalfSum = 0, quotedN = 0;
  for (const x of tr) {
    const q0 = midAt(pair, x.t); if (!q0) continue;
    const mid = q0.mid; if (!(mid > 0) || !(x.price > 0)) continue;
    rel[x.side]?.push((x.price - mid) / mid * 1e4);
    quotedHalfSum += q0.spreadBps / 2; quotedN++;
  }
  // decide D from the data: buy side whose avg (price-mid) is higher is the ASK-lifting (taker-buy) side
  const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const buyAbove = avg(rel.buy) >= avg(rel.sell);
  const Dof = (side) => (side === 'buy' ? (buyAbove ? 1 : -1) : (buyAbove ? -1 : 1));
  for (const x of tr) {
    const q0 = midAt(pair, x.t); if (!q0) continue;
    const mid = q0.mid; if (!(mid > 0)) continue;
    const D = Dof(x.side);
    eff.push(D * (x.price - mid) / mid * 1e4);
    for (const h of HORIZONS) { const qf = midAt(pair, x.t + h * 60000, Math.max(TOL, 15000)); if (qf) realized[h].push(D * (x.price - qf.mid) / mid * 1e4); }
  }
  const n = eff.length;
  const quotedHalf = quotedN ? quotedHalfSum / quotedN : 0;
  const measEff = avg(eff);
  // HARD SELF-CHECK: measured effective half-spread must reproduce the quoted half
  const ok = n >= 30 && measEff > 0 && measEff >= 0.4 * quotedHalf && measEff <= 1.6 * quotedHalf;
  const realHf5 = realized[5].length >= 30 ? avg(realized[5]) : null;
  const adv = realHf5 != null ? measEff - realHf5 : null;
  const net = realHf5 != null ? realHf5 - FEE_BPS : null;
  const isFlag = ok && net != null && net > 0 && quotedHalf > 3;   // real edge: check passed, wide pair, positive net
  if (isFlag) flags++;
  console.log(`  ${pair.padEnd(9)} ${String(n).padStart(5)} ${quotedHalf.toFixed(2).padStart(9)} ${measEff.toFixed(2).padStart(10)} ${(ok ? 'OK' : 'FAIL').padStart(6)}  | ${realHf5 != null ? realHf5.toFixed(2).padStart(10) : '—'.padStart(10)} ${adv != null ? adv.toFixed(2).padStart(8) : '—'.padStart(8)} ${net != null ? net.toFixed(2).padStart(8) : '—'.padStart(8)}${isFlag ? '  <== edge' : ''}`);
}
console.log(`\n  'check' = does measured effective half-spread reproduce the quoted half-spread? FAIL => mid-sync`);
console.log(`  too coarse (REST scout samples book ~14s); adverse-selection numbers for that pair are NOT trustworthy.`);
console.log(`  MM GRADER VERDICT ${new Date().toISOString()} pairs=${pairs.length} FLAGS=${flags}${flags ? '' : ' (no trustworthy edge — see check column)'}\n`);
