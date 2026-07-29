import { runControlledFlywheelCycle } from '../server/discovery/controlled_flywheel_runtime.js';

const result = await runControlledFlywheelCycle();
const snapshot = result.flywheel;
const loops = Object.fromEntries(Object.entries(result.loops).map(([id, loop]) => [id, {
  executed: loop.executed, outcome: loop.run.outcome, reason: loop.run.reason,
  itemsFound: loop.run.itemsFound, newEvidence: loop.run.newEvidence,
}]));
console.log(JSON.stringify({
  mode: result.mode,
  acquisition: { executed: result.acquisition.executed, outcome: result.acquisition.run.outcome,
    reason: result.acquisition.run.reason, newEvidence: result.acquisition.run.newEvidence },
  discovery: { executed: result.discovery.executed, outcome: result.discovery.run.outcome,
    reason: result.discovery.run.reason, declaredTrials: result.discovery.run.declaredTrials },
  loops,
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
  flywheelIntegrity: snapshot.integrity,
  controlIntegrity: result.control.integrity,
  v3StageIntegrity: Object.fromEntries(Object.entries(result.stageSnapshots).map(([name, stage]) => [name, stage.integrity])),
  coverage: snapshot.coverage,
  liveExecution: result.liveExecution,
}, null, 2));
