import { runExecutionCohortStudy } from '../server/discovery/execution_cohorts.js';
import { SIGNAL_RESEARCH_POLICY_VERSION } from '../server/discovery/signal_research.js';
import { contentHash } from '../server/discovery/store.js';
import { VALIDATION_POLICY_VERSION } from '../server/discovery/validation_runtime.js';
import { ValidationStore } from '../server/discovery/validation_store.js';
import { PortfolioOperationStore } from '../server/discovery/portfolio_operation_store.js';

const validation = new ValidationStore();
const currentEvaluations = validation.readActiveCurrentPolicyEvaluations();
const candidates = currentEvaluations.filter((evaluation) => evaluation.disposition === 'forward_candidate');
// Execution cohorts only consume observations created after a passing sealed
// evaluation. With zero forward candidates, fabricating historical assignments
// would contaminate the untouched-forward contract.
const cohortStudy = runExecutionCohortStudy({ decisions: [], sourceEvaluationIds: candidates.map((row) => row.id),
  seed: 20_260_715, makerOffsetBps: 5, feeBps: 5, slippageBps: 3, participationRate: 0.05,
  minimumOutcomesPerCohort: 30 });
const blockers = candidates.length ? ['FORWARD_EXECUTION_OBSERVATIONS_NOT_YET_AVAILABLE'] : [
  'NO_FORWARD_CANDIDATE_EVALUATIONS', 'TARGET_PORTFOLIO_NOT_CONSTRUCTED',
  'WEIGHT_AND_ORDER_SIMULATION_WITHHELD', 'EXECUTION_COHORTS_WITHHELD',
];
const identity = { validationPolicyVersion: VALIDATION_POLICY_VERSION,
  signalResearchPolicyVersion: SIGNAL_RESEARCH_POLICY_VERSION, sourceEvaluationIds: candidates.map((row) => row.id).sort(),
  cohortStudyId: cohortStudy.id, blockers };
const record = { id: `portfolio_execution_audit_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1 as const,
  createdAt: Date.now(), validationPolicyVersion: VALIDATION_POLICY_VERSION,
  signalResearchPolicyVersion: SIGNAL_RESEARCH_POLICY_VERSION, sourceEvaluationIds: candidates.map((row) => row.id).sort(),
  targetPortfolio: null, weightSimulation: null, orderSimulation: null, cohortStudy,
  status: 'blocked' as const, blockers, liveExecution: 'locked' as const };
const store = new PortfolioOperationStore(); store.appendAudits([record]); const snapshot = store.snapshot();
console.log(JSON.stringify({ status: snapshot.integrity.invalidAuditIds.length ? 'fail' : 'pass',
  currentValidationEvaluations: currentEvaluations.length, forwardCandidateEvaluations: candidates.length,
  targetPortfolio: record.targetPortfolio, weightSimulation: record.weightSimulation, orderSimulation: record.orderSimulation,
  executionCohorts: { status: cohortStudy.status, outcomes: cohortStudy.outcomes.length, blockers: cohortStudy.blockers },
  blockers: record.blockers, integrity: snapshot.integrity, liveExecution: snapshot.liveExecution }, null, 2));
