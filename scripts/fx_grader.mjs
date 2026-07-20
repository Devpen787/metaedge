#!/usr/bin/env node
/**
 * FX TREND GRADER — the edge test for the forex lane. Each trending pair the scout
 * flagged becomes a DIRECTIONAL paper entry (long the up-trend / short the down),
 * graded on the forward return IN THE TRADE'S DIRECTION, net of costs, at 3/7 days
 * (FX trends run multi-day). Edge = a high-score band, n>=20, positive net.
 *
 * Survivorship isn't really a factor for FX majors/crosses (they don't delist), but
 * forward marks still come from actual Yahoo history (not our scan) for correctness.
 * Pessimistic fill: entry next daily close after signal; cost-per-side by pair type
 * (majors/crosses tight ~3bps, exotics/EM ~12bps). Live locked; no order path.
 *
 * Usage (VM): node scripts/fx_grader.mjs [--score-bar 25] [--mature-days 7]
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Grades fx_scout\'s trend-aligned pairs (score>=SCORE_BAR, default 25) as directional paper entries, net of cost, at 3/7d.',
  notYet: [
    'Survivorship correction is present but noted as low-relevance here (FX majors/crosses/exotics don\'t delist the way coins do) — kept anyway, for consistency with the other graders, not because it was found to matter.',
    'Only 2 horizons (3d, 7d) — FX trends are assumed multi-day; not tested at shorter or longer windows.',
    'No verdict below n=20 in the 40+ band.',
  ],
  why: [
    'Cost-per-side is binary: ~3bps for majors/crosses, ~12bps for exotics/EM (EXOTIC currency set) — reflects the real, large liquidity gap between the two tiers rather than one blended average that would misprice both.',
    'Entry priced at the next daily close AFTER signal — same never-first discipline as every other grader.',
    'The console output states the prior plainly: FX rarely clears costs at these horizons — a FLAGS=0 result here is the expected, honest outcome given the entry prior, not a sign the test is broken.',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'fx');
const SCORE_BAR = Number(flag('score-bar', '25'));
const MAX = Number(flag('max', '30'));
const MATURE_DAYS = Number(flag('mature-days', '7'));
const HORIZONS = [3, 7];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;
const EXOTIC = new Set(['MXN', 'ZAR', 'TRY', 'SEK', 'NOK', 'PLN', 'SGD', 'HKD', 'RUB', 'BRL']);
const costPerSide = (pair) => ([pair.slice(0, 3), pair.slice(3)].some((c) => EXOTIC.has(c)) ? 0.0012 : 0.0003);

async function chart(pair) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${pair}=X?range=2mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
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
      if (!(r.score >= SCORE_BAR) || !r.pair) continue;
      const prev = first.get(r.pair);
      if (!prev || r.t < prev.t) first.set(r.pair, r);
    }
  }
  return [...first.values()];
}
function loadGraded() { const fp = path.join(DIR, 'paper-trades.jsonl'); const d = new Set(); if (fs.existsSync(fp)) for (const l of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { try { d.add(JSON.parse(l).pair); } catch { /**/ } } return d; }
const priceAt = (s, tMs) => { let px = null; for (const [t, p] of s) { if (t <= tMs) px = p; else break; } return px; };
const priceAfter = (s, tMs) => { for (const [t, p] of s) if (t >= tMs) return p; return null; };

async function main() {
  if (!fs.existsSync(DIR)) { console.log('no fx scans yet'); return; }
  const done = loadGraded();
  const now = Date.now();
  const cands = signals().filter((s) => !done.has(s.pair)).filter((s) => now - s.t >= MATURE_DAYS * DAY).sort((a, b) => b.score - a.score).slice(0, MAX);
  console.log(`\n=== FX trend grader — DIRECTIONAL, net of costs, by score band ===`);
  console.log(`  score bar ${SCORE_BAR} | mature >= ${MATURE_DAYS}d | grading ${cands.length} candidates\n`);
  const graded = [];
  for (const s of cands) {
    const ser = await chart(s.pair); await sleep(800);
    if (!ser || ser.length < 5) continue;
    const entry = priceAfter(ser, s.t + DAY); if (!(entry > 0)) continue;
    const cps = costPerSide(s.pair), dir = s.direction === 'long' ? 1 : -1;
    const marks = {};
    for (const h of HORIZONS) { const fwd = priceAt(ser, s.t + h * DAY); if (fwd != null && now - s.t >= h * DAY) marks[`d${h}`] = +((dir * (fwd / entry - 1) - 2 * cps) * 100).toFixed(2); }
    graded.push({ pair: s.pair, score: s.score, direction: s.direction, r20: s.r20, cps: +(cps * 100).toFixed(2), marks });
  }
  if (!graded.length) { console.log('  0 candidates gradeable yet. Pipeline exercised; verdict awaits accrual.\n'); return; }
  fs.appendFileSync(path.join(DIR, 'paper-trades.jsonl'), graded.map((g) => JSON.stringify({ t: Date.now(), ...g })).join('\n') + '\n');
  const bands = [[SCORE_BAR, 40, `${SCORE_BAR}-40`], [40, 999, '40+ (strong)']];
  const H = 3;
  console.log(`  ${'band'.padEnd(14)} ${'n'.padStart(4)} ${`dirExp@${H}d`.padStart(10)} ${'win%'.padStart(6)}`);
  let flags = 0;
  for (const [lo, hi, label] of bands) {
    const g = graded.filter((x) => x.score >= lo && x.score < hi && x.marks[`d${H}`] != null);
    if (!g.length) { console.log(`  ${label.padEnd(14)} ${'0'.padStart(4)}       —`); continue; }
    const rets = g.map((x) => x.marks[`d${H}`]); const exp = rets.reduce((a, b) => a + b, 0) / rets.length; const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const isFlag = lo >= 40 && g.length >= 20 && exp > 0; if (isFlag) flags++;
    console.log(`  ${label.padEnd(14)} ${String(g.length).padStart(4)} ${(exp > 0 ? '+' : '') + exp.toFixed(2) + '%'} ${win.toFixed(0).padStart(5)}%${isFlag ? '  <== net positive' : ''}`);
  }
  console.log(`\n  dirExp@${H}d = mean return in the TREND direction, minus round-trip cost. Prior: FX moves rarely clear costs at these horizons.`);
  console.log(`  FX GRADER VERDICT ${new Date().toISOString()} graded=${graded.length} FLAGS=${flags}${flags ? '' : ' (no edge yet / insufficient sample)'}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => console.error('[fx-grader] failed:', e.message));
