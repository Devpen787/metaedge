#!/usr/bin/env node
/**
 * FAST DISLOCATION STUDY — the horizon-response curve, not a fixed-horizon
 * strategy. Per ChatGPT's correct point: don't pre-decide "dislocation = 15min
 * hold." Take the SAME event and measure the net forward return at MANY
 * horizons (5s, 15s, 30s, 1m, ... 4h), and let the data show whether an effect
 * exists, when it's strongest, how fast it decays, and — critically — at which
 * horizons it survives realistic costs.
 *
 * EVENT (from fast_perp_recorder raw data): a "stretch" = the perp premium
 * (mark vs oracle) is extreme relative to its own recent rolling distribution
 * (|z-score| >= Z over a trailing window). The FADE bet: perp too cheap
 * (premium << 0) -> LONG perp expecting convergence up; perp too rich -> SHORT.
 *
 * HONEST FILLS BY CONSTRUCTION (the whole point — a paper win must be real):
 * entry and exit use the RECORDED impact bid/ask, not mid. A long enters at the
 * ask and exits at the bid; a short enters at the bid and exits at the ask —
 * so the round-trip already pays the real spread that was live at those exact
 * moments, plus a taker fee each side. A dislocation that exists only at mid,
 * inside the spread, correctly grades as unprofitable. This is what stops a
 * fast-horizon "edge" from being a mirage that evaporates in real execution.
 *
 * EXECUTION-REALITY FILTER (the piece the horizon curve alone misses): the
 * curve will happily show a net-positive effect at 5s that a co-located HFT
 * could grab and we cannot. So a MIN_ACTIONABLE_S floor is printed alongside —
 * horizons below it are flagged "detectable, not harvestable on our wiring":
 * a real effect there is noted but not claimed as ours.
 *
 * SIGNIFICANCE: reuses scripts/lib/stats.mjs (t>=2), same bar as every grader —
 * a horizon "works" only if mean net return > 0 AND t >= 2 AND n >= MIN_N.
 *
 * Usage: node scripts/fast_dislocation_study.mjs [--z 2] [--window 60]
 *        [--fee-bps 4.5] [--min-n 30] [--min-actionable-s 2]
 */
import fs from 'node:fs';
import path from 'node:path';
import { tStat, T_BAR } from './lib/stats.mjs';

export const LEGIBILITY = {
  doing: 'Finds perp/oracle dislocation events in fast_perp_recorder data and grades the net-of-cost forward return of fading them at every horizon 5s..4h, using recorded impact bid/ask for honest fills.',
  notYet: [
    'Uses Hyperliquid oraclePx as the spot reference — a dedicated spot-venue book would be a stronger "spot did NOT confirm" filter (this can\'t yet distinguish a perp-led stretch from a genuine index move both feeds share).',
    'Fade-both-directions only — does not yet condition on funding, OI change, or aggressive-flow (ChatGPT\'s richer event features); those are additional columns to add once the base effect is or isn\'t there.',
    'Single discovery pass over all recorded data — no separate frozen holdout yet. Until an effect looks real, this is exploration; a real verdict needs the discovery/validation/holdout split before anything is believed.',
  ],
  why: [
    'Horizon curve (many horizons from one event) instead of a fixed hold, so the data shows where the effect lives and dies rather than us guessing the hold up front.',
    'Fills use recorded impact bid/ask + a taker fee each side, so a "win" that only exists at mid is graded as the loss it really is — paper honesty, not paper flattery.',
    'A MIN_ACTIONABLE_S floor separates "the effect exists here" from "we could actually trade it here" — the horizon curve finds effects at speeds only faster players can harvest, and those are flagged, not claimed.',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const Z = Number(flag('z', '2'));
const WINDOW = Number(flag('window', '60'));            // trailing snapshots for the rolling premium distribution
const FEE_BPS = Number(flag('fee-bps', '4.5'));         // taker fee per side (Hyperliquid base tier ~0.045%)
const MIN_N = Number(flag('min-n', '30'));
const MIN_ACTIONABLE_S = Number(flag('min-actionable-s', '2'));  // below this, effect is detectable but not harvestable on our wiring
const DIR = path.join(process.cwd(), 'data', 'market', 'fast_perps');
const HORIZONS_S = [5, 15, 30, 60, 180, 300, 900, 1800, 3600, 7200, 14400];

function loadByCoin() {
  const byCoin = new Map();
  if (!fs.existsSync(DIR)) return byCoin;
  for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('raw-'))) {
    for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      let r; try { r = JSON.parse(line); } catch { continue; }
      if (r.kind === 'gap' || !r.coin) continue;
      if (!(r.markPx > 0) || !(r.oraclePx > 0) || !(r.impactBid > 0) || !(r.impactAsk > 0)) continue;
      const prem = (r.markPx - r.oraclePx) / r.oraclePx * 1e4;   // premium in bps
      if (!byCoin.has(r.coin)) byCoin.set(r.coin, []);
      byCoin.get(r.coin).push({ t: r.t, prem, impactBid: r.impactBid, impactAsk: r.impactAsk });
    }
  }
  for (const arr of byCoin.values()) arr.sort((a, b) => a.t - b.t);
  return byCoin;
}

// nearest snapshot at-or-after a target time (the honest forward mark: you can
// only act on data that has actually arrived), within a tolerance so a big gap
// doesn't silently match a far-future bar.
function atOrAfter(arr, fromIdx, targetT, tolMs) {
  for (let i = fromIdx; i < arr.length; i++) {
    if (arr[i].t >= targetT) return (arr[i].t - targetT <= tolMs) ? arr[i] : null;
  }
  return null;
}

function run() {
  const byCoin = loadByCoin();
  const events = [];   // { coin, dir, entry, snapsForward: arr, idx }
  for (const [coin, arr] of byCoin) {
    let lastEventIdx = -Infinity;
    for (let i = WINDOW; i < arr.length; i++) {
      const win = arr.slice(i - WINDOW, i);
      const mean = win.reduce((s, x) => s + x.prem, 0) / win.length;
      const sd = Math.sqrt(win.reduce((s, x) => s + (x.prem - mean) ** 2, 0) / (win.length - 1)) || 0;
      if (sd === 0) continue;
      const z = (arr[i].prem - mean) / sd;
      if (Math.abs(z) < Z) continue;
      if (i - lastEventIdx < WINDOW / 2) continue;         // cooldown: don't re-fire while still stretched
      lastEventIdx = i;
      // fade: perp cheap (prem below its mean) -> LONG; perp rich -> SHORT
      const dir = (arr[i].prem < mean) ? 'long' : 'short';
      events.push({ coin, idx: i, dir, arr });
    }
  }

  console.log(`\n=== FAST DISLOCATION STUDY — horizon-response curve, net of ${FEE_BPS}bps/side + recorded spread ===`);
  const totalSnaps = [...byCoin.values()].reduce((s, a) => s + a.length, 0);
  console.log(`  data: ${byCoin.size} coins, ${totalSnaps} valid snapshots | events (|z|>=${Z}, window ${WINDOW}): ${events.length}`);
  if (!events.length) {
    console.log(`  0 dislocation events yet — the recorder must accrue (dislocations happen in volatility, not a calm sample).`);
    console.log(`  Pipeline exercised; verdict awaits accrual. Run fast_perp_recorder.mjs continuously first.\n`);
    return;
  }

  console.log(`  ${'horizon'.padStart(8)} ${'n'.padStart(5)} ${'netRet(bps)'.padStart(12)} ${'win%'.padStart(6)} ${'t'.padStart(6)}  verdict`);
  for (const h of HORIZONS_S) {
    const rets = [];
    for (const e of events) {
      const t0 = e.arr[e.idx].t;
      const fwd = atOrAfter(e.arr, e.idx + 1, t0 + h * 1000, Math.max(3000, h * 1000 * 0.5));
      if (!fwd) continue;
      const entry = e.arr[e.idx];
      // honest round-trip on recorded impact prices + taker fee each side
      let gross;
      if (e.dir === 'long') gross = fwd.impactBid / entry.impactAsk - 1;      // buy ask now, sell bid later
      else gross = entry.impactBid / fwd.impactAsk - 1;                        // sell bid now, buy ask later
      const net = (gross - 2 * FEE_BPS / 1e4) * 1e4;                          // to bps, minus both taker fees
      rets.push(net);
    }
    if (!rets.length) { console.log(`  ${(h + 's').padStart(8)} ${'0'.padStart(5)}   (no forward data at this horizon yet)`); continue; }
    const { mean, t } = tStat(rets);
    const win = 100 * rets.filter((r) => r > 0).length / rets.length;
    const harvestable = h >= MIN_ACTIONABLE_S;
    const real = rets.length >= MIN_N && mean > 0 && t >= T_BAR;
    let verdict;
    if (!harvestable) verdict = 'detectable, NOT harvestable on our wiring';
    else if (real) verdict = '*** net-positive, t>=2 ***';
    else if (rets.length < MIN_N) verdict = `accruing (n<${MIN_N})`;
    else verdict = 'no edge';
    console.log(`  ${(h + 's').padStart(8)} ${String(rets.length).padStart(5)} ${(mean >= 0 ? '+' : '') + mean.toFixed(2)} ${win.toFixed(0).padStart(5)}% ${t.toFixed(1).padStart(6)}  ${verdict}`);
  }
  console.log(`\n  netRet = mean fade return in bps, honest round-trip (impact bid/ask + ${FEE_BPS}bps/side fee). t = one-sample t-stat vs 0.`);
  console.log(`  A horizon "works" only if it is harvestable (>=${MIN_ACTIONABLE_S}s), net-positive, n>=${MIN_N}, AND t>=${T_BAR}.`);
  console.log(`  DISLOCATION STUDY ${new Date().toISOString()} events=${events.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) run();
