#!/usr/bin/env node
/**
 * FIND KALSHI'S REAL MARKETS. The parlay hypotheses are DEAD (mispricing ~1 tick,
 * every orderbook empty). But that only condemns the auto-generated parlay
 * firehose — which is all the default /markets ordering ever showed us. We have
 * been rummaging in the junk drawer.
 *
 * Kalshi's actual business is elections / Fed / CPI / weather, and those plausibly
 * have real books. Query EVENTS (not the market firehose) to find them, then check
 * whether their books are fillable. If these are empty too, Kalshi is dead as a
 * venue for us and we stop.
 */
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const B = 'https://api.elections.kalshi.com/trade-api/v2';
async function get(url) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1200); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// Series = Kalshi's product families. Non-KXMVE* = real markets, not parlays.
let cursor; const fams = {};
for (let page = 0; page < 10; page++) {
  const u = new URL(`${B}/events`);
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const j = await get(u.toString()); if (!j) break;
  const evs = j.events || []; if (!evs.length) break;
  for (const e of evs) {
    const fam = String(e.series_ticker || e.event_ticker || '').split('-')[0];
    (fams[fam] ||= { n: 0, sample: e.title, tickers: [] });
    fams[fam].n++;
    if (fams[fam].tickers.length < 2) fams[fam].tickers.push(e.event_ticker);
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(300);
}
const ranked = Object.entries(fams).sort((a, b) => b[1].n - a[1].n);
console.log(`\n--- Kalshi EVENT families (${ranked.length} distinct) ---`);
for (const [k, v] of ranked.slice(0, 20)) {
  const junk = k.startsWith('KXMVE') ? '  ← parlay junk' : '';
  console.log(`  ${String(v.n).padStart(4)}  ${k.padEnd(28)} ${String(v.sample).slice(0, 40)}${junk}`);
}

// Take the biggest NON-parlay families and ask the only question that matters:
// is there a real book?
const real = ranked.filter(([k]) => !k.startsWith('KXMVE')).slice(0, 6);
console.log(`\n--- Do REAL (non-parlay) markets have fillable books? ---`);
for (const [fam, v] of real) {
  const ev = await get(`${B}/events/${v.tickers[0]}`); await sleep(250);
  const mkts = ev?.markets || [];
  if (!mkts.length) { console.log(`  ${fam}: no markets`); continue; }
  const m = mkts.sort((a, b) => D(b.volume_fp) - D(a.volume_fp))[0];
  const ob = await get(`${B}/markets/${m.ticker}/orderbook?depth=3`); await sleep(250);
  const yes = ob?.orderbook?.yes?.length ?? 0, no = ob?.orderbook?.no?.length ?? 0;
  console.log(`  ${fam.padEnd(24)} vol=${String(Math.round(D(m.volume_fp))).padStart(7)} bid=${(D(m.yes_bid_dollars)*100).toFixed(0).padStart(3)}c ask=${(D(m.yes_ask_dollars)*100).toFixed(0).padStart(3)}c | BOOK yes=${yes} no=${no} ${(yes||no) ? '✅ TRADABLE' : '← empty'}`);
  console.log(`      ${String(m.title).slice(0, 70)}`);
}
console.log('');
