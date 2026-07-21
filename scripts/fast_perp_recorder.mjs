#!/usr/bin/env node
/**
 * FAST PERP RECORDER — the seconds-cadence data plane the horizon study needs.
 *
 * The existing perp_scout.mjs samples the whole universe every ~30 min — fine
 * for slow carry research, useless for the perp/spot dislocation family (a
 * "stretch" between the perp mark and the oracle/index can open and snap back
 * in seconds-to-minutes, invisible to a 30-min clock). This records a SMALL
 * core set FAST so a dislocation event and its decay are actually observable.
 *
 * ONE endpoint gives everything: Hyperliquid's metaAndAssetCtxs returns, per
 * coin, markPx (perp), oraclePx (index/spot reference), midPx, impactPxs
 * (bid/ask -> spread), premium (mark-vs-oracle, pre-computed), funding,
 * openInterest, dayNtlVlm — in a single call. So mark-vs-oracle (the "stretch")
 * AND a spread/executability proxy are both captured at seconds cadence from
 * one request, no order-book subscription needed for v1.
 *
 * RAW ONLY, NOTHING DERIVED (same discipline as memecoin_scout/kalshi_scout):
 * we record point-in-time raw fields; the horizon study derives premium
 * z-scores, forward returns, etc. — so the model can change without
 * re-collecting. Every row is an immutable append.
 *
 * BOUNDED RUN, not a permanent daemon: polls for DURATION_S then exits (the
 * flywheel VM-starvation lesson — a long-lived process on the e2-micro starves
 * the site). Cron re-launches it back-to-back for continuous coverage; the gap
 * between one run ending and the next starting is recorded, not hidden.
 *
 * HONEST FILLS FOUNDATION: impactPxs (Hyperliquid's impact bid/ask) is captured
 * so the study can price a realistic taker fill and reject a "win" that only
 * exists at mid — the paper-honesty rule. A dislocation that's real but sits
 * inside the spread is not tradeable, and the recorded spread is what proves it.
 *
 * GAP/STALE HONESTY: each row carries the real wall-clock poll time and the
 * measured gap since the previous poll; a failed or slow poll is recorded as a
 * gap marker, never silently skipped — so the study can tell "no dislocation"
 * from "we weren't looking."
 *
 * Usage: node scripts/fast_perp_recorder.mjs [--seconds 60] [--poll-ms 1000]
 *        [--coins BTC,ETH,SOL,HYPE,XRP,DOGE]
 */
import fs from 'node:fs';
import path from 'node:path';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Records mark/oracle/mid/impact-bid-ask/premium/funding/OI for a small core coin set at ~1s cadence via Hyperliquid metaAndAssetCtxs, raw and immutable, in bounded DURATION_S runs.',
  notYet: [
    'Core set only (default BTC/ETH/SOL/HYPE/XRP/DOGE), not the full perp universe — the SLOW perp_scout still covers the wide universe at 30-min cadence; this is the fast lane for the names liquid enough to trade a short-horizon signal on.',
    'REST poll, not a websocket subscription — ~1s cadence, not true tick-by-tick. A dislocation that opens and closes entirely between two 1s polls is missed; the l2Book websocket upgrade (finer than 1s, real order-book depth) is the next data-plane increment, not built yet.',
    'No spot-venue cross-check — uses Hyperliquid\'s own oraclePx as the index/spot reference (it is an aggregated oracle, close to spot but not a specific spot exchange\'s book). A second real spot feed (Binance/Coinbase) would be a stronger confirmation, not yet added.',
  ],
  why: [
    'ONE metaAndAssetCtxs call carries mark, oracle, mid, impact bid/ask, premium, funding, and OI together — so the dislocation signal (mark vs oracle) and the executability check (spread from impactPxs) are captured in the same atomic snapshot, never stitched from separate mistimed requests.',
    'Records RAW point-in-time fields only, derives nothing — the horizon study computes premium z-scores and forward returns downstream, so the signal definition can change without re-collecting the data (same discipline as every other scout).',
    'Bounded-duration run (not a daemon) because a permanent process on the e2-micro starves the live site — cron relaunches it; the inter-run gap is recorded as a gap marker so "we weren\'t looking" is never mistaken for "nothing happened".',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DURATION_S = Number(flag('seconds', '60'));
const POLL_MS = Number(flag('poll-ms', '1000'));
const CORE = (flag('coins', process.env.FAST_PERP_COINS || 'BTC,ETH,SOL,HYPE,XRP,DOGE')).split(',').map((s) => s.trim()).filter(Boolean);
const DIR = path.join(process.cwd(), 'data', 'market', 'fast_perps');
const HL = 'https://api.hyperliquid.xyz/info';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function snapshot() {
  const r = await fetch(HL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
  if (!r.ok) return { __err: r.status };
  const j = await r.json();
  const meta = j[0]?.universe || [], ctx = j[1] || [];
  const byName = new Map();
  for (let i = 0; i < meta.length; i++) byName.set(meta[i].name, ctx[i]);
  return { byName };
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const fp = path.join(DIR, `raw-${day}.jsonl`);
  const endAt = Date.now() + DURATION_S * 1000;
  let prevPollAt = null, polls = 0, rows = 0, errs = 0;

  while (Date.now() < endAt) {
    const t = Date.now();
    const gapMs = prevPollAt == null ? null : t - prevPollAt;
    // flag a gap that is meaningfully larger than the intended cadence (slow
    // poll, transient failure, or the inter-run boundary) so the study can
    // distinguish real quiet from a hole in coverage.
    const gapFlag = gapMs != null && gapMs > POLL_MS * 1.8;
    const snap = await snapshot();
    if (snap.__err) {
      fs.appendFileSync(fp, JSON.stringify({ t, kind: 'gap', reason: `http_${snap.__err}`, sincePrevMs: gapMs }) + '\n');
      errs++; prevPollAt = t; await sleep(POLL_MS); continue;
    }
    const batch = [];
    for (const coin of CORE) {
      const c = snap.byName.get(coin);
      if (!c) { batch.push({ t, kind: 'gap', coin, reason: 'coin_absent', sincePrevMs: gapMs }); continue; }
      batch.push({
        t, coin,
        markPx: N(c.markPx), oraclePx: N(c.oraclePx), midPx: N(c.midPx),
        impactBid: N(c.impactPxs?.[0]), impactAsk: N(c.impactPxs?.[1]),
        premium: N(c.premium), funding: N(c.funding),
        oi: N(c.openInterest), dayVol: N(c.dayNtlVlm),
        sincePrevMs: gapMs, gapFlag,   // gapFlag: this snapshot follows an abnormally long interval
      });
    }
    fs.appendFileSync(fp, batch.map((b) => JSON.stringify(b)).join('\n') + '\n');
    rows += batch.length; polls++; prevPollAt = t;
    const spent = Date.now() - t;
    await sleep(Math.max(0, POLL_MS - spent));   // hold cadence; if a poll ran long, don't double-sleep
  }
  console.log(`[fast-perp] ${new Date().toISOString()} polls=${polls} rows=${rows} errs=${errs} coins=${CORE.length} -> ${fp}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => console.error('[fast-perp] failed:', e.message));
}
