import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const reason = 'RECOVERY_PREACCEPTANCE_RESTART_CADENCE_BYPASS';
const root = path.join(process.cwd(), 'data', 'opportunity-factory-v3');
const activeFile = path.join(root, 'fast-perps', 'derived', 'research-runs.jsonl');
const archiveRoot = path.join(process.cwd(), 'data', 'archive', 'flywheel-v3-preacceptance-restart-runs-2026-07-16');
const rows = fs.readFileSync(activeFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const retained = rows.filter((row) => row.researchLookNumber === 1);
const quarantined = rows.filter((row) => row.researchLookNumber !== 1);
if (retained.length !== 1 || !quarantined.length) throw new Error('UNEXPECTED_RESTART_RESEARCH_RUN_SHAPE');
fs.mkdirSync(archiveRoot, { recursive: true });
const archivedFile = path.join(archiveRoot, 'research-runs.jsonl');
fs.writeFileSync(archivedFile, `${quarantined.map((row) => JSON.stringify(row)).join('\n')}\n`);
const digest = crypto.createHash('sha256').update(fs.readFileSync(archivedFile)).digest('hex');
fs.writeFileSync(path.join(archiveRoot, 'manifest.json'), JSON.stringify({ schemaVersion: 1, reason,
  quarantinedRunIds: quarantined.map((row) => row.id), sha256: digest, promotable: false,
  liveExecution: 'locked' }, null, 2));
const temporary = `${activeFile}.${process.pid}.tmp`;
fs.writeFileSync(temporary, `${retained.map((row) => JSON.stringify(row)).join('\n')}\n`);
fs.renameSync(temporary, activeFile);
const summaryFile = path.join(root, 'fast-perps', 'materialized', 'evidence-summary.json');
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
summary.counts.researchRuns = retained.length; summary.latestResearchRun = retained.at(-1); summary.updatedAt = Date.now();
const summaryTemporary = `${summaryFile}.${process.pid}.tmp`; fs.writeFileSync(summaryTemporary, JSON.stringify(summary));
fs.renameSync(summaryTemporary, summaryFile);
fs.chmodSync(archivedFile, 0o444); fs.chmodSync(path.join(archiveRoot, 'manifest.json'), 0o444);
console.log(JSON.stringify({ reason, retained: retained.map((row) => row.id),
  quarantined: quarantined.map((row) => row.id), sha256: digest, liveExecution: 'locked' }));
