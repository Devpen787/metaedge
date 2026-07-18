import fs from 'node:fs';
import path from 'node:path';
import { EconomicOperationStore } from '../server/discovery/economic_store.js';
import { runFastLifecycleCycle } from '../server/discovery/fast_lifecycle_runtime.js';
import { FastPerpEvidenceStore } from '../server/discovery/fast_perp_store.js';
import { commitFastForwardDecisions, resolveFastForwardOutcomes } from '../server/discovery/fast_shadow_runtime.js';
import { FAST_PERP_CLOCKS, fastPerpClockWakeInterval, measureFastPerpClockQueue } from '../server/discovery/fast_perp_scheduler.js';

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main(): Promise<void> {
  const clockId = process.argv[2]; const definition = FAST_PERP_CLOCKS.find((row) => row.id === clockId);
  if (!definition) throw new Error(`UNKNOWN_FAST_PERP_CLOCK:${clockId}`);
  const parentPid = process.ppid;
  const pauseRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'pauses');
  const heartbeatRoot = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'heartbeats');
  fs.mkdirSync(heartbeatRoot, { recursive: true });
  const evidenceStore = new FastPerpEvidenceStore();
  const economicStore = new EconomicOperationStore();
  let lastLogSignature: string | null = null;
  process.once('exit', () => evidenceStore.close());
  const writeHeartbeat = (heartbeat: Record<string, unknown>) => {
    const file = path.join(heartbeatRoot, `${clockId}.json`); const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(heartbeat)); fs.renameSync(temporary, file);
  };

  while (true) {
    try { process.kill(parentPid, 0); } catch { process.exit(0); }
    const startedAt = Date.now(); let items = 0; let status = 'healthy'; let detail: unknown = null;
    const paused = fs.existsSync(path.join(pauseRoot, 'global.json')) || fs.existsSync(path.join(pauseRoot, `${clockId}.json`));
    if (paused) status = 'paused';
    else {
      try {
        if (clockId === 'signal_evaluator') {
          const configured = process.env.FAST_PERP_EVIDENCE_MODE;
          const evidenceMode = configured === 'canary' || configured === 'historical_replay' ? configured : 'paper_forward';
          detail = commitFastForwardDecisions({ evidenceStore, economicStore, now: startedAt, evidenceMode });
          items = (detail as { createdDecisions: number }).createdDecisions;
        } else if (clockId === 'outcome_resolver') {
          detail = resolveFastForwardOutcomes({ evidenceStore, economicStore, now: startedAt });
          items = (detail as { createdOutcomes: number }).createdOutcomes;
        } else {
          detail = runFastLifecycleCycle({ economicStore }); items = (detail as { evaluated: number }).evaluated;
        }
      } catch (error) { status = 'degraded'; detail = { error: error instanceof Error ? error.message : String(error) }; }
    }
    const completedAt = Date.now(); const queue = measureFastPerpClockQueue({ cadenceMs: definition.cadenceMs,
      startedAt, completedAt, reportedQueueDepth: (detail as { queueDepth?: number } | null)?.queueDepth,
      reportedQueueLagMs: (detail as { queueLagMs?: number } | null)?.queueLagMs });
    const heartbeat = { schemaVersion: 1, clock: clockId, pid: process.pid, startedAt, completedAt,
      heartbeatAt: completedAt, durationMs: completedAt - startedAt, cadenceMs: definition.cadenceMs,
      ...queue, status, phase: 'idle', items,
      detail, liveExecution: 'locked' };
    writeHeartbeat(heartbeat);
    const logSignature = items || status !== 'healthy'
      ? `${status}:${items}:${String((detail as { error?: unknown } | null)?.error ?? '')}` : null;
    if (logSignature && logSignature !== lastLogSignature) {
      console.log(`[fast-perps:${clockId}] status=${status} items=${items}; live locked`);
    }
    lastLogSignature = logSignature;
    const wakeIntervalMs = fastPerpClockWakeInterval(definition);
    await sleep(Math.max(1, wakeIntervalMs - (Date.now() - startedAt)));
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
