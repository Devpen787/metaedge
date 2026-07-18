import { buildSignalResearchArtifact } from '../server/discovery/signal_research.js';
import { SignalResearchStore } from '../server/discovery/signal_store.js';
import type { SignalInputPoint } from '../server/discovery/signal_types.js';
import { readFactoryConfig } from '../server/discovery/sources.js';
import { WorldStore } from '../server/discovery/world_store.js';
import type { WorldEvent } from '../server/discovery/world_types.js';
import type { FlywheelLane } from '../server/discovery/flywheel_types.js';

interface BarPayload { closeAt: number; close: number; volume: number }
interface MembershipPayload { lane: FlywheelLane; symbol: string }

function barEvents(events: WorldEvent[], lane: FlywheelLane, symbol: string): Array<WorldEvent<BarPayload>> {
  return events.filter((event): event is WorldEvent<BarPayload> => event.kind === 'bar' && event.lane === lane
    && event.symbol === symbol && typeof (event.payload as BarPayload)?.close === 'number')
    .sort((left, right) => left.eventTime - right.eventTime);
}

function signalInputs(asset: Array<WorldEvent<BarPayload>>, benchmark: Array<WorldEvent<BarPayload>>): SignalInputPoint[] {
  const benchmarkByTime = new Map(benchmark.map((event) => [event.eventTime, event]));
  const aligned = asset.map((assetEvent) => ({ assetEvent, benchmarkEvent: benchmarkByTime.get(assetEvent.eventTime) }))
    .filter((row): row is { assetEvent: WorldEvent<BarPayload>; benchmarkEvent: WorldEvent<BarPayload> } => Boolean(row.benchmarkEvent));
  const points: SignalInputPoint[] = [];
  for (let index = 1; index < aligned.length; index++) {
    const prior = aligned[index - 1]; const current = aligned[index];
    if (!(prior.assetEvent.payload.close > 0 && current.assetEvent.payload.close > 0
      && prior.benchmarkEvent.payload.close > 0 && current.benchmarkEvent.payload.close > 0)) continue;
    points.push({ at: current.assetEvent.eventTime,
      availableAt: Math.max(current.assetEvent.availableAt, current.benchmarkEvent.availableAt),
      assetReturnBps: Math.log(current.assetEvent.payload.close / prior.assetEvent.payload.close) * 10_000,
      benchmarkReturnBps: Math.log(current.benchmarkEvent.payload.close / prior.benchmarkEvent.payload.close) * 10_000,
      capacityUsd: current.assetEvent.payload.volume * current.assetEvent.payload.close * 0.0005,
      sourceEventIds: [prior.assetEvent.id, current.assetEvent.id, prior.benchmarkEvent.id, current.benchmarkEvent.id].sort() });
  }
  return points;
}

const worldStore = new WorldStore();
const worldSnapshot = worldStore.snapshot();
const audit = worldSnapshot.latestAudit;
if (!audit || audit.parityStatus !== 'pass') throw new Error('SIGNAL_AUDIT_REQUIRES_PASSING_WORLD_PARITY_AUDIT');
const allowedIds = new Set(audit.historicalTrace.consumedEventIds);
const events = worldStore.readEvents().filter((event) => allowedIds.has(event.id));
const membershipEvents = events.filter((event) => event.kind === 'universe_membership') as Array<WorldEvent<MembershipPayload>>;
const config = readFactoryConfig();
const laneContracts = membershipEvents.map((event) => {
  const lane = event.lane as Extract<FlywheelLane, 'stocks' | 'spot_crypto'>;
  if (lane !== 'stocks' && lane !== 'spot_crypto') return null;
  return { lane, symbol: event.symbol as string, benchmark: lane === 'stocks' ? config.stock.benchmark : config.crypto.benchmark };
}).filter((row): row is { lane: Extract<FlywheelLane, 'stocks' | 'spot_crypto'>; symbol: string; benchmark: string } => row !== null);

const artifacts = laneContracts.map((lane) => {
  const points = signalInputs(barEvents(events, lane.lane, lane.symbol), barEvents(events, lane.lane, lane.benchmark));
  if (points.length < 200) throw new Error(`SIGNAL_AUDIT_INSUFFICIENT_ALIGNED_WORLD_EVENTS:${lane.lane}:${points.length}`);
  const isStock = lane.lane === 'stocks';
  const laneBlockers = audit.blockers.filter((blocker) => {
    if (blocker.startsWith('HISTORICAL_MEMBERSHIP_UNAVAILABLE:')) return blocker.includes(`:${lane.lane}:`);
    if (blocker.startsWith('STOCK_')) return lane.lane === 'stocks';
    return true;
  });
  laneBlockers.push('UNTOUCHED_FORWARD_OUTCOMES_NOT_YET_OBSERVED');
  return buildSignalResearchArtifact({ datasetVersionId: audit.datasetVersionId,
    universeVersionId: audit.universeVersionId, worldContractId: audit.contractId, lane: lane.lane,
    symbol: lane.symbol, benchmark: lane.benchmark, points, normalization: 'causal_robust_zscore',
    normalizationWindows: isStock ? [20, 40, 60] : [24, 48, 96], smoothingAlphas: [0.1, 0.25, 0.5],
    eventThresholds: [0.5, 1, 1.5], horizons: isStock ? [1, 5, 20] : [1, 6, 24],
    historicalResearchEligible: audit.historicalResearchEligible,
    paperForwardEligible: audit.paperForwardEligible, blockers: laneBlockers });
});

const store = new SignalResearchStore();
store.appendArtifacts(artifacts);
const snapshot = store.snapshot();
console.log(JSON.stringify({ status: snapshot.integrity.invalidArtifactIds.length ? 'fail' : 'pass',
  worldContractId: audit.contractId, artifacts: artifacts.map((artifact) => ({ id: artifact.id, lane: artifact.lane,
    symbol: artifact.symbol, benchmark: artifact.benchmark, observations: artifact.points.length,
    declaredTrials: artifact.transform.declaredTrials, selectedTransform: artifact.transform.id,
    orientation: artifact.transform.orientation, methodDisposition: artifact.methodDisposition,
    promotionDisposition: artifact.promotionDisposition, decisionReasons: artifact.decisionReasons,
    plateau: artifact.plateau, informationHorizon: artifact.informationHorizon,
    holdoutEventStudies: artifact.eventStudies.filter((study) => study.split === 'holdout'),
    trafficTransitions: artifact.traffic.length, historicalResearchEligible: artifact.historicalResearchEligible,
    paperForwardEligible: artifact.paperForwardEligible, blockers: artifact.blockers })),
  integrity: snapshot.integrity, liveExecution: snapshot.liveExecution }, null, 2));
