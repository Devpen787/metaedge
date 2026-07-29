import fs from 'node:fs';
import path from 'node:path';
import type { ForwardQuarantineEnrollment, LockboxEvaluation, ResearchLockbox } from './validation_types.js';
import { VALIDATION_POLICY_VERSION } from './validation_runtime.js';
import { SIGNAL_RESEARCH_POLICY_VERSION } from './signal_research.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}
function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class ValidationStore {
  private readonly lockboxesFile: string;
  private readonly evaluationsFile: string;
  private readonly quarantineFile: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'validation')) {
    this.lockboxesFile = path.join(root, 'lockboxes.jsonl');
    this.evaluationsFile = path.join(root, 'evaluations.jsonl');
    this.quarantineFile = path.join(root, 'forward-quarantine.jsonl');
  }
  appendLockboxes(rows: ResearchLockbox[]): void { appendUnique(this.lockboxesFile, rows); }
  appendEvaluations(rows: LockboxEvaluation[]): void {
    const existing = this.readEvaluations();
    const evaluationByLockbox = new Map(existing.map((row) => [row.lockboxId, row]));
    for (const row of rows) {
      const prior = evaluationByLockbox.get(row.lockboxId);
      if (prior && prior.id !== row.id) throw new Error(`LOCKBOX_ALREADY_EVALUATED:${row.lockboxId}`);
      evaluationByLockbox.set(row.lockboxId, row);
    }
    appendUnique(this.evaluationsFile, rows);
  }
  appendForwardQuarantines(rows: ForwardQuarantineEnrollment[]): void { appendUnique(this.quarantineFile, rows); }
  readLockboxes(): ResearchLockbox[] { return readJsonl(this.lockboxesFile); }
  readEvaluations(): LockboxEvaluation[] { return readJsonl(this.evaluationsFile); }
  readForwardQuarantines(): ForwardQuarantineEnrollment[] { return readJsonl(this.quarantineFile); }
  readActiveCurrentPolicyEvaluations(): LockboxEvaluation[] {
    const lockboxes = this.readLockboxes(); const evaluations = this.readEvaluations();
    const latestByFamily = new Map<string, ResearchLockbox>();
    for (const lockbox of lockboxes) {
      if (lockbox.validationPolicyVersion !== VALIDATION_POLICY_VERSION
        || lockbox.signalResearchPolicyVersion !== SIGNAL_RESEARCH_POLICY_VERSION) continue;
      const prior = latestByFamily.get(lockbox.familyId);
      if (!prior || lockbox.sealedAt >= prior.sealedAt) latestByFamily.set(lockbox.familyId, lockbox);
    }
    const activeLockboxIds = new Set([...latestByFamily.values()].map((row) => row.id));
    return evaluations.filter((row) => activeLockboxIds.has(row.lockboxId));
  }
  snapshot() {
    const lockboxes = this.readLockboxes(); const evaluations = this.readEvaluations();
    const forwardQuarantines = this.readForwardQuarantines(); const lockboxIds = new Set(lockboxes.map((row) => row.id));
    const evaluationIds = new Set(evaluations.map((row) => row.id));
    const evaluationCounts = evaluations.reduce((counts, row) => counts.set(row.lockboxId, (counts.get(row.lockboxId) ?? 0) + 1), new Map<string, number>());
    const legacyUnversionedLockboxIds = lockboxes.filter((row) => !row.validationPolicyVersion).map((row) => row.id);
    const legacyUnversionedSignalPolicyLockboxIds = lockboxes.filter((row) => !row.signalResearchPolicyVersion).map((row) => row.id);
    const invalidLockboxIds = lockboxes.filter((row) => !row.immutable || row.evaluationLimit !== 1
      || row.totalDeclaredTrials > row.maximumTrialBudget).map((row) => row.id);
    const orphanEvaluationIds = evaluations.filter((row) => !lockboxIds.has(row.lockboxId)).map((row) => row.id);
    const multiplyEvaluatedLockboxIds = [...evaluationCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    const orphanForwardQuarantineIds = forwardQuarantines.filter((row) => !evaluationIds.has(row.lockboxEvaluationId)).map((row) => row.id);
    const lockboxesById = new Map(lockboxes.map((row) => [row.id, row]));
    const allCurrentPolicyEvaluations = evaluations.filter((row) =>
      lockboxesById.get(row.lockboxId)?.validationPolicyVersion === VALIDATION_POLICY_VERSION
      && lockboxesById.get(row.lockboxId)?.signalResearchPolicyVersion === SIGNAL_RESEARCH_POLICY_VERSION);
    const currentPolicyEvaluations = this.readActiveCurrentPolicyEvaluations();
    const activeEvaluationIds = new Set(currentPolicyEvaluations.map((row) => row.id));
    const supersededCurrentPolicyEvaluationIds = allCurrentPolicyEvaluations.filter((row) => !activeEvaluationIds.has(row.id))
      .map((row) => row.id);
    return { mode: 'Paper research', lockboxes, evaluations, forwardQuarantines,
      counts: { lockboxes: lockboxes.length, evaluations: evaluations.length, forwardQuarantines: forwardQuarantines.length },
      operatorSummary: { forwardCandidates: evaluations.filter((row) => row.disposition === 'forward_candidate').length,
        declined: evaluations.filter((row) => row.disposition === 'declined').length,
        blocked: evaluations.filter((row) => row.disposition === 'blocked').length,
        totalChargedTrials: evaluations.reduce((sum, row) => sum + row.totalChargedTrials, 0) },
      currentPolicy: { validationVersion: VALIDATION_POLICY_VERSION, signalResearchVersion: SIGNAL_RESEARCH_POLICY_VERSION,
        evaluations: currentPolicyEvaluations.length,
        supersededEvaluations: supersededCurrentPolicyEvaluationIds.length,
        forwardCandidates: currentPolicyEvaluations.filter((row) => row.disposition === 'forward_candidate').length,
        declined: currentPolicyEvaluations.filter((row) => row.disposition === 'declined').length,
        blocked: currentPolicyEvaluations.filter((row) => row.disposition === 'blocked').length,
        totalChargedTrials: currentPolicyEvaluations.reduce((sum, row) => sum + row.totalChargedTrials, 0) },
      integrity: { invalidLockboxIds, legacyUnversionedLockboxIds, legacyUnversionedSignalPolicyLockboxIds,
        supersededCurrentPolicyEvaluationIds, orphanEvaluationIds, multiplyEvaluatedLockboxIds, orphanForwardQuarantineIds,
        allLiveExecutionLocked: [...lockboxes, ...evaluations, ...forwardQuarantines]
          .every((row) => row.liveExecution === 'locked') }, liveExecution: 'locked' as const };
  }
}
