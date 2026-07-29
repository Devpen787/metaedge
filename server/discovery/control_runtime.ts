import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ControlGateDecision, ControlGateInput, FlywheelControlConfig, ResearchLoopRun,
} from './control_types.js';

export function readFlywheelControlConfig(file = path.join(process.cwd(), 'config', 'research', 'flywheel-v3-control.json')): FlywheelControlConfig {
  const config = JSON.parse(fs.readFileSync(file, 'utf8')) as FlywheelControlConfig;
  if (config.schemaVersion !== 1 || config.liveExecution !== 'locked') throw new Error('INVALID_FLYWHEEL_CONTROL_CONFIG');
  if (!(config.budget.reportOnlyAtFraction > 0 && config.budget.reportOnlyAtFraction < 1)) throw new Error('INVALID_REPORT_ONLY_FRACTION');
  if (!config.loops.length || new Set(config.loops.map((loop) => loop.id)).size !== config.loops.length) throw new Error('INVALID_LOOP_REGISTRY');
  return config;
}

export function evaluateControlGate(config: FlywheelControlConfig, runs: ResearchLoopRun[], input: ControlGateInput): ControlGateDecision {
  const now = input.now ?? Date.now();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const daily = runs.filter((run) => run.loopId === input.loopId && run.startedAt >= dayStart.getTime());
  const matchingEvidence = runs.filter((run) => run.loopId === input.loopId && run.evidenceFingerprint === input.evidenceFingerprint);
  const attempts = matchingEvidence.filter((run) => run.outcome === 'completed' || run.outcome === 'failed' || run.actionsTaken > 0);
  const recentMatching = [...attempts].sort((a, b) => b.completedAt - a.completedAt);
  let consecutiveFailures = 0;
  for (const run of recentMatching) {
    if (run.outcome !== 'failed') break;
    consecutiveFailures++;
  }
  const dailyEstimatedTokens = daily.reduce((sum, run) => sum + run.estimatedTokens, 0);
  const dailyAgentActions = daily.reduce((sum, run) => sum + run.actionsTaken, 0);
  const blockers: string[] = [];
  let mode: ControlGateDecision['mode'] = 'full';
  if (config.pauseAll) { blockers.push('LOOP_PAUSE_ALL'); mode = 'paused'; }
  else if (daily.length >= config.budget.maxRunsPerDay) { blockers.push('DAILY_RUN_BUDGET_EXHAUSTED'); mode = 'paused'; }
  else if (dailyEstimatedTokens + input.estimatedTokens >= config.budget.maxEstimatedTokensPerDay) {
    blockers.push('DAILY_TOKEN_BUDGET_EXHAUSTED'); mode = 'paused';
  } else if (attempts.length >= config.budget.maxAttemptsPerEvidence || consecutiveFailures >= config.budget.maxConsecutiveFailures) {
    blockers.push('NO_PROGRESS_CIRCUIT_BREAKER'); mode = 'escalate';
  } else if (input.requestedTrials > config.budget.maxDeclaredTrialsPerCycle) {
    blockers.push('DECLARED_TRIAL_BUDGET_EXCEEDED'); mode = 'report_only';
  } else if (dailyAgentActions + input.requestedAgentActions > config.budget.maxAgentActionsPerDay ||
    dailyEstimatedTokens + input.estimatedTokens >= config.budget.maxEstimatedTokensPerDay * config.budget.reportOnlyAtFraction) {
    blockers.push('CONTROL_BUDGET_REPORT_ONLY_THRESHOLD'); mode = 'report_only';
  } else {
    const definition = config.loops.find((loop) => loop.id === input.loopId);
    // Cadence is anchored to actual successful work. Failed attempts may retry
    // immediately until the non-progress circuit breaker, and repeated no-op
    // polls cannot postpone the next eligible execution indefinitely.
    const lastCompleted = runs.filter((run) => run.loopId === input.loopId && run.outcome === 'completed')
      .sort((a, b) => b.completedAt - a.completedAt)[0];
    if (definition?.earlyExitWithoutNewEvidence && lastCompleted?.evidenceFingerprint === input.evidenceFingerprint
      && !input.forwardResolutionChanged) {
      blockers.push('NO_NEW_EVIDENCE'); mode = 'no_op';
    } else if (definition && lastCompleted && now - lastCompleted.completedAt < definition.cadenceMs
      && !input.forwardResolutionChanged) {
      blockers.push('CADENCE_NOT_DUE'); mode = 'no_op';
    }
  }
  return { allowed: mode === 'full', mode, blockers, dailyRuns: daily.length, dailyEstimatedTokens,
    attemptsOnEvidence: attempts.length, consecutiveFailures, liveExecution: 'locked' };
}

export function evidenceManifestFingerprint(input: { roots: string[]; configFiles: string[] }): string {
  const entries: Array<{ path: string; size: number; contentHash: string }> = [];
  const fingerprintFile = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const visit = (root: string, current: string) => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) visit(root, full);
      else if (stat.isFile()) entries.push({ path: path.join(path.basename(root), path.relative(root, full)),
        size: stat.size, contentHash: fingerprintFile(full) });
    }
  };
  for (const root of input.roots) {
    try { visit(root, root); } catch { /* missing evidence roots remain absent from the fingerprint */ }
  }
  for (const file of input.configFiles) {
    try { const stat = fs.statSync(file); entries.push({ path: path.basename(file), size: stat.size, contentHash: fingerprintFile(file) }); }
    catch { /* missing config is validated by its owning runtime */ }
  }
  return crypto.createHash('sha256').update(JSON.stringify(entries.sort((a, b) => a.path.localeCompare(b.path)))).digest('hex');
}
