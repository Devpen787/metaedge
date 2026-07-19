#!/usr/bin/env node
/**
 * VERDICT BOARD — one place to read the whole edge search. Not another scanner:
 * the instrument to read them. For each lane it shows how much data has accrued
 * and the latest grader verdict (FLAGS = did anything clear the pessimistic bar).
 * Run on the VM: node scripts/verdict_board.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const M = path.join(process.cwd(), 'data', 'market');
const E = path.join(process.cwd(), 'data', 'edgeops');

// lane -> { scan files glob dir+prefix, verdict log path, verdict grep tag }
const LANES = [
  { name: 'Prediction (Kalshi)', scan: [M, 'kalshi', 'resolutions-'], log: [M, 'kalshi', 'calibration-report.log'], tag: 'CALIBRATION VERDICT' },
  { name: 'Memecoin pops', scan: [M, 'memecoin', 'pools-'], log: [M, 'memecoin', 'grader-report.log'], tag: 'MEMECOIN GRADER VERDICT' },
  { name: 'Crypto momentum', scan: [M, 'momentum', 'scan-'], log: [M, 'momentum', 'grader-report.log'], tag: 'MOMENTUM GRADER VERDICT' },
  { name: 'Stocks momentum', scan: [M, 'stocks', 'scan-'], log: [M, 'stocks', 'grader-report.log'], tag: 'STOCK GRADER VERDICT' },
  { name: 'Perps (funding)', scan: [M, 'perps', 'scan-'], log: [M, 'perps', 'grader-report.log'], tag: 'PERP GRADER VERDICT' },
  { name: 'FX trend', scan: [M, 'fx', 'scan-'], log: [M, 'fx', 'grader-report.log'], tag: 'FX GRADER VERDICT' },
  { name: 'Market-making', scan: [M, 'mm', 'trades-'], log: [M, 'mm', 'grader-report.log'], tag: 'MM GRADER VERDICT' },
  { name: 'Cross-venue arb', scan: [M, 'xvenue', 'gaps-'], log: null, tag: null },
  { name: 'Funding carry', scan: null, log: [M, 'carry-report.log'], tag: 'CARRY VERDICT' },
];

function countRows(dir, prefix) {
  try { return fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).reduce((s, f) => s + fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).length, 0); }
  catch { return 0; }
}
function lastVerdict(logPath, tag) {
  try { const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l.includes(tag)); return lines.length ? lines[lines.length - 1] : null; }
  catch { return null; }
}
const flagsOf = (v) => { const m = v && v.match(/FLAGS=(\d+)/); return m ? Number(m[1]) : null; };

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
console.log(`  All FLAGS=0 after full accrual = honest "no cost-surviving edge in the reachable field."\n`);
