#!/usr/bin/env node
/**
 * KILL-RULE REPORT (read-only).
 *
 * The rule itself lives in server/killrule.mjs and is NOT re-implemented here --
 * duplicating it would repeat the exact failure it exists to prevent.
 *
 * This script only READS. It never writes data/db.json: a separate process doing
 * read-modify-write on the flat file would race the server's own writes (the
 * single-threaded-atomicity argument holds within one process, not across two).
 * Enforcement therefore lives in-process, in server/killguard.ts.
 *
 * Exits 1 on any violation, so it can gate a cron or CI.
 *
 * Usage:
 *   node scripts/kill_check.mjs              report on live paper strategies
 *   node scripts/kill_check.mjs --selftest   prove the rule fires on the real corpses
 */
import fs from 'node:fs';
import { evaluateKill, aggregateClosedTradesByFamily, MIN_N, MIN_PROFIT_FACTOR } from '../server/killrule.mjs';

// The corpses, as recorded in docs/edgeops/cards/KILLED-FAMILIES-2026-07.md.
// Real historical measurements used as FIXTURES to prove the rule fires.
// They are test inputs, never evidence of anything.
function selftest() {
  const cases = [
    { name: 'grid (real: n=542, -$0.48/trade)', input: { family: 'grid', n: 542, grossWin: 200, grossLoss: 460, netPnl: -260 }, expect: 'KILL' },
    { name: 'custom_ai (real: n=268, -$0.76/trade)', input: { family: 'custom_ai', n: 268, grossWin: 100, grossLoss: 304, netPnl: -204 }, expect: 'KILL' },
    { name: 'weak-but-positive PF 1.05 at n=100', input: { family: 'weak', n: 100, grossWin: 210, grossLoss: 200, netPnl: 10 }, expect: 'KILL' },
    { name: 'small sample, bad avg (n=10)', input: { family: 'young', n: 10, grossWin: 1, grossLoss: 20, netPnl: -19 }, expect: 'INSUFFICIENT_SAMPLE' },
    { name: 'clears the bar (PF 1.5, n=50)', input: { family: 'ok', n: 50, grossWin: 300, grossLoss: 200, netPnl: 100 }, expect: 'HOLD' },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = evaluateKill(c.input).verdict;
    const pass = got === c.expect;
    if (!pass) failed++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${c.name} -> ${got}${pass ? '' : ` (expected ${c.expect})`}`);
  }
  console.log(`\n${failed === 0 ? 'Kill rule fires correctly on all cases.' : `${failed} case(s) FAILED.`}`);
  return failed;
}

function main() {
  if (process.argv.includes('--selftest')) {
    console.log('Kill-rule self-test (historical corpses as fixtures):\n');
    process.exit(selftest() === 0 ? 0 : 1);
  }

  const db = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
  const results = aggregateClosedTradesByFamily(db).map(evaluateKill);

  if (results.length === 0) {
    console.log('No closed paper trades to evaluate.');
    process.exit(0);
  }

  console.log(`Kill check -- survivor bar: n >= ${MIN_N}, PF >= ${MIN_PROFIT_FACTOR}, avg PnL > 0\n`);
  console.log('family'.padEnd(18) + 'n'.padStart(6) + 'PF'.padStart(9) + 'avg $'.padStart(10) + '  verdict');
  console.log('-'.repeat(72));
  for (const r of results.sort((a, b) => b.n - a.n)) {
    const pf = r.profitFactor === null ? 'inf' : r.profitFactor.toFixed(2);
    console.log(`${r.family.padEnd(18)}${String(r.n).padStart(6)}${pf.padStart(9)}${r.avgPnl.toFixed(2).padStart(10)}  ${r.verdict}`);
  }

  const violations = results.filter((r) => r.verdict === 'KILL');
  if (violations.length) {
    console.log(`\nKILL-RULE VIOLATIONS (${violations.length}) -- must be stopped, not observed:`);
    for (const v of violations) console.log(`  ${v.family}: ${v.reason}`);
    process.exit(1);
  }
  console.log('\nNo kill-rule violations.');
  process.exit(0);
}

main();
