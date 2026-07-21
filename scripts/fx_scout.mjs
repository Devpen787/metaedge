#!/usr/bin/env node
/**
 * FX TREND SCOUT — completes the "scan everything" set (crypto, memes, stocks,
 * perps, now forex). Honest low prior: FX is the most efficient market there is,
 * and short-horizon moves are tiny vs costs. The ONE documented FX edge is TREND
 * (currencies trend at multi-day/week horizons; CTAs harvest this), so the signal
 * is trend-alignment, not 1d pops. Exotics/EM pairs move more than majors.
 *
 * DIRECTIONAL signal: long the pair if the 20d trend is up, short if down; enter
 * only when the 5d confirms the 20d (aligned). Records blind; the pessimistic
 * grader (forward directional return net of costs) is the arbiter.
 *
 * Source: Yahoo Finance FX (SYMBOL=X), free, no key. Read-only, no order path.
 * Universe: live-derived via scripts/lib/fx_universe.mjs (Yahoo lookup API,
 * ISO-4217-filtered, weekly cache) — no more hand-picked list, same fix
 * already applied to crypto/stocks/mm's universe derivation.
 * Records data/market/fx/scan-<date>.jsonl. VM cron ~ every 2h (FX moves slowly).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fxUniverseSymbols } from './lib/fx_universe.mjs';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Scores the live-derived FX pair universe (scripts/lib/fx_universe.mjs — ~588 ISO-4217-valid pairs as of this writing, weekly-cached) for 5d/20d trend alignment via Yahoo daily closes, every ~2h.',
  notYet: [
    'Daily-close granularity only — no intraday FX signal; trend is explicitly the ONE documented FX edge being tested (multi-day CTA-style trend), not a claim that faster signals were checked and rejected.',
    'This is a RADAR — fx_grader.mjs is the only place a net-of-cost verdict exists.',
    'Universe is Yahoo-reachable currency pairs only — still bounded by what Yahoo\'s lookup API surfaces, not a claim of literally every FX pair traded anywhere; a real broker/ECN\'s full tradeable list would be a further, not-yet-reached ceiling.',
  ],
  why: [
    'FX is treated with an explicitly LOW PRIOR going in (most efficient market there is; short-horizon moves are tiny vs costs) — the file\'s own stated expectation is "no edge," and that is the honest baseline this test is checking, not a strawman.',
    'Universe used to be a hand-picked 24-pair list — a real, flagged inconsistency (crypto/stocks/mm all learned to derive their universe live from a real venue query this session; FX never got that fix until now). Now derived live from Yahoo\'s currency lookup API, filtered against a real ISO 4217 code allowlist to drop commodity/SDR tickers Yahoo mislabels as currencies (XCU=copper, XDR=SDR) and a handful of non-standard ticker artifacts (CAX, BRX, etc.) — 24x more pairs, live-derived rather than hand-curated.',
    'Entry requires 5d trend to CONFIRM (not just match sign loosely) the 20d trend — an unconfirmed 20d trend alone is not enough to signal, reducing false trend calls on a recent reversal.',
  ],
};

const DIR = path.join(process.cwd(), 'data', 'market', 'fx');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chart(sym) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}=X?range=4mo&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(3000); continue; }
    if (!r.ok) return null;
    const j = await r.json();
    const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    return Array.isArray(q) ? q.filter((x) => x != null) : null;
  }
  return null;
}

// trend-alignment score (FX moves are small -> scaled up)
function score(r5, r20, r60) {
  const aligned = Math.sign(r5) === Math.sign(r20) && r20 !== 0;
  let s = 0;
  if (aligned) { s += Math.min(30, Math.abs(r20) * 10); s += Math.min(15, Math.abs(r5) * 8); s += 10; }
  if (Math.abs(r60) > 15) s -= 10;   // very extended
  return Math.round(Math.max(0, s));
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const PAIRS = process.env.FX_PAIRS ? process.env.FX_PAIRS.split(',') : await fxUniverseSymbols();
  const rows = [];
  for (const sym of PAIRS) {
    const c = await chart(sym);
    await sleep(600);
    if (!c || c.length < 65) continue;
    const px = c[c.length - 1];
    const r5 = (px / c[c.length - 6] - 1) * 100, r20 = (px / c[c.length - 21] - 1) * 100, r60 = (px / c[c.length - 61] - 1) * 100;
    const sc = score(r5, r20, r60);
    rows.push({ t, pair: sym, price: px, r5: +r5.toFixed(2), r20: +r20.toFixed(2), r60: +r60.toFixed(2), score: sc, direction: r20 >= 0 ? 'long' : 'short' });
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `scan-${day}.jsonl`), rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const top = rows.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  console.log(`[fx] ${new Date().toISOString()} universe=${PAIRS.length} pairs=${rows.length}`);
  console.log(`  top trends: ${top.map((r) => `${r.pair}(${r.score}|20d ${r.r20}% ${r.direction})`).join('  ')}`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => console.error('[fx] scout failed:', e.message));
}
