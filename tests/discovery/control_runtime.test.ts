import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { controlPlaneSnapshot, executeControlledLoop } from '../../server/discovery/control_cycle.js';
import { evidenceManifestFingerprint, evaluateControlGate, readFlywheelControlConfig } from '../../server/discovery/control_runtime.js';
import { FlywheelControlStore } from '../../server/discovery/control_store.js';
import type { ResearchLoopRun } from '../../server/discovery/control_types.js';

const config = readFlywheelControlConfig();
const now = Date.UTC(2026, 6, 15, 12);

function run(overrides: Partial<ResearchLoopRun> = {}): ResearchLoopRun {
  return { id: 'run', loopId: 'signal_discovery', startedAt: now - 1_000, completedAt: now - 500,
    evidenceFingerprint: 'same', outcome: 'completed', reason: 'DONE', itemsFound: 1, actionsTaken: 1,
    declaredTrials: 1, estimatedTokens: 10_000, errorSignature: null, newEvidence: true,
    liveExecution: 'locked', ...overrides };
}

test('control gate exits without spending another research cycle on unchanged evidence', () => {
  const decision = evaluateControlGate(config, [run()], { loopId: 'signal_discovery', evidenceFingerprint: 'same',
    requestedTrials: 10, requestedAgentActions: 0, estimatedTokens: 10_000, forwardResolutionChanged: false, now });
  assert.equal(decision.mode, 'no_op');
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockers, ['NO_NEW_EVIDENCE']);
});

test('control gate enforces declared-trial budget before experimentation', () => {
  const decision = evaluateControlGate(config, [], { loopId: 'signal_discovery', evidenceFingerprint: 'new',
    requestedTrials: config.budget.maxDeclaredTrialsPerCycle + 1, requestedAgentActions: 0,
    estimatedTokens: 10_000, forwardResolutionChanged: false, now });
  assert.equal(decision.mode, 'report_only');
  assert.ok(decision.blockers.includes('DECLARED_TRIAL_BUDGET_EXCEEDED'));
});

test('control gate buffers changed evidence until the declared loop cadence', () => {
  const decision = evaluateControlGate(config, [run()], { loopId: 'signal_discovery', evidenceFingerprint: 'changed',
    requestedTrials: 10, requestedAgentActions: 0, estimatedTokens: 10_000, forwardResolutionChanged: false, now });
  assert.equal(decision.mode, 'no_op');
  assert.deepEqual(decision.blockers, ['CADENCE_NOT_DUE']);
});

test('three failures on unchanged evidence trip the non-progress circuit breaker', () => {
  const failures = Array.from({ length: 3 }, (_, index) => run({ id: `run${index}`, outcome: 'failed',
    completedAt: now - index, errorSignature: 'SAME_ERROR' }));
  const decision = evaluateControlGate(config, failures, { loopId: 'signal_discovery', evidenceFingerprint: 'same',
    requestedTrials: 1, requestedAgentActions: 0, estimatedTokens: 1_000, forwardResolutionChanged: false, now });
  assert.equal(decision.mode, 'escalate');
  assert.ok(decision.blockers.includes('NO_PROGRESS_CIRCUIT_BREAKER'));
});

test('a failed loop may retry before cadence while no-op polls do not move the successful cadence anchor', () => {
  const failed = run({ id: 'failed', outcome: 'failed', evidenceFingerprint: 'new', completedAt: now - 100 });
  const retry = evaluateControlGate(config, [failed], { loopId: 'signal_discovery', evidenceFingerprint: 'new',
    requestedTrials: 1, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false, now });
  assert.equal(retry.mode, 'full');
  const completed = run({ id: 'completed', completedAt: now - config.loops.find((row) => row.id === 'signal_discovery')!.cadenceMs - 1 });
  const recentNoOp = run({ id: 'noop', outcome: 'no_op', completedAt: now - 1, evidenceFingerprint: 'different' });
  const due = evaluateControlGate(config, [completed, recentNoOp], { loopId: 'signal_discovery', evidenceFingerprint: 'changed',
    requestedTrials: 1, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false, now });
  assert.equal(due.mode, 'full');
});

test('control store persists append-only runs and prevents overlapping resource owners', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-control-'));
  const store = new FlywheelControlStore(root);
  store.appendRuns([run()]); store.appendRuns([run()]);
  assert.equal(store.readRuns().length, 1);
  const first = store.acquireLock({ owner: 'signal_discovery', resources: ['data/market/**'], acquiredAt: now,
    expiresAt: now + 60_000, liveExecution: 'locked' });
  const second = store.acquireLock({ owner: 'numerical_verification', resources: ['data/market/BTC.jsonl'], acquiredAt: now,
    expiresAt: now + 60_000, liveExecution: 'locked' });
  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.blocker?.owner, 'signal_discovery');
});

test('controlled loop executes once, then records a no-op for unchanged evidence', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-control-cycle-'));
  const store = new FlywheelControlStore(root);
  let actionCalls = 0;
  const input = {
    loopId: 'signal_discovery' as const,
    evidenceFingerprint: 'immutable-evidence-v1',
    requestedTrials: 3,
    requestedAgentActions: 1,
    estimatedTokens: 1_000,
    forwardResolutionChanged: false,
    store,
    config,
    now: () => now,
    action: () => {
      actionCalls++;
      return { value: { candidates: 2 }, reason: 'DISCOVERY_COMPLETE', itemsFound: 2,
        actionsTaken: 1, newEvidence: true };
    },
  };
  const first = await executeControlledLoop(input);
  const second = await executeControlledLoop(input);
  assert.equal(first.executed, true);
  assert.equal(first.run.outcome, 'completed');
  assert.equal(second.executed, false);
  assert.equal(second.run.outcome, 'no_op');
  assert.equal(actionCalls, 1);
  assert.equal(evaluateControlGate(config, store.readRuns(), { ...input, now }).attemptsOnEvidence, 1);
  const snapshot = controlPlaneSnapshot(store, config, now);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
  assert.deepEqual(snapshot.integrity.duplicateRunIds, []);
});

test('resource lock rejects a concurrent run from the same loop owner', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-control-owner-'));
  const store = new FlywheelControlStore(root);
  const lock = { owner: 'signal_discovery' as const, resources: ['data/research/**'], acquiredAt: now,
    expiresAt: now + 60_000, liveExecution: 'locked' as const };
  assert.equal(store.acquireLock(lock).acquired, true);
  assert.equal(store.acquireLock(lock).acquired, false);
});

test('evidence manifest ignores timestamp-only rewrites but detects content changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-evidence-manifest-'));
  const file = path.join(root, 'evidence.jsonl');
  fs.writeFileSync(file, '{"price":100}\n');
  const first = evidenceManifestFingerprint({ roots: [root], configFiles: [] });
  fs.utimesSync(file, new Date(now + 60_000), new Date(now + 60_000));
  const timestampOnly = evidenceManifestFingerprint({ roots: [root], configFiles: [] });
  fs.writeFileSync(file, '{"price":101}\n');
  const changed = evidenceManifestFingerprint({ roots: [root], configFiles: [] });
  assert.equal(timestampOnly, first);
  assert.notEqual(changed, first);
});

test('human-gated actions require an evidence-bound approval and consume it exactly once', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-human-gate-')); const store = new FlywheelControlStore(root);
  let current = now; const clock = () => current++;
  const gate = 'threshold changes'; const evidenceFingerprint = 'sealed-evidence';
  const missing = await executeControlledLoop({ loopId: 'numerical_verification', evidenceFingerprint,
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    humanGate: { gate, approvalId: 'missing' }, store, config, now: clock,
    action: () => ({ value: true, reason: 'SHOULD_NOT_RUN', itemsFound: 0, actionsTaken: 0, newEvidence: false }) });
  assert.equal(missing.executed, false);
  assert.match(missing.run.reason, /HUMAN_APPROVAL_REQUIRED_OR_INVALID/);
  const approval = store.makeHumanApproval({ loopId: 'numerical_verification', gate, evidenceFingerprint,
    grantedAt: current, expiresAt: current + 60_000 }); store.appendHumanApprovals([approval]);
  const approvedInput = { loopId: 'numerical_verification' as const, evidenceFingerprint,
    requestedTrials: 0, requestedAgentActions: 0, estimatedTokens: 0, forwardResolutionChanged: false,
    humanGate: { gate, approvalId: approval.id }, store, config, now: clock,
    action: () => ({ value: true, reason: 'GATED_ACTION_COMPLETE', itemsFound: 1, actionsTaken: 1, newEvidence: true }) };
  const approved = await executeControlledLoop(approvedInput);
  assert.equal(approved.executed, true); assert.equal(store.readHumanConsumptions().length, 1);
  const replay = await executeControlledLoop({ ...approvedInput, evidenceFingerprint: `${evidenceFingerprint}-changed`,
    forwardResolutionChanged: true });
  assert.equal(replay.executed, false); assert.match(replay.run.reason, /HUMAN_APPROVAL_REQUIRED_OR_INVALID/);
});
