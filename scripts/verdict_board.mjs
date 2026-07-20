#!/usr/bin/env node
/**
 * VERDICT BOARD — one place to read the whole edge search. Not another scanner:
 * the instrument to read them. For each lane it shows how much data has accrued
 * and the latest grader verdict (FLAGS = did anything clear the pessimistic bar).
 * Run on the VM: node scripts/verdict_board.mjs
 * Add --legibility to also print each lane's SYSTEM LEGIBILITY block (what it's
 * doing / not doing yet / why — per docs/trading_research_operating_model.md)
 * without having to go open each lane's own source file.
 */
import fs from 'node:fs';
import path from 'node:path';

const M = path.join(process.cwd(), 'data', 'market');
const E = path.join(process.cwd(), 'data', 'edgeops');

// lane -> { scan files glob dir+prefix, verdict log path, verdict grep tag, kind,
// legibilityModule: relative path to the file exporting this lane's LEGIBILITY
// const (scout file when scout+grader disagree in scope; the grader carries its
// own separate LEGIBILITY export and is read too when present, see printBoard). }
// `kind` tells edge_watcher.mjs which auto-harness mechanic applies: 'binary'
// (Kalshi-style: buy a side, wait for resolution) vs 'directional' (momentum/
// memecoin/stocks/perps/fx: entry + stop/target/hold, runs on the portfolio
// ledger + Risk OS) vs null (no auto-harness defined yet — mm/xvenue/carry
// already have bespoke measurement, not a directional bet to size).
export const LANES = [
  { name: 'Prediction (Kalshi)', scan: [M, 'kalshi', 'resolutions-'], log: [M, 'kalshi', 'calibration-report.log'], tag: 'CALIBRATION VERDICT', kind: 'binary', legibilityModules: ['./kalshi_scout.mjs', './kalshi_calibration.mjs', './kalshi_paper_harness.mjs'] },
  { name: 'Memecoin pops', scan: [M, 'memecoin', 'pools-'], log: [M, 'memecoin', 'grader-report.log'], tag: 'MEMECOIN GRADER VERDICT', kind: 'directional', legibilityModules: ['./memecoin_scout.mjs', './memecoin_grader.mjs'] },
  { name: 'Crypto momentum', scan: [M, 'momentum', 'scan-'], log: [M, 'momentum', 'grader-report.log'], tag: 'MOMENTUM GRADER VERDICT', kind: 'directional', legibilityModules: ['./momentum_scout.mjs', './momentum_grader.mjs'] },
  { name: 'Stocks momentum', scan: [M, 'stocks', 'scan-'], log: [M, 'stocks', 'grader-report.log'], tag: 'STOCK GRADER VERDICT', kind: 'directional', legibilityModules: ['./stock_scout_wide.mjs', './stock_grader.mjs'] },
  { name: 'Perps (funding)', scan: [M, 'perps', 'scan-'], log: [M, 'perps', 'grader-report.log'], tag: 'PERP GRADER VERDICT', kind: 'directional', legibilityModules: ['./perp_scout.mjs', './perp_grader.mjs'] },
  { name: 'FX trend', scan: [M, 'fx', 'scan-'], log: [M, 'fx', 'grader-report.log'], tag: 'FX GRADER VERDICT', kind: 'directional', legibilityModules: ['./fx_scout.mjs', './fx_grader.mjs'] },
  { name: 'Market-making', scan: [M, 'mm', 'trades-'], log: [M, 'mm', 'grader-report.log'], tag: 'MM GRADER VERDICT', kind: null, legibilityModules: ['./mm_scout.mjs', './mm_grader.mjs'] },
  { name: 'Cross-venue arb', scan: [M, 'xvenue', 'gaps-'], log: null, tag: null, kind: null, legibilityModules: ['./xvenue_scout.mjs'] },
  { name: 'Funding carry', scan: null, log: [M, 'carry-report.log'], tag: 'CARRY VERDICT', kind: null, legibilityModules: ['./carry_analyzer.mjs'] },
];

export function countRows(dir, prefix) {
  try { return fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).reduce((s, f) => s + fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).length, 0); }
  catch { return 0; }
}
export function lastVerdict(logPath, tag) {
  try { const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l.includes(tag)); return lines.length ? lines[lines.length - 1] : null; }
  catch { return null; }
}
export const flagsOf = (v) => { const m = v && v.match(/FLAGS=(\d+)/); return m ? Number(m[1]) : null; };

// prints one lane's SYSTEM LEGIBILITY block (what/not-yet/why) by dynamically
// importing each of its legibilityModules and reading their LEGIBILITY export.
// Missing exports are reported plainly (not silently skipped) — a lane with no
// LEGIBILITY export is itself a legibility gap worth surfacing, not hiding.
async function printLegibility(L) {
  console.log(`\n  --- ${L.name} ---`);
  for (const rel of L.legibilityModules || []) {
    let mod;
    try { mod = await import(rel); } catch (e) { console.log(`    [${rel}] failed to load: ${e.message}`); continue; }
    if (!mod.LEGIBILITY) { console.log(`    [${rel}] NO LEGIBILITY EXPORT — gap, not silently skipped.`); continue; }
    const { doing, notYet, why } = mod.LEGIBILITY;
    console.log(`    [${rel}]`);
    console.log(`      doing:   ${doing}`);
    for (const n of notYet || []) console.log(`      not yet: ${n}`);
    for (const w of why || []) console.log(`      why:     ${w}`);
  }
}

// Only print the board when this file is run directly — importing LANES/helpers
// from edge_watcher.mjs must not trigger the console report as a side effect.
if (import.meta.url === `file://${process.argv[1]}`) {
  const showLegibility = process.argv.includes('--legibility');
  console.log(`\n=== EDGE VERDICT BOARD — ${new Date().toISOString()} ===`);
  console.log(`  ${'lane'.padEnd(22)} ${'accrued'.padStart(9)}  status / latest verdict`);
  for (const L of LANES) {
    const rows = L.scan ? countRows(path.join(L.scan[0], L.scan[1]), L.scan[2]) : null;
    const v = L.log ? lastVerdict(path.join(...L.log), L.tag) : null;
    const flags = flagsOf(v);
    let status;
    if (flags == null) status = v ? 'verdict logged' : (rows ? 'accruing (no verdict yet)' : 'no data');
    else if (flags > 0) status = `*** FLAGS=${flags} — EDGE CANDIDATE, INVESTIGATE ***`;
    else status = 'no edge (FLAGS=0)';
    const tail = v ? '  ::  ' + v.replace(/^.*VERDICT\s+/, '').slice(0, 60) : '';
    console.log(`  ${L.name.padEnd(22)} ${(rows == null ? '—' : String(rows)).padStart(9)}  ${status}${tail}`);
  }
  console.log(`\n  FLAGS>0 anywhere = a signal cleared the pessimistic, net-of-cost bar -> the practice book + Risk OS runs it.`);
  console.log(`  All FLAGS=0 after full accrual = honest "no cost-surviving edge in the reachable field."`);
  if (showLegibility) {
    console.log(`\n=== SYSTEM LEGIBILITY (what each lane is doing / not doing yet / why) ===`);
    for (const L of LANES) await printLegibility(L);
  } else {
    console.log(`\n  Run with --legibility to see what each lane is doing, not doing yet, and why.`);
  }
  console.log();
}
