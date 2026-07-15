#!/usr/bin/env tsx
/**
 * Forward-paper trial report — funding-basis-v2 variant B (hedged spot-perp carry).
 *
 * Read-only. Accrues hypothetical carry from OUR recorder's funding capture and
 * evaluates the card's PRE-COMMITTED falsifier: < 5% APR on deployed capital over
 * 60 days -> KILL.
 *
 * Usage: npx tsx scripts/carry_trial.ts
 */
import fs from 'node:fs';
import { computeCarryTrial, projectAprOnCapital, type CarryTrialConfig } from '../server/opportunity/carry_trial.js';

const configFlag = process.argv.indexOf('--config');
const configPath = configFlag >= 0 ? process.argv[configFlag + 1] : 'config/research/carry-trial-v2.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as CarryTrialConfig;
const trial = computeCarryTrial(config);

console.log(`\nfunding-basis-v2 variant B — forward paper trial`);
console.log(`day ${trial.daysElapsed.toFixed(1)} of ${trial.trialDays} · $100 notional/coin · capital = 2x notional (both legs funded)`);
console.log(`falsifier: APR on DEPLOYED CAPITAL < ${trial.killFloorAprOnCapital}% at day ${trial.trialDays} -> KILL\n`);

if (trial.legs.length === 0) {
  console.log(`  ${trial.verdict}: ${trial.reason}\n`);
  process.exit(0);
}

console.log(
  'coin'.padEnd(6) + 'hrs'.padStart(6) + 'funding%'.padStart(11) + 'basis'.padStart(12) +
  'net $'.padStart(9) + 'APR/notional'.padStart(14) + 'APR/capital'.padStart(13)
);
console.log('-'.repeat(71));
for (const l of trial.legs) {
  const basis = l.basisMeasured ? `${((l.basisPnlFraction as number) * 100).toFixed(4)}%` : 'UNMEASURED';
  console.log(
    l.symbol.padEnd(6) +
    String(l.hoursAccrued).padStart(6) +
    (l.accruedFundingFraction * 100).toFixed(4).padStart(11) +
    basis.padStart(12) +
    l.netUsd.toFixed(3).padStart(9) +
    (l.aprOnNotional.toFixed(1) + '%').padStart(14) +
    (l.aprOnCapital.toFixed(1) + '%').padStart(13)
  );
}

console.log(`\n  capture coverage: ${(trial.minCaptureCoverage * 100).toFixed(1)}% ` +
  `(${trial.legs[0].hoursAccrued} hourly rows captured of ${Math.round(trial.legs[0].hoursElapsed)} elapsed)`);
if (trial.minCaptureCoverage < 0.9) {
  console.log('  WARNING: gaps do not accrue, so low coverage UNDERSTATES carry.');
  console.log('           At day 60 this blocks a verdict rather than rendering a false KILL.');
}

const anyUnmeasured = trial.legs.some((l) => !l.basisMeasured);
if (anyUnmeasured) {
  console.log('\n  NOTE: basis UNMEASURED where premium was not captured before 2026-07-09.');
  console.log('        Treated as unknown, never as zero. Net figures exclude basis for those legs.');
}

const bh = trial.legs[0]?.breakevenHours;
if (bh) {
  console.log(`\n  Cost drag: the 40bps round trip takes ~${(bh / 24).toFixed(1)} days of carry to repay`);
  console.log(`             at the current funding rate. Early APR is dominated by that cost.`);
}

console.log(`\n  verdict: ${trial.verdict} — ${trial.reason}`);

// What does the card's own cost model imply at sustained funding levels?
console.log(`\n  Projection at day ${trial.trialDays}, by sustained funding rate (card cost model):`);
console.log('  ' + 'funding APR (notional)'.padEnd(26) + 'trial APR on capital'.padStart(22) + '   verdict');
console.log('  ' + '-'.repeat(60));
for (const f of [8, 10, 10.95, 12, 14, 16, 20]) {
  const apr = projectAprOnCapital(f, config);
  const v = apr < trial.killFloorAprOnCapital ? 'KILL' : 'survives';
  const tag = Math.abs(f - 10.95) < 0.01 ? '  <- current' : '';
  console.log('  ' + `${f.toFixed(2)}%`.padEnd(26) + `${apr.toFixed(2)}%`.padStart(22) + `   ${v}${tag}`);
}
console.log();
