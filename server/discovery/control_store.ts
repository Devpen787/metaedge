import fs from 'node:fs';
import path from 'node:path';
import { contentHash } from './store.js';
import type { HumanGateApproval, HumanGateConsumption, ResearchEscalation, ResearchLock, ResearchLoopRun, ResearchLoopState } from './control_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); }
  catch { return []; }
}

function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function atomicJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

function resourcesOverlap(left: string[], right: string[]): boolean {
  return left.some((a) => right.some((b) => a === b || a === '*' || b === '*' ||
    a.endsWith('/**') && b.startsWith(a.slice(0, -3)) || b.endsWith('/**') && a.startsWith(b.slice(0, -3))));
}

export class FlywheelControlStore {
  private readonly runsFile: string;
  private readonly escalationsFile: string;
  private readonly stateFile: string;
  private readonly lockDirectory: string;
  private readonly humanApprovalsFile: string;
  private readonly humanConsumptionsFile: string;

  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'control')) {
    this.runsFile = path.join(root, 'run-log.jsonl');
    this.escalationsFile = path.join(root, 'escalations.jsonl');
    this.stateFile = path.join(root, 'state.json');
    this.lockDirectory = path.join(root, 'locks');
    this.humanApprovalsFile = path.join(root, 'human-approvals.jsonl');
    this.humanConsumptionsFile = path.join(root, 'human-approval-consumptions.jsonl');
  }

  readRuns(): ResearchLoopRun[] { return readJsonl(this.runsFile); }
  appendRuns(rows: ResearchLoopRun[]): void { appendUnique(this.runsFile, rows); }
  readEscalations(): ResearchEscalation[] { return readJsonl(this.escalationsFile); }
  appendEscalations(rows: ResearchEscalation[]): void { appendUnique(this.escalationsFile, rows); }
  readState(): ResearchLoopState | null {
    try { return JSON.parse(fs.readFileSync(this.stateFile, 'utf8')) as ResearchLoopState; } catch { return null; }
  }
  writeState(state: ResearchLoopState): void { atomicJson(this.stateFile, state); }
  readHumanApprovals(): HumanGateApproval[] { return readJsonl(this.humanApprovalsFile); }
  appendHumanApprovals(rows: HumanGateApproval[]): void { appendUnique(this.humanApprovalsFile, rows); }
  readHumanConsumptions(): HumanGateConsumption[] { return readJsonl(this.humanConsumptionsFile); }
  appendHumanConsumptions(rows: HumanGateConsumption[]): void { appendUnique(this.humanConsumptionsFile, rows); }
  makeHumanApproval(input: Omit<HumanGateApproval, 'id' | 'grantedBy' | 'liveExecution'>): HumanGateApproval {
    return { id: `human_approval_${contentHash(input).slice(0, 20)}`, ...input, grantedBy: 'human', liveExecution: 'locked' };
  }
  availableHumanApproval(input: { approvalId: string; loopId: HumanGateApproval['loopId']; gate: string;
    evidenceFingerprint: string; now: number }): HumanGateApproval | null {
    const approval = this.readHumanApprovals().find((row) => row.id === input.approvalId) ?? null;
    if (!approval || approval.loopId !== input.loopId || approval.gate !== input.gate
      || approval.evidenceFingerprint !== input.evidenceFingerprint || approval.grantedAt > input.now
      || approval.expiresAt <= input.now || this.readHumanConsumptions().some((row) => row.approvalId === approval.id)) return null;
    return approval;
  }
  consumeHumanApproval(approval: HumanGateApproval, consumedAt: number): HumanGateConsumption {
    const identity = { approvalId: approval.id, loopId: approval.loopId, gate: approval.gate,
      evidenceFingerprint: approval.evidenceFingerprint, consumedAt };
    const consumption = { id: `human_consumption_${contentHash(identity).slice(0, 20)}`, ...identity,
      liveExecution: 'locked' as const };
    this.appendHumanConsumptions([consumption]); return consumption;
  }

  listLocks(now = Date.now()): ResearchLock[] {
    try {
      return fs.readdirSync(this.lockDirectory).filter((file) => file.endsWith('.json')).flatMap((file) => {
        try {
          const lock = JSON.parse(fs.readFileSync(path.join(this.lockDirectory, file), 'utf8')) as ResearchLock;
          return lock.expiresAt > now ? [lock] : [];
        } catch { return []; }
      });
    } catch { return []; }
  }

  acquireLock(lock: ResearchLock): { acquired: boolean; blocker: ResearchLock | null } {
    fs.mkdirSync(this.lockDirectory, { recursive: true });
    const blocker = this.listLocks(lock.acquiredAt).find((existing) =>
      resourcesOverlap(existing.resources, lock.resources)) ?? null;
    if (blocker) return { acquired: false, blocker };
    const file = path.join(this.lockDirectory, `${lock.owner}.json`);
    atomicJson(file, lock);
    return { acquired: true, blocker: null };
  }

  releaseLock(owner: ResearchLock['owner']): void {
    try { fs.unlinkSync(path.join(this.lockDirectory, `${owner}.json`)); } catch { /* already released */ }
  }

  makeRun(input: Omit<ResearchLoopRun, 'id' | 'liveExecution'>): ResearchLoopRun {
    const id = `loop_run_${contentHash(input).slice(0, 20)}`;
    return { id, ...input, liveExecution: 'locked' };
  }

  makeEscalation(input: Omit<ResearchEscalation, 'id' | 'liveExecution'>): ResearchEscalation {
    const id = `escalation_${contentHash(input).slice(0, 20)}`;
    return { id, ...input, liveExecution: 'locked' };
  }
}
