import { runDecisionCouncil } from '../server/discovery/council_runtime.js';
import { CouncilStore } from '../server/discovery/council_store.js';
import { LaneSignalStore } from '../server/discovery/lane_signal_store.js';

const laneSnapshot = new LaneSignalStore().snapshot();
if (laneSnapshot.current.length !== 7) throw new Error(`COUNCIL_REQUIRES_SEVEN_STREAM_PACKETS:found=${laneSnapshot.current.length}`);
const runs = laneSnapshot.current.map((packet) => runDecisionCouncil(packet));
const store = new CouncilStore(); store.appendRuns(runs);
const snapshot = store.snapshot();
console.log(JSON.stringify({ status: snapshot.integrity.invalidRunIds.length ? 'fail' : 'pass',
  runs: runs.map((run) => ({ stream: run.stream, specialistConclusions: Object.fromEntries(run.specialists.map((packet) =>
    [packet.role, packet.conclusion])), bull: run.bullCase.conclusion, bear: run.bearCase.conclusion,
    proposedAction: run.synthesis.proposedAction, unresolvedDissent: run.synthesis.unresolvedDissent.length,
    numericalGatePassed: run.numericalGate.passed, numericalBlockers: run.numericalGate.blockers,
    managerDecision: run.manager.decision })), operatorSummary: snapshot.operatorSummary, integrity: snapshot.integrity,
  liveExecution: snapshot.liveExecution }, null, 2));
