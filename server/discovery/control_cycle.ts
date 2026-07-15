import { contentHash } from './store.js';
import { evaluateControlGate, readFlywheelControlConfig } from './control_runtime.js';
import { FlywheelControlStore } from './control_store.js';
import type {
  ControlGateInput,
  FlywheelControlConfig,
  ResearchEscalation,
  ResearchLoopOutcome,
  ResearchLoopRun,
  ResearchLoopState,
} from './control_types.js';

export interface ControlledActionResult<T> {
  value: T;
  reason: string;
  itemsFound: number;
  actionsTaken: number;
  newEvidence: boolean;
}

export interface ControlledLoopResult<T> {
  executed: boolean;
  value: T | null;
  run: ResearchLoopRun;
}

export interface ControlledLoopInput<T> extends Omit<ControlGateInput, 'now'> {
  store?: FlywheelControlStore;
  config?: FlywheelControlConfig;
  now?: () => number;
  humanGate?: { gate: string; approvalId: string };
  action: () => Promise<ControlledActionResult<T>> | ControlledActionResult<T>;
}

function gateOutcome(mode: ReturnType<typeof evaluateControlGate>['mode']): ResearchLoopOutcome {
  if (mode === 'no_op') return 'no_op';
  if (mode === 'report_only') return 'report_only';
  if (mode === 'escalate') return 'escalated';
  return 'blocked';
}

function initialState(config: FlywheelControlConfig, now: number): ResearchLoopState {
  return {
    schemaVersion: 1,
    updatedAt: now,
    pauseAll: config.pauseAll,
    currentEvidenceFingerprint: null,
    highPriority: [],
    watch: [],
    recentNoise: [],
    humanInbox: [],
    liveExecution: 'locked',
  };
}

function updateState(
  store: FlywheelControlStore,
  config: FlywheelControlConfig,
  run: ResearchLoopRun,
): void {
  const state = store.readState() ?? initialState(config, run.completedAt);
  const recentNoise = run.outcome === 'no_op'
    ? [...state.recentNoise.filter((item) => item !== run.reason), run.reason].slice(-20)
    : state.recentNoise;
  const humanInbox = run.outcome === 'escalated'
    ? [...state.humanInbox.filter((item) => item !== run.reason), run.reason].slice(-20)
    : state.humanInbox;
  store.writeState({
    ...state,
    updatedAt: run.completedAt,
    pauseAll: config.pauseAll,
    currentEvidenceFingerprint: run.evidenceFingerprint,
    recentNoise,
    humanInbox,
    liveExecution: 'locked',
  });
}

function appendEscalation(store: FlywheelControlStore, run: ResearchLoopRun): ResearchEscalation {
  const escalation = store.makeEscalation({
    loopId: run.loopId,
    createdAt: run.completedAt,
    evidenceFingerprint: run.evidenceFingerprint,
    reason: run.reason,
    status: 'open',
  });
  store.appendEscalations([escalation]);
  return escalation;
}

export async function executeControlledLoop<T>(input: ControlledLoopInput<T>): Promise<ControlledLoopResult<T>> {
  const config = input.config ?? readFlywheelControlConfig();
  const store = input.store ?? new FlywheelControlStore();
  const clock = input.now ?? Date.now;
  const startedAt = clock();
  const gate = evaluateControlGate(config, store.readRuns(), {
    loopId: input.loopId,
    evidenceFingerprint: input.evidenceFingerprint,
    requestedTrials: input.requestedTrials,
    requestedAgentActions: input.requestedAgentActions,
    estimatedTokens: input.estimatedTokens,
    forwardResolutionChanged: input.forwardResolutionChanged,
    now: startedAt,
  });
  const makeRun = (values: {
    outcome: ResearchLoopOutcome;
    reason: string;
    itemsFound?: number;
    actionsTaken?: number;
    newEvidence?: boolean;
    errorSignature?: string | null;
  }): ResearchLoopRun => store.makeRun({
    loopId: input.loopId,
    startedAt,
    completedAt: clock(),
    evidenceFingerprint: input.evidenceFingerprint,
    outcome: values.outcome,
    reason: values.reason,
    itemsFound: values.itemsFound ?? 0,
    actionsTaken: values.actionsTaken ?? 0,
    declaredTrials: input.requestedTrials,
    estimatedTokens: input.estimatedTokens,
    errorSignature: values.errorSignature ?? null,
    newEvidence: values.newEvidence ?? false,
  });

  if (!gate.allowed) {
    const run = makeRun({ outcome: gateOutcome(gate.mode), reason: gate.blockers.join('|') || gate.mode });
    store.appendRuns([run]);
    if (run.outcome === 'escalated') appendEscalation(store, run);
    updateState(store, config, run);
    return { executed: false, value: null, run };
  }

  const definition = config.loops.find((loop) => loop.id === input.loopId);
  if (!definition) throw new Error(`UNKNOWN_RESEARCH_LOOP:${input.loopId}`);
  if (input.humanGate) {
    const gateDeclared = definition.humanGates.includes(input.humanGate.gate);
    const approval = gateDeclared ? store.availableHumanApproval({ approvalId: input.humanGate.approvalId,
      loopId: input.loopId, gate: input.humanGate.gate, evidenceFingerprint: input.evidenceFingerprint, now: startedAt }) : null;
    if (!approval) {
      const reason = gateDeclared ? `HUMAN_APPROVAL_REQUIRED_OR_INVALID:${input.humanGate.gate}`
        : `HUMAN_GATE_NOT_DECLARED_FOR_LOOP:${input.humanGate.gate}`;
      const run = makeRun({ outcome: 'blocked', reason }); store.appendRuns([run]); updateState(store, config, run);
      return { executed: false, value: null, run };
    }
    // Consume before mutation. A failing action must never make the same
    // approval replayable.
    store.consumeHumanApproval(approval, startedAt);
  }
  const lock = store.acquireLock({
    owner: input.loopId,
    resources: definition.writeScopes,
    acquiredAt: startedAt,
    expiresAt: startedAt + config.lockTtlMs,
    liveExecution: 'locked',
  });
  if (!lock.acquired) {
    const run = makeRun({ outcome: 'blocked', reason: `RESOURCE_LOCKED:${lock.blocker?.owner ?? 'unknown'}` });
    store.appendRuns([run]);
    updateState(store, config, run);
    return { executed: false, value: null, run };
  }

  try {
    const result = await input.action();
    const runtimeMs = clock() - startedAt;
    const exceededRuntime = runtimeMs > config.budget.maxRuntimeMs;
    const run = makeRun({
      outcome: exceededRuntime ? 'escalated' : 'completed',
      reason: exceededRuntime ? `RUNTIME_BUDGET_EXCEEDED:${runtimeMs}` : result.reason,
      itemsFound: result.itemsFound,
      actionsTaken: result.actionsTaken,
      newEvidence: result.newEvidence,
    });
    store.appendRuns([run]);
    if (exceededRuntime) appendEscalation(store, run);
    updateState(store, config, run);
    return { executed: true, value: result.value, run };
  } catch (error) {
    const signature = contentHash({
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    }).slice(0, 24);
    const run = makeRun({ outcome: 'failed', reason: 'CONTROLLED_LOOP_FAILED', errorSignature: signature });
    store.appendRuns([run]);
    updateState(store, config, run);
    throw error;
  } finally {
    store.releaseLock(input.loopId);
  }
}

export function controlPlaneSnapshot(
  store = new FlywheelControlStore(),
  config = readFlywheelControlConfig(),
  now = Date.now(),
) {
  const runs = store.readRuns();
  const escalations = store.readEscalations();
  const humanApprovals = store.readHumanApprovals();
  const humanConsumptions = store.readHumanConsumptions();
  const locks = store.listLocks(now);
  const state = store.readState() ?? initialState(config, now);
  const duplicateIds = (ids: string[]) => [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  return {
    mode: 'Paper research',
    config,
    state,
    runs,
    openEscalations: escalations.filter((item) => item.status === 'open'),
    humanGates: { approvals: humanApprovals, consumptions: humanConsumptions,
      available: humanApprovals.filter((approval) => approval.expiresAt > now
        && !humanConsumptions.some((consumption) => consumption.approvalId === approval.id)) },
    locks,
    integrity: {
      duplicateRunIds: duplicateIds(runs.map((run) => run.id)),
      duplicateEscalationIds: duplicateIds(escalations.map((item) => item.id)),
      duplicateHumanApprovalIds: duplicateIds(humanApprovals.map((item) => item.id)),
      duplicateHumanConsumptionIds: duplicateIds(humanConsumptions.map((item) => item.id)),
      allLiveExecutionLocked: config.liveExecution === 'locked' && state.liveExecution === 'locked' &&
        [...runs, ...escalations, ...locks, ...humanApprovals, ...humanConsumptions]
          .every((item) => item.liveExecution === 'locked'),
    },
    snapshotId: `control_${contentHash({ config, state, runs, escalations, humanApprovals, humanConsumptions, locks }).slice(0, 20)}`,
  };
}
