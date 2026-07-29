import fs from 'node:fs';
import path from 'node:path';
import type { PortfolioExecutionAuditRecord } from './portfolio_operation_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}
function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true }); const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class PortfolioOperationStore {
  private readonly auditsFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'portfolio-execution')) {
    this.auditsFile = path.join(root, 'audits.jsonl');
  }
  appendAudits(rows: PortfolioExecutionAuditRecord[]): void { appendUnique(this.auditsFile, rows); }
  readAudits(): PortfolioExecutionAuditRecord[] { return readJsonl(this.auditsFile); }
  snapshot() {
    const audits = this.readAudits(); const latest = audits.at(-1) ?? null;
    const invalidAuditIds = audits.filter((audit) => audit.liveExecution !== 'locked'
      || (audit.weightSimulation?.maximumInvariantErrorUsd ?? 0) > 1e-6
      || (audit.orderSimulation?.maximumInvariantErrorUsd ?? 0) > 1e-6
      || (audit.targetPortfolio != null && audit.targetPortfolio.liveExecution !== 'locked')
      || (audit.weightSimulation != null && audit.weightSimulation.liveExecution !== 'locked')
      || (audit.orderSimulation != null && audit.orderSimulation.liveExecution !== 'locked')).map((audit) => audit.id);
    return { mode: 'Paper research', counts: { audits: audits.length }, latest,
      integrity: { invalidAuditIds, allLiveExecutionLocked: audits.every((audit) => audit.liveExecution === 'locked') },
      liveExecution: 'locked' as const };
  }
}
