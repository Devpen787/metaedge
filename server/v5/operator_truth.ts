import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../storage.js';
import { assessPopulationBurnInV5 } from './population.js';
import type {
  DatabaseState,
  DecisionBlockCategoryV5,
  DecisionCycleDiagnosticsV5,
  ForwardOperationCheckpointV5,
  ForwardOperationIncidentV5,
  LocalAcceptanceBundleV5,
} from '../../src/types.js';
import type { LayeredDecision } from '../decision/types.js';

type CycleSummary = NonNullable<NonNullable<DatabaseState['decisionRuntime']>['lastCycle']>;

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function containsFixture(value: unknown): boolean {
  return /(?:^|[_:\s-])(fixture|assurance|synthetic|test)(?:$|[_:\s-])/i.test(String(value || ''));
}

export function isAssuranceDecisionV5(decision: LayeredDecision): boolean {
  return [decision.id, decision.cycleId, decision.reason, decision.routedTradeId,
    decision.signal?.setup, decision.signal?.trigger,
    ...decision.featureEvidence.flatMap((feature) => [feature.source.provider, feature.source.dataset])]
    .some(containsFixture);
}

function blockCategory(decision: LayeredDecision): DecisionBlockCategoryV5 {
  const declinedGate = decision.gates.find((gate) => gate.status === 'decline');
  if (declinedGate) return declinedGate.layer;
  const reason = decision.reason.toUpperCase();
  if (reason.includes('VALIDAT')) return 'validation';
  if (reason.includes('ROUT') || reason.includes('QUEUE')) return 'routing';
  if (reason.includes('NO_SIGNAL') || !decision.signal || decision.signal.action === 'hold') return 'no_signal';
  return 'other';
}

function countedRows(rows: LayeredDecision[], key: (decision: LayeredDecision) => string) {
  const groups = new Map<string, LayeredDecision[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) || []), row]);
  return [...groups.entries()].map(([id, items]) => {
    const reasons = new Map<string, number>();
    for (const item of items) reasons.set(item.reason, (reasons.get(item.reason) || 0) + 1);
    const topReason = [...reasons.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    return { id, evaluated: items.length, routed: items.filter((item) => item.queueStatus === 'routed').length, topReason };
  }).sort((left, right) => right.evaluated - left.evaluated || left.id.localeCompare(right.id));
}

export function buildDecisionCycleDiagnosticsV5(
  decisions: LayeredDecision[],
  summary: CycleSummary,
): DecisionCycleDiagnosticsV5 {
  const cycleRows = decisions.filter((decision) => decision.cycleId === summary.cycleId
    || decision.cycleId.startsWith(`${summary.cycleId}:`));
  const assuranceExcluded = cycleRows.filter(isAssuranceDecisionV5).length;
  const organic = cycleRows.filter((decision) => !isAssuranceDecisionV5(decision));
  const byOutcome: Record<string, number> = {};
  const reasons = new Map<string, { category: DecisionBlockCategoryV5; count: number }>();
  for (const decision of organic) {
    byOutcome[decision.outcome] = (byOutcome[decision.outcome] || 0) + 1;
    if (decision.queueStatus !== 'routed') {
      const category = blockCategory(decision);
      const key = `${category}:${decision.reason}`;
      reasons.set(key, { category, count: (reasons.get(key)?.count || 0) + 1 });
    }
  }
  const blockingReasons = [...reasons.entries()].map(([key, value]) => ({
    category: value.category,
    reason: key.slice(key.indexOf(':') + 1),
    count: value.count,
  })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  const organicRouted = organic.filter((decision) => decision.queueStatus === 'routed').length;
  const organicPaperCandidates = organic.filter((decision) => decision.outcome === 'paper_trade_candidate').length;
  const categoryCount = (categories: DecisionBlockCategoryV5[]) => blockingReasons
    .filter((row) => categories.includes(row.category)).reduce((sum, row) => sum + row.count, 0);
  const noRouteClassification: DecisionCycleDiagnosticsV5['noRouteClassification'] = organicRouted > 0
    ? 'not_applicable'
    : organicPaperCandidates > 0 ? 'routing_gap'
      : categoryCount(['data_quality', 'universe', 'liquidity', 'validation']) > organic.length / 2 ? 'evidence_blocked'
        : categoryCount(['risk', 'portfolio', 'cost']) > organic.length / 2 ? 'risk_vetoed'
          : categoryCount(['no_signal', 'regime']) > 0 ? 'expected_no_trade'
            : 'unclassified';
  const explanation = organicRouted > 0
    ? `${organicRouted} organic paper route${organicRouted === 1 ? '' : 's'} recorded.`
    : noRouteClassification === 'expected_no_trade' ? 'No valid trigger or eligible regime was present; standing down is expected behavior.'
      : noRouteClassification === 'evidence_blocked' ? 'Market evidence, validation, universe, or liquidity gates prevented eligible signals.'
        : noRouteClassification === 'risk_vetoed' ? 'Valid-looking signals were withheld by cost, risk, or portfolio controls.'
          : noRouteClassification === 'routing_gap' ? 'At least one paper candidate existed but no organic intent was routed; investigate routing.'
            : 'No organic route was recorded and the available reasons do not yet explain why.';
  const body = {
    authorityVersion: 5 as const,
    schema: 'decision-cycle-diagnostics.v5' as const,
    cycleId: summary.cycleId,
    completedAt: summary.completedAt,
    evaluated: summary.evaluated,
    organicEvaluated: organic.length,
    organicRouted,
    assuranceExcluded,
    byOutcome,
    byStrategy: countedRows(organic, (decision) => decision.pluginId)
      .map(({ id, ...row }) => ({ pluginId: id, ...row })),
    bySymbol: countedRows(organic, (decision) => decision.symbol)
      .map(({ id, ...row }) => ({ symbol: id, ...row })),
    blockingReasons,
    noRouteClassification,
    explanation,
  };
  const diagnosticHash = digest(body);
  return { ...body, diagnosticId: `cycle_diagnostic_v5_${diagnosticHash.slice(0, 24)}`, diagnosticHash };
}

export function buildForwardCheckpointV5(
  db: DatabaseState,
  summary: CycleSummary,
  diagnostics: DecisionCycleDiagnosticsV5,
  recordedAt = summary.completedAt,
): ForwardOperationCheckpointV5 {
  const prior = db.decisionRuntime?.forwardCheckpoints || [];
  let consecutiveZeroRouteCycles = diagnostics.organicRouted === 0 ? 1 : 0;
  for (let index = prior.length - 1; diagnostics.organicRouted === 0 && index >= 0; index -= 1) {
    if (prior[index].organicRouted > 0) break;
    consecutiveZeroRouteCycles += 1;
  }
  const incidents: ForwardOperationIncidentV5[] = [];
  if (summary.error) incidents.push({ code: 'CYCLE_ERROR', severity: 'critical', evidenceIds: [summary.cycleId], message: summary.error });
  if (diagnostics.noRouteClassification === 'evidence_blocked') incidents.push({
    code: 'EVIDENCE_PIPELINE_BLOCKED', severity: 'attention', evidenceIds: [diagnostics.diagnosticId],
    message: diagnostics.explanation,
  });
  if (diagnostics.noRouteClassification === 'routing_gap') incidents.push({
    code: 'ROUTING_GAP', severity: 'critical', evidenceIds: [diagnostics.diagnosticId], message: diagnostics.explanation,
  });
  // Clock and order-SLA incidents are added by the operation sampler after the
  // broker, portfolio, outcome, and risk clocks have had their turn. Sampling
  // them here, immediately after the decision writer, would create a false
  // stale incident during every otherwise healthy cycle.
  const body = {
    authorityVersion: 5 as const,
    schema: 'forward-operation-checkpoint.v5' as const,
    cycleId: summary.cycleId,
    recordedAt,
    organicRouted: diagnostics.organicRouted,
    consecutiveZeroRouteCycles,
    noRouteClassification: diagnostics.noRouteClassification,
    incidents,
    liveExecution: 'locked' as const,
  };
  const checkpointHash = digest({ ...body, diagnosticHash: diagnostics.diagnosticHash });
  return { ...body, checkpointId: `forward_checkpoint_v5_${checkpointHash.slice(0, 24)}`, checkpointHash };
}

export function persistCycleOperatorTruthV5(db: DatabaseState, summary: CycleSummary): void {
  const runtime = db.decisionRuntime!;
  runtime.cycleDiagnostics ||= [];
  runtime.forwardCheckpoints ||= [];
  if (runtime.cycleDiagnostics.some((row) => row.cycleId === summary.cycleId)) return;
  const diagnostics = buildDecisionCycleDiagnosticsV5(runtime.decisions, summary);
  runtime.cycleDiagnostics.push(diagnostics);
  runtime.forwardCheckpoints.push(buildForwardCheckpointV5(db, summary, diagnostics));
  if (runtime.cycleDiagnostics.length > 1_000) runtime.cycleDiagnostics.splice(0, runtime.cycleDiagnostics.length - 1_000);
  if (runtime.forwardCheckpoints.length > 1_000) runtime.forwardCheckpoints.splice(0, runtime.forwardCheckpoints.length - 1_000);
}

function assuranceEvidenceIds(db: DatabaseState): Set<string> {
  return new Set((db.populationOperationsV5?.assuranceRecords || []).flatMap((record) => record.evidenceIds));
}

function isAssuranceOutcomeV5(db: DatabaseState, outcome: NonNullable<DatabaseState['experimentLearningV5']>['outcomes'][string]): boolean {
  const linkedIds = [outcome.outcomeId, outcome.episodeId, ...outcome.tradeIds, ...outcome.orderIntentIds];
  if (linkedIds.some(containsFixture) || linkedIds.some((id) => assuranceEvidenceIds(db).has(id))) return true;
  const linkedTrades = db.trades.filter((trade) => outcome.tradeIds.includes(trade.id));
  if (linkedTrades.some((trade) => [trade.thesis?.setup, trade.thesis?.trigger, trade.thesis?.invalidation].some(containsFixture))) return true;
  return outcome.orderIntentIds.some((intentId) => {
    const intent = db.orderIntentsV5?.[intentId];
    return intent && [intent.nonce, intent.thesis?.setup, intent.thesis?.trigger, intent.thesis?.invalidation].some(containsFixture);
  });
}

function organicOutcomesV5(db: DatabaseState) {
  return Object.values(db.experimentLearningV5?.outcomes || {}).filter((outcome) => !isAssuranceOutcomeV5(db, outcome));
}

export function buildLocalAcceptanceBundleV5(db: DatabaseState, generatedAt = Date.now()): LocalAcceptanceBundleV5 {
  const assessment = assessPopulationBurnInV5(db, generatedAt);
  const operation = db.populationOperationsV5;
  const cleanCycleIds = [...new Set((operation?.samples || []).filter((sample) => sample.clean && sample.decisionCycleId)
    .map((sample) => sample.decisionCycleId!))].slice(-assessment.requiredConsecutiveCleanCycles);
  const body = {
    authorityVersion: 5 as const,
    schema: 'local-acceptance-bundle.v5' as const,
    generatedAt,
    scope: 'isolated_local_mechanics_only' as const,
    mechanicsVerdict: assessment.verdict,
    economicEdgeProven: false as const,
    deploymentAuthorized: false as const,
    liveExecution: 'locked' as const,
    policyHash: operation?.policy.policyHash || '',
    assuranceEvidence: (operation?.assuranceRecords || []).filter((record) =>
      record.evidenceHash === digest({ kind: record.kind, evidenceIds: [...new Set(record.evidenceIds)].sort() }))
      .map((record) => ({
      recordId: record.recordId, kind: record.kind, evidenceHash: record.evidenceHash,
    })).sort((left, right) => left.recordId.localeCompare(right.recordId)),
    cleanCycleIds,
    diagnosticHashes: (db.decisionRuntime?.cycleDiagnostics || []).map((row) => row.diagnosticHash).sort(),
    checkpointHashes: (db.decisionRuntime?.forwardCheckpoints || []).map((row) => row.checkpointHash).sort(),
  };
  const bundleHash = digest(body);
  return { ...body, bundleId: `local_acceptance_v5_${bundleHash.slice(0, 24)}`, bundleHash };
}

export function recordLocalAcceptanceBundleV5(generatedAt = Date.now()): LocalAcceptanceBundleV5 {
  const db = readDatabase();
  const bundle = buildLocalAcceptanceBundleV5(db, generatedAt);
  db.populationOperationsV5!.acceptanceBundles ||= [];
  if (!db.populationOperationsV5!.acceptanceBundles!.some((row) => row.bundleId === bundle.bundleId)) {
    db.populationOperationsV5!.acceptanceBundles!.push(bundle);
    writeDatabase(db, ['populationOperationsV5']);
  }
  return bundle;
}

export function operatorTruthSnapshotV5(now = Date.now()) {
  const db = readDatabase();
  const burnIn = assessPopulationBurnInV5(db, now);
  const diagnostics = db.decisionRuntime?.cycleDiagnostics?.at(-1) || null;
  const checkpoint = db.decisionRuntime?.forwardCheckpoints?.at(-1) || null;
  const organicOutcomes = organicOutcomesV5(db);
  const organicOutcomeIds = new Set(organicOutcomes.map((outcome) => outcome.outcomeId));
  const reviewCandidates = Object.values(db.experimentLearningV5?.assessments || {})
    .filter((assessment) => assessment.promotable && assessment.outcomeIds.some((id) => organicOutcomeIds.has(id))).length;
  const economicStatus = reviewCandidates > 0 ? 'review_candidate_not_proven'
    : organicOutcomes.length > 0 ? 'collecting_forward_evidence' : 'unproven_no_organic_outcomes';
  return {
    authorityVersion: 5,
    schema: 'operator-truth-snapshot.v5',
    generatedAt: now,
    mechanics: { status: burnIn.verdict, reasons: burnIn.reasons },
    economics: { status: economicStatus, edgeProven: false, organicOutcomes: organicOutcomes.length, reviewCandidates },
    deployment: { authorized: false, status: 'not_authorized' },
    liveExecution: 'locked',
    latestCycle: diagnostics,
    forwardOperation: checkpoint ? {
      latestCheckpoint: checkpoint,
      activeIncidents: checkpoint.incidents,
      totalCheckpoints: db.decisionRuntime?.forwardCheckpoints?.length || 0,
    } : { latestCheckpoint: null, activeIncidents: [], totalCheckpoints: 0 },
    latestAcceptanceBundle: db.populationOperationsV5?.acceptanceBundles?.at(-1) || null,
    boundaries: ['MECHANICS_GO_IS_NOT_ECONOMIC_EDGE', 'ASSURANCE_FIXTURES_EXCLUDED', 'PAPER_ONLY', 'DEPLOYMENT_NOT_AUTHORIZED'],
  };
}
