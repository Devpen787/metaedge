import fs from 'node:fs';
import path from 'node:path';
import type { PaperLifecycleState, PaperTradeContract, PaperTradeLifecycleEvent } from './economic_types.js';
import { ECONOMIC_OBJECTIVE_POLICY, rankPaperTradeContracts } from './economic_runtime.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); }
  catch { return []; }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

const NEXT: Record<PaperLifecycleState, PaperLifecycleState | null> = {
  research_candidate: 'shadow_paper', shadow_paper: 'funded_paper', funded_paper: 'live_review', live_review: null,
};

export class EconomicOperationStore {
  private readonly contractsFile: string;
  private readonly lifecycleFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'economics')) {
    this.contractsFile = path.join(root, 'paper-trade-contracts.jsonl');
    this.lifecycleFile = path.join(root, 'lifecycle-events.jsonl');
  }
  appendContracts(rows: PaperTradeContract[]): void {
    if (rows.some((row) => !row.immutable || row.liveExecution !== 'locked')) throw new Error('ECONOMIC_STORE_CONTRACT_NOT_SAFE');
    appendUnique(this.contractsFile, rows);
  }
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
    appendUnique(this.lifecycleFile, rows);
  }
  readContracts(): PaperTradeContract[] { return readJsonl(this.contractsFile); }
  readLifecycleEvents(): PaperTradeLifecycleEvent[] { return readJsonl(this.lifecycleFile); }
  currentState(contractId: string, events = this.readLifecycleEvents()): PaperLifecycleState {
    return events.filter((row) => row.contractId === contractId && row.passed)
      .sort((left, right) => left.evaluatedAt - right.evaluatedAt || left.id.localeCompare(right.id))
      .at(-1)?.to ?? 'research_candidate';
  }
  snapshot() {
    const contracts = this.readContracts(); const lifecycleEvents = this.readLifecycleEvents();
    const contractIds = new Set(contracts.map((row) => row.id));
    const invalidContractIds = contracts.filter((row) => !row.immutable || row.liveExecution !== 'locked'
      || row.objectivePolicyId !== ECONOMIC_OBJECTIVE_POLICY.id
      || Math.abs(row.costs.totalBps - Object.entries(row.costs).filter(([key]) => key !== 'totalBps')
        .reduce((sum, [, value]) => sum + value, 0)) > 1e-9).map((row) => row.id);
    const orphanLifecycleEventIds = lifecycleEvents.filter((row) => !contractIds.has(row.contractId)).map((row) => row.id);
    const current = rankPaperTradeContracts(contracts).map((contract) => ({ contract,
      currentState: this.currentState(contract.id, lifecycleEvents),
      latestLifecycleEvent: lifecycleEvents.filter((row) => row.contractId === contract.id)
        .sort((left, right) => right.evaluatedAt - left.evaluatedAt)[0] ?? null }));
    const stateCounts = current.reduce<Record<PaperLifecycleState, number>>((counts, row) => {
      counts[row.currentState]++; return counts;
    }, { research_candidate: 0, shadow_paper: 0, funded_paper: 0, live_review: 0 });
    return { mode: 'Paper money', objectivePolicy: ECONOMIC_OBJECTIVE_POLICY, counts: {
      contracts: contracts.length, lifecycleEvents: lifecycleEvents.length, ...stateCounts }, current,
      topEconomicCandidates: current.slice(0, 20),
      integrity: { invalidContractIds, orphanLifecycleEventIds,
        allLiveExecutionLocked: contracts.every((row) => row.liveExecution === 'locked')
          && lifecycleEvents.every((row) => row.liveExecution === 'locked') }, liveExecution: 'locked' as const };
  }
}
