#!/usr/bin/env node
/**
 * KALSHI PAPER HARNESS — closes the loop kalshi_calibration.mjs itself demanded:
 * "the only ones worth a forward paper test." It found FLAGS=2 (72c and 88c
 * BUY YES, n=107/256, +2.0c/+2.7c after cost) consistently across 3+ daily
 * reads. That's an in-sample historical measurement (last quote vs realized
 * outcome, backward-looking). This is the forward test: open a REAL paper
 * position on a CURRENTLY OPEN market when its live quote lands in a flagged
 * bucket, then track it to actual resolution. No paper trade until now would
 * have existed for this finding — this is the concrete "don't miss the
 * opportunity we may have already found" action.
 *
 * SAME BAR AS THE MONITOR (deliberately not widened to the looser surrounding
 * buckets — 77c broke the pattern in the historical table, so this stays on
 * the monitor's own conservative n>=100/edge>2c criterion, not an expanded band).
 *
 * HONESTY RAILS:
 *  - Terminal only (refuses barrier-shaped rules, same classifier as the scout).
 *  - Entry = the ASK (what a real buy-yes actually costs), not mid.
 *  - Cost = Kalshi's real per-contract fee, applied at entry.
 *  - One paper position per market (no pyramiding); never re-enters a market
 *    it's already open on or already resolved.
 *  - Settles ONLY from the real recorded resolution — never assumes an outcome.
 *  - Paper only: no auth, no order path, no real money. Live stays locked.
 *
 * Buckets (from kalshi_calibration's own flagged output, kept in sync manually
 * since they're a measured finding, not a formula):
 *   72c bucket (70-75c): BUY YES
 *   88c bucket (85-90c): BUY YES
 *
 * Run on the VM (Kalshi is only reachable from a US network). Opens positions
 * every 5 minutes alongside the scout (cron cadence written out to avoid the
 * star-slash token closing this comment); resolves by cross-referencing the
 * scout's recorded resolutions file, no separate polling needed.
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Opens real paper BUY_YES positions on currently-open Kalshi crypto markets whose live quote lands in a bucket kalshi_calibration.mjs has already flagged (72c, 88c), tracks each to real resolution.',
  notYet: [
    'Only the two buckets kalshi_calibration.mjs has actually flagged (70-75c, 85-90c) — NOT auto-derived from live calibration output each run, deliberately: a new bucket only trades after a human has seen it cross the bar, same discipline as MAX_PAGES being a verified constant rather than a live guess.',
    'Terminal markets only — barrier-shaped markets are refused outright (marketKind() check), because the calibration finding this harness is testing was itself measured on terminal markets only.',
    'One paper position per market, ever — no pyramiding, no re-entry on a market already touched, open or closed.',
  ],
  why: [
    'Entry priced at the real ASK plus Kalshi\'s real per-contract fee (not mid) — this is what a real BUY_YES actually costs, not an idealized fill.',
    'Bucket list is kept in sync MANUALLY with kalshi_calibration\'s own flagged output specifically because it is a measured finding, not a formula — automating it would let an unreviewed bucket start trading real (paper) capital.',
    'Settles ONLY from the scout\'s own recorded resolution file — never assumes or infers an outcome ahead of the real settlement being recorded.',
  ],
};

const B = 'https://api.elections.kalshi.com/trade-api/v2';
const DIR = path.join(process.cwd(), 'data', 'market', 'kalshi');
const LEDGER = path.join(DIR, 'paper-harness-positions.jsonl');
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const kalshiFee = (p) => 0.07 * p * (1 - p);
// buckets the monitor has actually flagged, n>=100 & edge>2c — kept as an
// explicit list (not derived live) so a new bucket only trades after a human
// has seen it cross the bar in kalshi_calibration's own output, same discipline
// as MAX_PAGES being a verified constant, not a live-computed guess.
const FLAGGED_BUCKETS = [
  { lo: 0.70, hi: 0.75, side: 'BUY_YES', label: '72c' },
  { lo: 0.85, hi: 0.90, side: 'BUY_YES', label: '88c' },
];

async function get(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 1200)); continue; }
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 'retries' };
}
function marketKind(m) {
  const rules = String(m.rules_primary || '').toLowerCase();
  const early = String(m.early_close_condition || '').toLowerCase();
  if (rules.includes(' ever ') || rules.includes('touch') || early.includes('price') || /MAX|MIN/.test(String(m.ticker))) return 'barrier';
  return 'terminal';
}
function loadPositions() {
  const open = new Map(), closedTickers = new Set();
  if (!fs.existsSync(LEDGER)) return { open, closedTickers };
  for (const l of fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean)) {
    let r; try { r = JSON.parse(l); } catch { continue; }
    if (r.status === 'OPEN') open.set(r.ticker, r);
    else closedTickers.add(r.ticker);
  }
  // an OPEN row later closed removes itself from `open` on the settle pass; here
  // we only need to know what's currently open vs ever touched.
  for (const t of closedTickers) open.delete(t);
  return { open, closedTickers };
}
function loadResolutions() {
  const byTicker = new Map();
  for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('resolutions-'))) {
    for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
      try { const r = JSON.parse(l); byTicker.set(r.ticker, r); } catch { /* skip */ }
    }
  }
  return byTicker;
}

async function openNewPositions(open, closedTickers) {
  const s = await get(`${B}/series?limit=500`);
  if (s.__err) { console.error(`[kalshi-harness] series HTTP ${s.__err}`); return 0; }
  const crypto = (s.series || []).filter((x) => String(x.category).toLowerCase() === 'crypto').map((x) => x.ticker);
  let opened = 0;
  for (const st of crypto) {
    const mk = await get(`${B}/markets?limit=200&status=open&series_ticker=${st}`);
    if (mk.__err) continue;
    for (const m of mk.markets || []) {
      if (open.has(m.ticker) || closedTickers.has(m.ticker)) continue;       // never re-enter
      if (marketKind(m) !== 'terminal') continue;                            // refuse barrier-shaped
      const ask = D(m.yes_ask_dollars);
      if (!(ask > 0 && ask < 1)) continue;
      const bucket = FLAGGED_BUCKETS.find((b) => ask >= b.lo && ask < b.hi);
      if (!bucket) continue;
      const entry = ask + kalshiFee(ask);                                    // pay the ask + fee, honest cost
      const row = { t: Date.now(), ticker: m.ticker, series: st, title: m.title, bucket: bucket.label,
        side: bucket.side, entryAsk: ask, entryCost: +entry.toFixed(4), closeTime: m.close_time, status: 'OPEN' };
      fs.appendFileSync(LEDGER, JSON.stringify(row) + '\n');
      open.set(m.ticker, row);
      opened++;
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  return opened;
}

function settleResolved(open, resolutions) {
  let settled = 0, wins = 0, netPnl = 0;
  for (const [ticker, pos] of [...open]) {
    const res = resolutions.get(ticker);
    if (!res) continue;                                                       // still open, real resolution not in yet
    const won = res.result === 'yes';                                        // BUY_YES: win iff resolves yes
    const payoff = won ? 1 : 0;
    const pnl = payoff - pos.entryCost;                                       // $1 payout on win, else lose the cost
    fs.appendFileSync(LEDGER, JSON.stringify({ ...pos, status: 'CLOSED', resolvedResult: res.result, pnl: +pnl.toFixed(4), settledAt: Date.now() }) + '\n');
    open.delete(ticker);
    settled++; if (pnl > 0) wins++; netPnl += pnl;
  }
  return { settled, wins, netPnl };
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const { open, closedTickers } = loadPositions();
  const resolutions = loadResolutions();
  const { settled, wins, netPnl } = settleResolved(open, resolutions);
  const opened = await openNewPositions(open, closedTickers);

  // running tally across ALL closed positions ever, for a persistent verdict
  let allClosed = [];
  if (fs.existsSync(LEDGER)) for (const l of fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(l); if (r.status === 'CLOSED') allClosed.push(r); } catch { /* skip */ }
  }
  const totalN = allClosed.length, totalWins = allClosed.filter((r) => r.pnl > 0).length;
  const totalPnl = allClosed.reduce((s, r) => s + r.pnl, 0);
  console.log(`[kalshi-harness] ${new Date().toISOString()} opened=${opened} settled_this_run=${settled} open_now=${open.size}`);
  console.log(`  LIFETIME: n=${totalN} win=${totalN ? (100 * totalWins / totalN).toFixed(0) : 0}% netPnl=$${totalPnl.toFixed(2)} avgPnl=$${totalN ? (totalPnl / totalN).toFixed(3) : 0}/contract`);
  if (totalN >= 30) console.log(`  KALSHI HARNESS VERDICT n=${totalN} netPnl=${totalPnl.toFixed(2)} ${totalPnl > 0 ? 'POSITIVE — forward-confirming the calibration finding' : 'NEGATIVE — the in-sample finding did not survive forward'}`);
  else console.log(`  n=${totalN} still below 30 — no verdict yet, accruing.`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => console.error('[kalshi-harness] failed:', e.message));
}
