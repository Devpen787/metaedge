#!/usr/bin/env node
/**
 * H1 DECOMPOSITION + LIQUIDITY REALITY CHECK.
 *
 * The legs decompose cleanly and are INDEPENDENT (different MLB games / different
 * tennis matches), so fair value really is the product of the legs — the
 * correlation objection does not apply to cross-event parlays. So we can price the
 * parlay from its own components and see if the market agrees.
 *
 * BUT the list endpoint shows yes_ask=100c and yes_bid=0 on parlays with 11k+
 * volume. An ask of $1.00 is not a price — it is an EMPTY BOOK (ask defaults to
 * max with no offers). So before any mispricing means anything, ask the question
 * that kills most "edges": COULD YOU GET FILLED? We pull the real orderbook.
 *
 * An edge you cannot transact is not an edge. Liquidity first, cleverness second.
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

// find volume-bearing parlays
let cursor; const parlays = [];
for (let page = 0; page < 8 && parlays.length < 6; page++) {
  const u = new URL(`${B}/markets`);
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const j = await get(u.toString()); if (!j) break;
  for (const m of j.markets || []) {
    if (D(m.volume_fp) > 0 && Array.isArray(m.mve_selected_legs) && m.mve_selected_legs.length >= 3) parlays.push(m);
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(300);
}
parlays.sort((a, b) => D(b.volume_fp) - D(a.volume_fp));

console.log(`\nDecomposing ${Math.min(4, parlays.length)} highest-volume parlays\n`);

for (const p of parlays.slice(0, 4)) {
  const legs = p.mve_selected_legs;
  console.log(`PARLAY ${p.ticker.slice(-11)}  vol=${Math.round(D(p.volume_fp))}  legs=${legs.length}`);
  console.log(`  quoted: last=${(D(p.last_price_dollars)*100).toFixed(1)}c  bid=${(D(p.yes_bid_dollars)*100).toFixed(1)}c  ask=${(D(p.yes_ask_dollars)*100).toFixed(1)}c`);

  // real book for the parlay — the fill question
  const ob = await get(`${B}/markets/${p.ticker}/orderbook?depth=3`);
  const book = ob?.orderbook;
  const yesLvls = book?.yes?.length ?? 0, noLvls = book?.no?.length ?? 0;
  console.log(`  ORDERBOOK: yes levels=${yesLvls}  no levels=${noLvls}  ${(!yesLvls && !noLvls) ? '← EMPTY: untradable' : ''}`);
  if (yesLvls || noLvls) console.log(`    raw: ${JSON.stringify(book).slice(0, 220)}`);
  await sleep(300);

  // price the legs -> product = fair value (legs are independent events)
  let product = 1, priced = 0;
  for (const leg of legs) {
    const lm = await get(`${B}/markets/${leg.market_ticker}`);
    const m = lm?.market; if (!m) continue;
    // use last traded price as the leg's probability estimate
    const px = D(m.last_price_dollars);
    if (px > 0) { product *= px; priced++; }
    await sleep(250);
  }
  if (priced === legs.length && priced > 0) {
    const fair = product * 100;
    const mkt = D(p.last_price_dollars) * 100;
    console.log(`  FAIR (product of ${priced} legs) = ${fair.toFixed(2)}c   vs   MARKET last = ${mkt.toFixed(1)}c`);
    console.log(`  → ${mkt > fair ? 'parlay OVERpriced by' : 'parlay UNDERpriced by'} ${Math.abs(mkt - fair).toFixed(2)}c`);
  } else {
    console.log(`  FAIR: could not price all legs (${priced}/${legs.length} had a last price)`);
  }
  console.log('');
}
console.log('Reminder: a mispricing with an empty book is not an edge. Fill first, math second.\n');
