#!/usr/bin/env node
/**
 * RESEARCH TRUTH FREEZE — robustness diagnostics over the frozen golden-cross trade log.
 * READ-ONLY: consumes docs/research/gc-truth-freeze/trades.jsonl, changes nothing.
 * These are stress tests of an IN-SAMPLE, PARAMETER-SELECTED result. They are NOT holdout tests
 * and prove nothing out-of-sample. Usage: node scripts/gc_robustness.mjs [tradesFile]
 */
import fs from 'node:fs';
const FILE = process.argv[2] || 'docs/research/gc-truth-freeze/trades.jsonl';
const T = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const win = (a) => a.length ? 100 * a.filter((x) => x > 0).length / a.length : NaN;
const net = (t) => t.netPct;
const nets = (arr) => arr.map(net);
const line = (label, arr) => `${label.padEnd(30)} n=${String(arr.length).padStart(4)}  medianNet=${median(nets(arr)).toFixed(2).padStart(7)}%  meanNet=${mean(nets(arr)).toFixed(2).padStart(7)}%  win=${win(nets(arr)).toFixed(0).padStart(3)}%`;

// bootstrap 95% CI for median & mean of net returns
function bootCI(arr, stat, B = 3000) {
  const v = nets(arr); if (v.length < 3) return [NaN, NaN];
  const out = [];
  for (let b = 0; b < B; b++) { let s = []; for (let i = 0; i < v.length; i++) s.push(v[(Math.random() * v.length) | 0]); out.push(stat(s)); }
  out.sort((a, b) => a - b);
  return [out[(0.025 * B) | 0], out[(0.975 * B) | 0]];
}

// instrument classification (best-effort; tokenized-equity detection is incomplete — flagged)
const STABLE = new Set(['USDT', 'USDC', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'USDE', 'PYUSD', 'GUSD', 'USDD', 'USDG', 'USD1', 'USDY', 'USDF', 'BUSD', 'EUR', 'EURT', 'EURI']);
const isLeveraged = (s) => /(?:[2-5](L|S)|UP|DOWN)$/.test(s);
const isWrapped = (s) => /^W[A-Z]{2,}$/.test(s) || ['WBTC', 'WETH', 'WBETH', 'STETH', 'WEETH', 'CBETH', 'RETH'].includes(s);
const KNOWN_TOKENIZED = new Set(['QQQON', 'SPYON', 'AAPLON', 'TSLAON', 'NVDAON', 'MSTRON', 'COINON', 'GOOGLON', 'METAON', 'AMZNON']); // partial
const isTokenizedEq = (s) => KNOWN_TOKENIZED.has(s) || /(ON|X)$/.test(s) && /(QQQ|SPY|AAPL|TSLA|NVDA|MSTR|COIN)/.test(s);
const isJunk = (s) => STABLE.has(s) || isLeveraged(s) || isWrapped(s) || isTokenizedEq(s);

console.log(`\n=== GOLDEN-CROSS TRUTH-FREEZE ROBUSTNESS (${T.length} trades, ${FILE}) ===`);
console.log('IN-SAMPLE parameter-selected result under stress. NOT out-of-sample. Net = gross - 0.4% round-trip.\n');

// headline + CIs
console.log(line('ALL TRADES', T));
const [mlo, mhi] = bootCI(T, median), [alo, ahi] = bootCI(T, mean);
console.log(`  95% CI  medianNet=[${mlo.toFixed(2)}, ${mhi.toFixed(2)}]%   meanNet=[${alo.toFixed(2)}, ${ahi.toFixed(2)}]%   (bootstrap, ignores date-clustering below)\n`);

// chronological folds (by entry date)
const sorted = [...T].sort((a, b) => a.entryMs - b.entryMs);
console.log('-- chronological folds (equal trade counts, by entry time) --');
for (let k = 0; k < 4; k++) { const seg = sorted.slice(Math.floor(k * T.length / 4), Math.floor((k + 1) * T.length / 4)); console.log('  ' + line(`fold ${k + 1} (${seg[0]?.entryDate}..${seg[seg.length - 1]?.entryDate})`, seg)); }
console.log('-- early vs late (50/50 by time) --');
console.log('  ' + line('early half', sorted.slice(0, T.length >> 1)));
console.log('  ' + line('late half', sorted.slice(T.length >> 1)) + '\n');

// leave-one-venue-out
const venues = [...new Set(T.map((t) => t.venue))];
console.log('-- venue mix + leave-one-venue-out (venue = re-derived at run time, NOT persisted at fetch) --');
for (const v of venues) console.log('  ' + line(`only ${v}`, T.filter((t) => t.venue === v)));
for (const v of venues) console.log('  ' + line(`drop ${v}`, T.filter((t) => t.venue !== v)));
console.log('');

// liquidity / turnover cohorts
console.log('-- turnover cohorts (24h quote turnover at entry) --');
console.log('  ' + line('$1-5M', T.filter((t) => t.turnoverUsd < 5e6)));
console.log('  ' + line('$5-50M', T.filter((t) => t.turnoverUsd >= 5e6 && t.turnoverUsd < 5e7)));
console.log('  ' + line('>$50M', T.filter((t) => t.turnoverUsd >= 5e7)) + '\n');

// volume-multiple cohorts
console.log('-- volume-multiple cohorts --');
console.log('  ' + line('3-5x', T.filter((t) => t.volMultiple != null && t.volMultiple < 5)));
console.log('  ' + line('5-10x', T.filter((t) => t.volMultiple >= 5 && t.volMultiple < 10)));
console.log('  ' + line('>=10x', T.filter((t) => t.volMultiple >= 10)) + '\n');

// instrument exclusion (the frozen "real spot only" definition the backtest did NOT enforce)
const junk = T.filter((t) => isJunk(t.symbol));
console.log('-- instrument exclusion: remove leveraged/stable/wrapped/tokenized-equity --');
console.log(`  flagged non-spot (best-effort): ${junk.length} → ${junk.map((t) => t.symbol).join(', ') || '(none)'}`);
console.log('  ' + line('real-spot-only (junk removed)', T.filter((t) => !isJunk(t.symbol))) + '\n');

// date clustering — same-day entries are likely one market event, not independent trades
const byDay = {}; for (const t of T) (byDay[t.entryDate] ||= []).push(t);
const days = Object.keys(byDay);
const dayMeans = days.map((d) => mean(nets(byDay[d])));
const multiDay = days.filter((d) => byDay[d].length > 1);
console.log('-- date clustering (independence check) --');
console.log(`  ${T.length} trades on ${days.length} distinct entry dates; ${multiDay.length} dates carry >1 trade`);
console.log(`  day-level (one obs per date = that date's mean): n=${days.length}  medianNet=${median(dayMeans).toFixed(2)}%  meanNet=${mean(dayMeans).toFixed(2)}%  win=${win(dayMeans).toFixed(0)}%`);
const biggestDay = days.map((d) => [d, byDay[d].length]).sort((a, b) => b[1] - a[1])[0];
console.log(`  most-clustered date: ${biggestDay[0]} with ${biggestDay[1]} simultaneous entries\n`);

// performance concentration
const byNet = [...T].sort((a, b) => net(b) - net(a));
const totNet = nets(T).reduce((a, b) => a + b, 0);
console.log('-- performance concentration (net %, summed) --');
console.log(`  total summed net across all ${T.length}: ${totNet.toFixed(1)}%`);
for (const k of [1, 5, 10]) { const top = byNet.slice(0, k); const topSum = nets(top).reduce((a, b) => a + b, 0); console.log(`  top ${String(k).padStart(2)} trades = ${topSum.toFixed(1)}% (${(100 * topSum / totNet).toFixed(0)}% of total)  |  remove them → ` + line('', byNet.slice(k)).trim()); }
console.log('');

// closed-trade equity DD (NOT true intra-trade MTM — flagged as a blocker)
const CONC = 5;
let eq = 1, peak = 1, dd = 0;
for (const t of [...T].sort((a, b) => a.exitMs - b.exitMs)) { eq *= (1 + (t.netPct / 100) / CONC); peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
console.log(`-- closed-trade equity (1/${CONC} sized, exit-ordered) --`);
console.log(`  total ${((eq - 1) * 100).toFixed(0)}%   closed-trade maxDD -${(dd * 100).toFixed(1)}%   [NOT mark-to-market concurrency — see blockers]\n`);

// exit-reason mix
const rc = {}; for (const t of T) rc[t.exitReason] = (rc[t.exitReason] || 0) + 1;
console.log('-- exit-reason mix -- ' + Object.entries(rc).map(([k, v]) => `${k}:${v}`).join('  '));
