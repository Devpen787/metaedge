import { contentHash } from '../server/discovery/store.js';
import { SignalResearchStore } from '../server/discovery/signal_store.js';
import { SIGNAL_RESEARCH_POLICY_VERSION } from '../server/discovery/signal_research.js';
import {
  enrollUntouchedForward, evaluateResearchLockbox, sealResearchLockbox, VALIDATION_POLICY_VERSION,
} from '../server/discovery/validation_runtime.js';
import { ValidationStore } from '../server/discovery/validation_store.js';

const signalArtifacts = new SignalResearchStore().readArtifacts();
const current = new Map<string, (typeof signalArtifacts)[number]>();
for (const artifact of signalArtifacts) if (artifact.researchChoices?.length
  && artifact.researchPolicyVersion === SIGNAL_RESEARCH_POLICY_VERSION) current.set(`${artifact.lane}:${artifact.symbol}`, artifact);
if (!current.size) throw new Error('VALIDATION_AUDIT_REQUIRES_ACCOUNTED_SIGNAL_ARTIFACTS');
const store = new ValidationStore();
const existingLockboxes = store.readLockboxes();
const lockboxes = [...current.values()].map((artifact) => {
  const existing = existingLockboxes.find((row) => row.signalArtifactId === artifact.id
    && row.validationPolicyVersion === VALIDATION_POLICY_VERSION
    && row.signalResearchPolicyVersion === SIGNAL_RESEARCH_POLICY_VERSION);
  if (existing) return existing;
  const familyId = `signal_family_${contentHash({ lane: artifact.lane, symbol: artifact.symbol,
    benchmark: artifact.benchmark, mechanism: 'residualized_price_state' }).slice(0, 20)}`;
  const parent = existingLockboxes.filter((row) => row.familyId === familyId).at(-1);
  return sealResearchLockbox({ artifact, familyId, parentLockboxId: parent?.id ?? null, maximumTrialBudget: 100 });
});
store.appendLockboxes(lockboxes);
const evaluations = lockboxes.map((lockbox) => evaluateResearchLockbox({ lockbox,
  artifact: [...current.values()].find((artifact) => artifact.id === lockbox.signalArtifactId)!, requiredPassingRegimes: 3 }));
store.appendEvaluations(evaluations);
const quarantines = evaluations.flatMap((evaluation) => {
  const artifact = [...current.values()].find((row) => row.id === evaluation.signalArtifactId)!;
  const enrollment = enrollUntouchedForward({ evaluation, artifact }); return enrollment ? [enrollment] : [];
});
store.appendForwardQuarantines(quarantines);
const snapshot = store.snapshot();
const criticalIntegrityFailure = snapshot.integrity.invalidLockboxIds.length > 0
  || snapshot.integrity.orphanEvaluationIds.length > 0 || snapshot.integrity.multiplyEvaluatedLockboxIds.length > 0
  || snapshot.integrity.orphanForwardQuarantineIds.length > 0 || !snapshot.integrity.allLiveExecutionLocked;
console.log(JSON.stringify({ status: criticalIntegrityFailure ? 'fail' : 'pass', evaluations: evaluations.map((evaluation) => ({ id: evaluation.id,
  signalArtifactId: evaluation.signalArtifactId, chargedTrials: evaluation.totalChargedTrials,
  disposition: evaluation.disposition, passingRegimes: `${evaluation.passingRegimes}/${evaluation.requiredPassingRegimes}`,
  factorAttribution: evaluation.factorAttribution, holdoutDegradationRatio: evaluation.holdoutDegradationRatio,
  blockers: evaluation.blockers, verifierHash: evaluation.verifierHash })), forwardQuarantines: quarantines.length,
  operatorSummary: snapshot.operatorSummary, currentPolicy: snapshot.currentPolicy,
  integrity: snapshot.integrity, liveExecution: snapshot.liveExecution }, null, 2));
