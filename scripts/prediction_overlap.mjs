#!/usr/bin/env node
/**
 * VIABILITY PROBE — does the cross-venue prediction edge exist at all?
 *
 * The whole category rests on one unverified assumption: that Polymarket and
 * Kalshi price the SAME events. If they don't, there is no spread to capture and
 * this dies here — cheaply, which is the point. Recorded Polymarket titles are
 * Norfolk police commissioners, Ethiopian politics, Sri Lankan cricket and esports
 * kill counts; Kalshi is US elections/econ/weather. Overlap is a real question,
 * not a formality.
 *
 * Answer it BEFORE building a matcher, an order-book reader and a spread engine.
 * Cost of being wrong here: a few minutes. Cost of being wrong after building all
 * that: a week, and the temptation to believe it anyway.
 *
 * This is a PROBE, not a strategy:
 * - It matches on title text, which is fuzzy and wrong at the edges. Two markets
 *   can share words and resolve on different criteria ("by Dec 31" vs "by Jan 1"),
 *   so every pair it prints is a CANDIDATE FOR REVIEW, never a trade.
 * - It reports an INDICATIVE gap only. Polymarket's gamma `outcomePrices` is not
 *   a firm bid/ask, so a real edge needs the CLOB book. Any gap shown here is an
 *   upper bound on a real one, and upper bounds are how fake edges are born —
 *   which is exactly why we check overlap first and precision second.
 *
 * Usage: node scripts/prediction_overlap.mjs [--min-similarity 0.5]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MIN_SIM = Number(flag('min-similarity', '0.5'));
const DIR = path.join(process.cwd(), 'data', 'market', 'predictions');

const STOP = new Set(['will','the','be','a','an','of','in','on','at','to','by','for','and','or','is','are','was','were','do','does','before','after','than','this','that','who','what','when','which','it','its','2026','2027']);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
};

// --- Kalshi, live ---
async function kalshi() {
  const out = [];
  let cursor;
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
    url.searchParams.set('limit', '200');
    url.searchParams.set('status', 'open');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
    if (!res.ok) throw new Error(`Kalshi HTTP ${res.status}`);
    const j = await res.json();
    for (const m of j.markets || []) {
      const bid = Number(m.yes_bid), ask = Number(m.yes_ask);
      if (!(bid > 0) || !(ask > 0)) continue;           // executable quotes only
      out.push({ id: m.ticker, title: m.title, sub: m.yes_sub_title || '',
        yesBid: bid / 100, yesAsk: ask / 100, volume: Number(m.volume) || 0 });
    }
    cursor = j.cursor; if (!cursor) break;
  }
  return out;
}

// --- Polymarket, from the odds we already record ---
function polymarket() {
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.startsWith('odds-')).sort() : [];
  if (!files.length) return [];
  const latest = new Map();
  for (const f of files) {
    for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      try {
        const r = JSON.parse(line);
        const prev = latest.get(r.id);
        if (!prev || r.t >= prev.t) latest.set(r.id, r);
      } catch { /* skip malformed */ }
    }
  }
  return [...latest.values()].filter((r) => Array.isArray(r.prices) && r.prices.length);
}

const pm = polymarket();
if (!pm.length) { console.error('No recorded Polymarket odds — run the prediction scout first.'); process.exit(1); }

let ks;
try { ks = await kalshi(); }
catch (err) {
  console.error(`Kalshi unreachable: ${err.message}`);
  console.error('If this is a TLS/connection failure, the network is blocking prediction-market domains.');
  process.exit(1);
}

console.log(`\n=== Cross-venue overlap probe ===`);
console.log(`  Kalshi markets (two-sided):  ${ks.length}`);
console.log(`  Polymarket markets recorded: ${pm.length}\n`);

// An empty side makes overlap ZERO by arithmetic — that is NOT evidence about the
// venues. v1 of this probe printed a confident "this category closes" verdict off
// zero Kalshi markets: a conclusion with no data behind it, which is exactly the
// failure this repo exists to prevent. "No overlap" and "no data" must never
// render as the same sentence. Refuse to conclude.
if (!ks.length) {
  console.error('  ABORT: zero Kalshi markets returned — this proves NOTHING about overlap.');
  console.error('  Comparing against an empty set is arithmetic, not a finding.');
  console.error('  Diagnose the fetch (status filter? response shape? quote fields?)');
  console.error('  before drawing any conclusion about this category.\n');
  process.exit(2);
}

const pmTok = pm.map((r) => ({ ...r, tok: norm(r.question) }));
const pairs = [];
for (const k of ks) {
  const kt = norm(`${k.title} ${k.sub}`);
  let best = null;
  for (const p of pmTok) {
    const sim = jaccard(kt, p.tok);
    if (sim >= MIN_SIM && (!best || sim > best.sim)) best = { sim, p };
  }
  if (best) {
    const pmYes = Number(best.p.prices[0]);
    pairs.push({ sim: best.sim, kalshi: k, pm: best.p, pmYes,
      // INDICATIVE ONLY — pm price is not a firm quote (see header).
      indicativeGap: Math.max(pmYes - k.yesAsk, k.yesBid - pmYes) });
  }
}
pairs.sort((a, b) => b.indicativeGap - a.indicativeGap);

if (!pairs.length) {
  console.log(`  NO OVERLAPPING EVENTS FOUND (similarity >= ${MIN_SIM}).`);
  console.log(`  That is a real, cheap answer: the two venues price different questions,`);
  console.log(`  so there is no cross-venue spread to capture. This category closes unless`);
  console.log(`  a venue with genuine event overlap exists (Betfair/Smarkets from the`);
  console.log(`  CloddsBot map are the next candidates).\n`);
  process.exit(0);
}

console.log(`  ${pairs.length} candidate overlapping event(s) — REVIEW REQUIRED, none are trades:\n`);
for (const x of pairs.slice(0, 15)) {
  console.log(`  gap ~${(x.indicativeGap * 100).toFixed(1)}c  (sim ${x.sim.toFixed(2)})`);
  console.log(`     KALSHI  ${String(x.kalshi.title).slice(0, 64)}`);
  console.log(`             bid ${(x.kalshi.yesBid * 100).toFixed(0)}c / ask ${(x.kalshi.yesAsk * 100).toFixed(0)}c  vol ${x.kalshi.volume}`);
  console.log(`     POLY    ${String(x.pm.question).slice(0, 64)}`);
  console.log(`             yes ${(x.pmYes * 100).toFixed(0)}c (indicative, not a firm quote)\n`);
}
console.log(`  NEXT, only if these pairs are genuinely the same question:`);
console.log(`   1. read both order books for FIRM bid/ask (gamma prices are not executable)`);
console.log(`   2. subtract both venues' fees`);
console.log(`   3. check depth at those quotes`);
console.log(`   4. price the capital LOCKED until resolution — a 6c gap held 6 months`);
console.log(`      is ~12%/yr before fees, not free money.\n`);
