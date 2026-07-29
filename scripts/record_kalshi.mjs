#!/usr/bin/env node
/**
 * Kalshi odds scout — the second venue for the cross-venue prediction spread.
 *
 * WHY THIS CATEGORY. Our registry says 99.05% of 29,718 hypotheses asked "which
 * way will price move?" — the most competitive question in finance. This asks
 * nothing of the sort. If Polymarket prices an event at 70c and Kalshi prices the
 * SAME event at 64c, the gap is arithmetic, not a forecast. That is one of five
 * edge categories where we have run zero experiments
 * (docs/RESEARCH_BACKLOG.md #1).
 *
 * WHAT IT RECORDS, AND WHY IT IS BID/ASK NOT last_price.
 * `last_price` is what someone ELSE traded at; you cannot transact on it. An
 * "edge" computed from last prices is fiction — the classic way to manufacture an
 * arbitrage that does not exist. To buy YES you pay the ASK; to sell you hit the
 * BID. So we record the executable quotes and the spread between them, and we
 * skip any market that has no two-sided quote rather than guess a mid.
 *
 * Kalshi quotes in CENTS (integer 1-99). Polymarket quotes decimal probability
 * (0.64). We store BOTH raw and a normalised probability so the two venues can be
 * compared without re-deriving a unit conversion at every call site — units bugs
 * have bitten this codebase four times (funding APR, open interest, prediction
 * payouts, cost basis).
 *
 * HONESTY: recording a spread is NOT finding an edge. Before any spread counts it
 * must survive (a) both venues' fees, (b) real depth at those quotes, (c) the two
 * markets resolving on IDENTICAL criteria — "by Dec 31" vs "by Jan 1" are
 * different questions — and (d) capital being LOCKED until resolution, which can
 * be months. A 6% spread locked for 6 months is ~12% annualised before fees, not
 * free money. This script measures; it does not conclude.
 *
 * Usage: node scripts/record_kalshi.mjs [--limit 200] [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(flag('limit', '500'));
const DRY = args.includes('--dry');
const DIR = path.join(process.cwd(), 'data', 'market', 'predictions');
const BASE = 'https://api.elections.kalshi.com/trade-api/v2/markets';

async function fetchPage(cursor) {
  const url = new URL(BASE);
  url.searchParams.set('limit', '200');
  url.searchParams.set('status', 'open');
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kalshi HTTP ${res.status}`);
  return res.json();
}

const rows = [];
let cursor;
try {
  while (rows.length < LIMIT) {
    const page = await fetchPage(cursor);
    const markets = page?.markets;
    if (!Array.isArray(markets) || !markets.length) break;
    for (const m of markets) {
      // Executable quotes only. No two-sided market => no tradable price => skip.
      // Never substitute last_price or invent a mid: that is how a fake edge is born.
      const yesBid = Number(m.yes_bid), yesAsk = Number(m.yes_ask);
      if (!Number.isFinite(yesBid) || !Number.isFinite(yesAsk) || yesBid <= 0 || yesAsk <= 0) continue;
      rows.push({
        t: Date.now(),
        venue: 'kalshi',
        id: m.ticker,
        eventId: m.event_ticker ?? null,
        title: m.title ?? null,
        subtitle: m.yes_sub_title ?? m.subtitle ?? null,
        // raw (cents, as the venue states them)
        yesBidCents: yesBid, yesAskCents: yesAsk,
        // normalised probability — one conversion, defined once
        yesBid: yesBid / 100, yesAsk: yesAsk / 100,
        spread: (yesAsk - yesBid) / 100,          // the venue's own cost of a round trip
        lastPrice: Number.isFinite(Number(m.last_price)) ? Number(m.last_price) / 100 : null,
        volume: Number(m.volume) || 0,
        openInterest: Number(m.open_interest) || 0,
        liquidity: Number(m.liquidity) || 0,
        closeTime: m.close_time ?? null,
      });
      if (rows.length >= LIMIT) break;
    }
    cursor = page.cursor;
    if (!cursor) break;
  }
} catch (err) {
  console.error(`[kalshi] ${err.message}`);
  console.error('[kalshi] If this is a TLS/connection error, the network may be blocking');
  console.error('[kalshi] prediction-market domains. A gap is honest; no data is written.');
  process.exit(1);
}

if (!rows.length) { console.error('[kalshi] no two-sided markets returned — nothing written'); process.exit(1); }

const tradable = rows.filter((r) => r.volume > 0);
console.log(`[kalshi] ${rows.length} markets with executable two-sided quotes (${tradable.length} with volume)`);
console.log(`[kalshi] median venue spread: ${(() => {
  const s = rows.map((r) => r.spread).sort((a, b) => a - b);
  return (s[Math.floor(s.length / 2)] * 100).toFixed(1);
})()}c  ← you pay this to cross, before any cross-venue edge exists`);
for (const r of rows.slice(0, 3)) {
  console.log(`  ${String(r.title).slice(0, 58).padEnd(58)} bid ${(r.yesBid * 100).toFixed(0)}c / ask ${(r.yesAsk * 100).toFixed(0)}c`);
}

if (DRY) { console.log('[kalshi] --dry: nothing written'); process.exit(0); }
fs.mkdirSync(DIR, { recursive: true });
const day = new Date().toISOString().slice(0, 10);
fs.appendFileSync(path.join(DIR, `kalshi-odds-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`[kalshi] → data/market/predictions/kalshi-odds-${day}.jsonl`);
