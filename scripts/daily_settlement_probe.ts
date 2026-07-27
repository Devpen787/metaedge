/**
 * DAILY-SETTLEMENT PROBE — startDailyRoll used to record the first post-midnight snapshot as a
 * day's "settled" bar (an OPENING price, not the prior day's close), corrupting the SMAs forward.
 * This proves dailyRollStep() now finalizes the PRIOR day at its LAST-observed close.
 * FACT_CLOSED when the settled bar == the prior day's last price. NO PRODUCTION DATA CHANGE.
 *
 * Run: npx tsx scripts/daily_settlement_probe.ts [--expect-closed]
 */
import { __seedSeries, __getSeries, dailyRollStep } from '../server/decision/daily_features.js';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');
const DAY = 86_400_000, D = 20_000, H = 3_600_000;

// seed a small history ending on day D-1
__seedSeries('TESTX', [5, 4, 3, 2, 1].map((k) => ({ t: (D - k) * DAY, p: 50, v: 1e6 })));
const tick = (px: number) => (b: string) => (b === 'TESTX' ? { price: px, vol24hUsd: 1e6 } : null);

dailyRollStep(D * DAY + 12 * H, tick(100));                 // noon day D  → first sight, running close 100 (no finalize)
dailyRollStep(D * DAY + 20 * H, tick(110));                 // evening day D → running close updates to 110
const finalized = dailyRollStep((D + 1) * DAY + 8 * H, tick(130)); // morning day D+1 → rollover: finalize day D

const s = __getSeries('TESTX') || [];
const dayDBars = s.filter((b: any) => Math.floor(b.t / DAY) === D);
const dayDClose = dayDBars.length ? dayDBars[dayDBars.length - 1].p : null;

const settledOnce = finalized === 1;
const settledAtPriorClose = dayDClose === 110;                          // the last price OF day D
const notNextDayOpen = dayDClose !== 130;                               // NOT the new day's opening
const notFirstOfDay = dayDClose !== 100;                                // NOT day D's first price
const datedToPriorDay = dayDBars.every((b: any) => Math.floor(b.t / DAY) === D);

const ok = settledOnce && settledAtPriorClose && notNextDayOpen && notFirstOfDay && datedToPriorDay;
const cls = ok ? 'FACT_CLOSED' : 'FACT_OPEN';
console.log('\n=== DAILY-SETTLEMENT PROBE ===');
console.log(JSON.stringify({
  id: 'DAILY_ROLL_SETTLES_WRONG_BAR', class: cls,
  checks: { finalizedExactlyOne: settledOnce, settledAtPriorDayClose_110: settledAtPriorClose, notNextDayOpen_130: notNextDayOpen, notFirstPriceOfDay_100: notFirstOfDay, datedToPriorDay: datedToPriorDay },
  evidence: { seededHistoryLastDay: D - 1, intradayPrices: [100, 110], nextDayOpen: 130, settledDayDClose: dayDClose, finalizedCount: finalized, seriesLen: s.length },
}, null, 2));
console.log(cls === 'FACT_CLOSED'
  ? '\nCLOSED: day D settled at 110 (its last close), dated to day D — not 130 (next-day open) or 100 (first-of-day).\n'
  : '\nOPEN: settlement bar is wrong.\n');
process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
