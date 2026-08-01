import fs from 'node:fs';
import path from 'node:path';

const runRoot = path.resolve(process.argv[2] || '');
if (!runRoot || !fs.existsSync(runRoot)) throw new Error('BURNIN_RUN_DIRECTORY_REQUIRED');
const summaryFile = path.join(runRoot, 'summary.json'); const seriesFile = path.join(runRoot, 'series.jsonl');
if (!fs.existsSync(summaryFile)) throw new Error('BURNIN_SUMMARY_MISSING');
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const samples = fs.readFileSync(seriesFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
const failures = []; const fail = (code) => { if (!failures.includes(code)) failures.push(code); };
const percentile = (values, level) => {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  return rows.length ? rows[Math.min(rows.length - 1, Math.ceil(level * rows.length) - 1)] : null;
};
const median = (values) => percentile(values, 0.5);
const durationMs = Number(summary.completedAt) - Number(summary.startedAt);
if (!summary.passed) fail('MONITOR_SUMMARY_FAILED');
if (durationMs < 2 * 60 * 60_000) fail('FULL_TWO_HOURS_NOT_MEASURED');
if (samples.length < 450) fail('INSUFFICIENT_15_SECOND_SAMPLES');
const utcHours = new Set(samples.map((row) => new Date(row.at).toISOString().slice(0, 13)));
if (utcHours.size < 3) fail('UTC_PARTITION_BOUNDARIES_NOT_CROSSED');
if (samples.some((row) => row.session.status !== 200 || row.v5.status !== 200 || row.health.status !== 200)) {
  fail('ENDPOINT_FAILURE');
}
if (samples.some((row) => row.health.operational !== true || row.health.storageHealthy !== true
  || row.health.currentLiveLock !== true || row.v5.liveExecution !== 'locked')) fail('OPERATIONAL_OR_LOCK_FAILURE');
const expectedClocks = ['lifecycle_evaluator', 'outcome_resolver', 'signal_evaluator'];
if (samples.some((row) => JSON.stringify((row.health.clocks || []).map((clock) => clock.id).sort())
  !== JSON.stringify(expectedClocks))) fail('CONTINUOUS_CLOCK_SET_CHANGED');
if (samples.some((row) => (row.health.clocks || []).some((clock) => !clock.fresh || !clock.bounded
  || clock.status !== 'healthy' || Number(clock.queueDepth) > 10_000 || Number(clock.queueLagMs) > 30_000))) {
  fail('CLOCK_HEALTH_FAILURE');
}
const firstHeartbeatPids = Object.values(samples[0]?.heartbeatPids || {}).map(Number).filter(Number.isFinite);
const heartbeatPidSet = new Set(firstHeartbeatPids);
const serverPid = (samples[0]?.process?.pids || []).map(Number).find((pid) => !heartbeatPidSet.has(pid)) ?? null;
const coreProcessPids = [serverPid, ...firstHeartbeatPids].filter(Number.isFinite).sort((a, b) => a - b);
const maximumProcessCount = Math.max(0, ...samples.map((row) => Number(row.process.processCount) || 0));
const maximumTransientProcesses = Math.max(0, maximumProcessCount - coreProcessPids.length);
const coreChanged = coreProcessPids.length !== 4 || samples.some((row) => !row.process.alive
  || coreProcessPids.some((pid) => !row.process.pids.includes(pid))
  || JSON.stringify(Object.values(row.heartbeatPids || {}).map(Number).sort((a, b) => a - b))
    !== JSON.stringify([...firstHeartbeatPids].sort((a, b) => a - b)));
if (coreChanged) {
  fail('PROCESS_TREE_CHANGED');
}
if (maximumTransientProcesses > 2) fail('TRANSIENT_PROCESS_TREE_UNBOUNDED');
if (samples.some((row) => Number(row.health.unresolvedDecisions) !== 0 || Number(row.health.unresolvedOutcomes) !== 0)) {
  fail('UNRESOLVED_FORWARD_STATE');
}
const finalThirty = samples.filter((row) => row.at >= summary.completedAt - 30 * 60_000);
const window = Math.min(10, Math.floor(finalThirty.length / 2));
const rssStart = median(finalThirty.slice(0, window).map((row) => row.process.rssKb));
const rssEnd = median(finalThirty.slice(-window).map((row) => row.process.rssKb));
const finalThirtyRssGrowthFraction = rssStart > 0 ? (rssEnd - rssStart) / rssStart : null;
if (finalThirtyRssGrowthFraction == null || finalThirtyRssGrowthFraction > 0.10) fail('FINAL_THIRTY_MINUTE_RSS_GROWTH');
const averageCpuPercent = samples.reduce((sum, row) => sum + Number(row.process.cpuPercent), 0) / samples.length;
const p95CpuPercent = percentile(samples.map((row) => row.process.cpuPercent), 0.95);
if (averageCpuPercent >= 30 || p95CpuPercent >= 70) fail('CPU_GATE_FAILED');
if (summary.metrics.sessionP95Ms >= 100 || summary.metrics.v5P95Ms >= 250 || summary.metrics.v5P99Ms >= 500) {
  fail('LATENCY_GATE_FAILED');
}
if (summary.metrics.rawKbPerDay >= 500 * 1024 || summary.metrics.derivedKbPerDay >= 25 * 1024) fail('STORAGE_RATE_GATE_FAILED');
if (summary.metrics.contractCreationWithoutResearch || summary.metrics.processRestarts || !summary.metrics.liveExecutionLockedThroughout) {
  fail('TRUTH_OR_RESTART_GATE_FAILED');
}
const projectRoot = process.cwd(); const manifestFile = path.join(projectRoot, 'data', 'opportunity-factory-v3',
  'fast-perps', 'manifests', 'partition-maintenance.jsonl');
const maintenance = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8').split('\n').filter(Boolean)
  .map((line) => JSON.parse(line)).filter((row) => row.recordedAt >= summary.startedAt && row.recordedAt <= summary.completedAt) : [];
const batches = new Map(); for (const row of maintenance) batches.set(row.recordedAt, (batches.get(row.recordedAt) || 0) + 1);
if (!maintenance.some((row) => row.action === 'compressed')) fail('NO_BOUNDARY_COMPRESSION');
if ([...batches.values()].some((count) => count > 2)) fail('COMPRESSION_BATCH_EXCEEDED_TWO');
for (const row of maintenance.filter((item) => item.action === 'compressed')) {
  if (fs.existsSync(row.file) || !fs.existsSync(row.target)) fail('PARTITION_SOURCE_TARGET_RECONCILIATION_FAILED');
}
const walk = (root) => !fs.existsSync(root) ? [] : fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(root, entry.name); return entry.isDirectory() ? walk(target) : [target];
});
const rawRoot = path.join(projectRoot, 'data', 'opportunity-factory-v3', 'fast-perps', 'raw');
const orphanTemporaryFiles = walk(rawRoot).filter((file) => file.endsWith('.tmp') || file.endsWith('.staging'));
if (orphanTemporaryFiles.length) fail('ORPHAN_TEMPORARY_PARTITION');
const proof = { schemaVersion: 1, verifiedAt: Date.now(), runRoot, durationMs, samples: samples.length,
  utcHours: [...utcHours].sort(), processPids: coreProcessPids, coreProcessPids,
  metrics: { ...summary.metrics, averageCpuPercent, p95CpuPercent, finalThirtyRssGrowthFraction,
    maintenanceRecords: maintenance.length, maintenanceBatches: batches.size, maximumMaintenanceBatch: Math.max(0, ...batches.values()),
    orphanTemporaryFiles: orphanTemporaryFiles.length, maximumProcessCount, maximumTransientProcesses },
  failures, passed: failures.length === 0, liveExecution: 'locked' };
const output = path.join(projectRoot, 'output', 'proof', 'flywheel-recovery', 'availability-burnin-verification.json');
fs.writeFileSync(output, JSON.stringify(proof, null, 2)); console.log(JSON.stringify({ output, ...proof }, null, 2));
if (failures.length) process.exitCode = 1;
