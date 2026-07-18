import fs from 'node:fs';
import path from 'node:path';
import { EconomicOperationStore } from '../server/discovery/economic_store.js';
import { runFastLifecycleCycle } from '../server/discovery/fast_lifecycle_runtime.js';
import { runFastPerpResearchCycle } from '../server/discovery/fast_perp_research.js';
import { FastPerpEvidenceStore } from '../server/discovery/fast_perp_store.js';
import { commitFastForwardDecisions, resolveFastForwardOutcomes } from '../server/discovery/fast_shadow_runtime.js';
import { materializeV3OperatorSnapshot } from '../server/discovery/operator_snapshot.js';

const clock = process.argv[2]; const now = Date.now();
const globalPause = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses', 'global.json');
const clockPause = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses', `${clock}.json`);
if (fs.existsSync(globalPause) || fs.existsSync(clockPause)) {
  console.log(JSON.stringify({ status: 'paused', items: 0, liveExecution: 'locked' })); process.exit(0);
}
const evidenceStore = new FastPerpEvidenceStore(); const economicStore = new EconomicOperationStore();
let items = 0; let detail: unknown;
if (clock === 'signal_evaluator') {
  const configuredMode = process.env.FAST_PERP_EVIDENCE_MODE;
  const evidenceMode = configuredMode === 'canary' || configuredMode === 'historical_replay' ? configuredMode : 'paper_forward';
  detail = commitFastForwardDecisions({ evidenceStore, economicStore, now, evidenceMode });
  items = (detail as { createdDecisions: number }).createdDecisions;
} else if (clock === 'outcome_resolver') {
  detail = resolveFastForwardOutcomes({ evidenceStore, economicStore, now });
  items = (detail as { createdOutcomes: number }).createdOutcomes;
} else if (clock === 'challenger_research') {
  detail = runFastPerpResearchCycle({ evidenceStore, economicStore, now });
  items = (detail as { evaluations: unknown[] }).evaluations.length;
  evidenceStore.maintainPartitions(now, 30, 2);
} else if (clock === 'lifecycle_evaluator') {
  detail = runFastLifecycleCycle({ economicStore });
  items = (detail as { evaluated: number }).evaluated;
} else {
  throw new Error(`UNKNOWN_FAST_PERP_CLOCK:${clock}`);
}
evidenceStore.close();
if (clock !== 'signal_evaluator') materializeV3OperatorSnapshot({ now: Date.now() });
const heartbeat = { schemaVersion: 1, clock, pid: process.pid, startedAt: now, completedAt: Date.now(),
  durationMs: Date.now() - now, queueDepth: 0, status: 'healthy', items, liveExecution: 'locked', detail };
const directory = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'heartbeats');
fs.mkdirSync(directory, { recursive: true }); const target = path.join(directory, `${clock}.json`);
const temporary = `${target}.${process.pid}.tmp`; fs.writeFileSync(temporary, JSON.stringify(heartbeat, null, 2)); fs.renameSync(temporary, target);
console.log(JSON.stringify({ status: heartbeat.status, items, liveExecution: heartbeat.liveExecution }));
