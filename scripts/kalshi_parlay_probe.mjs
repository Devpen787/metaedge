#!/usr/bin/env node
/**
 * KALSHI IS REAL. Filtering out the parlay junk revealed genuine markets with
 * genuine two-sided quotes (Senate margins 84/87, MLB debut 34/35, 724 event
 * families incl. Fed decisions and GPU pricing).
 *
 * My 'BOOK empty' reading was a PARSE BUG — a market quoting 84c/87c has a book by
 * definition. Third Kalshi field mistake in a row, and it nearly produced a second
 * false 'category is dead' verdict. So: dump the RAW orderbook shape and stop
 * guessing.
 *
 * The real signal here is not arbitrage — it is SPREAD. 20c on NBA wins, 57c on
 * college basketball. Wide spreads in niche markets are market-making territory,
 * the untested category that fits our only structural advantage: too small for a
 * big firm to bother with.
 *
 * Measures: raw book shape, then spread x volume across real markets, because a
 * huge spread with no volume pays nothing (you sit there forever) and a tight
 * spread with volume pays little. The product is what matters.
 */
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'https://api.elections.kalshi.com/trade-api/v2';
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1200); continue; }
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 'retries' };
}

// 1) RAW orderbook — fix the parse by looking, not assuming.
const probe = await get(`${B}/markets?limit=40&status=open&series_ticker=KXMIDTERMMOV`);
const cand = (probe.markets || []).filter((m) => D(m.yes_bid_dollars) > 0 && D(m.yes_ask_dollars) > 0)
  .sort((a, b) => D(b.volume_fp) - D(a.volume_fp))[0];
if (cand) {
  console.log(`\n--- RAW orderbook for a market quoting ${(D(cand.yes_bid_dollars)*100).toFixed(0)}c/${(D(cand.yes_ask_dollars)*100).toFixed(0)}c ---`);
  console.log(`  ${cand.ticker}`);
  const raw = await get(`${B}/markets/${cand.ticker}/orderbook?depth=5`);
  console.log(`  ${JSON.stringify(raw).slice(0, 700)}`);
  await sleep(300);
}

// 2) SPREAD x VOLUME across real (non-parlay) markets — the market-making scan.
console.log(`\n--- Market-making scan: real markets, spread x volume ---`);
let cursor; const rows = []; let scanned = 0;
for (let page = 0; page < 12; page++) {
  const u = new URL(`${B}/markets`);
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const j = await get(u.toString()); if (j.__err) break;
  const ms = j.markets || []; if (!ms.length) break;
  for (const m of ms) {
    scanned++;
    if (String(m.event_ticker || '').startsWith('KXMVE')) continue;      // skip parlay junk
    const bid = D(m.yes_bid_dollars), ask = D(m.yes_ask_dollars), vol = D(m.volume_fp);
    if (!(bid > 0 && ask > 0 && ask > bid)) continue;                    // real two-sided only
    rows.push({ t: m.title, tk: m.ticker, bid, ask, spread: ask - bid, vol,
      oi: D(m.open_interest_fp), liq: D(m.liquidity_dollars) });
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(300);
}
console.log(`  scanned ${scanned} | real two-sided markets: ${rows.length}`);
if (rows.length) {
  const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`  median spread: ${(med(rows.map((r) => r.spread)) * 100).toFixed(1)}c`);
  console.log(`\n  --- best spread-capture candidates (spread x volume) ---`);
  for (const r of rows.map((r) => ({ ...r, score: r.spread * r.vol })).sort((a, b) => b.score - a.score).slice(0, 15)) {
    console.log(`  spread ${(r.spread*100).toFixed(0).padStart(3)}c | vol ${String(Math.round(r.vol)).padStart(6)} | OI ${String(Math.round(r.oi)).padStart(6)} | ${(r.bid*100).toFixed(0)}/${(r.ask*100).toFixed(0)} | ${String(r.t).slice(0, 46)}`);
  }
}
console.log('');
