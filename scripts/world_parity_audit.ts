import fs from 'node:fs';
import path from 'node:path';
import { selectAsOfUniverse } from '../server/discovery/data_world.js';
import { DataWorldStore } from '../server/discovery/data_world_store.js';
import type { DatasetFileRecord, UniverseMembership } from '../server/discovery/data_world_types.js';
import type { FlywheelLane } from '../server/discovery/flywheel_types.js';
import { readFactoryConfig } from '../server/discovery/sources.js';
import {
  assertWorldParity, makeWorldContract, makeWorldEvent, makeWorldParityAudit, runHistoricalWorld, runPaperWorld,
} from '../server/discovery/world_runtime.js';
import { WorldStore } from '../server/discovery/world_store.js';
import type { WorldEvent } from '../server/discovery/world_types.js';

interface BarRow { t: number; o: number; h: number; l: number; c: number; v: number }
interface PriceCorpusFile { file: DatasetFileRecord; lane: Extract<FlywheelLane, 'stocks' | 'spot_crypto'>;
  symbol: string; intervalMs: number; role: 'asset' | 'benchmark' }

function priceFile(record: DatasetFileRecord, memberships: UniverseMembership[]): PriceCorpusFile | null {
  if (record.kind !== 'price_bars' || record.status !== 'valid') return null;
  const match = path.basename(record.path).match(/^backfill-(.+)-(1h|1d)\.jsonl$/);
  if (!match) return null;
  const symbol = match[1];
  const lanes = new Set(memberships.filter((row) => row.symbol === symbol).map((row) => row.lane));
  if (match[2] === '1d' && lanes.has('stocks')) return { file: record, lane: 'stocks', symbol,
    intervalMs: 6.5 * 60 * 60 * 1_000, role: 'asset' };
  if (match[2] === '1h' && lanes.has('spot_crypto')) return { file: record, lane: 'spot_crypto', symbol,
    intervalMs: 60 * 60 * 1_000, role: 'asset' };
  return null;
}

function selectCorpus(files: DatasetFileRecord[], memberships: UniverseMembership[]): PriceCorpusFile[] {
  const candidates = files.map((file) => priceFile(file, memberships)).filter((item): item is PriceCorpusFile => item !== null);
  return (['stocks', 'spot_crypto'] as const).map((lane) => candidates.filter((item) => item.lane === lane)
    .sort((left, right) => right.file.records - left.file.records || left.symbol.localeCompare(right.symbol))[0])
    .filter((item): item is PriceCorpusFile => item !== undefined);
}

function readTailBars(file: string, limit: number): BarRow[] {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(-limit)
    .map((line) => JSON.parse(line) as BarRow);
}

const dataStore = new DataWorldStore();
const dataSnapshot = dataStore.snapshot();
const dataset = dataSnapshot.latestDatasetVersion;
const universe = dataSnapshot.latestUniverseVersion;
if (!dataset) throw new Error('WORLD_AUDIT_REQUIRES_DATASET_VERSION:run npm run discovery:data-audit');
if (!universe) throw new Error('WORLD_AUDIT_REQUIRES_UNIVERSE_VERSION:run npm run discovery:data-audit');

const universeMembershipIds = new Set(universe.membershipIds);
const memberships = dataSnapshot.memberships.filter((row) => universeMembershipIds.has(row.id));
const corpus = selectCorpus(dataset.files, memberships);
if (corpus.length !== 2) throw new Error(`WORLD_AUDIT_REQUIRES_STOCK_AND_SPOT_CORPUS:found=${corpus.length}`);
const config = readFactoryConfig();
const evidenceCorpus = corpus.flatMap((asset) => {
  const benchmark = asset.lane === 'stocks' ? config.stock.benchmark : config.crypto.benchmark;
  const interval = asset.lane === 'stocks' ? '1d' : '1h';
  const benchmarkFile = dataset.files.find((file) => path.basename(file.path) === `backfill-${benchmark}-${interval}.jsonl`
    && file.status === 'valid');
  if (!benchmarkFile) throw new Error(`WORLD_AUDIT_BENCHMARK_MISSING:${asset.lane}:${benchmark}`);
  return [asset, { file: benchmarkFile, lane: asset.lane, symbol: benchmark, intervalMs: asset.intervalMs,
    role: 'benchmark' as const }];
});

const contract = makeWorldContract({
  datasetVersionId: dataset.id,
  universeVersionId: universe.id,
  calendarVersion: 'stocks-regular-close-plus-crypto-24x7-v1',
  seed: 20_260_715,
  executionTiming: 'next_bar',
  missingBarPolicy: 'freeze_last_mark_no_new_order',
  sameBarPathPolicy: 'stop_before_limit',
  correctionPolicy: 'new_world_version',
});

const events: WorldEvent[] = [];
for (const item of evidenceCorpus) {
  for (const row of readTailBars(item.file.path, 512)) {
    const closeAt = Number(row.t) + item.intervalMs;
    events.push(makeWorldEvent({
      kind: 'bar',
      lane: item.lane,
      symbol: item.symbol,
      eventTime: closeAt,
      availableAt: closeAt,
      observedAt: Math.max(dataset.createdAt, closeAt),
      sourceVersionId: dataset.id,
      payload: { openAt: row.t, closeAt, open: row.o, high: row.h, low: row.l, close: row.c, volume: row.v },
    }));
  }
  const membership = item.role === 'asset'
    ? memberships.filter((row) => row.lane === item.lane && row.symbol === item.symbol)
      .sort((left, right) => right.knownAt - left.knownAt)[0]
    : undefined;
  if (membership) events.push(makeWorldEvent({
    kind: 'universe_membership',
    lane: item.lane,
    symbol: item.symbol,
    eventTime: membership.effectiveFrom,
    availableAt: membership.knownAt,
    observedAt: Math.max(universe.createdAt, membership.knownAt),
    sourceVersionId: universe.id,
    payload: membership,
  }));
}

const ordered = [...events].sort((left, right) => left.availableAt - right.availableAt
  || left.eventTime - right.eventTime || left.id.localeCompare(right.id));
const historicalTrace = runHistoricalWorld(contract, ordered);
const paperTrace = runPaperWorld(contract, ordered);
assertWorldParity(historicalTrace, paperTrace);

const firstBarAt = Math.min(...ordered.filter((event) => event.kind === 'bar').map((event) => event.availableAt));
const selectedMemberships = corpus.map((item) => memberships.filter((row) => row.lane === item.lane && row.symbol === item.symbol)
  .sort((left, right) => right.knownAt - left.knownAt)[0]).filter((row): row is UniverseMembership => row !== undefined);
const paperForwardEligibleAt = selectedMemberships.length === corpus.length
  ? Math.max(...selectedMemberships.map((row) => row.knownAt)) : null;
const paperForwardEligible = paperForwardEligibleAt !== null && corpus.every((item) =>
  selectAsOfUniverse(memberships, item.lane, paperForwardEligibleAt, 'paper_forward').eligibleSymbols.includes(item.symbol));
const blockers: string[] = [];
if (!universe.survivorshipSafe) blockers.push('UNIVERSE_VERSION_NOT_SURVIVORSHIP_SAFE');
for (const item of corpus) {
  const view = selectAsOfUniverse(memberships, item.lane, firstBarAt);
  if (!view.eligibleSymbols.includes(item.symbol)) blockers.push(`HISTORICAL_MEMBERSHIP_UNAVAILABLE:${item.lane}:${item.symbol}`);
}
if (corpus.some((item) => item.lane === 'stocks')) blockers.push('STOCK_CORPORATE_ACTION_POINT_IN_TIME_PROVENANCE_UNVERIFIED');
const audit = makeWorldParityAudit({ contract, events: ordered, historicalTrace, paperTrace,
  historicalResearchEligible: blockers.length === 0, paperForwardEligible, paperForwardEligibleAt, blockers });

const worldStore = new WorldStore();
worldStore.appendContracts([contract]);
worldStore.appendEvents(ordered);
worldStore.appendAudits([audit]);
const snapshot = worldStore.snapshot();

console.log(JSON.stringify({
  status: audit.parityStatus === 'pass' ? 'pass' : 'fail',
  contractId: contract.id,
  datasetVersionId: dataset.id,
  universeVersionId: universe.id,
  corpus: evidenceCorpus.map((item) => ({ lane: item.lane, symbol: item.symbol, role: item.role,
    file: item.file.path, bars: 512 })),
  events: audit.eventCount,
  historicalParityHash: audit.historicalTrace.parityHash,
  paperParityHash: audit.paperTrace.parityHash,
  historicalResearchEligible: audit.historicalResearchEligible,
  paperForwardEligible: audit.paperForwardEligible,
  paperForwardEligibleAt: audit.paperForwardEligibleAt,
  blockers: audit.blockers,
  integrity: snapshot.integrity,
  liveExecution: snapshot.liveExecution,
}, null, 2));
