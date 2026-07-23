/**
 * DAILY-FEATURES PROBE — the runtime had no 200-DAY 50/200 SMA (its sma200 is a 200-HOUR SMA,
 * ~8 days; the recorder keeps ~16 days). This proves daily_features now serves real daily
 * 50/200 SMAs + 50-day average volume for the long-tail universe, evolving with the live price.
 * NO PRODUCT CHANGE. FACT_OPEN if daily indicators can't be computed; FACT_CLOSED if they can.
 *
 * Run: npx tsx scripts/daily_features_probe.ts [--expect-closed]
 */
const EXPECT_CLOSED = process.argv.includes('--expect-closed');

(async () => {
  const daily = await import('../server/decision/daily_features.js');
  const broad = await import('../server/broad_feed.js');
  await broad.refreshBroadFeed();

  const check = (base: string) => {
    const t = broad.getBroadTick(base);
    const ind = daily.dailyIndicators(base, t?.price, t?.vol24hUsd);
    if (!ind) return null;
    return {
      base, days: ind.days,
      sma50: Number(ind.sma50.toPrecision(6)), sma200: Number(ind.sma200.toPrecision(6)),
      bull: ind.sma50 > ind.sma200,
      freshCrossToday: ind.sma50Prev <= ind.sma200Prev && ind.sma50 > ind.sma200,
      vol50dAvgUsd: Math.round(ind.vol50dAvg), live24hUsd: ind.vol24hUsd == null ? null : Math.round(ind.vol24hUsd),
      volSurge3x: ind.vol24hUsd != null && ind.vol24hUsd >= 3 * ind.vol50dAvg,
    };
  };

  const btc = check('BTC');
  // find a long-tail symbol (non-major) with 200+ cached days
  const majors = new Set(['BTC', 'ETH', 'SOL', 'LINK', 'DOGE', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC']);
  let longTail: ReturnType<typeof check> = null;
  for (const b of ['PEPE', 'WIF', 'BONK', 'JUP', 'ENA', 'SEI', 'PENGU', 'PYTH', 'TIA', 'ARB', 'OP', 'INJ']) {
    if (majors.has(b)) continue;
    const c = check(b); if (c && c.days >= 200) { longTail = c; break; }
  }

  const btcOk = !!btc && btc.days >= 200 && btc.sma50 > 0 && btc.sma200 > 0;
  const longTailOk = !!longTail && longTail.days >= 200;
  const cls = btcOk && longTailOk ? 'FACT_CLOSED' : 'FACT_OPEN';

  console.log('\n=== DAILY-FEATURES PROBE ===');
  console.log(JSON.stringify({
    id: 'RUNTIME_HAS_NO_DAILY_50_200',
    class: cls,
    title: 'runtime can compute a real 200-day 50/200 SMA + 50-day avg volume for the long-tail universe',
    checks: {
      btcDaily200SmaComputed: btcOk,
      longTailDaily200SmaComputed: longTailOk,
      goldenCrossGatesEvaluable: !!longTail && longTail.live24hUsd != null,
    },
    evidence: { btc, longTail },
    codePath: 'server/decision/daily_features.ts (cache data/market/momentum/gccache-multi + live broad feed)',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? `\nCLOSED: real daily 50/200 SMAs + 50d avg volume available for BTC and long-tail (${longTail?.base}, ${longTail?.days}d). The golden-cross gates are now evaluable live.\n`
    : '\nOPEN: daily 50/200 indicators could not be computed (missing cache / <200 days).\n');

  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
