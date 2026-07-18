import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { automaticPauseReason } from './fast_perp_soak_policy.mjs';

const execute = promisify(execFile); const startedAt = Date.now();
const durationMs = Number(process.env.SOAK_DURATION_MS || 86_400_000);
const intervalMs = Number(process.env.SOAK_INTERVAL_MS || 15_000); const stage = process.env.SOAK_STAGE || 'final';
const pid = Number(process.env.METAEDGE_PID || 0); const base = process.env.METAEDGE_URL || 'http://127.0.0.1:3000';
const root = path.join(process.cwd(), 'output', 'proof', 'flywheel-recovery', `soak-${stage}-${startedAt}`);
fs.mkdirSync(root, { recursive: true }); const seriesFile = path.join(root, 'series.jsonl');
const pauseRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses');
const heartbeatRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'heartbeats');
const samples = []; const decisions = new Map(); const clockPids = new Map(); const violations = [];

async function endpoint(url) {
  const start = performance.now();
  try {
    const response = await fetch(`${base}${url}`, { signal: AbortSignal.timeout(5_000) });
    let body; try { body = await response.json(); } catch { body = { error: 'NON_JSON_RESPONSE' }; }
    return { status: response.status, latencyMs: performance.now() - start, body };
  } catch (error) { return { status: 0, latencyMs: performance.now() - start, body: { error: error.message } }; }
}

async function processMetrics() {
  if (!pid) return { alive: null, cpuPercent: null, rssKb: null, processCount: null, pids: [] };
  try {
    const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,%cpu=,rss=']);
    const rows = stdout.trim().split('\n').map((line) => line.trim().split(/\s+/).map(Number))
      .filter((row) => row.length === 4 && row.every(Number.isFinite));
    const included = new Set([pid]); let changed = true;
    while (changed) {
      changed = false;
      for (const [candidatePid, parentPid] of rows) {
        if (included.has(parentPid) && !included.has(candidatePid)) { included.add(candidatePid); changed = true; }
      }
    }
    const tree = rows.filter(([candidatePid]) => included.has(candidatePid));
    return { alive: tree.some(([candidatePid]) => candidatePid === pid), cpuPercent: tree.reduce((sum, row) => sum + row[2], 0),
      rssKb: tree.reduce((sum, row) => sum + row[3], 0), processCount: tree.length,
      pids: tree.map((row) => row[0]).sort((a, b) => a - b) };
  } catch { return { alive: false, cpuPercent: null, rssKb: null, processCount: null, pids: [] }; }
}

function logicalBytes(target) {
  try {
    const stat = fs.statSync(target); if (stat.isFile()) return stat.size;
    if (!stat.isDirectory()) return 0;
    return fs.readdirSync(target).reduce((sum, entry) => sum + logicalBytes(path.join(target, entry)), 0);
  } catch { return 0; }
}

async function kilobytes(paths) {
  const existing = paths.filter((target) => fs.existsSync(target)); if (!existing.length) return 0;
  return existing.reduce((sum, target) => sum + logicalBytes(target), 0) / 1024;
}

async function storageMetrics() {
  const data = path.join(process.cwd(), 'data', 'opportunity-factory-v3');
  const rawKb = await kilobytes([path.join(data, 'fast-perps', 'raw')]);
  const derivedKb = await kilobytes([path.join(data, 'economics'), path.join(data, 'live-review'),
    path.join(data, 'fast-perps', 'derived'), path.join(data, 'fast-perps', 'manifests'),
    path.join(data, 'fast-perps', 'materialized'), path.join(data, 'fast-perps', 'state'), path.join(data, 'operator')]);
  return { rawKb, derivedKb, totalKb: rawKb == null || derivedKb == null ? null : rawKb + derivedKb };
}

function heartbeatPids() {
  const result = {};
  for (const clock of ['signal_evaluator', 'outcome_resolver', 'challenger_research', 'lifecycle_evaluator']) {
    try { result[clock] = Number(JSON.parse(fs.readFileSync(path.join(heartbeatRoot, `${clock}.json`), 'utf8')).pid) || null; }
    catch { result[clock] = null; }
  }
  return result;
}

function percentile(values, level) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  return ordered.length ? ordered[Math.min(ordered.length - 1, Math.ceil(level * ordered.length) - 1)] : null;
}

function average(values) {
  const finite = values.filter(Number.isFinite); return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function ratePerDay(first, last, key) {
  const elapsed = Number(last?.at) - Number(first?.at); const growth = Number(last?.storage?.[key]) - Number(first?.storage?.[key]);
  return elapsed > 0 && Number.isFinite(growth) ? Math.max(0, growth) / elapsed * 86_400_000 : null;
}

function recordViolation(code, sample) {
  if (!violations.some((row) => row.code === code)) violations.push({ code, at: sample.at });
}

function pause(reason, sample) {
  recordViolation(reason, sample); fs.mkdirSync(pauseRoot, { recursive: true }); const file = path.join(pauseRoot, 'global.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, pausedAt: Date.now(), reason,
    sample, liveExecution: 'locked' }, null, 2));
}

while (Date.now() - startedAt < durationMs) {
  const [session, v3, health, processState, storage] = await Promise.all([endpoint('/api/session'),
    endpoint('/api/opportunity-factory/v3'), endpoint('/api/opportunity-factory/health'), processMetrics(), storageMetrics()]);
  const tiers = new Map((v3.body.economics?.topCandidates || []).map((contract) => [contract.id, contract.speedTier]));
  for (const decision of v3.body.economics?.recentShadowDecisions || []) {
    if (!decisions.has(decision.id)) decisions.set(decision.id, { id: decision.id, contractId: decision.contractId,
      speedTier: tiers.get(decision.contractId) || null, decisionLagMs: Number(decision.decisionLagMs), recordedAt: decision.recordedAt });
  }
  const heartbeatPidSnapshot = heartbeatPids();
  for (const [clock, clockPid] of Object.entries(heartbeatPidSnapshot)) {
    if (clockPid && !clockPids.has(clock)) clockPids.set(clock, clockPid);
    else if (clockPid && clockPids.get(clock) !== clockPid) recordViolation(`CLOCK_RESTARTED:${clock}`, { at: Date.now() });
  }
  const sample = { at: Date.now(), session: { status: session.status, latencyMs: session.latencyMs },
    v3: { status: v3.status, latencyMs: v3.latencyMs, stale: v3.body.stale, liveExecution: v3.body.liveExecution,
      criticalFailures: v3.body.integrity?.criticalFailures?.length ?? null,
      contracts: Number(v3.body.economics?.counts?.contracts ?? 0), researchRuns: Number(v3.body.fastPerps?.counts?.researchRuns ?? 0),
      decisions: Number(v3.body.economics?.counts?.shadowDecisions ?? 0), outcomes: Number(v3.body.economics?.counts?.shadowOutcomes ?? 0) },
    health: { status: health.status, operational: health.body.operational, eventAgeMs: health.body.eventAgeMs,
      apiSummaryAgeMs: health.body.apiSummaryAgeMs, clocks: health.body.clocks, queueLagMs: health.body.queueLagMs,
      contractChurn: health.body.contractChurn, unresolvedDecisions: health.body.unresolvedDecisions,
      unresolvedOutcomes: health.body.unresolvedOutcomes, storageHealthy: health.body.storageHealthy,
      currentLiveLock: health.body.currentLiveLock, recorder: health.body.recorder },
    process: processState, storage, heartbeatPids: heartbeatPidSnapshot };
  const prior = samples.at(-1); samples.push(sample); fs.appendFileSync(seriesFile, `${JSON.stringify(sample)}\n`);
  if (!processState.alive) recordViolation('SERVER_PROCESS_NOT_ALIVE', sample);
  if (prior && sample.v3.contracts > prior.v3.contracts && sample.v3.researchRuns <= prior.v3.researchRuns) {
    recordViolation('CONTRACT_CREATED_WITHOUT_RESEARCH_RUN', sample);
  }
  const recent = samples.filter((row) => row.at >= Date.now() - 5 * 60_000);
  const v3p95 = percentile(recent.map((row) => row.v3.latencyMs), 0.95);
  const firstStorage = samples.find((row) => row.storage.totalKb != null);
  const projectedTotalKbPerDay = ratePerDay(firstStorage, sample, 'totalKb');
  const automaticPause = automaticPauseReason({ stage, sample, recent, intervalMs,
    projectedTotalKbPerDay, v3p95Ms: v3p95 });
  if (automaticPause) pause(automaticPause, sample);
  await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, Math.max(0, startedAt + durationMs - Date.now()))));
}

const completedAt = Date.now(); const finalSixHour = samples.filter((row) => row.at >= completedAt - 6 * 60 * 60_000);
const finalSixStart = finalSixHour[0]; const finalSixEnd = finalSixHour.at(-1);
const finalSixRssGrowthFraction = finalSixStart?.process.rssKb > 0 && finalSixEnd?.process.rssKb != null
  ? (finalSixEnd.process.rssKb - finalSixStart.process.rssKb) / finalSixStart.process.rssKb : null;
const microLags = [...decisions.values()].filter((row) => row.speedTier === 'microstructure').map((row) => row.decisionLagMs);
const fastLags = [...decisions.values()].filter((row) => row.speedTier === 'fast_event').map((row) => row.decisionLagMs);
const rawKbPerDay = ratePerDay(samples[0], samples.at(-1), 'rawKb');
const derivedKbPerDay = ratePerDay(samples[0], samples.at(-1), 'derivedKb');
const pauseRecord = fs.existsSync(path.join(pauseRoot, 'global.json'))
  ? JSON.parse(fs.readFileSync(path.join(pauseRoot, 'global.json'), 'utf8')) : null;
const metrics = { endpointFailures: samples.filter((row) => row.session.status !== 200 || row.v3.status !== 200
    || row.health.status !== 200).length,
  nonOperationalSamples: samples.filter((row) => row.health.operational !== true).length,
  sessionP95Ms: percentile(samples.map((row) => row.session.latencyMs), 0.95),
  v3P95Ms: percentile(samples.map((row) => row.v3.latencyMs), 0.95),
  v3P99Ms: percentile(samples.map((row) => row.v3.latencyMs), 0.99),
  averageCpuPercent: average(samples.map((row) => row.process.cpuPercent)),
  p95CpuPercent: percentile(samples.map((row) => row.process.cpuPercent), 0.95),
  startRssKb: samples[0]?.process.rssKb ?? null, endRssKb: samples.at(-1)?.process.rssKb ?? null,
  finalSixRssGrowthFraction, rawKbPerDay, derivedKbPerDay,
  microstructureDecisionCount: microLags.length, microstructureDecisionLagP99Ms: percentile(microLags, 0.99),
  fastEventDecisionCount: fastLags.length, fastEventDecisionLagP99Ms: percentile(fastLags, 0.99),
  maximumQueueDepth: Math.max(0, ...samples.flatMap((row) => (row.health.clocks || []).map((clock) => Number(clock.queueDepth) || 0))),
  maximumQueueLagMs: Math.max(0, ...samples.map((row) => Number(row.health.queueLagMs) || 0)),
  maximumUnresolvedDecisions: Math.max(0, ...samples.map((row) => Number(row.health.unresolvedDecisions) || 0)),
  finalUnresolvedDecisions: Number(samples.at(-1)?.health.unresolvedDecisions || 0),
  liveExecutionLockedThroughout: samples.every((row) => row.health.currentLiveLock === true && row.v3.liveExecution === 'locked'),
  contractCreationWithoutResearch: violations.some((row) => row.code === 'CONTRACT_CREATED_WITHOUT_RESEARCH_RUN'),
  processRestarts: violations.filter((row) => row.code.startsWith('CLOCK_RESTARTED:')).length,
};
const gates = {
  fullDuration: completedAt - startedAt >= durationMs,
  endpointsHealthy: metrics.endpointFailures === 0,
  operationHealthy: stage === 'recorder'
    ? samples.every((row) => row.health.recorder?.running === true && row.health.recorder?.connected === true
      && row.health.eventAgeMs != null && row.health.eventAgeMs <= 30_000)
    : metrics.nonOperationalSamples === 0,
  sessionLatency: metrics.sessionP95Ms != null && metrics.sessionP95Ms < 100,
  v3Latency: metrics.v3P95Ms != null && metrics.v3P95Ms < 250 && metrics.v3P99Ms != null && metrics.v3P99Ms < 500,
  cpu: metrics.averageCpuPercent != null && metrics.averageCpuPercent < 30
    && metrics.p95CpuPercent != null && metrics.p95CpuPercent < 70,
  memory: durationMs < 6 * 60 * 60_000 ? stage !== 'final'
    : metrics.finalSixRssGrowthFraction != null && metrics.finalSixRssGrowthFraction <= 0.10,
  storage: stage === 'final'
    ? metrics.rawKbPerDay != null && metrics.rawKbPerDay < 500 * 1024
      && metrics.derivedKbPerDay != null && metrics.derivedKbPerDay < 25 * 1024
    : metrics.rawKbPerDay != null && metrics.derivedKbPerDay != null
      && metrics.rawKbPerDay + metrics.derivedKbPerDay < 2 * 1024 * 1024,
  decisionLatency: (metrics.microstructureDecisionCount === 0 || metrics.microstructureDecisionLagP99Ms < 250)
    && (metrics.fastEventDecisionCount === 0 || metrics.fastEventDecisionLagP99Ms < 1_000),
  queuesBounded: metrics.maximumQueueDepth <= 10_000 && metrics.maximumQueueLagMs <= 30_000,
  allExpiredResolved: metrics.finalUnresolvedDecisions === 0,
  noContractFromRawArrival: !metrics.contractCreationWithoutResearch,
  noRestarts: metrics.processRestarts === 0 && !violations.some((row) => row.code === 'SERVER_PROCESS_NOT_ALIVE'),
  liveLocked: metrics.liveExecutionLockedThroughout,
  noAutomaticPause: pauseRecord == null,
};
const final = { schemaVersion: 2, stage, startedAt, completedAt, durationMs: completedAt - startedAt,
  targetDurationMs: durationMs, samples: samples.length, metrics, gates, violations, pause: pauseRecord,
  passed: Object.values(gates).every(Boolean) };
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(final, null, 2));
console.log(JSON.stringify({ root, ...final }, null, 2)); if (!final.passed) process.exitCode = 1;
