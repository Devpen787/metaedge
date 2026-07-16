#!/usr/bin/env node
// THE go/no-go question is "what does Kalshi actually TRADE?" — not "what are the
// quotes". 3000 scanned -> 299 have volume -> only 2 show a two-sided quote, so the
// list endpoint does not carry live books (that needs /markets/{ticker}/orderbook).
// Demanding quotes here threw away the very markets that answer overlap.
// Also: HTTP 429 last run — pace the requests.
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let cursor, scanned = 0; const live = [];
for (let page = 0; page < 12; page++) {
  const u = new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
  if (r.status === 429) { console.log(`(rate limited after ${scanned} scanned — pausing)`); await sleep(2000); continue; }
  if (!r.ok) { console.log('HTTP', r.status); break; }
  const j = await r.json();
  const ms = j.markets || [];
  if (!ms.length) break;
  for (const m of ms) {
    scanned++;
    const vol = D(m.volume_fp);
    if (vol > 0) live.push({ vol, t: m.title, sub: m.yes_sub_title, ev: m.event_ticker,
      last: D(m.last_price_dollars), liq: D(m.liquidity_dollars), oi: D(m.open_interest_fp) });
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(350);                       // be a good citizen; 429 last time
}
live.sort((a, b) => b.vol - a.vol);
console.log(`\nscanned ${scanned} | with real volume: ${live.length}\n`);
console.log('--- WHAT KALSHI ACTUALLY TRADES (top 25 by volume) ---');
for (const m of live.slice(0, 25)) {
  console.log(`  vol ${String(Math.round(m.vol)).padStart(8)} | last ${(m.last * 100).toFixed(0).padStart(3)}c | ${String(m.t).slice(0, 62)}`);
}
// Category shape decides overlap with Polymarket far more than any single quote.
const cat = {};
for (const m of live) { const k = String(m.ev).split('-')[0]; cat[k] = (cat[k] || 0) + 1; }
console.log('\n--- top event families by count ---');
for (const [k, n] of Object.entries(cat).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${k}`);
