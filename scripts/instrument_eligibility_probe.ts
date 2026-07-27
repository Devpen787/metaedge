/**
 * INSTRUMENT-ELIGIBILITY PROBE — production admitted leveraged tokens + tokenized equities,
 * violating the frozen "real spot only" hypothesis and corrupting the forward test. This proves
 * isRealSpot() excludes them WITHOUT false-excluding real coins, and that the scanner now applies it.
 * FACT_CLOSED when every classification is correct. NO PRODUCTION DATA CHANGE.
 *
 * Run: npx tsx scripts/instrument_eligibility_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import { isRealSpot, ineligibleReason } from '../server/decision/instrument_eligibility.js';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');

// must be EXCLUDED (non-spot)
const excl = ['SHIB3S', 'BTC3L', 'DOGE5L', 'WIF5S', 'ETH3S', 'BCH5L', 'PEPE3L', 'HYPE3S', 'QQQON', 'AMZNON', 'USDT', 'USDC', 'DAI', 'WBTC', 'WETH', 'STETH', 'BNSOL'];
// must be KEPT (real spot) — includes the tricky ones my patterns must NOT kill
const keep = ['BTC', 'ETH', 'SOL', 'PEPE', 'ADA', 'JUP', 'WIF', 'ONDO', 'TON', 'OP', 'MOON', 'SUI', 'ENA', 'BONK', 'S', 'W', 'PENGU'];

const wrongExcl = excl.filter((s) => isRealSpot(s));                 // should be [] (none wrongly kept)
const wrongKeep = keep.filter((s) => !isRealSpot(s));               // should be [] (none wrongly excluded)

// apply to the frozen trade log's symbols: the 9 known non-spot must drop out
let logCheck: any = { skipped: true };
try {
  const syms = [...new Set(fs.readFileSync('docs/research/gc-truth-freeze/trades.jsonl', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).symbol))];
  const removed = syms.filter((s) => !isRealSpot(s)).sort();
  const expected = ['AMZNON', 'BCH5L', 'BTC3S', 'DOGE3L', 'DOGE5L', 'ETH3S', 'HYPE3S', 'PEPE3L', 'WIF5S'].sort();
  logCheck = { totalSymbols: syms.length, removed, expected, matchesExpected: JSON.stringify(removed) === JSON.stringify(expected) };
} catch (e: any) { logCheck = { error: e?.message }; }

// confirm the scanner applies the filter (source wiring)
const scannerUses = /isRealSpot\(base\)/.test(fs.readFileSync('server/decision/golden_cross_scanner.ts', 'utf8'));

const ok = wrongExcl.length === 0 && wrongKeep.length === 0 && logCheck.matchesExpected === true && scannerUses;
const cls = ok ? 'FACT_CLOSED' : 'FACT_OPEN';
console.log('\n=== INSTRUMENT-ELIGIBILITY PROBE ===');
console.log(JSON.stringify({
  id: 'PROD_ADMITS_NON_SPOT_INSTRUMENTS', class: cls,
  checks: { noRealCoinFalseExcluded: wrongKeep.length === 0, allNonSpotExcluded: wrongExcl.length === 0, frozenLogNonSpotRemovedExactly: logCheck.matchesExpected === true, scannerAppliesFilter: scannerUses },
  wronglyKept: wrongExcl, wronglyExcluded: wrongKeep,
  sampleReasons: { SHIB3S: ineligibleReason('SHIB3S'), QQQON: ineligibleReason('QQQON'), USDT: ineligibleReason('USDT'), WBTC: ineligibleReason('WBTC'), JUP: ineligibleReason('JUP') },
  frozenLog: logCheck,
}, null, 2));
console.log(cls === 'FACT_CLOSED'
  ? `\nCLOSED: real-spot-only enforced — ${logCheck.removed?.length} non-spot removed from the frozen universe, 0 real coins false-excluded, scanner wired.\n`
  : '\nOPEN: classification or wiring not correct.\n');
process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
