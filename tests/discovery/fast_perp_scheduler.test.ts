import assert from 'node:assert/strict';
import test from 'node:test';
import { FAST_PERP_CLOCKS, FAST_PERP_RESEARCH_BATCH, enabledFastPerpClocks,
  evaluateFastPerpClockHeartbeat, measureFastPerpClockQueue,
  fastPerpClockWakeInterval, recorderEvidenceIsOperational,
  remainingChallengerDelay } from '../../server/discovery/fast_perp_scheduler.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FlywheelControlStore } from '../../server/discovery/control_store.js';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { runControlledFastPerpCycle } from '../../server/discovery/fast_perp_controlled_runtime.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';

test('fast-perp operation exposes only the three continuous clocks', () => {
  assert.deepEqual(FAST_PERP_CLOCKS.map((clock) => [clock.id, clock.cadenceMs]), [
    ['signal_evaluator', 250],
    ['outcome_resolver', 1_000],
    ['lifecycle_evaluator', 60_000],
  ]);
  assert.deepEqual(FAST_PERP_RESEARCH_BATCH, {
    id: 'challenger_research', flag: 'FAST_PERP_RESEARCH_ENABLED', cadenceMs: 6 * 60 * 60 * 1_000,
    timeoutMs: 5 * 60_000,
  });
});

test('each clock is independently fail-closed behind its staged flag', () => {
  assert.deepEqual(enabledFastPerpClocks({}), []);
  assert.deepEqual(enabledFastPerpClocks({ FAST_PERP_SIGNAL_ENABLED: 'true', FAST_PERP_RESOLVER_ENABLED: 'true' }),
    ['signal_evaluator', 'outcome_resolver']);
});

test('ordinary six-hour flywheel delegates and never runs the legacy combined fast cycle', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-delegation-'));
  const prior = process.env.FAST_PERP_OPERATION_ENABLED; process.env.FAST_PERP_OPERATION_ENABLED = 'true';
  try {
    const evidenceStore = new FastPerpEvidenceStore(path.join(root, 'evidence'));
    const result = await runControlledFastPerpCycle({ controlStore: new FlywheelControlStore(path.join(root, 'control')),
      evidenceStore, economicStore: new EconomicOperationStore(path.join(root, 'economics')), now: () => 10_000 });
    assert.equal(result.evidence.counts.researchRuns, 0);
    assert.match(result.research.run.reason, /DELEGATED_TO_INDEPENDENT_CLOCK/);
  } finally {
    if (prior == null) delete process.env.FAST_PERP_OPERATION_ENABLED; else process.env.FAST_PERP_OPERATION_ENABLED = prior;
  }
});

test('challenger restart resumes the persisted six-hour cadence instead of spending a new look', () => {
  const now = Date.UTC(2026, 6, 16, 12, 0);
  assert.equal(remainingChallengerDelay(null, now), 0);
  assert.equal(remainingChallengerDelay(now - 60_000, now), 6 * 60 * 60_000 - 60_000);
  assert.equal(remainingChallengerDelay(now - 6 * 60 * 60_000, now), 0);
});

test('operator clock health uses measured queue state and fails freshness after one cadence', () => {
  const clock = FAST_PERP_CLOCKS[0];
  const fresh = evaluateFastPerpClockHeartbeat(clock, { completedAt: 900, queueDepth: 7, queueLagMs: 40,
    status: 'healthy' }, 1_000);
  assert.equal(fresh.queueDepth, 7);
  assert.equal(fresh.queueLagMs, 40);
  assert.equal(fresh.fresh, true);
  assert.equal(evaluateFastPerpClockHeartbeat(clock, { completedAt: 900, queueDepth: 7, queueLagMs: 40,
    status: 'healthy' }, 1_151).fresh, false);
});

test('recorder health tolerates transport reconnection only while evidence remains current', () => {
  assert.equal(recorderEvidenceIsOperational({ required: true, running: true, connected: false,
    evidenceCurrent: true }), true);
  assert.equal(recorderEvidenceIsOperational({ required: true, running: true, connected: false,
    evidenceCurrent: false }), false);
  assert.equal(recorderEvidenceIsOperational({ required: true, running: false, connected: true,
    evidenceCurrent: true }), false);
  assert.equal(recorderEvidenceIsOperational({ required: false, running: false, connected: false,
    evidenceCurrent: false }), true);
});

test('latency-sensitive clocks wake with scheduling margin while health keeps strict cadences', () => {
  const signal = FAST_PERP_CLOCKS.find((row) => row.id === 'signal_evaluator')!;
  const resolver = FAST_PERP_CLOCKS.find((row) => row.id === 'outcome_resolver')!;
  assert.equal(fastPerpClockWakeInterval(signal), 200);
  assert.equal(fastPerpClockWakeInterval(resolver), 900);
  assert.ok(fastPerpClockWakeInterval(signal) < signal.cadenceMs);
  assert.ok(fastPerpClockWakeInterval(resolver) < resolver.cadenceMs);
  assert.equal(evaluateFastPerpClockHeartbeat(signal, { completedAt: 1_000, queueDepth: 0,
    status: 'healthy' }, 1_251).fresh, false);
  assert.equal(evaluateFastPerpClockHeartbeat(resolver, { completedAt: 1_000, queueDepth: 0,
    status: 'healthy' }, 2_001).fresh, false);
});

test('challenger research is not eligible for continuous heartbeat health', () => {
  assert.equal(FAST_PERP_CLOCKS.map((row) => String(row.id)).includes('challenger_research'), false);
});

test('the continuous server launcher keeps research batches disabled', () => {
  const launcher = fs.readFileSync(path.join(process.cwd(), 'scripts', 'run_fast_perp_final_server.sh'), 'utf8');
  assert.match(launcher, /FAST_PERP_RESEARCH_ENABLED=false/);
  assert.doesNotMatch(launcher, /FAST_PERP_RESEARCH_ENABLED=true/);
});

test('the final browser smoke targets an isolated configurable server port', () => {
  const smoke = fs.readFileSync(path.join(process.cwd(), 'scripts', 'all_tabs_smoke.mjs'), 'utf8');
  const browserProof = fs.readFileSync(path.join(process.cwd(), 'scripts', 'recovery_browser_proof.mjs'), 'utf8');
  const matrix = fs.readFileSync(path.join(process.cwd(), 'scripts', 'run_flywheel_final_matrix.mjs'), 'utf8');
  assert.match(smoke, /process\.env\.METAEDGE_URL/);
  assert.match(browserProof, /process\.env\.METAEDGE_URL/);
  assert.match(matrix, /recovery_browser_proof\.mjs/);
  assert.match(matrix, /METAEDGE_URL.*127\.0\.0\.1:3100/);
});

test('clock queue health measures schedule overrun instead of reporting a literal zero', () => {
  assert.deepEqual(measureFastPerpClockQueue({ cadenceMs: 250, startedAt: 1_000, completedAt: 1_800,
    reportedQueueDepth: 0, reportedQueueLagMs: 0 }), { queueDepth: 3, queueLagMs: 550, scheduleLagMs: 550 });
  assert.deepEqual(measureFastPerpClockQueue({ cadenceMs: 1_000, startedAt: 1_000, completedAt: 1_100,
    reportedQueueDepth: 4, reportedQueueLagMs: 2_000 }), { queueDepth: 4, queueLagMs: 2_000, scheduleLagMs: 0 });
});
