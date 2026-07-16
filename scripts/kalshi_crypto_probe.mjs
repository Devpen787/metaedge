#!/usr/bin/env node
/**
 * KALSHI CRYPTO BINARIES — the best lead we have, and the first time our existing
 * data becomes a weapon.
 *
 * "Will BTC be >= $64,000 at 5pm EDT" is a DIGITAL OPTION, not a forecast. Given
 * spot and volatility, its probability is COMPUTABLE. We already own the hard part:
 * real Binance candles, 37 coins, 2 years. This plugs a venue onto that pipeline.
 *
 * And it kills the objection that sank prediction markets for us: capital lockup.
 * These resolve in HOURS (15-minute / hourly / daily), not months — a 15-minute
 * market recycles capital ~96x a day. Kalshi shows $1,036,444 volume on ONE BTC
 * market, and it is an exchange, so either side is tradable.
 *
 * SOBERING CHECK ALREADY DONE (by hand, off Devin's screenshot):
 *   BTC 64,076 spot, 64,000 strike, ~7.7h left -> fair ~53.4%; Kalshi quoted 53%.
 *   64,250 strike -> fair ~42.3%; Kalshi quoted 41%.
 * The near-the-money strikes are EFFICIENTLY PRICED. So this probe is not looking
 * for free money at the money — it is looking for a systematic bias at the FAR
 * strikes (longshot territory) and in the SHORTEST expiries, where fewer people
 * bother. If none exists, this dies in a day and we lose nothing.
 *
 * Step 1 (this): find the crypto series and DUMP their real structure — strikes,
 * expiries, quotes, books. After four straight parse bugs (status value,
 * *_dollars fields, orderbook_fp.yes_dollars) the rule is: print it before writing
 * a line against it.
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

// 1) find crypto-looking series
console.log('\n--- hunting crypto series ---');
const s = await get(`${B}/series?limit=200`);
let names = [];
if (!s.__err && Array.isArray(s.series)) {
  names = s.series.filter((x) => /BTC|ETH|SOL|CRYPTO|BITCOIN|ETHER/i.test(JSON.stringify(x)))
    .map((x) => ({ t: x.ticker, title: x.title, cat: x.category }));
  console.log(`  series endpoint: ${s.series.length} total, ${names.length} crypto-ish`);
  for (const n of names.slice(0, 15)) console.log(`    ${String(n.t).padEnd(18)} ${String(n.title).slice(0, 50)} [${n.cat}]`);
} else {
  console.log('  /series ->', JSON.stringify(s).slice(0, 120));
}

// 2) find crypto EVENTS by paging (the firehose ordering hides them, so filter)
console.log('\n--- crypto events (paging) ---');
let cursor; const hits = new Map();
for (let p = 0; p < 12; p++) {
  const u = new URL(`${B}/events`);
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const j = await get(u.toString()); if (j.__err) break;
  for (const e of j.events || []) {
    if (/BTC|bitcoin|ETH|ether|SOL\b/i.test(String(e.title) + String(e.series_ticker))) {
      const fam = String(e.series_ticker || '').split('-')[0];
      if (!hits.has(fam)) hits.set(fam, e);
    }
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(250);
}
console.log(`  crypto event families found: ${hits.size}`);
for (const [fam, e] of [...hits].slice(0, 10)) console.log(`    ${fam.padEnd(16)} ${String(e.title).slice(0, 56)}`);

// 3) DUMP one crypto market fully — structure before code
const first = [...hits.values()][0];
if (first) {
  console.log(`\n--- full structure of one crypto event: ${first.event_ticker} ---`);
  const ev = await get(`${B}/events/${first.event_ticker}`);
  const ms = (ev.markets || []).slice(0, 6);
  console.log(`  markets in event: ${(ev.markets || []).length}`);
  for (const m of ms) {
    console.log(`  ${String(m.ticker).slice(-28).padEnd(28)} strike=${m.floor_strike ?? m.cap_strike ?? m.strike_type ?? '?'} bid=${(D(m.yes_bid_dollars)*100).toFixed(0)}c ask=${(D(m.yes_ask_dollars)*100).toFixed(0)}c vol=${Math.round(D(m.volume_fp))} close=${m.close_time}`);
  }
  if (ms[0]) {
    console.log(`\n  --- raw market[0] (strike/expiry fields) ---`);
    const keep = {};
    for (const [k, v] of Object.entries(ms[0])) if (/strike|cap|floor|close|expir|title|subtitle|rules_primary/i.test(k)) keep[k] = v;
    console.log('  ' + JSON.stringify(keep, null, 1).slice(0, 700));
    const ob = await get(`${B}/markets/${ms[0].ticker}/orderbook?depth=5`);
    console.log(`\n  --- its book (orderbook_fp.yes_dollars/no_dollars) ---`);
    console.log('  ' + JSON.stringify(ob).slice(0, 400));
  }
}
console.log('');
