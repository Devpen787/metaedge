// Enriched scan report: the coins above the golden cross + the volume-surge set, bucketed by
// directional archetype (early uptrend / mature / extended-blowoff / surge-on-weakness).
import { refreshBroadFeed, getBroadTick, listBroadSymbols } from '../server/broad_feed.js';
import { dailyIndicators } from '../server/decision/daily_features.js';
import { enrichCandidate, GcEnriched } from '../server/decision/golden_cross_scanner.js';

type Row = GcEnriched & { bull: boolean; fresh: boolean; surge: boolean; archetype: string };

function archetype(e: GcEnriched, bull: boolean): string {
  const ext = e.priceVsSma50Pct, r30 = e.return30dPct ?? 0, above = e.distAboveCrossPct;
  if (!bull) return 'below-cross';
  if (ext > 80 || r30 > 300) return 'extended / blow-off (reversal risk)';
  if (ext < -20 || r30 < -25) return 'surge-on-weakness (falling knife)';
  if (above < 12 && ext > -5 && r30 > 0) return 'early uptrend (freshest)';
  return 'established uptrend';
}

(async () => {
  await refreshBroadFeed();
  const rows: Row[] = [];
  for (const base of listBroadSymbols()) {
    const t = getBroadTick(base);
    if (!t || !(t.vol24hUsd >= 1_000_000)) continue;      // liquid only
    const ind = dailyIndicators(base, t.price, t.vol24hUsd);
    if (!ind) continue;
    const e = enrichCandidate(base, t.price, ind);
    const bull = ind.sma50 > ind.sma200;
    const fresh = ind.sma50Prev <= ind.sma200Prev && ind.sma50 > ind.sma200;
    const surge = ind.vol24hUsd != null && ind.vol24hUsd >= 3 * ind.vol50dAvg;
    rows.push({ ...e, bull, fresh, surge, archetype: archetype(e, bull) });
  }
  const bull = rows.filter((r) => r.bull);
  const surge = rows.filter((r) => r.surge);
  const bullSurge = rows.filter((r) => r.bull && r.surge);

  console.log(`\n=== SCAN REPORT ${new Date().toISOString().slice(0, 16)} (liquid >= $1M, ${rows.length} evaluable) ===`);
  console.log(`  above the golden cross (50>200): ${bull.length} | 3x+ volume surge: ${surge.length} | both: ${bullSurge.length} | fresh cross today: ${rows.filter((r) => r.fresh).length}`);

  console.log(`\n  --- the 366-type set (above cross) by directional archetype ---`);
  const byArch: Record<string, number> = {};
  for (const r of bull) byArch[r.archetype] = (byArch[r.archetype] || 0) + 1;
  Object.entries(byArch).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${String(v).padStart(3)}  ${k}`));

  const fmt = (r: Row) => `${r.base.padEnd(9)} ${r.archetype.split(' (')[0].padEnd(22)} | vol ${r.volMultiple.toFixed(1).padStart(5)}x $${(r.turnover24hUsd / 1e6).toFixed(0).padStart(4)}M | 50d>200d ${(r.distAboveCrossPct >= 0 ? '+' : '') + r.distAboveCrossPct.toFixed(0)}% | px vs50d ${(r.priceVsSma50Pct >= 0 ? '+' : '') + r.priceVsSma50Pct.toFixed(0)}% | 30d ${(r.return30dPct == null ? '?' : (r.return30dPct >= 0 ? '+' : '') + r.return30dPct.toFixed(0) + '%')} | rvol ${r.realizedVolPctDaily == null ? '?' : r.realizedVolPctDaily.toFixed(0) + '%'}`;

  console.log(`\n  --- BULL + 3x VOLUME (the "something's happening in an uptrend" set: ${bullSurge.length}), ranked by score ---`);
  bullSurge.sort((a, b) => b.score - a.score).forEach((r) => console.log('    ' + fmt(r)));

  console.log(`\n  --- the freshest, healthiest (early-uptrend archetype, any volume), top 15 by score ---`);
  bull.filter((r) => r.archetype.startsWith('early')).sort((a, b) => b.score - a.score).slice(0, 15).forEach((r) => console.log('    ' + fmt(r)));
  process.exit(0);
})();
