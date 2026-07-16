#!/usr/bin/env node
/**
 * KALSHI LEARNING SCOUT — continuous, read-only capture of crypto-market quotes
 * and resolutions. This is the FOUNDATION: no strategy can be graded, and no
 * expected return can be measured, without recorded quotes over time joined to
 * how each market actually resolved. It captures; it never trades.
 *
 * GUARDRAIL: this file has no auth and no order path by construction. Market data
 * is public, so recording carries ZERO money risk. Trading lives in a separate
 * module that stays OFF until a strategy beats paper. Keep it that way.
 *
 * WHAT IT RECORDS (per run, appended to data/market/kalshi/):
 *   quotes-<date>.jsonl      — every open crypto market: bid/ask/last, spread,
 *                              volume, minutes-to-close, strike, barrier-vs-terminal
 *   resolutions-<date>.jsonl — settled markets: final result (yes/no), so any
 *                              model can be graded against reality
 *
 * Run it once a minute on the VM (Kalshi is only reachable from a US network;
 * Devin's Swiss ISP hijacks its DNS). Cron:
 *   * * * * * cd ~/metaedge && node scripts/kalshi_scout.mjs >> data/market/kalshi/scout.log 2>&1
 *
 * API facts, learned the hard way (six parse bugs — see RESEARCH_BACKLOG):
 *  - query status=open; the market's own `status` FIELD reads "active" (different).
 *  - quotes are yes_bid_dollars / yes_ask_dollars: STRINGS, in DOLLARS.
 *  - find crypto via /series category=="Crypto" (a /ETH/i regex matches "togETHer").
 *  - MAX/MIN series are ONE-TOUCH BARRIERS ("ever above $X"); *D and 15M are terminal.
 *    Misreading this fakes a sell-everything edge, so we TAG it, never assume it.
 */
import fs from 'node:fs';
import path from 'node:path';

const B = 'https://api.elections.kalshi.com/trade-api/v2';
const DIR = path.join(process.cwd(), 'data', 'market', 'kalshi');
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1200); continue; }
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 'retries' };
}

// classify a market from its own rules — never guess
function marketKind(m) {
  const rules = String(m.rules_primary || '').toLowerCase();
  const early = String(m.early_close_condition || '').toLowerCase();
  if (rules.includes(' ever ') || rules.includes('touch') || early.includes('price') || /MAX|MIN/.test(String(m.ticker))) return 'barrier';
  return 'terminal';
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);

  // 1) crypto series via the venue's own category
  const s = await get(`${B}/series?limit=500`);
  if (s.__err) { console.error(`[kalshi] series HTTP ${s.__err}`); return; }
  const crypto = (s.series || []).filter((x) => String(x.category).toLowerCase() === 'crypto').map((x) => x.ticker);

  // 2) quotes for each series' open markets
  const quotes = [];
  const settledIds = [];
  for (const st of crypto) {
    const mk = await get(`${B}/markets?limit=200&status=open&series_ticker=${st}`);
    if (mk.__err) continue;
    for (const m of mk.markets || []) {
      const bid = D(m.yes_bid_dollars), ask = D(m.yes_ask_dollars);
      if (!(bid >= 0) || !(ask >= 0)) continue;
      quotes.push({
        t, series: st, ticker: m.ticker, kind: marketKind(m),
        title: m.title, sub: m.yes_sub_title,
        strike: D(m.floor_strike ?? m.cap_strike), strikeType: m.strike_type,
        yesBid: bid, yesAsk: ask, last: D(m.last_price_dollars),
        spread: Number.isFinite(ask) && Number.isFinite(bid) ? ask - bid : NaN,
        bidSize: D(m.yes_bid_size_fp), askSize: D(m.yes_ask_size_fp),
        volume: D(m.volume_fp), openInterest: D(m.open_interest_fp),
        closeTime: m.close_time,
        minsToClose: Math.round((Date.parse(m.close_time) - t) / 60000),
      });
    }
    await sleep(250);
  }
  if (quotes.length) fs.appendFileSync(path.join(DIR, `quotes-${day}.jsonl`), quotes.map((q) => JSON.stringify(q)).join('\n') + '\n');

  // 3) resolutions: markets that have settled since we last looked. Grade truth.
  const known = new Set();
  try {
    for (const f of fs.readdirSync(DIR).filter((n) => n.startsWith('resolutions-'))) {
      for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
        try { known.add(JSON.parse(line).ticker); } catch { /* skip */ }
      }
    }
  } catch { /* first run */ }
  const settled = [];
  for (const st of crypto) {
    const mk = await get(`${B}/markets?limit=200&status=settled&series_ticker=${st}`);
    if (mk.__err) continue;
    for (const m of mk.markets || []) {
      if (!m.result || known.has(m.ticker)) continue;      // result is "yes"/"no"
      settled.push({ t, series: st, ticker: m.ticker, title: m.title, sub: m.yes_sub_title,
        result: m.result, strike: D(m.floor_strike ?? m.cap_strike),
        closeTime: m.close_time, settlementValue: m.settlement_value ?? null });
    }
    await sleep(250);
  }
  if (settled.length) fs.appendFileSync(path.join(DIR, `resolutions-${day}.jsonl`), settled.map((r) => JSON.stringify(r)).join('\n') + '\n');

  console.log(`[kalshi] ${new Date().toISOString()} series=${crypto.length} quotes=${quotes.length} newly-settled=${settled.length}`);
}

run().catch((e) => console.error('[kalshi] scout failed:', e.message));
