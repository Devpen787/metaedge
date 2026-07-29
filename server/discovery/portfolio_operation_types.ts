import type { ExecutionCohortStudy } from './execution_cohort_types.js';
import type { OrderSimulationResult } from './execution_types.js';
import type { PortfolioConstructionResult, WeightSimulationResult } from './portfolio_types.js';

export interface PortfolioExecutionAuditRecord {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  validationPolicyVersion: string;
  signalResearchPolicyVersion: string;
  sourceEvaluationIds: string[];
  targetPortfolio: PortfolioConstructionResult | null;
  weightSimulation: WeightSimulationResult | null;
  orderSimulation: OrderSimulationResult | null;
  cohortStudy: ExecutionCohortStudy;
  status: 'operational' | 'collecting' | 'blocked';
  blockers: string[];
  liveExecution: 'locked';
}
