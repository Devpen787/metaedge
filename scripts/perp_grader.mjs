#!/usr/bin/env node
/**
 * PERP CONTRARIAN-FUNDING GRADER — the edge test for the perp structural lane.
 * Each extreme-funding perp the scout flagged becomes a DIRECTIONAL paper entry
 * (fade the funding: short crowded longs / long crowded shorts) and measures the
 * forward return IN THE TRADE'S DIRECTION, net of costs, at 1/3 days. Only a
 * high-score bucket that nets POSITIVE under an unfair fill earns the signal.
 *
 * SURVIVORSHIP-SAFE: forward prices come from Hyperliquid's own candle history,
 * not from whether the coin stayed in our liquid scan.
 *
 * PESSIMISTIC FILL: entry ~1h AFTER signal (not first), cost-per-side by liquidity.
 * CONSERVATIVE: ignores the funding TAILWIND (the contrarian side actually collects
 * funding) — so a real edge here is understated, not flattered.
 *
 * NO LOOK-AHEAD: entry uses candles after signal; forward marks strictly later.
 * Idempotent: grades each coin's first signal once, when the 3d window is complete.
 *
 * Usage (VM): node scripts/perp_grader.mjs [--score-bar 25] [--max 40] [--mature-days 3]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'perps');
const SCORE_BAR = Number(flag('score-bar', '25'));   // isolate genuinely EXTREME funding
const MAX = Number(flag('max', '40'));
const MATURE_DAYS = Number(flag('mature-days', '3'));
const HORIZONS = [1, 3];                               // days (funding crowding unwinds fast)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;
const costPerSide = (dvol) => (!(dvol > 0) ? 0.004 : dvol > 5e7 ? 0.0006 : dvol > 1e7 ? 0.0012 : 0.003);

async function candles(coin, startMs) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: '1h', startTime: startMs, endTime: Date.now() } }) });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j.map((c) => [Number(c.t), Number(c.c)]).filter(([t, c]) => t > 0 && c > 0) : null;
  }
  return null;
}

function signals() {
  const first = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('scan-'))) {
    for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (!(r.score >= SCORE_BAR) || !r.coin) continue;
      const prev = first.get(r.coin);
      if (!prev || r.t < prev.t) first.set(r.coin, r);
    }
  }
  return [...first.values()];
}
function loadGraded() {
  const fp = path.join(DIR, 'paper-trades.jsonl');
  const done = new Set();
  if (fs.existsSync(fp)) for (const l of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { try { done.add(JSON.parse(l).coin); } catch { /**/ } }
  return done;
}
const priceAt = (s, tMs) => { let px = null; for (const [t, p] of s) { if (t <= tMs) px = p; else break; } return px; };
const priceAfter = (s, tMs) => { for (const [t, p] of s) if (t >= tMs) return p; return null; };

(async () => {
  if (!fs.existsSync(DIR)) { console.log('no perp scans yet'); return; }
  const done = loadGraded();
  const now = Date.now();
  const cands = signals().filter((s) => !done.has(s.coin)).filter((s) => now - s.t >= MATURE_DAYS * DAY).sort((a, b) => b.score - a.score).slice(0, MAX);
  console.log(`\n=== Perp contrarian-funding grader — DIRECTIONAL, net of costs, by score band ===`);
  console.log(`  score bar ${SCORE_BAR} | mature >= ${MATURE_DAYS}d | grading ${cands.length} candidates\n`);

  const graded = [];
  for (const s of cands) {
    const ser = await candles(s.coin, s.t - 2 * 3600000);
    await sleep(400);
    if (!ser || ser.length < 5) continue;
    const entryRaw = priceAfter(ser, s.t + 3600000);       // ~1h after signal
    if (!(entryRaw > 0)) continue;
    const cps = costPerSide(s.dayVol);
    const dir = s.direction === 'long' ? 1 : -1;            // fade the funding
    const marks = {};
    for (const h of HORIZONS) {
      const fwd = priceAt(ser, s.t + h * DAY);
      if (fwd != null && now - s.t >= h * DAY) {
        const rawRet = fwd / entryRaw - 1;
        marks[`d${h}`] = +((dir * rawRet - 2 * cps) * 100).toFixed(2);   // directional, minus round-trip cost
      }
    }
    graded.push({ coin: s.coin, score: s.score, fundingApr: s.fundingApr, direction: s.direction, dayVol: s.dayVol, cps: +(cps * 100).toFixed(2), marks });
  }

  if (!graded.length) { console.log('  0 candidates gradeable yet (extreme funding is rare; window incomplete). Pipeline exercised; verdict awaits accrual.\n'); return; }
  fs.appendFileSync(path.join(DIR, 'paper-trades.jsonl'), graded.map((g) => JSON.stringify({ t: Date.now(), ...g })).join('\n') + '\n');

  const bands = [[SCORE_BAR, 40, `${SCORE_BAR}-40`], [40, 999, '40+ (extreme)']];
  const H = 1;
  console.log(`  ${'band'.padEnd(14)} ${'n'.padStart(4)} ${`dirExp@${H}d`.padStart(10)} ${'win%'.padStart(6)}`);
  let flags = 0;
  for (const [lo, hi, label] of bands) {
    const g = graded.filter((x) => x.score >= lo && x.score < hi && x.marks[`d${H}`] != null);
    if (!g.length) { console.log(`  ${label.padEnd(14)} ${'0'.padStart(4)}       —`); continue; }
    const rets = g.map((x) => x.marks[`d${H}`]);
    const exp = rets.reduce((a, b) => a + b, 0) / rets.length;
    const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const isFlag = lo >= 40 && g.length >= 20 && exp > 0;
    if (isFlag) flags++;
    console.log(`  ${label.padEnd(14)} ${String(g.length).padStart(4)} ${(exp > 0 ? '+' : '') + exp.toFixed(2) + '%'} ${win.toFixed(0).padStart(5)}%${isFlag ? '  <== net positive' : ''}`);
  }
  console.log(`\n  dirExp@${H}d = mean return in the FADE-THE-FUNDING direction, minus round-trip cost. (Funding tailwind ignored = conservative.)`);
  console.log(`  Edge = a 40+ (extreme) band with n>=20 and positive net. Prior guarded: extreme funding may reflect real info, not just crowding.`);
  console.log(`  PERP GRADER VERDICT ${new Date().toISOString()} graded=${graded.length} FLAGS=${flags}${flags ? '' : ' (no edge yet / insufficient sample)'}\n`);
})();
