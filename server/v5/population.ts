import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';
import { paperBrokerClockV5 } from '../trades.js';
import { riskLoopClockV5 } from '../decision/risk_loop.js';
import { outcomeReconcilerClockV5 } from './outcomes.js';
import { portfolioReconcilerClockV5 } from './portfolio.js';
import { v5AuthorityFlags } from './authority.js';
import type {
  DatabaseState,
  PopulationBurnInAssessmentV5,
  PopulationAssuranceKindV5,
  PopulationClockSampleV5,
  PopulationOperationPolicyV5,
  PopulationOperationSampleV5,
} from '../../src/types.js';

const REQUIRED_CLOCK_IDS = new Set([
  'decision_runtime_v5',
  'paper_broker_clock_v5',
  'portfolio_allocator_reconciler_v5',
  'experiment_outcome_reconciler_v5',
  'risk_exit_clock_v5',
]);

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

const POLICY_BODY = {
  authorityVersion: 5 as const,
  schema: 'population-operation-policy.v5' as const,
  id: 'population-operation-policy-v5',
  semanticVersion: '5.0.0',
  minimumRegisteredArms: 12,
  maximumRegisteredArms: 20,
  minimumMechanismFamilies: 12,
  requiredConsecutiveCleanCycles: 10,
  unresolvedOrderSlaMs: 15 * 60_000,
  liveExecution: 'locked' as const,
};

export const DEFAULT_POPULATION_OPERATION_POLICY_V5: PopulationOperationPolicyV5 = {
  ...POLICY_BODY,
  policyHash: digest(POLICY_BODY),
};

function operationStore(db: DatabaseState) {
  const current = (db.populationOperationsV5 ||= {
    policy: DEFAULT_POPULATION_OPERATION_POLICY_V5,
    samples: [],
    assuranceRecords: [],
  });
  current.assuranceRecords ||= [];
  current.acceptanceBundles ||= [];
  const storedHash = current.policy.policyHash;
  // PostgreSQL jsonb does not preserve object-key insertion order. Rebuild the
  // policy body in its declared order before hashing so a restart cannot make
  // the same immutable policy look mutated solely because jsonb reordered it.
  const storedBody = {
    authorityVersion: current.policy.authorityVersion,
    schema: current.policy.schema,
    id: current.policy.id,
    semanticVersion: current.policy.semanticVersion,
    minimumRegisteredArms: current.policy.minimumRegisteredArms,
    maximumRegisteredArms: current.policy.maximumRegisteredArms,
    minimumMechanismFamilies: current.policy.minimumMechanismFamilies,
    requiredConsecutiveCleanCycles: current.policy.requiredConsecutiveCleanCycles,
    unresolvedOrderSlaMs: current.policy.unresolvedOrderSlaMs,
    liveExecution: current.policy.liveExecution,
  };
  if (storedHash !== digest(storedBody) || storedHash !== DEFAULT_POPULATION_OPERATION_POLICY_V5.policyHash) {
    throw new Error('POPULATION_OPERATION_POLICY_IMMUTABLE');
  }
  return current;
}

function sampledClock(id: string, enabled: boolean, cadenceMs: number, lastCompletedAt: number | null | undefined, now: number): PopulationClockSampleV5 {
  const ageMs = lastCompletedAt == null ? null : Math.max(0, now - lastCompletedAt);
  return { id, enabled, cadenceMs, lastCompletedAt: lastCompletedAt ?? null, ageMs, fresh: enabled && ageMs != null && ageMs <= cadenceMs * 2 };
}

export function evaluatePopulationOperationV5(
  db: DatabaseState,
  now = Date.now(),
  clockOverride?: PopulationClockSampleV5[],
): PopulationOperationSampleV5 {
  const policy = operationStore(db).policy;
  const flags = v5AuthorityFlags();
  const specs = Object.values(db.experimentsV5?.specs || {});
  const families = new Set(specs.map((spec) => spec.family));
  const decisionCycle = db.decisionRuntime?.lastCycle;
  const broker = paperBrokerClockV5();
  const portfolio = portfolioReconcilerClockV5();
  const outcomes = outcomeReconcilerClockV5();
  const risk = riskLoopClockV5();
  const clocks = clockOverride || [
    sampledClock('decision_runtime_v5', Boolean(decisionCycle?.completedAt), 5 * 60_000, decisionCycle?.completedAt, now),
    sampledClock(broker.id, broker.enabled, broker.cadenceMs, broker.lastCompletedAt, now),
    sampledClock(portfolio.id, portfolio.enabled, portfolio.cadenceMs, portfolio.lastCompletedAt, now),
    sampledClock(outcomes.id, outcomes.enabled, outcomes.cadenceMs, outcomes.lastCompletedAt, now),
    sampledClock(risk.id, risk.enabled, risk.cadenceMs, risk.lastCompletedAt, now),
  ];
  const unresolvedBeyondSla = Object.values(db.orderIntentsV5 || {})
    .filter((intent) => intent.experimentId && intent.status === 'UNRESOLVED' && now - intent.updatedAt > policy.unresolvedOrderSlaMs)
    .map((intent) => intent.intentId);
  const reasons: string[] = [];
  if (specs.length < policy.minimumRegisteredArms || specs.length > policy.maximumRegisteredArms) reasons.push('POPULATION_SIZE_OUTSIDE_DECLARED_RANGE');
  if (families.size < policy.minimumMechanismFamilies) reasons.push('MECHANISM_FAMILY_DIVERSITY_INSUFFICIENT');
  const clockIds = new Set(clocks.map((clock) => clock.id));
  if (clocks.length !== REQUIRED_CLOCK_IDS.size || [...REQUIRED_CLOCK_IDS].some((id) => !clockIds.has(id))) {
    reasons.push('REQUIRED_CONTINUOUS_CLOCK_MISSING');
  }
  if (clocks.some((clock) => !clock.enabled || !clock.fresh)) reasons.push('CONTINUOUS_CLOCK_NOT_FRESH');
  if (unresolvedBeyondSla.length) reasons.push('UNRESOLVED_ORDER_BEYOND_SLA');
  if (flags.liveExecutionEnabled) reasons.push('LIVE_EXECUTION_NOT_LOCKED');
  if (flags.legacyWritersEnabled) reasons.push('LEGACY_WRITER_ENABLED');
  if (!db.authorityV5) reasons.push('V5_AUTHORITY_CUTOVER_MISSING');
  if (db.authorityV5 && specs.some((spec) => db.authorityV5!.legacyStrategySpecIds.includes(spec.strategyHash))) {
    reasons.push('ACTIVE_STRATEGY_FROZEN_AS_LEGACY');
  }
  if (Object.values(db.agents).some((agent) => agent.status !== 'revoked'
    && (agent.authorityVersion !== 5 || agent.schema !== 'trading-agent.v5'))) reasons.push('ACTIVE_AGENT_BELOW_V5');
  const identity = {
    decisionCycleId: decisionCycle?.cycleId || null,
    clockCompletions: clocks.map((clock) => [clock.id, clock.lastCompletedAt]),
  };
  return {
    authorityVersion: 5,
    schema: 'population-operation-sample.v5',
    sampleId: `population_sample_v5_${digest(identity).slice(0, 24)}`,
    decisionCycleId: decisionCycle?.cycleId || null,
    recordedAt: now,
    registeredArms: specs.length,
    mechanismFamilies: families.size,
    observations: db.experimentsV5?.observations.length || 0,
    orderIntents: Object.values(db.orderIntentsV5 || {}).filter((intent) => intent.experimentId).length,
    outcomes: Object.keys(db.experimentLearningV5?.outcomes || {}).length,
    unresolvedBeyondSla,
    clocks,
    clean: reasons.length === 0,
    reasons,
    liveExecution: 'locked',
  };
}

export function recordPopulationOperationSampleV5(now = Date.now()): PopulationOperationSampleV5 {
  const db = readDatabase();
  const ledger = operationStore(db);
  const sample = evaluatePopulationOperationV5(db, now);
  const existing = ledger.samples.find((item) => item.sampleId === sample.sampleId);
  if (existing) return existing;
  ledger.samples.push(sample);
  if (ledger.samples.length > 1_000) ledger.samples.splice(0, ledger.samples.length - 1_000);
  ledger.lastSampledAt = now;
  const checkpoint = db.decisionRuntime?.forwardCheckpoints?.find((item) => item.cycleId === sample.decisionCycleId);
  if (checkpoint) {
    checkpoint.incidents = checkpoint.incidents.filter((incident) => incident.code !== 'CLOCK_STALE' && incident.code !== 'ORDER_SLA_BREACH');
    if (sample.reasons.includes('CONTINUOUS_CLOCK_NOT_FRESH')) checkpoint.incidents.push({
      code: 'CLOCK_STALE', severity: 'critical',
      evidenceIds: sample.clocks.filter((item) => !item.fresh).map((item) => item.id),
      message: 'One or more required V5 clocks are not fresh at the operation checkpoint.',
    });
    if (sample.unresolvedBeyondSla.length) checkpoint.incidents.push({
      code: 'ORDER_SLA_BREACH', severity: 'critical', evidenceIds: sample.unresolvedBeyondSla,
      message: `${sample.unresolvedBeyondSla.length} unresolved order intent(s) exceeded the SLA.`,
    });
    const diagnosticHash = db.decisionRuntime?.cycleDiagnostics?.find((item) => item.cycleId === checkpoint.cycleId)?.diagnosticHash || '';
    const { checkpointId: _checkpointId, checkpointHash: _checkpointHash, ...checkpointBody } = checkpoint;
    checkpoint.checkpointHash = digest({ ...checkpointBody, diagnosticHash });
    checkpoint.checkpointId = `forward_checkpoint_v5_${checkpoint.checkpointHash.slice(0, 24)}`;
  }
  writeDatabase(db, ['populationOperationsV5', 'decisionRuntime']);
  return sample;
}

export function markPopulationUiLedgerParityV5(verified: boolean, now = Date.now()): void {
  const db = readDatabase();
  const ledger = operationStore(db);
  ledger.uiLedgerParityVerifiedAt = verified ? now : undefined;
  writeDatabase(db, ['populationOperationsV5']);
}

export function recordPopulationAssuranceV5(kind: PopulationAssuranceKindV5, evidenceIds: string[], now = Date.now()): void {
  if (!evidenceIds.length || evidenceIds.some((id) => !id.trim())) throw new Error('POPULATION_ASSURANCE_EVIDENCE_REQUIRED');
  const db = readDatabase();
  const ledger = operationStore(db);
  const normalizedEvidenceIds = [...new Set(evidenceIds)].sort();
  const evidenceHash = digest({ kind, evidenceIds: normalizedEvidenceIds });
  const recordId = `population_assurance_v5_${digest({ kind, evidenceHash }).slice(0, 24)}`;
  if (!ledger.assuranceRecords!.some((record) => record.recordId === recordId)) {
    ledger.assuranceRecords!.push({
      authorityVersion: 5,
      schema: 'population-assurance-record.v5',
      recordId,
      kind,
      evidenceIds: normalizedEvidenceIds,
      evidenceHash,
      recordedAt: now,
    });
    writeDatabase(db, ['populationOperationsV5']);
  }
}

export function assessPopulationBurnInV5(db = readDatabase(), now = Date.now()): PopulationBurnInAssessmentV5 {
  const ledger = operationStore(db);
  const chronological = [...ledger.samples].sort((left, right) => left.recordedAt - right.recordedAt);
  let consecutiveCleanCycles = 0;
  const distinctCycles = new Set<string>();
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const sample = chronological[index];
    if (!sample.clean || !sample.decisionCycleId || distinctCycles.has(sample.decisionCycleId)) break;
    distinctCycles.add(sample.decisionCycleId);
    consecutiveCleanCycles += 1;
  }
  const decisions = db.portfolioAllocatorV5?.decisions || [];
  const events = db.orderEventsV5 || [];
  const lifecycle = db.experimentsV5?.lifecycleEvents || [];
  const outcomeRows = Object.values(db.experimentLearningV5?.outcomes || {});
  const validAssuranceRecords = (ledger.assuranceRecords || [])
    .filter((record) => record.authorityVersion === 5
      && record.schema === 'population-assurance-record.v5'
      && record.evidenceIds.length > 0
      && record.evidenceHash === digest({ kind: record.kind, evidenceIds: [...new Set(record.evidenceIds)].sort() }));
  const assuranceKinds = new Set(validAssuranceRecords.map((record) => record.kind));
  const portfolioVetoObserved = decisions.some((decision) => !decision.accepted
    && decision.reasons.length > 0
    && validAssuranceRecords.some((record) => record.kind === 'portfolio_allocator_veto'
      && record.evidenceIds.includes(decision.decisionId)
      && record.evidenceIds.includes(decision.reservationId)
      && record.evidenceIds.includes(decision.snapshotBeforeHash)
      && record.evidenceIds.includes(decision.policyHash)
      && decision.reasons.every((reason) => record.evidenceIds.includes(reason))));
  const lifecycleReactivationObserved = lifecycle.some((ineligible) => ineligible.type === 'regime_ineligible'
    && lifecycle.some((eligible) => eligible.type === 'regime_eligible'
      && eligible.experimentId === ineligible.experimentId
      && eligible.at > ineligible.at
      && validAssuranceRecords.some((record) => record.kind === 'lifecycle_reactivation'
        && record.evidenceIds.includes(ineligible.experimentId)
        && record.evidenceIds.includes(ineligible.eventId)
        && record.evidenceIds.includes(eligible.eventId))));
  const evidence = {
    portfolioVetoObserved,
    partialFillObserved: events.some((event) => event.type === 'PARTIALLY_FILLED'),
    reconciliationObserved: db.auditEvents.some((event) => event.action.startsWith('RECONCILE_ORDER_')),
    lifecycleReactivationObserved,
    controlledOutcomeObserved: outcomeRows.some((outcome) => outcome.noTradeControlPnlUsd === 0
      && Number.isFinite(outcome.buyHoldControlPnlUsd)),
    uiLedgerParityVerified: Boolean(ledger.uiLedgerParityVerifiedAt),
    intentRestartRecoveryVerified: assuranceKinds.has('intent_restart_recovery'),
    partialFillRestartRecoveryVerified: assuranceKinds.has('partial_fill_restart_recovery'),
    outcomeRestartRecoveryVerified: assuranceKinds.has('outcome_restart_recovery'),
    staleDataRejectionVerified: assuranceKinds.has('stale_data_rejection'),
    writeFailureInjectionVerified: assuranceKinds.has('write_failure_injection'),
  };
  const reasons: string[] = [];
  if (consecutiveCleanCycles < ledger.policy.requiredConsecutiveCleanCycles) reasons.push('TEN_CONSECUTIVE_CLEAN_CYCLES_NOT_PROVEN');
  for (const [key, passed] of Object.entries(evidence)) if (!passed) reasons.push(`${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_NOT_PROVEN`);
  return {
    authorityVersion: 5,
    schema: 'population-burn-in-assessment.v5',
    assessedAt: now,
    verdict: reasons.length ? 'no_go' : 'go_local_paper_operation',
    consecutiveCleanCycles,
    requiredConsecutiveCleanCycles: ledger.policy.requiredConsecutiveCleanCycles,
    evidence,
    reasons,
    liveExecution: 'locked',
  };
}

export function populationOperationSnapshotV5(now = Date.now()) {
  const db = readDatabase();
  const ledger = operationStore(db);
  return {
    mode: 'Paper money',
    liveExecution: 'locked',
    policy: ledger.policy,
    current: evaluatePopulationOperationV5(db, now),
    recentSamples: ledger.samples.slice(-25).reverse(),
    burnIn: assessPopulationBurnInV5(db, now),
  };
}

const SUPERVISOR_MS = Math.max(5_000, Number(process.env.POPULATION_SUPERVISOR_INTERVAL_MS) || 30_000);
let started = false;

export function startPopulationOperationSupervisorV5(): void {
  if (started) return;
  started = true;
  const run = () => {
    try { recordPopulationOperationSampleV5(Date.now()); }
    catch (error: any) { console.warn('[population-operation-v5] sample failed:', error?.message || String(error)); }
  };
  setTimeout(run, 20_000).unref();
  setInterval(run, SUPERVISOR_MS).unref();
  console.log(`[population-operation-v5] supervising distinct V5 cycles every ${SUPERVISOR_MS}ms — live locked`);
}
