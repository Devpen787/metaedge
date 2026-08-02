import { readDatabase, writeDatabase } from '../storage.js';
import type { FrozenStrategySpec, LayeredDecision, ValidationRecord } from './types.js';
import { assertAuthorityV5Contract } from '../v5/authority.js';
import { persistCycleOperatorTruthV5 } from '../v5/operator_truth.js';

const MAX_DECISIONS = 2_000;
const MAX_EXECUTED_IDS = 5_000;

function runtime(db: ReturnType<typeof readDatabase>) {
  return (db.decisionRuntime ||= { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} });
}

export function persistStrategySpec(spec: FrozenStrategySpec): FrozenStrategySpec {
  persistStrategySpecs([spec]);
  return spec;
}

export function persistStrategySpecs(specs: FrozenStrategySpec[]): FrozenStrategySpec[] {
  if (!specs.length) return specs;
  for (const spec of specs) assertAuthorityV5Contract(spec);
  const db = readDatabase();
  const state = runtime(db);
  let changed = false;
  for (const spec of specs) {
    if (state.strategySpecs[spec.hash]) continue;
    state.strategySpecs[spec.hash] = spec;
    changed = true;
  }
  if (changed) writeDatabase(db, ['decisionRuntime']);
  return specs.map((spec) => state.strategySpecs[spec.hash]);
}

export function persistValidation(validation: ValidationRecord): ValidationRecord {
  const db = readDatabase();
  const state = runtime(db);
  const spec = state.strategySpecs[validation.strategyHash];
  if (!spec) throw new Error(`Unknown strategy hash: ${validation.strategyHash}`);
  if (validation.status === 'forward_paper_candidate' && !validation.symbols?.length) {
    throw new Error('Forward-paper validation must name its authorized symbols');
  }
  state.validations[validation.id] = validation;
  writeDatabase(db, ['decisionRuntime']);
  return validation;
}

export function latestValidation(strategyHash: string): ValidationRecord | undefined {
  const db = readDatabase();
  return Object.values(runtime(db).validations)
    .filter((record) => record.strategyHash === strategyHash)
    .sort((a, b) => b.validatedAt - a.validatedAt)[0];
}

export function persistDecision(decision: LayeredDecision): LayeredDecision {
  persistDecisions([decision]);
  return decision;
}

export function persistDecisions(decisions: LayeredDecision[]): LayeredDecision[] {
  if (!decisions.length) return decisions;
  for (const decision of decisions) assertAuthorityV5Contract(decision);
  const db = readDatabase();
  const state = runtime(db);
  const indexes = new Map(state.decisions.map((item, index) => [item.id, index]));
  for (const decision of decisions) {
    const index = indexes.get(decision.id);
    if (index != null) state.decisions[index] = decision;
    else { indexes.set(decision.id, state.decisions.length); state.decisions.push(decision); }
  }
  if (state.decisions.length > MAX_DECISIONS) state.decisions.splice(0, state.decisions.length - MAX_DECISIONS);
  writeDatabase(db, ['decisionRuntime']);
  return decisions;
}

export function markDecisionRouted(decisionId: string, tradeId: string): LayeredDecision | undefined {
  const db = readDatabase();
  const state = runtime(db);
  const decision = state.decisions.find((item) => item.id === decisionId);
  if (!decision) return undefined;
  decision.queueStatus = 'routed';
  decision.routedTradeId = tradeId;
  state.executedDecisionIds[decisionId] = tradeId;
  const ids = Object.keys(state.executedDecisionIds);
  if (ids.length > MAX_EXECUTED_IDS) {
    for (const id of ids.slice(0, ids.length - MAX_EXECUTED_IDS)) delete state.executedDecisionIds[id];
  }
  writeDatabase(db, ['decisionRuntime']);
  return decision;
}

export function decisionWasExecuted(decisionId: string): string | undefined {
  const db = readDatabase();
  return runtime(db).executedDecisionIds[decisionId]
    || db.trades.find((trade) => trade.thesis?.decisionId === decisionId)?.id;
}

export function persistCycleSummary(summary: NonNullable<ReturnType<typeof readDatabase>['decisionRuntime']>['lastCycle']) {
  const db = readDatabase();
  runtime(db).lastCycle = summary;
  persistCycleOperatorTruthV5(db, summary);
  writeDatabase(db, ['decisionRuntime']);
}

export function decisionRuntimeSnapshot(viewerId?: string) {
  const db = readDatabase();
  const state = runtime(db);
  const visibleDecision = (decision: LayeredDecision) => decision.ownerId && decision.ownerId !== viewerId
    ? { ...decision, ownerId: undefined, agentId: undefined, routedTradeId: undefined }
    : decision;
  return {
    strategySpecs: Object.values(state.strategySpecs),
    validations: Object.values(state.validations),
    recentDecisions: state.decisions.slice(-100).reverse().map(visibleDecision),
    queued: state.decisions.filter((decision) => decision.queueStatus === 'queued').slice(-100).map(visibleDecision),
    lastCycle: state.lastCycle || null,
    marketDataV5: {
      activeUniverse: db.marketDataV5?.activeUniverseId
        ? db.marketDataV5.universeVersions[db.marketDataV5.activeUniverseId]
        : null,
      latestCoverage: db.marketDataV5?.latestCoverage || null,
    },
  };
}
