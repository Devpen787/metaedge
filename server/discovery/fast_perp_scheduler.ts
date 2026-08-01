import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { legacyWritersEnabled } from '../v5/authority.js';

const operationChildren = new Set<ReturnType<typeof spawn>>();
let cleanupRegistered = false;

export const FAST_PERP_CLOCKS = [
  { id: 'signal_evaluator', flag: 'FAST_PERP_SIGNAL_ENABLED', cadenceMs: 250 },
  { id: 'outcome_resolver', flag: 'FAST_PERP_RESOLVER_ENABLED', cadenceMs: 1_000 },
  { id: 'lifecycle_evaluator', flag: 'FAST_PERP_LIFECYCLE_ENABLED', cadenceMs: 60_000 },
] as const;

export const FAST_PERP_RESEARCH_BATCH = {
  id: 'challenger_research', flag: 'FAST_PERP_RESEARCH_ENABLED', cadenceMs: 6 * 60 * 60 * 1_000,
  timeoutMs: 5 * 60_000,
} as const;

export function evaluateFastPerpClockHeartbeat(clock: (typeof FAST_PERP_CLOCKS)[number], heartbeat: {
  completedAt: number | null; heartbeatAt?: number; phase?: string; queueDepth: number; queueLagMs?: number;
  status: string }, now = Date.now()) {
  const freshnessAt = Math.max(Number(heartbeat.completedAt) || 0, Number(heartbeat.heartbeatAt) || 0);
  const ageMs = now - freshnessAt; const queueDepth = Number(heartbeat.queueDepth);
  const freshnessBudgetMs = heartbeat.phase === 'running' ? Math.min(clock.cadenceMs, 60_000) : clock.cadenceMs;
  return { id: clock.id, cadenceMs: clock.cadenceMs, ageMs, queueDepth,
    queueLagMs: Number(heartbeat.queueLagMs ?? 0), fresh: ageMs >= 0 && ageMs <= freshnessBudgetMs,
    bounded: Number.isFinite(queueDepth) && queueDepth <= 10_000,
    status: heartbeat.status as 'healthy' | 'degraded' | 'paused' | 'missing' };
}

export function measureFastPerpClockQueue(input: { cadenceMs: number; startedAt: number; completedAt: number;
  reportedQueueDepth?: number | null; reportedQueueLagMs?: number | null }) {
  const cadenceMs = Math.max(1, Number(input.cadenceMs));
  const scheduleLagMs = Math.max(0, Number(input.completedAt) - Number(input.startedAt) - cadenceMs);
  const scheduleBacklog = Math.ceil(scheduleLagMs / cadenceMs);
  const reportedQueueDepth = Number.isFinite(Number(input.reportedQueueDepth))
    ? Math.max(0, Number(input.reportedQueueDepth)) : 0;
  const reportedQueueLagMs = Number.isFinite(Number(input.reportedQueueLagMs))
    ? Math.max(0, Number(input.reportedQueueLagMs)) : 0;
  return { queueDepth: Math.max(scheduleBacklog, reportedQueueDepth),
    queueLagMs: Math.max(scheduleLagMs, reportedQueueLagMs), scheduleLagMs };
}

export function enabledFastPerpClocks(environment: Record<string, string | undefined> = process.env): string[] {
  return FAST_PERP_CLOCKS.filter((clock) => environment[clock.flag] === 'true').map((clock) => clock.id);
}

export function recorderEvidenceIsOperational(input: { required: boolean; running: boolean; connected: boolean;
  evidenceCurrent: boolean }): boolean {
  if (!input.required) return true;
  // Connection state remains visible in recorder status. During a bounded reconnect, operator health depends on
  // the recorder still running and both trade and book evidence remaining inside the fixed freshness window.
  return input.running && input.evidenceCurrent;
}

export function fastPerpClockWakeInterval(clock: (typeof FAST_PERP_CLOCKS)[number]): number {
  if (clock.id === 'signal_evaluator') return 200;
  if (clock.id === 'outcome_resolver') return 900;
  return clock.cadenceMs;
}

export function remainingChallengerDelay(lastRunAt: number | null, now = Date.now()): number {
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return 0;
  return Math.max(0, FAST_PERP_RESEARCH_BATCH.cadenceMs - Math.max(0, now - lastRunAt));
}

export function startFastPerpOperation(): void {
  if (!legacyWritersEnabled()) {
    console.log('[fast-perps] legacy v3 operation disabled by v5 authority'); return;
  }
  if (process.env.FAST_PERP_OPERATION_ENABLED !== 'true') {
    console.log('[fast-perps] governed paper operation disabled by default pending recovery proof'); return;
  }
  const enabled = new Set(enabledFastPerpClocks());
  if (!enabled.size) {
    console.log('[fast-perps] operation gate enabled but all three continuous clocks remain disabled'); return;
  }
  const compiled = path.join(process.cwd(), 'dist', 'fast_perp_clock_daemon.cjs');
  const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  for (const clock of FAST_PERP_CLOCKS.filter((row) => enabled.has(row.id))) {
    const executable = fs.existsSync(compiled) ? process.execPath : tsx;
    const args = fs.existsSync(compiled) ? [compiled, clock.id] : ['scripts/fast_perp_clock_daemon.ts', clock.id];
    const child = spawn(executable, args, { cwd: process.cwd(), env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { const message = String(chunk).trim(); if (message) console.log(message); });
    child.stderr.on('data', (chunk) => { const message = String(chunk).trim(); if (message) console.warn(message); });
    operationChildren.add(child);
    child.on('exit', (code, signal) => {
      operationChildren.delete(child);
      if (code !== 0 && signal !== 'SIGTERM') console.warn(`[fast-perps:${clock.id}] persistent clock exited code=${code} signal=${signal}; health degraded`);
    });
    child.unref();
  }
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    process.once('exit', () => {
      for (const child of operationChildren) child.kill('SIGTERM');
    });
  }
  console.log(`[fast-perps] independent paper clocks enabled: ${[...enabled].join(', ')}; live execution locked`);
}

export function startFastPerpOperatorSummary(): void {
  let childRunning = false; const tsx = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
  const compiled = path.join(process.cwd(), 'dist', 'operator_summary_refresh.cjs');
  const run = () => {
    if (childRunning) return; childRunning = true;
    const executable = fs.existsSync(compiled) ? process.execPath : tsx;
    const args = fs.existsSync(compiled) ? [compiled] : ['scripts/operator_summary_refresh.ts'];
    execFile(executable, args, { cwd: process.cwd(), timeout: 10_000,
      maxBuffer: 256 * 1024 }, (error) => { childRunning = false;
      if (error) console.warn('[fast-perps:operator-summary] refresh failed:', error.message); });
  };
  setTimeout(run, 1_000).unref(); setInterval(run, 15_000).unref();
}
