import type { DatabaseState } from '../src/types';

/**
 * Add only deterministic persisted-schema defaults.
 *
 * This function is shared by normal reads and the one-time PostgreSQL import so
 * a freshly migrated state does not discover schema drift on its first write.
 * It deliberately does not create date-relative product fixtures.
 */
export function normalizePersistedState(state: Record<string, any>): DatabaseState {
  if (!state.sessions) state.sessions = {};
  if (!state.predictionBetEvents) state.predictionBetEvents = [];
  if (!state.arenaMembers) state.arenaMembers = [];
  if (!state.arenaBadges) state.arenaBadges = [];
  if (!state.arenaRankSnapshots) state.arenaRankSnapshots = {};
  if (!state.trailingState) state.trailingState = {};
  if (!state.cooldowns) state.cooldowns = {};
  if (!state.orderIntentsV5) state.orderIntentsV5 = {};
  if (!state.orderNonceIndexV5) state.orderNonceIndexV5 = {};
  if (!state.orderEventsV5) state.orderEventsV5 = [];
  if (!state.paperFillsV5) state.paperFillsV5 = [];
  if (!state.experimentsV5) {
    state.experimentsV5 = { specs: {}, states: {}, budgets: {}, observations: [], lifecycleEvents: [] };
  }
  if (!state.experimentsV5.specs) state.experimentsV5.specs = {};
  if (!state.experimentsV5.states) state.experimentsV5.states = {};
  if (!state.experimentsV5.budgets) state.experimentsV5.budgets = {};
  if (!state.experimentsV5.observations) state.experimentsV5.observations = [];
  if (!state.experimentsV5.lifecycleEvents) state.experimentsV5.lifecycleEvents = [];
  if (state.portfolioAllocatorV5) {
    if (!state.portfolioAllocatorV5.reservations) state.portfolioAllocatorV5.reservations = {};
    if (!state.portfolioAllocatorV5.decisions) state.portfolioAllocatorV5.decisions = [];
  }
  if (state.populationOperationsV5) {
    if (!state.populationOperationsV5.samples) state.populationOperationsV5.samples = [];
    if (!state.populationOperationsV5.assuranceRecords) state.populationOperationsV5.assuranceRecords = [];
    if (!state.populationOperationsV5.acceptanceBundles) state.populationOperationsV5.acceptanceBundles = [];
  }
  if (!state.marketDataV5) state.marketDataV5 = { universeVersions: {}, coverageHistory: [] };
  if (!state.marketDataV5.universeVersions) state.marketDataV5.universeVersions = {};
  if (!state.marketDataV5.coverageHistory) state.marketDataV5.coverageHistory = [];
  if (!state.decisionRuntime) {
    state.decisionRuntime = { strategySpecs: {}, validations: {}, decisions: [], executedDecisionIds: {} };
  }
  if (!state.decisionRuntime.strategySpecs) state.decisionRuntime.strategySpecs = {};
  if (!state.decisionRuntime.validations) state.decisionRuntime.validations = {};
  if (!state.decisionRuntime.decisions) state.decisionRuntime.decisions = [];
  if (!state.decisionRuntime.executedDecisionIds) state.decisionRuntime.executedDecisionIds = {};
  if (!state.decisionRuntime.cycleDiagnostics) state.decisionRuntime.cycleDiagnostics = [];
  if (!state.decisionRuntime.forwardCheckpoints) state.decisionRuntime.forwardCheckpoints = [];
  return state as DatabaseState;
}
