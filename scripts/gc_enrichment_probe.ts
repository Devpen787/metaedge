/**
 * GC-ENRICHMENT PROBE — every candidate now carries the "why" (exact numbers) and a quality
 * score, and the scanner ranks the strongest crosses first instead of first-come. NO PRODUCT CHANGE.
 * FACT_CLOSED when: enriched fields are populated, and a bigger volume surge scores higher
 * (ranking is grounded in the research-proven, dose-responsive lever).
 *
 * Run: npx tsx scripts/gc_enrichment_probe.ts [--expect-closed]
 */
const EXPECT_CLOSED = process.argv.includes('--expect-closed');

(async () => {
  const gc = await import('../server/decision/golden_cross_scanner.js');
  const ind = (o: Partial<any>) => ({ sma50: 110, sma200: 100, sma50Prev: 99, sma200Prev: 100, vol50dAvg: 1e6, vol24hUsd: 5e6, days: 300, lastClose: 110, return30dPct: 12, realizedVolPctDaily: 4, ...o }) as any;

  const hi = gc.enrichCandidate('HIVOL', 110, ind({ vol24hUsd: 8e6 }));   // 8x surge
  const lo = gc.enrichCandidate('LOVOL', 110, ind({ vol24hUsd: 3e6 }));   // 3x surge, same everything else

  const fieldsPopulated =
    hi.volMultiple === 8 && typeof hi.distAboveCrossPct === 'number' && hi.distAboveCrossPct > 0 &&
    typeof hi.priceVsSma50Pct === 'number' && hi.return30dPct === 12 && hi.realizedVolPctDaily === 4 && hi.score > 0;
  const rankingPrefersBiggerSurge = hi.score > lo.score;
  const scoreDoseResponsive = gc.scoreCandidate({ volMultiple: 5, turnover24hUsd: 1e6 }) > gc.scoreCandidate({ volMultiple: 2, turnover24hUsd: 1e6 });

  const cls = fieldsPopulated && rankingPrefersBiggerSurge && scoreDoseResponsive ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== GC-ENRICHMENT PROBE ===');
  console.log(JSON.stringify({
    id: 'GC_CANDIDATES_ENRICHED_AND_RANKED', class: cls,
    checks: { enrichedFieldsPopulated: fieldsPopulated, rankingPrefersBiggerVolumeSurge: rankingPrefersBiggerSurge, scoreDoseResponsiveToVolume: scoreDoseResponsive },
    sample: { HIVOL: { volMultiple: hi.volMultiple, distAboveCrossPct: +hi.distAboveCrossPct.toFixed(2), priceVsSma50Pct: +hi.priceVsSma50Pct.toFixed(2), return30dPct: hi.return30dPct, realizedVolPctDaily: hi.realizedVolPctDaily, score: hi.score }, LOVOL_score: lo.score },
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? `\nCLOSED: candidates carry full context (${Object.keys(hi).length} fields) and the 8x surge (score ${hi.score}) outranks the 3x (score ${lo.score}) — the scanner takes the strongest crosses first.\n`
    : '\nOPEN: enrichment/ranking not working as expected.\n');
  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
