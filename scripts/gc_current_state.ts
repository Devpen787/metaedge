// Read-only snapshot: how many tokens are at each stage of the golden-cross funnel RIGHT NOW,
// with the ENRICHED context on the closest candidates.
import { refreshBroadFeed, getBroadTick, listBroadSymbols } from '../server/broad_feed.js';
import { dailyIndicators } from '../server/decision/daily_features.js';
import { evaluateGoldenCrossEntry, enrichCandidate, GcEnriched } from '../server/decision/golden_cross_scanner.js';

(async () => {
  const r = await refreshBroadFeed();
  const syms = listBroadSymbols();
  let liquid1M = 0, has200d = 0, bull = 0, freshCross = 0, volSurge3x = 0;
  const fullPass: GcEnriched[] = [];
  const bullSurgeNotFresh: GcEnriched[] = [];

  for (const base of syms) {
    const t = getBroadTick(base);
    if (!t || !(t.vol24hUsd > 0)) continue;
    if (t.vol24hUsd >= 1_000_000) liquid1M++;
    const ind = dailyIndicators(base, t.price, t.vol24hUsd);
    if (!ind) continue;                         // no 200-day daily history in cache
    has200d++;
    const isBull = ind.sma50 > ind.sma200;
    const fresh = ind.sma50Prev <= ind.sma200Prev && ind.sma50 > ind.sma200;
    const surge = ind.vol24hUsd >= 3 * ind.vol50dAvg;
    if (isBull) bull++;
    if (fresh) freshCross++;
    if (surge) volSurge3x++;
    if (evaluateGoldenCrossEntry(ind).enter) fullPass.push(enrichCandidate(base, t.price, ind));
    else if (isBull && surge && t.vol24hUsd >= 1_000_000) bullSurgeNotFresh.push(enrichCandidate(base, t.price, ind));
  }
  const fmt = (e: GcEnriched) => `${e.base.padEnd(9)} score ${e.score.toFixed(1).padStart(5)} | vol ${e.volMultiple.toFixed(1)}x | $${(e.turnover24hUsd / 1e6).toFixed(1)}M | 50d ${e.distAboveCrossPct >= 0 ? '+' : ''}${e.distAboveCrossPct.toFixed(1)}% >200d | px ${e.priceVsSma50Pct >= 0 ? '+' : ''}${e.priceVsSma50Pct.toFixed(1)}% vs 50d | 30d ${e.return30dPct == null ? '?' : (e.return30dPct >= 0 ? '+' : '') + e.return30dPct.toFixed(0) + '%'} | rvol ${e.realizedVolPctDaily == null ? '?' : e.realizedVolPctDaily.toFixed(1) + '%/d'}`;

  console.log(`\n=== GOLDEN-CROSS FUNNEL — live snapshot ${new Date().toISOString()} ===`);
  console.log(`  universe seen by the feed (Binance+Gate USDT): ${syms.length}`);
  console.log(`  ... with >= $1M 24h volume (liquid):           ${liquid1M}`);
  console.log(`  ... with >= 200 days of daily history:         ${has200d}   (the set we can actually evaluate)`);
  console.log(`  ------------------------------------------------------------`);
  console.log(`  currently ABOVE the golden cross (50d > 200d): ${bull}   <- "have passed the golden cross"`);
  console.log(`  FRESH cross (crossed up today):                ${freshCross}`);
  console.log(`  with a 3x+ volume surge:                       ${volSurge3x}`);
  console.log(`  ============================================================`);
  console.log(`  FULL ENTRY (fresh cross + 3x vol + $1M):       ${fullPass.length}   <- what the flywheel would trade NOW (best-first)`);
  fullPass.sort((a, b) => b.score - a.score).forEach((e) => console.log('    ' + fmt(e)));
  if (bullSurgeNotFresh.length) {
    console.log(`\n  Closest — bull regime WITH a volume surge, but the cross isn't fresh today (top by score):`);
    bullSurgeNotFresh.sort((a, b) => b.score - a.score).slice(0, 10).forEach((e) => console.log('    ' + fmt(e)));
  }
  console.log(`\n  NOTE: daily history is the ~07-23 cache + today's live bar; a nightly roll keeps it current in prod.\n`);
  process.exit(0);
})();
