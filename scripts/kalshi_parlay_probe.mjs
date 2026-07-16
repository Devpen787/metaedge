#!/usr/bin/env node
/**
 * PARLAY MISPRICING PROBE — the first non-arbitrage Kalshi edge test.
 *
 * TWO HYPOTHESES, neither requiring a prediction:
 *  H1 (combinatorial): a parlay of independent legs should cost ~= the PRODUCT of
 *     its legs. Kalshi lists the legs separately and names them in
 *     `mve_selected_legs`, so the parlay's fair value is computable from its own
 *     components. A persistent premium over that = a structural mispricing.
 *  H2 (favorite-longshot bias): retail overpays for lottery tickets. Nearly every
 *     volume-bearing Kalshi market prices 0-8c. If those resolve YES less often
 *     than their price implies, SELLING them is the edge. Kalshi is an EXCHANGE,
 *     so unlike a sportsbook you can take that side.
 *
 * H1 is testable from a SNAPSHOT (no resolutions, no waiting). H2 needs recorded
 * odds + outcomes over time — this dumps the price distribution to start that clock.
 *
 * WHY THIS MIGHT BE NOTHING (state it up front, test it anyway):
 *  - Legs in one parlay are often CORRELATED (same game). Then product != fair
 *    value and an apparent "premium" is just correlation. We only trust
 *    cross-event parlays (different games) for H1.
 *  - Market makers may already arb it. If so the premium is ~0 and H1 dies cheap.
 *  - Liquidity: sample parlays showed liquidity_dollars = 0. An edge you cannot
 *    get filled on is not an edge.
 * This probe MEASURES. It concludes nothing.
 */
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// 1) collect volume-bearing parlays
let cursor; const parlays = []; let scanned = 0; const priceHist = {};
for (let page = 0; page < 10; page++) {
  const u = new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
  u.searchParams.set('limit', '200'); u.searchParams.set('status', 'open');
  if (cursor) u.searchParams.set('cursor', cursor);
  const j = await get(u.toString()); if (!j) break;
  const ms = j.markets || []; if (!ms.length) break;
  for (const m of ms) {
    scanned++;
    const vol = D(m.volume_fp); if (vol <= 0) continue;
    // H2 evidence: where do traded prices cluster?
    const c = Math.round(D(m.last_price_dollars) * 100);
    priceHist[c] = (priceHist[c] || 0) + 1;
    if (m.mve_selected_legs) parlays.push(m);
  }
  cursor = j.cursor; if (!cursor) break;
  await sleep(300);
}

console.log(`\nscanned ${scanned} | volume-bearing: ${Object.values(priceHist).reduce((a,b)=>a+b,0)} | with legs field: ${parlays.length}`);

console.log(`\n--- H2: where traded prices cluster (favorite-longshot test) ---`);
const buckets = { '0-5c': 0, '6-15c': 0, '16-40c': 0, '41-60c': 0, '61-85c': 0, '86-100c': 0 };
for (const [c, n] of Object.entries(priceHist)) {
  const p = Number(c);
  if (p <= 5) buckets['0-5c'] += n; else if (p <= 15) buckets['6-15c'] += n;
  else if (p <= 40) buckets['16-40c'] += n; else if (p <= 60) buckets['41-60c'] += n;
  else if (p <= 85) buckets['61-85c'] += n; else buckets['86-100c'] += n;
}
for (const [k, n] of Object.entries(buckets)) console.log(`  ${k.padEnd(8)} ${String(n).padStart(4)} ${'█'.repeat(Math.min(50, n))}`);
console.log(`  → heavy mass at 0-15c = lottery tickets. Do they pay off that often? (needs resolutions)`);

console.log(`\n--- H1: what a parlay's legs look like (fair value = product of legs) ---`);
if (!parlays.length) { console.log('  no mve_selected_legs found — cannot decompose'); process.exit(0); }
const sample = parlays.sort((a, b) => D(b.volume_fp) - D(a.volume_fp)).slice(0, 3);
for (const m of sample) {
  console.log(`\n  PARLAY vol=${Math.round(D(m.volume_fp))} last=${(D(m.last_price_dollars)*100).toFixed(0)}c yes_ask=${(D(m.yes_ask_dollars)*100).toFixed(0)}c`);
  console.log(`    ticker: ${m.ticker}`);
  console.log(`    title:  ${String(m.title).slice(0, 90)}`);
  console.log(`    legs (raw): ${JSON.stringify(m.mve_selected_legs).slice(0, 500)}`);
}
