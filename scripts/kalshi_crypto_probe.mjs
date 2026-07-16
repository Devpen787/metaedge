#!/usr/bin/env node
/**
 * Kalshi crypto binaries — find them by the venue's OWN category, then dump the
 * strike/expiry structure.
 *
 * Bug being fixed (the 5th of the day): I filtered events with /BTC|ETH|SOL/i on
 * titles, which matched togETHer, NETHerlands, Ethan, and releasETHelastofus. The
 * /series response carries an authoritative `category` field ("Crypto") — use the
 * venue's taxonomy, never a substring hunt through English prose.
 *
 * The prize is KXETH15M ("ETH 15M price up down") and any BTC equivalent: a binary
 * on a crypto price is a DIGITAL OPTION, computable from spot + vol using the 2
 * years of real candles we already have. And 15-minute expiries recycle capital
 * ~96x/day, which kills the capital-lockup objection that sank every other
 * prediction-market idea for us.
 *
 * Near-the-money is ALREADY efficiently priced (checked by hand: fair 53.4% vs
 * Kalshi 53%). So the only question worth asking is whether a systematic bias
 * exists at FAR strikes or the SHORTEST expiries. Dump structure first; no code
 * against an assumed shape.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'https://api.elections.kalshi.com/trade-api/v2';
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
async function get(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1200); continue; }
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 'retries' };
}

// 1) crypto series by the VENUE'S OWN category, not a regex on titles
const s = await get(`${B}/series?limit=500`);
const crypto = (s.series || []).filter((x) => String(x.category).toLowerCase() === 'crypto');
console.log(`\n--- Kalshi [Crypto] series: ${crypto.length} ---`);
for (const c of crypto) console.log(`  ${String(c.ticker).padEnd(22)} ${String(c.title).slice(0, 52)}`);

// 2) price-binary series are the ones we can value from spot+vol
const priceLike = crypto.filter((c) => /15M|HOURLY|DAILY|PRICE|UPDOWN|UP.?DOWN|ABOVE|MAX|MIN|RANGE/i.test(`${c.ticker} ${c.title}`));
console.log(`\n--- price-binary candidates: ${priceLike.map((c) => c.ticker).join(', ') || '(none)'} ---`);

// 3) dump real markets for each: strikes, expiries, quotes, book
for (const c of priceLike.slice(0, 3)) {
  console.log(`\n===== ${c.ticker} — ${c.title} =====`);
  const mk = await get(`${B}/markets?limit=25&status=open&series_ticker=${c.ticker}`);
  const ms = (mk.markets || []);
  console.log(`  open markets: ${ms.length}`);
  for (const m of ms.slice(0, 8)) {
    const strike = m.floor_strike ?? m.cap_strike ?? m.custom_strike ?? '—';
    console.log(`  ${String(m.ticker).slice(-26).padEnd(26)} strike=${String(strike).padEnd(9)} ${(D(m.yes_bid_dollars)*100).toFixed(0).padStart(3)}c/${(D(m.yes_ask_dollars)*100).toFixed(0).padStart(3)}c vol=${String(Math.round(D(m.volume_fp))).padStart(6)} closes=${m.close_time}`);
  }
  if (ms[0]) {
    console.log(`\n  --- strike/expiry fields on market[0] ---`);
    const keep = {};
    for (const [k, v] of Object.entries(ms[0])) if (/strike|floor|cap|close|expir|sub_title|rules_primary|title/i.test(k)) keep[k] = v;
    console.log('  ' + JSON.stringify(keep).slice(0, 600));
    const ob = await get(`${B}/markets/${ms[0].ticker}/orderbook?depth=5`);
    const bk = ob.orderbook_fp || {};
    const yes = bk.yes_dollars || [], no = bk.no_dollars || [];
    console.log(`\n  --- book: ${yes.length} yes levels, ${no.length} no levels ${(yes.length||no.length) ? '✅ TRADABLE' : '← empty'}`);
    if (yes.length || no.length) console.log('  ' + JSON.stringify(bk).slice(0, 300));
  }
  await sleep(400);
}
console.log('');
