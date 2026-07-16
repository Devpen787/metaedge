#!/usr/bin/env node
// FUNNEL: scan deep and show exactly where markets are lost. The first ~1000
// Kalshi markets are auto-generated multi-leg parlays (event_ticker KXMVE*) with
// zero quotes/volume/liquidity — real markets exist behind them, so measure the
// drop-off instead of concluding from the first page.
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };  // "*_dollars"/"*_fp" are STRINGS
let cursor, scanned = 0, withVol = 0, twoSided = 0, tradable = [];
for (let page = 0; page < 25; page++) {
  const u = new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
  if (!r.ok) { console.log('HTTP', r.status); break; }
  const j = await r.json();
  const ms = j.markets || [];
  if (!ms.length) break;
  for (const m of ms) {
    scanned++;
    const vol = D(m.volume_fp), bid = D(m.yes_bid_dollars), ask = D(m.yes_ask_dollars);
    if (vol > 0) withVol++;
    if (bid > 0 && ask > 0) {
      twoSided++;
      if (vol > 0) tradable.push({ t: m.title, sub: m.yes_sub_title, bid, ask, vol,
        liq: D(m.liquidity_dollars), ev: m.event_ticker });
    }
  }
  cursor = j.cursor; if (!cursor) break;
}
console.log(`\nscanned:            ${scanned}`);
console.log(`  volume > 0:       ${withVol}`);
console.log(`  two-sided quote:  ${twoSided}`);
console.log(`  BOTH (tradable):  ${tradable.length}`);
tradable.sort((a, b) => b.vol - a.vol);
console.log(`\n--- top tradable Kalshi markets by volume ---`);
for (const m of tradable.slice(0, 12)) {
  console.log(`  vol ${String(Math.round(m.vol)).padStart(7)} | ${(m.bid*100).toFixed(0)}c/${(m.ask*100).toFixed(0)}c | ${String(m.t).slice(0, 60)}`);
}
if (!tradable.length) console.log('  (none — every scanned market lacks quotes or volume)');
