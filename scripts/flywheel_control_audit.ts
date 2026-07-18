import fs from 'node:fs';
import path from 'node:path';
import { controlPlaneSnapshot } from '../server/discovery/control_cycle.js';

const snapshot = controlPlaneSnapshot();
const requiredFiles = ['LOOP.md', 'STATE.md', 'loop-constraints.md', 'loop-budget.md', 'loop-run-log.md'];
const requiredLoops = ['market_data_health', 'evidence_gap_acquisition', 'signal_discovery', 'numerical_verification',
  'forward_quarantine', 'execution_calibration', 'portfolio_risk', 'attribution_research', 'research_governance'];
const failures: string[] = [];
for (const file of requiredFiles) if (!fs.existsSync(path.join(process.cwd(), file))) failures.push(`MISSING_ARTIFACT:${file}`);
const loopIds = new Set(snapshot.config.loops.map((loop) => loop.id));
for (const loop of requiredLoops) if (!loopIds.has(loop as never)) failures.push(`MISSING_LOOP:${loop}`);
if (!snapshot.runs.length) failures.push('NO_CONTROL_RUNS');
const completedLoopIds = new Set(snapshot.runs.filter((run) => run.outcome === 'completed').map((run) => run.loopId));
for (const loop of requiredLoops) if (!completedLoopIds.has(loop as never)) failures.push(`LOOP_NEVER_COMPLETED:${loop}`);
const latestCompletedGovernance = snapshot.runs.filter((run) => run.loopId === 'research_governance' && run.outcome === 'completed')
  .sort((left, right) => right.completedAt - left.completedAt)[0];
if (!latestCompletedGovernance) failures.push('GOVERNANCE_NEVER_COMPLETED');
else if (latestCompletedGovernance.reason === 'GOVERNANCE_INTEGRITY_EXCEPTIONS_RECORDED') {
  failures.push('LATEST_GOVERNANCE_HAS_CURRENT_INTEGRITY_EXCEPTIONS');
}
if (!snapshot.state.updatedAt) failures.push('STATE_NOT_UPDATED');
if (snapshot.locks.length) failures.push(`ACTIVE_LOCKS:${snapshot.locks.map((lock) => lock.owner).join(',')}`);
if (!snapshot.integrity.allLiveExecutionLocked) failures.push('LIVE_EXECUTION_NOT_LOCKED');
if (snapshot.integrity.duplicateRunIds.length) failures.push('DUPLICATE_RUN_IDS');
if (snapshot.integrity.duplicateEscalationIds.length) failures.push('DUPLICATE_ESCALATION_IDS');
if (!snapshot.config.constraints.includes('NUMERICAL_VERDICT_NON_OVERRIDABLE')) failures.push('NUMERICAL_GATE_CONSTRAINT_MISSING');
if (!snapshot.config.constraints.includes('NO_NEW_EVIDENCE_REQUIRES_EARLY_EXIT')) failures.push('EARLY_EXIT_CONSTRAINT_MISSING');
const result = {
  status: failures.length ? 'failed' : 'pass',
  mode: snapshot.mode,
  loopsConfigured: snapshot.config.loops.length,
  runsRecorded: snapshot.runs.length,
  loopsCompleted: completedLoopIds.size,
  latestCompletedGovernance: latestCompletedGovernance ?? null,
  openEscalations: snapshot.openEscalations.length,
  activeLocks: snapshot.locks.length,
  lastRun: snapshot.runs.at(-1) ?? null,
  integrity: snapshot.integrity,
  failures,
  liveExecution: 'locked',
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
