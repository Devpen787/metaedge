import fs from 'node:fs';
import path from 'node:path';
import { contentHash } from './store.js';
import type {
  DatasetDriftAssessment, ForwardAttributionRecord, ForwardEvidenceObservation, ForwardLearningAuditRecord,
  ForwardLifecycleDecision, ForwardResearchQueueItem,
} from './forward_learning_types.js';

function readJsonl<T>(file: string): T[] {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; }
}

function appendImmutable<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = new Map(readJsonl<T>(file).map((row) => [row.id, row]));
  const fresh: T[] = [];
  for (const row of rows) {
    const prior = existing.get(row.id);
    if (prior && contentHash(prior) !== contentHash(row)) throw new Error(`IMMUTABLE_FORWARD_ID_COLLISION:${row.id}`);
    if (!prior) { existing.set(row.id, row); fresh.push(row); }
  }
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class ForwardLearningStore {
  private readonly observationsFile: string;
  private readonly attributionsFile: string;
  private readonly driftFile: string;
  private readonly lifecycleFile: string;
  private readonly researchQueueFile: string;
  private readonly auditsFile: string;

  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'forward-learning')) {
    this.observationsFile = path.join(root, 'observations.jsonl');
    this.attributionsFile = path.join(root, 'attributions.jsonl');
    this.driftFile = path.join(root, 'dataset-drift.jsonl');
    this.lifecycleFile = path.join(root, 'lifecycle.jsonl');
    this.researchQueueFile = path.join(root, 'research-queue.jsonl');
    this.auditsFile = path.join(root, 'audits.jsonl');
  }

  appendObservations(rows: ForwardEvidenceObservation[]): void { appendImmutable(this.observationsFile, rows); }
  appendAttributions(rows: ForwardAttributionRecord[]): void { appendImmutable(this.attributionsFile, rows); }
  appendDriftAssessments(rows: DatasetDriftAssessment[]): void { appendImmutable(this.driftFile, rows); }
  appendLifecycleDecisions(rows: ForwardLifecycleDecision[]): void { appendImmutable(this.lifecycleFile, rows); }
  appendResearchQueue(rows: ForwardResearchQueueItem[]): void { appendImmutable(this.researchQueueFile, rows); }
  appendAudits(rows: ForwardLearningAuditRecord[]): void { appendImmutable(this.auditsFile, rows); }
  readObservations(): ForwardEvidenceObservation[] { return readJsonl(this.observationsFile); }
  readAttributions(): ForwardAttributionRecord[] { return readJsonl(this.attributionsFile); }
  readDriftAssessments(): DatasetDriftAssessment[] { return readJsonl(this.driftFile); }
  readLifecycleDecisions(): ForwardLifecycleDecision[] { return readJsonl(this.lifecycleFile); }
  readResearchQueue(): ForwardResearchQueueItem[] { return readJsonl(this.researchQueueFile); }
  readAudits(): ForwardLearningAuditRecord[] { return readJsonl(this.auditsFile); }

  snapshot() {
    const observations = this.readObservations(); const attributions = this.readAttributions();
    const driftAssessments = this.readDriftAssessments(); const lifecycleDecisions = this.readLifecycleDecisions();
    const researchQueue = this.readResearchQueue(); const audits = this.readAudits();
    const observationIds = new Set(observations.map((row) => row.id));
    const lifecycleIds = new Set(lifecycleDecisions.map((row) => row.id));
    const latestAudit = audits.at(-1) ?? null;
    const activeEvaluationIds = new Set(latestAudit?.sourceEvaluationIds ?? []);
    const latestLifecycle = new Map<string, ForwardLifecycleDecision>();
    for (const decision of lifecycleDecisions) latestLifecycle.set(decision.lockboxEvaluationId, decision);
    const currentLifecycle = [...latestLifecycle.values()].filter((row) => activeEvaluationIds.has(row.lockboxEvaluationId))
      .sort((left, right) => left.lockboxEvaluationId.localeCompare(right.lockboxEvaluationId));
    const currentOpenResearchQueue = researchQueue.filter((row) => row.status === 'open'
      && activeEvaluationIds.has(row.sourceLockboxEvaluationId));
    const invalidObservationIds = observations.filter((row) => !row.immutable || row.liveExecution !== 'locked'
      || !(row.observedAt > row.evidenceCutoffAt) || row.resolvedAt < row.observedAt || !row.sourceEventIds.length
      || row.status === 'resolved' && row.blockers.length > 0).map((row) => row.id);
    const orphanAttributionIds = attributions.filter((row) => !observationIds.has(row.observationId)).map((row) => row.id);
    const invalidAttributionIds = attributions.filter((row) => row.liveExecution !== 'locked'
      || row.reconciliationErrorBps > 1e-6).map((row) => row.id);
    const invalidDriftAssessmentIds = driftAssessments.filter((row) => row.liveExecution !== 'locked'
      || !row.numericalGateNonOverridable || row.features.some((feature) =>
        feature.populationStabilityIndex != null && feature.populationStabilityIndex < 0)).map((row) => row.id);
    const invalidLifecycleDecisionIds = lifecycleDecisions.filter((row) => row.liveExecution !== 'locked'
      || !row.numericalGateNonOverridable || row.state === 'eligible_for_review'
        && (row.resolvedObservations < 30 || !(row.forwardNetLowerConfidenceBps != null && row.forwardNetLowerConfidenceBps > 0)))
      .map((row) => row.id);
    const orphanResearchQueueIds = researchQueue.filter((row) => !lifecycleIds.has(row.lifecycleDecisionId)).map((row) => row.id);
    const invalidResearchQueueIds = researchQueue.filter((row) => !row.requiresNewLockbox || row.liveExecution !== 'locked')
      .map((row) => row.id);
    const invalidAuditIds = audits.filter((row) => row.liveExecution !== 'locked').map((row) => row.id);
    const allLiveExecutionLocked = [...observations, ...attributions, ...driftAssessments, ...lifecycleDecisions,
      ...researchQueue, ...audits].every((row) => row.liveExecution === 'locked');
    return { mode: 'Paper research', counts: { observations: observations.length, attributions: attributions.length,
      driftAssessments: driftAssessments.length, lifecycleDecisions: lifecycleDecisions.length,
      researchQueue: researchQueue.length, audits: audits.length }, observations, attributions, driftAssessments,
      currentLifecycle, openResearchQueue: currentOpenResearchQueue, latestAudit,
      operatorSummary: { resolvedObservations: observations.filter((row) => row.status === 'resolved').length,
        attributedObservations: attributions.length,
        blocked: currentLifecycle.filter((row) => row.state === 'blocked').length,
        collecting: currentLifecycle.filter((row) => row.state === 'collecting' || row.state === 'paper_shadow').length,
        decaying: currentLifecycle.filter((row) => row.state === 'decaying').length,
        eligibleForReview: currentLifecycle.filter((row) => row.state === 'eligible_for_review').length,
        reResearch: currentLifecycle.filter((row) => row.state === 're_research').length,
        killed: currentLifecycle.filter((row) => row.state === 'killed').length,
        openResearchQueue: currentOpenResearchQueue.length },
      integrity: { invalidObservationIds, orphanAttributionIds, invalidAttributionIds, invalidDriftAssessmentIds,
        invalidLifecycleDecisionIds, orphanResearchQueueIds, invalidResearchQueueIds, invalidAuditIds,
        allLiveExecutionLocked }, liveExecution: 'locked' as const };
  }
}
