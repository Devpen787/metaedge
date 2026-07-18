#!/usr/bin/env node
/**
 * KALSHI CALIBRATION — is the crowd's price the truth?
 *
 * The cheapest honest edge test in the prediction-market lane. It needs NO
 * pricing model of our own (so it carries none of the model-error risk that made
 * the counting probe suspect). It only joins two things the scout already records
 * BLIND:
 *   - the market's IMPLIED probability  = the quote (mid of bid/ask) before close
 *   - the market's REALIZED outcome      = the recorded resolution (yes/no)
 *
 * The question: when the market implies P%, does the event happen P% of the time?
 * A systematic, well-populated gap is favorite-longshot bias — a tradeable edge
 * that requires no forecast, only fading the mispriced side.
 *
 * HONESTY RAILS (each one is how this measurement avoids lying to us):
 *  1. ONE observation per ticker — the last two-sided quote before close. No
 *     double-counting the same market from thousands of 5-minute snapshots.
 *  2. TWO-SIDED, NON-DEGENERATE quotes only (bid>0, ask<1, ask>bid). A 0/100
 *     book is not a probability, it is an empty market.
 *  3. TERMINAL and BARRIER bucketed SEPARATELY. A one-touch barrier's YES is
 *     structurally higher than a terminal's; mixing them manufactures a fake bias.
 *  4. n PRINTED PER BUCKET. A bias in a 12-sample bucket is noise; the verdict
 *     lives in the big buckets.
 *  5. IN-SAMPLE by construction. This says whether an edge is worth a FORWARD
 *     paper test — it is not itself proof. The scout kept recording blind, so the
 *     forward test is already accruing while we read the past.
 *  6. EDGE IS AFTER COSTS. The reported per-contract edge subtracts the Kalshi
 *     fee (~0.07*p*(1-p)) and half the quoted spread. A gap inside costs is not
 *     an edge.
 *
 * Streams line-by-line (the VM is a 1GB box; one quotes file is >200MB — reading
 * it whole would OOM the host and take the website down with it).
 *
 * Usage (run on the VM, where the data lives):
 *   node scripts/kalshi_calibration.mjs [--days 2026-07-16,2026-07-17,2026-07-18]
 *                                       [--min-vol 0] [--min-mins 2] [--kind terminal]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'kalshi');
const MIN_VOL = Number(flag('min-vol', '0'));       // require this much volume to count a market
const MIN_MINS = Number(flag('min-mins', '2'));     // quote must be >= this many minutes before close (tradeable)
const KIND_FILTER = flag('kind', 'both');           // terminal | barrier | both
const kalshiFee = (p) => 0.07 * p * (1 - p);

// Which dates: default to every quotes-*.jsonl present.
let days = flag('days', '');
if (days) days = days.split(',');
else days = fs.readdirSync(DIR).filter((f) => f.startsWith('quotes-')).map((f) => f.slice('quotes-'.length, -'.jsonl'.length)).sort();

const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// Pass 1 — stream every quote, keep only the LAST valid two-sided quote per
// ticker before close. Map stays small (distinct tickers), never the raw stream.
const best = new Map(); // ticker -> { t, mid, bid, ask, spread, minsToClose, volume, kind }
async function scanQuotes(day) {
  const fp = path.join(DIR, `quotes-${day}.jsonl`);
  if (!fs.existsSync(fp)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let q; try { q = JSON.parse(line); } catch { continue; }
    const bid = D(q.yesBid), ask = D(q.yesAsk), mins = D(q.minsToClose);
    if (!(bid > 0 && ask < 1 && ask > bid)) continue;         // rail 2: real two-sided book
    if (!(mins >= MIN_MINS)) continue;                        // tradeable moment, before close
    const prev = best.get(q.ticker);
    // "last before close" = the most recent snapshot that still had time left
    if (!prev || q.t > prev.t) {
      best.set(q.ticker, { t: q.t, mid: (bid + ask) / 2, bid, ask, spread: ask - bid,
        minsToClose: mins, volume: D(q.volume) || 0, kind: q.kind || 'terminal' });
    }
  }
}

// Pass 2 — stream resolutions, join to the kept quote, tally per (kind, bucket).
const NB = 20; // 5-cent buckets
const cell = () => Array.from({ length: NB }, () => ({ n: 0, yes: 0, sumImplied: 0, sumSpread: 0 }));
const tally = { terminal: cell(), barrier: cell() };
const seenRes = new Set();
let joined = 0, unmatched = 0;
async function scanResolutions(day) {
  const fp = path.join(DIR, `resolutions-${day}.jsonl`);
  if (!fs.existsSync(fp)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r.result !== 'yes' && r.result !== 'no') continue;
    if (seenRes.has(r.ticker)) continue; seenRes.add(r.ticker);   // one outcome per market
    const q = best.get(r.ticker);
    if (!q) { unmatched++; continue; }                            // resolved but never had a tradeable quote
    if (q.volume < MIN_VOL) continue;
    const kind = q.kind === 'barrier' ? 'barrier' : 'terminal';
    if (KIND_FILTER !== 'both' && KIND_FILTER !== kind) continue;
    const bi = Math.min(NB - 1, Math.floor(q.mid * NB));
    const c = tally[kind][bi];
    c.n++; c.sumImplied += q.mid; c.sumSpread += q.spread; if (r.result === 'yes') c.yes++;
    joined++;
  }
}

(async () => {
  console.log(`\n=== Kalshi calibration — implied price vs realized outcome ===`);
  console.log(`  days: ${days.join(', ')}  | min-vol ${MIN_VOL} | quote >= ${MIN_MINS}m before close | kind=${KIND_FILTER}`);
  for (const d of days) await scanQuotes(d);
  console.log(`  distinct markets with a tradeable two-sided quote: ${best.size}`);
  for (const d of days) await scanResolutions(d);
  console.log(`  resolved markets joined to a quote: ${joined}  (unmatched: ${unmatched})\n`);

  const flags = [];   // buckets that clear the forward-test bar (n>=100 AND post-cost edge >2c)
  for (const kind of ['terminal', 'barrier']) {
    if (KIND_FILTER !== 'both' && KIND_FILTER !== kind) continue;
    const rows = tally[kind];
    const total = rows.reduce((s, c) => s + c.n, 0);
    if (!total) continue;
    console.log(`--- ${kind.toUpperCase()} (${total} resolved) ---`);
    console.log(`  ${'implied'.padStart(9)} ${'n'.padStart(6)} ${'realized'.padStart(9)} ${'gap'.padStart(7)} ${'spread'.padStart(7)}  edge/contract after fee+½spread`);
    for (let i = 0; i < NB; i++) {
      const c = rows[i];
      if (!c.n) continue;
      const implied = c.sumImplied / c.n, realized = c.yes / c.n, gap = implied - realized;
      const spread = c.sumSpread / c.n;
      // fade the mispriced side: if implied>realized, SELL YES; profit = gap - fee - ½spread
      const edge = Math.abs(gap) - kalshiFee(implied) - spread / 2;
      const side = gap > 0 ? 'SELL YES' : 'BUY YES';
      const isFlag = c.n >= 100 && edge > 0.02;
      if (isFlag) flags.push(`${kind} ${(implied * 100).toFixed(0)}c ${side} +${(edge * 100).toFixed(1)}c (n=${c.n})`);
      console.log(`  ${(implied * 100).toFixed(0).padStart(7)}c ${String(c.n).padStart(6)} ${(realized * 100).toFixed(1).padStart(8)}% ${((gap) * 100).toFixed(1).padStart(6)}c ${(spread * 100).toFixed(1).padStart(6)}c ${isFlag ? `  <== ${side} +${(edge * 100).toFixed(1)}c` : ''}`);
    }
    console.log('');
  }
  console.log(`  Reading: 'gap' = implied − realized. Positive = market too HIGH on YES (fade by SELL YES).`);
  console.log(`  A '<==' flag marks buckets with n>=100 AND a post-cost edge >2c — the only ones worth a forward paper test.`);
  console.log(`  In-sample over the recorded window; a real edge must survive forward on the still-accruing scout data.`);
  // Machine-greppable verdict line — the forward monitor's cron watches for this.
  console.log(`CALIBRATION VERDICT ${new Date().toISOString()} days=${days.length} joined=${joined} FLAGS=${flags.length}${flags.length ? ' :: ' + flags.join(' | ') : ' (no capturable edge)'}`);
})();
