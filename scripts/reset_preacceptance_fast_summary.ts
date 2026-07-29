import fs from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), 'data', 'opportunity-factory-v3');
const derived = path.join(root, 'fast-perps', 'derived', 'research-runs.jsonl');
const contracts = path.join(root, 'economics', 'paper-trade-contracts.jsonl');
const versions = path.join(root, 'economics', 'strategy-versions.jsonl');
if ([contracts, versions].some((file) => fs.existsSync(file))) {
  throw new Error('ACTIVE_PREACCEPTANCE_DERIVED_FILES_STILL_PRESENT');
}
const summaryFile = path.join(root, 'fast-perps', 'materialized', 'evidence-summary.json');
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const activeResearchRuns = fs.existsSync(derived) ? fs.readFileSync(derived, 'utf8').split('\n').filter(Boolean)
  .map((line) => JSON.parse(line)) : [];
summary.counts.researchRuns = activeResearchRuns.length;
summary.latestResearchRun = activeResearchRuns.at(-1) ?? null;
summary.updatedAt = Date.now();
const temporary = `${summaryFile}.${process.pid}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(summary));
fs.renameSync(temporary, summaryFile);
console.log(JSON.stringify({ reset: true, reason: 'RECOVERY_PREACCEPTANCE_NONCANDIDATE_CONTRACTS',
  activeResearchRuns: activeResearchRuns.length,
  retainedRawCounts: summary.counts, liveExecution: 'locked' }));
