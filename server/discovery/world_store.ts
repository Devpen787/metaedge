import fs from 'node:fs';
import path from 'node:path';
import { contentHash } from './store.js';
import type { WorldContract, WorldEvent, WorldParityAudit } from './world_types.js';

function readJsonl<T>(file: string): T[] {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => {
    if (known.has(row.id)) return false;
    known.add(row.id);
    return true;
  });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function expectedContractId(contract: WorldContract): string {
  const { id: _id, ...base } = contract;
  return `world_contract_${contentHash(base).slice(0, 20)}`;
}

export class WorldStore {
  private readonly contractsFile: string;
  private readonly eventsFile: string;
  private readonly auditsFile: string;

  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'world')) {
    this.contractsFile = path.join(root, 'contracts.jsonl');
    this.eventsFile = path.join(root, 'events.jsonl');
    this.auditsFile = path.join(root, 'parity-audits.jsonl');
  }

  appendContracts(rows: WorldContract[]): void { appendUnique(this.contractsFile, rows); }
  appendEvents(rows: WorldEvent[]): void { appendUnique(this.eventsFile, rows); }
  appendAudits(rows: WorldParityAudit[]): void { appendUnique(this.auditsFile, rows); }
  readContracts(): WorldContract[] { return readJsonl(this.contractsFile); }
  readEvents(): WorldEvent[] { return readJsonl(this.eventsFile); }
  readAudits(): WorldParityAudit[] { return readJsonl(this.auditsFile); }

  snapshot() {
    const contracts = this.readContracts();
    const events = this.readEvents();
    const audits = this.readAudits();
    const contractIds = new Set(contracts.map((contract) => contract.id));
    const invalidContractIds = contracts.filter((contract) => expectedContractId(contract) !== contract.id)
      .map((contract) => contract.id);
    const invalidEventIds = events.filter((event) => contentHash(event.payload) !== event.payloadHash)
      .map((event) => event.id);
    const orphanAuditIds = audits.filter((audit) => !contractIds.has(audit.contractId)).map((audit) => audit.id);
    const divergentAuditIds = audits.filter((audit) => audit.parityStatus !== 'pass'
      || audit.historicalTrace.contractId !== audit.contractId
      || audit.paperTrace.contractId !== audit.contractId
      || audit.historicalTrace.parityHash !== audit.paperTrace.parityHash).map((audit) => audit.id);
    return {
      mode: 'Paper research',
      counts: { contracts: contracts.length, events: events.length, parityAudits: audits.length },
      contracts,
      latestAudit: audits.at(-1) ?? null,
      recentAudits: audits.slice(-20).reverse(),
      integrity: {
        invalidContractIds,
        invalidEventIds,
        orphanAuditIds,
        divergentAuditIds,
        allLiveExecutionLocked: [...contracts, ...events, ...audits].every((row) => row.liveExecution === 'locked'),
      },
      liveExecution: 'locked' as const,
    };
  }
}
