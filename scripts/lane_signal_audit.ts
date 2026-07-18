import { FlywheelLedger } from '../server/discovery/flywheel_store.js';
import { buildLaneSignalPackets } from '../server/discovery/lane_signals.js';
import { LaneSignalStore } from '../server/discovery/lane_signal_store.js';
import { SignalResearchStore } from '../server/discovery/signal_store.js';
import { WorldStore } from '../server/discovery/world_store.js';

const flywheel = new FlywheelLedger().snapshot();
const signalArtifacts = new SignalResearchStore().readArtifacts();
const worldAudit = new WorldStore().snapshot().latestAudit;
const packets = buildLaneSignalPackets({ flywheel, signalArtifacts, worldAudit });
const store = new LaneSignalStore();
store.appendPackets(packets);
const snapshot = store.snapshot();
console.log(JSON.stringify({ status: snapshot.integrity.invalidPacketIds.length ? 'fail' : 'pass',
  streams: packets.map((packet) => ({ stream: packet.stream, evidenceStatus: packet.evidenceStatus,
    researchDisposition: packet.researchDisposition, candidateAction: packet.candidateAction,
    observedSymbols: packet.observedSymbols.length, quality: packet.quality, measurements: packet.measurements,
    blockers: packet.blockers })), operatorSummary: snapshot.operatorSummary, integrity: snapshot.integrity,
  liveExecution: snapshot.liveExecution }, null, 2));
