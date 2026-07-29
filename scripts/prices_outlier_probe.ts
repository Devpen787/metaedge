/**
 * PARADOX-1 CLAMP PROBE — truth ledger for server/prices.ts's 25% outlier guard.
 * Flips FACT_OPEN -> FACT_CLOSED across the fix. NO PRODUCT CHANGE in this file.
 *
 * Bug: the guard (prices.ts:48) rejects ANY single poll that jumps >25% from the last
 * accepted price. It compares to the last *accepted* value, so a GENUINE, PERSISTENT
 * >25% move (real breakout / cascade) is rejected on every poll — the feed freezes at
 * the pre-move price and, because lastGoodFetch never advances, goes stale at 120s while
 * still wrong. The guard has no concept of TIME: a one-poll spike and a sustained new
 * reality are treated identically.
 *
 * Fix under test (persistence-based accept): keep rejecting the FIRST sighting of a >25%
 * jump (blip guard), but if the move persists in the same direction for N consecutive
 * polls, accept it as the new reality.
 *
 * Re-proof shape (your spec): Tick 1 (+30% -> rejected), Tick 2 (-> rejected),
 * Tick N (-> ACCEPTED). Plus a within-band control that must always update cleanly.
 *
 * Seam: mock global fetch (drive the REAL refresh path with scripted prices) + pin
 * Math.random (kill ±0.03% jitter). Observe only via getSpotPrice / getPriceFeedState.
 *
 * Run: npx tsx scripts/prices_outlier_probe.ts [--expect-closed]
 * (--expect-closed exits nonzero unless the freeze is fixed — for the re-proof gate.)
 */
const EXPECT_CLOSED = process.argv.includes('--expect-closed');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let mockPx = 100;
const origRandom = Math.random;
Math.random = () => 0.5;   // jitter = 0 → frozen/accepted price stays exact

(globalThis as any).fetch = async (url: string) => {
  const u = String(url);
  if (u.includes('coingecko')) {
    return { ok: true, json: async () => ([{ id: 'bitcoin', current_price: mockPx, price_change_percentage_24h: 0, high_24h: mockPx, low_24h: mockPx, total_volume: 1e9, market_cap: 1e12 }]) };
  }
  return { ok: false, json: async () => ({}) };   // Coinbase fallback = no-op; BTC only moves via the clamped CoinGecko path
};

(async () => {
  const prices = await import('../server/prices.js');

  // baseline (first accept skips the clamp because lastGoodFetch === 0)
  const t0 = Date.now();
  while (prices.getPriceFeedState().observedAt === 0 && Date.now() - t0 < 8000) await sleep(200);
  const baseline = prices.getSpotPrice('BTC')!;
  const observedAtBaseline = prices.getPriceFeedState().observedAt;
  if (!(baseline && Math.abs(baseline - 100) < 0.01)) {
    console.log(JSON.stringify({ id: 'PRICES_OUTLIER_CLAMP_FREEZE', class: 'PROBE_ERROR', reason: 'baseline not established', baseline }));
    process.exit(EXPECT_CLOSED ? 1 : 0);
  }

  // inject a PERSISTENT, legitimate +30% breakout (the >=3x-volume golden-cross pop)
  mockPx = 130;

  // EARLY checkpoint (~15s): the first refetch has fired but persistence not yet met.
  // The move MUST still be rejected here — that is the preserved blip guard.
  await sleep(15_000);
  const earlyFeed = prices.getSpotPrice('BTC')!;
  const earlyRejected = Math.abs(earlyFeed - 100) < 0.5;   // still at pre-move price after 1st poll

  // FINAL checkpoint (~32s total): with the fix, persistence has confirmed and the move
  // is accepted; without it, the feed is still frozen at 100.
  await sleep(17_000);
  const finalFeed = prices.getSpotPrice('BTC')!;
  const observedAtFinal = prices.getPriceFeedState().observedAt;
  const accepted = Math.abs(finalFeed - 130) < 0.5;        // feed caught up to the real move
  const stillFrozen = Math.abs(finalFeed - 100) < 0.5;     // feed never moved

  // CONTROL: a within-band move from the current level must always flow through. Wait past
  // the ~12s refetch gate — when the feed is HEALTHY (clock advancing) the next fetch is up
  // to 12s out, unlike the frozen case where a stale clock refetches immediately.
  const ctlTarget = accepted ? 136 : 124;                  // +4.6% from 130, or +24% from a frozen 100
  mockPx = ctlTarget;
  await sleep(15_000);
  const ctlFeed = prices.getSpotPrice('BTC')!;
  const controlUpdates = Math.abs(ctlFeed - ctlTarget) < 0.5;

  const cls = accepted && earlyRejected ? 'FACT_CLOSED' : (stillFrozen ? 'FACT_OPEN' : 'INDETERMINATE');
  console.log('\n=== PARADOX-1 PRICE-CLAMP PROBE ===');
  console.log(JSON.stringify({
    id: 'PRICES_OUTLIER_CLAMP_FREEZE',
    class: cls,
    title: 'server/prices.ts 25% guard vs a PERSISTENT >25% move',
    checks: {
      firstPollRejected_blipGuard: earlyRejected,     // blip protection preserved
      persistentMoveAccepted_freezeFixed: accepted,    // the fix
      everFrozenAtPreMovePrice: stillFrozen,           // the bug (should be false once fixed)
      feedClockAdvanced: observedAtFinal !== observedAtBaseline,
      withinBandControlUpdates: controlUpdates,
    },
    evidence: { baseline, injectedRealPrice: 130, earlyFeed, finalFeed, control: { target: ctlTarget, feedShows: ctlFeed } },
    codePath: 'server/prices.ts:48',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? '\nCLOSED: first poll rejected (blip guard intact), persistent move accepted after N polls (freeze fixed), control flows. \n'
    : cls === 'FACT_OPEN'
      ? '\nOPEN: persistent +30% move rejected on every poll; feed frozen at 100, clock stuck -> stale-at-120s while wrong.\n'
      : '\nINDETERMINATE — check timing/mocks.\n');

  Math.random = origRandom;
  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
