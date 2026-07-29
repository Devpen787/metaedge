import { DataWorldStore } from '../server/discovery/data_world_store.js';
import type { DatasetVersion } from '../server/discovery/data_world_types.js';
import {
  assessDatasetDrift, attributeForwardObservation, evaluateForwardLifecycle, FORWARD_LEARNING_POLICY_VERSION,
} from '../server/discovery/forward_learning_runtime.js';
import { ForwardLearningStore } from '../server/discovery/forward_learning_store.js';
import type { ForwardLearningAuditRecord } from '../server/discovery/forward_learning_types.js';
import { contentHash } from '../server/discovery/store.js';
import { ValidationStore } from '../server/discovery/validation_store.js';

function datasetFeatures(version: DatasetVersion): Record<string, Array<number | null>> {
  return {
    file_bytes: version.files.map((file) => file.bytes),
    file_records: version.files.map((file) => file.records),
    event_span_ms: version.files.map((file) => file.minEventTime != null && file.maxEventTime != null
      ? file.maxEventTime - file.minEventTime : null),
    quarantine_indicator: version.files.map((file) => file.status === 'quarantined' ? 1 : 0),
  };
}

const validation = new ValidationStore();
const lockboxes = new Map(validation.readLockboxes().map((row) => [row.id, row]));
const currentEvaluations = validation.readActiveCurrentPolicyEvaluations();
const candidates = currentEvaluations.filter((row) => row.disposition === 'forward_candidate');
const enrollments = validation.readForwardQuarantines().filter((row) =>
  candidates.some((evaluation) => evaluation.id === row.lockboxEvaluationId));
const enrollmentByEvaluation = new Map(enrollments.map((row) => [row.lockboxEvaluationId, row]));
const data = new DataWorldStore().snapshot();
const datasetById = new Map(data.datasetVersions.map((row) => [row.id, row]));
const latestDataset = data.latestDatasetVersion;
const store = new ForwardLearningStore();

const existingObservations = store.readObservations();
const attributions = existingObservations.flatMap((observation) => {
  const row = attributeForwardObservation(observation); return row ? [row] : [];
});
store.appendAttributions(attributions);

const driftAssessments = candidates.flatMap((evaluation) => {
  const lockbox = lockboxes.get(evaluation.lockboxId);
  const reference = lockbox ? datasetById.get(lockbox.datasetVersionId) : undefined;
  if (!lockbox || !reference || !latestDataset) return [];
  return [assessDatasetDrift({ lockboxEvaluationId: evaluation.id, measuredAt: latestDataset.createdAt,
    referenceDatasetVersionId: reference.id, currentDatasetVersionId: latestDataset.id,
    referenceSourceAuthority: reference.source, currentSourceAuthority: latestDataset.source,
    referenceFeatures: datasetFeatures(reference), currentFeatures: datasetFeatures(latestDataset) })];
});
store.appendDriftAssessments(driftAssessments);
const driftByEvaluation = new Map(driftAssessments.map((row) => [row.lockboxEvaluationId, row]));

const lifecycleResults = currentEvaluations.map((evaluation) => evaluateForwardLifecycle({ evaluation,
  enrollment: enrollmentByEvaluation.get(evaluation.id) ?? null,
  attributions: store.readAttributions(), drift: driftByEvaluation.get(evaluation.id) ?? null }));
store.appendLifecycleDecisions(lifecycleResults.map((row) => row.decision));
store.appendResearchQueue(lifecycleResults.flatMap((row) => row.researchQueue));

const blockers: string[] = [];
if (!candidates.length) blockers.push('NO_FORWARD_CANDIDATE_EVALUATIONS', 'UNTOUCHED_FORWARD_LEARNING_WITHHELD');
if (candidates.length && enrollments.length !== candidates.length) blockers.push('FORWARD_QUARANTINE_ENROLLMENT_MISSING');
const admittedEvaluationIds = new Set(candidates.map((row) => row.id));
const admittedObservations = store.readObservations().filter((row) => admittedEvaluationIds.has(row.lockboxEvaluationId));
if (candidates.length && !admittedObservations.length) blockers.push('POST_CUTOFF_FORWARD_OBSERVATIONS_NOT_YET_AVAILABLE');
const status: ForwardLearningAuditRecord['status'] = !candidates.length || enrollments.length !== candidates.length
  ? 'blocked' : admittedObservations.length ? 'operational' : 'collecting';
const identity = { forwardLearningPolicyVersion: FORWARD_LEARNING_POLICY_VERSION,
  sourceEvaluationIds: currentEvaluations.map((row) => row.id).sort(),
  sourceEnrollmentIds: enrollments.map((row) => row.id).sort(),
  observationIds: admittedObservations.map((row) => row.id).sort(),
  attributionIds: attributions.map((row) => row.id).sort(), driftAssessmentIds: driftAssessments.map((row) => row.id).sort(),
  lifecycleDecisionIds: lifecycleResults.map((row) => row.decision.id).sort(),
  researchQueueItemIds: lifecycleResults.flatMap((row) => row.researchQueue).map((row) => row.id).sort(), status, blockers };
const createdAt = Math.max(0, ...currentEvaluations.map((row) => row.evaluatedAt),
  ...enrollments.map((row) => row.enrolledAt), ...admittedObservations.map((row) => row.resolvedAt),
  ...driftAssessments.map((row) => row.measuredAt));
const auditIdentity = { ...identity, createdAt };
const audit: ForwardLearningAuditRecord = { id: `forward_learning_audit_${contentHash(auditIdentity).slice(0, 20)}`,
  schemaVersion: 1, ...identity, createdAt, liveExecution: 'locked' };
store.appendAudits([audit]);
const snapshot = store.snapshot();
const integrityFailed = Object.entries(snapshot.integrity).some(([key, value]) =>
  key === 'allLiveExecutionLocked' ? value !== true : Array.isArray(value) && value.length > 0);
console.log(JSON.stringify({ status: integrityFailed ? 'fail' : 'pass', auditStatus: audit.status,
  currentValidationEvaluations: currentEvaluations.length, forwardCandidateEvaluations: candidates.length,
  forwardEnrollments: enrollments.length, admittedObservations: admittedObservations.length,
  attributions: attributions.length, driftAssessments: driftAssessments.length,
  lifecycle: lifecycleResults.map((row) => ({ evaluationId: row.decision.lockboxEvaluationId,
    state: row.decision.state, resolvedObservations: row.decision.resolvedObservations,
    action: row.decision.action, reasons: row.decision.reasons })), blockers,
  operatorSummary: snapshot.operatorSummary, integrity: snapshot.integrity,
  liveExecution: snapshot.liveExecution }, null, 2));
