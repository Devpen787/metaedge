/**
 * BROAD-FEED PROBE — the runtime/Risk-OS can only price 11 majors; it is blind to the long-tail
 * tokens the golden cross trades. Flips FACT_OPEN -> FACT_CLOSED when getSpotPrice() falls back
 * to the broad feed. NO PRODUCT CHANGE in this file.
 *
 * Proof: refresh the REAL broad feed (one bulk call per venue), pick a long-tail base it saw
 * that is NOT one of the 11 serverPrices majors, and check whether getSpotPrice() resolves it.
 *   - FACT_OPEN  : getSpotPrice(longTail) === null (no fallback) even though the feed has a live price.
 *   - FACT_CLOSED: getSpotPrice(longTail) returns the live price (fallback wired).
 *
 * Run: npx tsx scripts/broad_feed_probe.ts [--expect-closed]
 */
const EXPECT_CLOSED = process.argv.includes('--expect-closed');

(async () => {
  const broad = await import('../server/broad_feed.js');
  const prices = await import('../server/prices.js');

  const refreshed = await broad.refreshBroadFeed();
  const majors = new Set(Object.keys(prices.serverPrices));   // the 11 live-priced symbols

  // pick a liquid long-tail base the feed saw that isn't a major (deterministic: highest-vol non-major)
  let pick: { base: string; price: number; vol: number } | null = null;
  for (const base of ['PEPE', 'WIF', 'FARTCOIN', 'BONK', 'JUP', 'PENGU', 'ENA', 'PYTH', 'SEI']) {
    const t = broad.getBroadTick(base);
    if (t && !majors.has(base)) { pick = { base, price: t.price, vol: t.vol24hUsd }; break; }
  }
  if (!pick) {
    console.log(JSON.stringify({ id: 'RUNTIME_BLIND_TO_LONGTAIL', class: 'PROBE_ERROR', reason: 'no candidate long-tail symbol found in feed', feedSymbols: refreshed.symbols }));
    process.exit(EXPECT_CLOSED ? 1 : 0);
  }

  const spot = prices.getSpotPrice(pick.base);            // the question: can the runtime price it?
  const resolvesLongTail = spot != null && spot > 0;
  const cls = resolvesLongTail ? 'FACT_CLOSED' : 'FACT_OPEN';

  console.log('\n=== BROAD-FEED PROBE ===');
  console.log(JSON.stringify({
    id: 'RUNTIME_BLIND_TO_LONGTAIL',
    class: cls,
    title: 'getSpotPrice() prices only the 11 majors unless it falls back to the broad feed',
    checks: {
      broadFeedSeesUniverse: refreshed.symbols > 500,
      broadFeedHasLongTailPriceAndVolume: pick.price > 0 && pick.vol > 0,
      getSpotPriceResolvesLongTail: resolvesLongTail,   // the flip
    },
    evidence: {
      feedSymbols: refreshed.symbols, venues: refreshed.venues,
      majorsCount: majors.size,
      sample: { base: pick.base, feedPrice: pick.price, feed24hVolUsd: pick.vol, getSpotPrice: spot },
    },
    codePath: 'server/prices.ts getSpotPrice fallback → server/broad_feed.ts',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? `\nCLOSED: getSpotPrice('${pick.base}') = $${spot} — the runtime can now price the long-tail universe (live price + 24h volume available).\n`
    : `\nOPEN: the broad feed has ${pick.base} live at $${pick.price} (24h vol $${(pick.vol / 1e6).toFixed(1)}M), but getSpotPrice('${pick.base}') = ${spot}. The runtime is blind to it.\n`);

  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
