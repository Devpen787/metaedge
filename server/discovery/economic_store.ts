import fs from 'node:fs';
import path from 'node:path';
import type {
  FastShadowDecision,
  FastShadowOutcome,
  PaperLifecycleState,
  PaperTradeContract,
  PaperTradeKillEvent,
  PaperTradeLifecycleEvent,
  StrategyVersion,
} from './economic_types.js';
import { ECONOMIC_OBJECTIVE_POLICY, rankPaperTradeContracts } from './economic_runtime.js';
import { readJsonlTolerant } from './jsonl_recovery.js';

function appendUnique<T extends { id: string }>(file: string, rows: T[], quarantineRoot: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonlTolerant<T>(file, quarantineRoot).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

const NEXT: Record<PaperLifecycleState, PaperLifecycleState | null> = {
  research_candidate: 'shadow_paper', shadow_paper: 'funded_paper', funded_paper: 'live_review', live_review: null,
};

export class EconomicOperationStore {
  private readonly contractsFile: string;
  private readonly lifecycleFile: string;
  private readonly shadowDecisionsFile: string;
  private readonly shadowOutcomesFile: string;
  private readonly killEventsFile: string;
  private readonly strategyVersionsFile: string;
  private readonly quarantineRoot: string;
  private readonly readCache = new Map<string, { size: number; mtimeMs: number; rows: unknown[] }>();
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'economics')) {
    this.contractsFile = path.join(root, 'paper-trade-contracts.jsonl');
    this.lifecycleFile = path.join(root, 'lifecycle-events.jsonl');
    this.shadowDecisionsFile = path.join(root, 'shadow-decisions.jsonl');
    this.shadowOutcomesFile = path.join(root, 'shadow-outcomes.jsonl');
    this.killEventsFile = path.join(root, 'kill-events.jsonl');
    this.strategyVersionsFile = path.join(root, 'strategy-versions.jsonl');
    this.quarantineRoot = path.join(root, 'quarantine');
  }
  private read<T>(file: string): T[] {
    try {
      const stat = fs.statSync(file); const cached = this.readCache.get(file);
      if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.rows as T[];
      const rows = readJsonlTolerant<T>(file, this.quarantineRoot);
      this.readCache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, rows }); return rows;
    } catch { return []; }
  }
  appendContracts(rows: PaperTradeContract[]): void {
    if (rows.some((row) => !row.immutable || row.liveExecution !== 'locked')) throw new Error('ECONOMIC_STORE_CONTRACT_NOT_SAFE');
    const versions: StrategyVersion[] = rows.map((row) => ({ id: row.strategyVersionId, schemaVersion: 1,
      strategyFamilyId: row.strategyFamilyId, mechanism: row.mechanism, parameterGrammar: row.trigger,
      universeVersionId: row.provenance.universeVersionId, costModel: row.costs, riskPolicy: row.riskLimits,
      softwareVersion: row.provenance.sourceVersion, immutable: true }));
    appendUnique(this.strategyVersionsFile, versions, this.quarantineRoot);
    appendUnique(this.contractsFile, rows, this.quarantineRoot);
  }
  readStrategyVersions(): StrategyVersion[] { return this.read(this.strategyVersionsFile); }
  appendLifecycleEvents(rows: PaperTradeLifecycleEvent[]): void {
    const contracts = new Map(this.readContracts().map((row) => [row.id, row]));
    const existing = this.readLifecycleEvents();
    const knownIds = new Set(existing.map((row) => row.id));
    for (const row of rows) {
      if (knownIds.has(row.id)) continue;
      if (!contracts.has(row.contractId)) throw new Error(`ECONOMIC_STORE_ORPHAN_LIFECYCLE:${row.contractId}`);
      if (row.liveExecution !== 'locked' || NEXT[row.from] !== row.to) throw new Error('ECONOMIC_STORE_INVALID_LIFECYCLE_TRANSITION');
      const current = this.currentState(row.contractId, existing);
      if (current !== row.from) throw new Error(`ECONOMIC_STORE_STALE_LIFECYCLE:${current}:${row.from}`);
      existing.push(row); knownIds.add(row.id);
    }
    appendUnique(this.lifecycleFile, rows, this.quarantineRoot);
  }
  readContracts(): PaperTradeContract[] { return this.read(this.contractsFile); }
  readLifecycleEvents(): PaperTradeLifecycleEvent[] { return this.read(this.lifecycleFile); }
  appendKillEvents(rows: PaperTradeKillEvent[]): void {
    const contractIds = new Set(this.readContracts().map((row) => row.id));
    if (rows.some((row) => !contractIds.has(row.contractId) || row.liveExecution !== 'locked')) {
      throw new Error('ECONOMIC_STORE_INVALID_KILL_EVENT');
    }
    appendUnique(this.killEventsFile, rows, this.quarantineRoot);
  }
  readKillEvents(): PaperTradeKillEvent[] { return this.read(this.killEventsFile); }
  appendShadowDecisions(rows: FastShadowDecision[]): void {
    const contractIds = new Set(this.readContracts().map((row) => row.id));
    if (rows.some((row) => !contractIds.has(row.contractId) || row.liveExecution !== 'locked'
      || row.recordedAt < row.evidenceCutoffAt || row.expiresAt <= row.recordedAt
      || (row.evidenceMode === 'paper_forward' && row.decisionLagMs < 0))) {
      throw new Error('ECONOMIC_STORE_INVALID_SHADOW_DECISION');
    }
    appendUnique(this.shadowDecisionsFile, rows, this.quarantineRoot);
  }
  appendShadowOutcomes(rows: FastShadowOutcome[]): void {
    const decisionIds = new Set(this.readShadowDecisions().map((row) => row.id));
    if (rows.some((row) => !decisionIds.has(row.decisionId) || row.liveExecution !== 'locked'
      || Math.abs(row.navAfterUsd - (row.navBeforeUsd + row.netPnlUsd)) > 1e-6
      || (row.promotable && (row.evidenceMode !== 'paper_forward' || !row.timingValid)))) {
      throw new Error('ECONOMIC_STORE_INVALID_SHADOW_OUTCOME');
    }
    appendUnique(this.shadowOutcomesFile, rows, this.quarantineRoot);
  }
  readShadowDecisions(): FastShadowDecision[] { return this.read(this.shadowDecisionsFile); }
  readShadowOutcomes(): FastShadowOutcome[] { return this.read(this.shadowOutcomesFile); }
  currentState(contractId: string, events = this.readLifecycleEvents()): PaperLifecycleState {
    return events.filter((row) => row.contractId === contractId && row.passed)
      .sort((left, right) => left.evaluatedAt - right.evaluatedAt || left.id.localeCompare(right.id))
      .at(-1)?.to ?? 'research_candidate';
  }
  snapshot(now = Date.now()) {
    const contracts = this.readContracts(); const strategyVersions = this.readStrategyVersions();
    const lifecycleEvents = this.readLifecycleEvents(); const killEvents = this.readKillEvents();
    const shadowDecisions = this.readShadowDecisions(); const shadowOutcomes = this.readShadowOutcomes();
    const contractIds = new Set(contracts.map((row) => row.id));
    const outcomeDecisionIds = new Set(shadowOutcomes.map((row) => row.decisionId));
    const openDecisions = shadowDecisions.filter((row) => !outcomeDecisionIds.has(row.id));
    const invalidContractIds = contracts.filter((row) => !row.immutable || row.liveExecution !== 'locked'
      || Math.abs(row.costs.totalBps - Object.entries(row.costs).filter(([key]) => key !== 'totalBps')
        .reduce((sum, [, value]) => sum + value, 0)) > 1e-9).map((row) => row.id);
    const legacyObjectivePolicyContractIds = contracts.filter((row) => row.objectivePolicyId !== ECONOMIC_OBJECTIVE_POLICY.id)
      .map((row) => row.id);
    const orphanLifecycleEventIds = lifecycleEvents.filter((row) => !contractIds.has(row.contractId)).map((row) => row.id);
    const latestByLineage = new Map<string, PaperTradeContract>();
    const stateRank: Record<PaperLifecycleState, number> = { research_candidate: 0, shadow_paper: 1, funded_paper: 2, live_review: 3 };
    for (const contract of contracts.filter((row) => row.objectivePolicyId === ECONOMIC_OBJECTIVE_POLICY.id)) {
      const mechanismFamily = contract.strategyFamilyId.split(':')[0];
      const lineage = `${mechanismFamily}|${contract.speedTier}|${contract.instrument}|${contract.venue}|${contract.executionPolicy}`;
      const prior = latestByLineage.get(lineage);
      const state = this.currentState(contract.id, lifecycleEvents); const priorState = prior ? this.currentState(prior.id, lifecycleEvents) : null;
      if (!prior || stateRank[state] > stateRank[priorState!]
        || (stateRank[state] === stateRank[priorState!] && (contract.evidenceCutoffAt > prior.evidenceCutoffAt
          || (contract.evidenceCutoffAt === prior.evidenceCutoffAt && contract.id > prior.id)))) latestByLineage.set(lineage, contract);
    }
    const activeContracts = [...latestByLineage.values()];
    const activeContractIds = new Set(activeContracts.map((row) => row.id));
    const current = rankPaperTradeContracts(activeContracts).map((contract) => ({ contract,
      currentState: this.currentState(contract.id, lifecycleEvents),
      killed: killEvents.some((row) => row.contractId === contract.id && row.triggered)
        || lifecycleEvents.some((row) => row.contractId === contract.id
          && row.blockers.some((blocker) => blocker.includes('KILL_RULE_TRIGGERED'))),
      latestLifecycleEvent: lifecycleEvents.filter((row) => row.contractId === contract.id)
        .sort((left, right) => right.evaluatedAt - left.evaluatedAt)[0] ?? null }));
    const stateCounts = current.reduce<Record<PaperLifecycleState, number>>((counts, row) => {
      counts[row.currentState]++; return counts;
    }, { research_candidate: 0, shadow_paper: 0, funded_paper: 0, live_review: 0 });
    const speedTierCounts = current.reduce<Record<PaperTradeContract['speedTier'], number>>((counts, row) => {
      counts[row.contract.speedTier]++; return counts;
    }, { microstructure: 0, fast_event: 0, research: 0 });
    return { mode: 'Paper money', objectivePolicy: ECONOMIC_OBJECTIVE_POLICY, counts: {
      strategyVersions: strategyVersions.length, contracts: contracts.length, activeContracts: activeContracts.length,
      supersededContracts: contracts.length - activeContracts.length,
      lifecycleEvents: lifecycleEvents.length, killEvents: killEvents.length,
      shadowDecisions: shadowDecisions.length,
      shadowOutcomes: shadowOutcomes.length, shadowFilled: shadowOutcomes.filter((row) => row.status === 'filled' || row.status === 'partial').length,
      openDecisions: openDecisions.length, expiredOpenDecisions: openDecisions.filter((row) => row.expiresAt <= now).length,
      contractsCreatedLast24h: contracts.filter((row) => row.createdAt >= now - 86_400_000 && row.createdAt <= now).length,
      historicalReplayOutcomes: shadowOutcomes.filter((row) => row.evidenceMode === 'historical_replay').length,
      canaryOutcomes: shadowOutcomes.filter((row) => row.evidenceMode === 'canary').length,
      paperForwardOutcomes: shadowOutcomes.filter((row) => row.evidenceMode === 'paper_forward').length,
      promotableOutcomes: shadowOutcomes.filter((row) => row.promotable).length,
      counterfactualOutcomes: shadowOutcomes.filter((row) => !row.promotable && row.status !== 'unresolved').length,
      rejectedOutcomes: shadowOutcomes.filter((row) => row.status === 'risk_rejected').length,
      unresolvedOutcomes: shadowOutcomes.filter((row) => row.status === 'unresolved').length,
      shadowNetPnlUsd: shadowOutcomes.reduce((sum, row) => sum + row.netPnlUsd, 0),
      killed: current.filter((row) => row.killed).length, ...speedTierCounts, ...stateCounts }, current,
      topEconomicCandidates: current.slice(0, 20),
      recentShadowDecisions: shadowDecisions.slice(-50).reverse(), recentShadowOutcomes: shadowOutcomes.slice(-50).reverse(),
      integrity: { invalidContractIds, orphanLifecycleEventIds, legacyObjectivePolicyContractIds,
        missingStrategyVersionContractIds: contracts.filter((row) => !strategyVersions.some((version) => version.id === row.strategyVersionId))
          .map((row) => row.id),
        supersededContractIds: contracts.filter((row) => !activeContractIds.has(row.id)).map((row) => row.id),
        orphanKillEventIds: killEvents.filter((row) => !contractIds.has(row.contractId)).map((row) => row.id),
        orphanShadowDecisionIds: shadowDecisions.filter((row) => !contractIds.has(row.contractId)).map((row) => row.id),
        orphanShadowOutcomeIds: shadowOutcomes.filter((row) => !shadowDecisions.some((decision) => decision.id === row.decisionId)).map((row) => row.id),
        allLiveExecutionLocked: contracts.every((row) => row.liveExecution === 'locked')
          && lifecycleEvents.every((row) => row.liveExecution === 'locked')
          && killEvents.every((row) => row.liveExecution === 'locked')
          && shadowDecisions.every((row) => row.liveExecution === 'locked')
          && shadowOutcomes.every((row) => row.liveExecution === 'locked') }, liveExecution: 'locked' as const };
  }
}
