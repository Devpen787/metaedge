import { contentHash } from './store.js';
import type {
  ExecutionBar, WorldContract, WorldEvent, WorldEventKind, WorldMode, WorldParityAudit, WorldSnapshot, WorldTrace,
} from './world_types.js';
import type { FlywheelLane } from './flywheel_types.js';

function eventKey(event: WorldEvent): string { return `${event.kind}:${event.lane}:${event.symbol ?? '*'}`; }
function orderEvents(left: WorldEvent, right: WorldEvent): number {
  return left.availableAt - right.availableAt || left.eventTime - right.eventTime || left.id.localeCompare(right.id);
}

export function makeWorldContract(input: Omit<WorldContract, 'id' | 'schemaVersion' | 'liveExecution'>): WorldContract {
  const base = { schemaVersion: 1 as const, ...input, liveExecution: 'locked' as const };
  return { id: `world_contract_${contentHash(base).slice(0, 20)}`, ...base };
}

export function makeWorldEvent<T>(input: {
  kind: WorldEventKind;
  lane: FlywheelLane;
  symbol?: string | null;
  eventTime: number;
  availableAt: number;
  observedAt: number;
  sourceVersionId: string;
  payload: T;
}): WorldEvent<T> {
  if (![input.eventTime, input.availableAt, input.observedAt].every(Number.isFinite)) throw new Error('WORLD_EVENT_TIME_INVALID');
  if (input.availableAt < input.eventTime) throw new Error('WORLD_EVENT_AVAILABLE_BEFORE_EVENT');
  if (input.observedAt < input.availableAt) throw new Error('WORLD_EVENT_OBSERVED_BEFORE_AVAILABLE');
  const payloadHash = contentHash(input.payload);
  const base = { kind: input.kind, lane: input.lane, symbol: input.symbol ?? null, eventTime: input.eventTime,
    availableAt: input.availableAt, observedAt: input.observedAt, sourceVersionId: input.sourceVersionId, payloadHash };
  return { id: `world_event_${contentHash(base).slice(0, 20)}`, ...base, payload: input.payload, liveExecution: 'locked' };
}

export class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0 || 0x6d2b79f5; }
  next(): number {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }
}

export class DeterministicWorld {
  private pending: WorldEvent[] = [];
  private consumed: WorldEvent[] = [];
  private latest = new Map<string, WorldEvent>();
  private snapshots: WorldSnapshot[] = [];
  private now = Number.NEGATIVE_INFINITY;
  readonly random: SeededRandom;

  constructor(readonly contract: WorldContract, readonly mode: WorldMode, initialEvents: WorldEvent[] = []) {
    this.random = new SeededRandom(contract.seed);
    const ids = new Set<string>();
    for (const event of initialEvents) {
      this.validateEvent(event);
      if (ids.has(event.id)) throw new Error(`WORLD_EVENT_DUPLICATE:${event.id}`);
      ids.add(event.id); this.pending.push(event);
    }
    this.pending.sort(orderEvents);
  }

  private validateEvent(event: WorldEvent): void {
    if (event.liveExecution !== 'locked') throw new Error('WORLD_EVENT_LIVE_NOT_LOCKED');
    const expectedSourceVersionId = event.kind === 'universe_membership'
      ? this.contract.universeVersionId : this.contract.datasetVersionId;
    if (event.sourceVersionId !== expectedSourceVersionId) {
      throw new Error(`WORLD_EVENT_SOURCE_VERSION_MISMATCH:${event.id}`);
    }
    if (contentHash(event.payload) !== event.payloadHash) throw new Error(`WORLD_EVENT_PAYLOAD_HASH_MISMATCH:${event.id}`);
  }

  append(event: WorldEvent): void {
    this.validateEvent(event);
    if (this.pending.some((item) => item.id === event.id) || this.consumed.some((item) => item.id === event.id)) return;
    if (event.availableAt < this.now) throw new Error('LATE_EVENT_REQUIRES_NEW_WORLD_VERSION');
    this.pending.push(event); this.pending.sort(orderEvents);
  }

  advanceTo(asOf: number): WorldSnapshot {
    if (!Number.isFinite(asOf)) throw new Error('WORLD_CLOCK_INVALID');
    if (asOf < this.now) throw new Error('WORLD_CLOCK_CANNOT_REWIND');
    while (this.pending[0] && this.pending[0].availableAt <= asOf) {
      const event = this.pending.shift() as WorldEvent;
      this.consumed.push(event); this.latest.set(eventKey(event), event);
    }
    this.now = asOf;
    const latestEventIds = Object.fromEntries([...this.latest.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, event]) => [key, event.id]));
    const consumedEventIds = this.consumed.map((event) => event.id);
    const consumedEventHash = contentHash(consumedEventIds);
    const stateHash = contentHash({ contractId: this.contract.id, asOf, consumedEventCount: consumedEventIds.length,
      consumedEventHash, latestEventIds });
    const snapshot: WorldSnapshot = { asOf, consumedEventCount: consumedEventIds.length, consumedEventHash,
      latestEventIds, stateHash, liveExecution: 'locked' };
    this.snapshots.push(snapshot); return snapshot;
  }

  snapshot(): WorldSnapshot { return this.advanceTo(this.now === Number.NEGATIVE_INFINITY ? 0 : this.now); }

  trace(): WorldTrace {
    const consumedEventIds = this.consumed.map((event) => event.id);
    const finalStateHash = this.snapshots.at(-1)?.stateHash ?? contentHash({ contractId: this.contract.id, empty: true });
    const parityHash = contentHash({ contractId: this.contract.id, consumedEventIds,
      snapshots: this.snapshots.map((snapshot) => ({ asOf: snapshot.asOf, stateHash: snapshot.stateHash })) });
    return { mode: this.mode, contractId: this.contract.id, consumedEventIds, snapshots: this.snapshots,
      parityHash, finalStateHash, liveExecution: 'locked' };
  }
}

export function runHistoricalWorld(contract: WorldContract, events: WorldEvent[]): WorldTrace {
  const world = new DeterministicWorld(contract, 'historical_replay', events);
  for (const availableAt of [...new Set(events.map((event) => event.availableAt))].sort((a, b) => a - b)) world.advanceTo(availableAt);
  return world.trace();
}

export function runPaperWorld(contract: WorldContract, events: WorldEvent[]): WorldTrace {
  const world = new DeterministicWorld(contract, 'paper_forward');
  const ordered = [...events].sort(orderEvents);
  for (const availableAt of [...new Set(ordered.map((event) => event.availableAt))]) {
    for (const event of ordered.filter((item) => item.availableAt === availableAt)) world.append(event);
    world.advanceTo(availableAt);
  }
  return world.trace();
}

export function assertWorldParity(historical: WorldTrace, paper: WorldTrace): void {
  if (historical.contractId !== paper.contractId || historical.parityHash !== paper.parityHash) {
    throw new Error(`HISTORICAL_PAPER_WORLD_DIVERGENCE:${historical.parityHash}:${paper.parityHash}`);
  }
}

export function makeWorldParityAudit(input: {
  contract: WorldContract;
  events: WorldEvent[];
  historicalTrace: WorldTrace;
  paperTrace: WorldTrace;
  historicalResearchEligible: boolean;
  paperForwardEligible: boolean;
  paperForwardEligibleAt: number | null;
  blockers: string[];
  auditedAt?: number;
}): WorldParityAudit {
  const blockers = [...new Set(input.blockers)].sort();
  if (input.historicalResearchEligible && blockers.length) throw new Error('WORLD_AUDIT_ELIGIBLE_WITH_BLOCKERS');
  const parityStatus = input.historicalTrace.contractId === input.paperTrace.contractId
    && input.historicalTrace.parityHash === input.paperTrace.parityHash ? 'pass' : 'fail';
  const availableTimes = input.events.map((event) => event.availableAt).filter(Number.isFinite);
  const identity = {
    contractId: input.contract.id,
    datasetVersionId: input.contract.datasetVersionId,
    universeVersionId: input.contract.universeVersionId,
    eventIds: input.events.map((event) => event.id).sort(),
    historicalParityHash: input.historicalTrace.parityHash,
    paperParityHash: input.paperTrace.parityHash,
    historicalResearchEligible: input.historicalResearchEligible,
    paperForwardEligible: input.paperForwardEligible,
    paperForwardEligibleAt: input.paperForwardEligibleAt,
    blockers,
  };
  return {
    id: `world_audit_${contentHash(identity).slice(0, 20)}`,
    schemaVersion: 1,
    auditedAt: input.auditedAt ?? Date.now(),
    contractId: input.contract.id,
    datasetVersionId: input.contract.datasetVersionId,
    universeVersionId: input.contract.universeVersionId,
    eventCount: input.events.length,
    minAvailableAt: availableTimes.length ? Math.min(...availableTimes) : null,
    maxAvailableAt: availableTimes.length ? Math.max(...availableTimes) : null,
    historicalTrace: input.historicalTrace,
    paperTrace: input.paperTrace,
    parityStatus,
    historicalResearchEligible: input.historicalResearchEligible,
    paperForwardEligible: input.paperForwardEligible,
    paperForwardEligibleAt: input.paperForwardEligibleAt,
    blockers,
    liveExecution: 'locked',
  };
}

export function nextExecutionBar(bars: ExecutionBar[], decisionAt: number): ExecutionBar | null {
  return [...bars].sort((a, b) => a.openAt - b.openAt || a.symbol.localeCompare(b.symbol))
    .find((bar) => bar.openAt > decisionAt) ?? null;
}
