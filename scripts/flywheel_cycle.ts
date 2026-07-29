import { runFlywheelCycle } from '../server/discovery/flywheel_runtime.js';

const snapshot = await runFlywheelCycle({ refreshBaseline: process.argv.includes('--refresh-baseline') });
console.log(JSON.stringify({
  mode: snapshot.mode,
  states: snapshot.states.length,
  candidates: snapshot.candidates.length,
  validations: snapshot.validations.length,
  novelty: snapshot.novelty.length,
  portfolioDecisions: snapshot.portfolioDecisions.length,
  executionDecisions: snapshot.executionDecisions.length,
  trials: snapshot.trials.length,
  forwardObservations: snapshot.forwardObservations.length,
  attributions: snapshot.attributions.length,
  lifecycle: snapshot.lifecycle.length,
  researchQueue: snapshot.researchQueue.length,
  operatorSummary: snapshot.operatorSummary,
  integrity: snapshot.integrity,
  coverage: snapshot.coverage,
  liveExecution: snapshot.liveExecution,
}, null, 2));
