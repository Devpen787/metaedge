import { runDecisionCycle } from '../server/decision/runtime.js';
import { checkStopsOnce, startRiskLoop } from '../server/decision/risk_loop.js';
import { processPaperBrokerOnce, startPaperBroker } from '../server/trades.js';
import { readDatabase } from '../server/storage.js';
import { verifyResearchFleetLedgerParityV5 } from '../server/research.js';
import { initializeV5Authority } from '../server/v5/authority.js';
import { runExperimentOutcomeReconcilerOnceV5, startExperimentOutcomeReconcilerV5 } from '../server/v5/outcomes.js';
import {
  assessPopulationBurnInV5,
  markPopulationUiLedgerParityV5,
  recordPopulationOperationSampleV5,
} from '../server/v5/population.js';
import { runPortfolioAllocatorReconcilerOnceV5, startPortfolioAllocatorReconcilerV5 } from '../server/v5/portfolio.js';

const requestedCycles = Number(process.argv[2] || 10);
const summaryOnly = process.argv.includes('--summary-only');
if (!Number.isInteger(requestedCycles) || requestedCycles < 1 || requestedCycles > 100) {
  throw new Error('Usage: npm run v5:population-burnin -- <cycles 1..100>');
}

initializeV5Authority();
startPaperBroker();
startPortfolioAllocatorReconcilerV5();
startExperimentOutcomeReconcilerV5();
startRiskLoop();

const cycles = [];
for (let index = 0; index < requestedCycles; index += 1) {
  const decision = await runDecisionCycle();
  const broker = processPaperBrokerOnce();
  const portfolio = runPortfolioAllocatorReconcilerOnceV5();
  const outcomes = runExperimentOutcomeReconcilerOnceV5();
  const risk = checkStopsOnce();
  const sample = recordPopulationOperationSampleV5();
  cycles.push({
    sequence: index + 1,
    decision,
    broker,
    portfolio,
    outcomes,
    risk,
    operation: {
      sampleId: sample.sampleId,
      clean: sample.clean,
      reasons: sample.reasons,
      clocks: sample.clocks,
    },
  });
}

const parity = verifyResearchFleetLedgerParityV5(readDatabase());
markPopulationUiLedgerParityV5(parity.verified);
const assessment = assessPopulationBurnInV5();

const report = {
  mode: 'Paper money',
  liveExecution: 'locked',
  databaseUrl: process.env.DATABASE_URL || null,
  requestedCycles,
  completedCycles: cycles.length,
  cleanCycles: cycles.filter((cycle) => cycle.operation.clean).length,
  parity,
  assessment,
  cycles,
};
const summary = {
  ...report,
  totalEvaluated: cycles.reduce((sum, cycle) => sum + (cycle.decision?.evaluated || 0), 0),
  totalRouted: cycles.reduce((sum, cycle) => sum + (cycle.decision?.routed || 0), 0),
  brokerFilled: cycles.reduce((sum, cycle) => sum + cycle.broker.filled, 0),
  brokerPartial: cycles.reduce((sum, cycle) => sum + cycle.broker.partial, 0),
  cycles: undefined,
};
console.log(JSON.stringify(summaryOnly ? summary : report, null, 2));

process.exit(assessment.verdict === 'go_local_paper_operation' ? 0 : 2);
