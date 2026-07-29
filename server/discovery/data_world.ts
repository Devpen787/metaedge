import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { contentHash } from './store.js';
import type {
  AsOfUniverseView, DataQuarantineRecord, DatasetFileRecord, DatasetKind, DatasetVersion, UniverseMembership,
  UniverseVersion,
} from './data_world_types.js';
import type { FlywheelLane } from './flywheel_types.js';

function fileHash(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function kindFor(file: string): DatasetKind {
  const name = path.basename(file);
  if (name.startsWith('backfill-')) return 'price_bars';
  if (name.startsWith('funding')) return 'funding';
  if (file.includes(`${path.sep}predictions${path.sep}`)) return 'prediction_odds';
  if (name.startsWith('ticks-')) return 'market_ticks';
  return 'unknown';
}

function finite(value: unknown): boolean { return Number.isFinite(Number(value)); }

function validateRow(kind: DatasetKind, row: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (!finite(row.t)) issues.push('EVENT_TIME_INVALID');
  if (kind === 'price_bars') {
    for (const field of ['o', 'h', 'l', 'c', 'v']) if (!finite(row[field])) issues.push(`BAR_${field.toUpperCase()}_INVALID`);
    if (finite(row.h) && finite(row.l) && Number(row.h) < Number(row.l)) issues.push('BAR_HIGH_BELOW_LOW');
    if (finite(row.o) && finite(row.h) && Number(row.o) > Number(row.h)) issues.push('BAR_OPEN_ABOVE_HIGH');
    if (finite(row.o) && finite(row.l) && Number(row.o) < Number(row.l)) issues.push('BAR_OPEN_BELOW_LOW');
    if (finite(row.c) && finite(row.h) && Number(row.c) > Number(row.h)) issues.push('BAR_CLOSE_ABOVE_HIGH');
    if (finite(row.c) && finite(row.l) && Number(row.c) < Number(row.l)) issues.push('BAR_CLOSE_BELOW_LOW');
    if (finite(row.v) && Number(row.v) < 0) issues.push('BAR_VOLUME_NEGATIVE');
  } else if (kind === 'funding' && !finite(row.funding) && !finite(row.fundingHourly)) issues.push('FUNDING_INVALID');
  else if (kind === 'prediction_odds') {
    const prices = Array.isArray(row.prices) ? row.prices.map(Number) : [];
    if (prices.length < 2 || prices.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) issues.push('PREDICTION_PRICES_INVALID');
    if (prices.length && Math.abs(prices.reduce((sum, value) => sum + value, 0) - 1) > 0.02) issues.push('PREDICTION_PRICE_SUM_INVALID');
  }
  return [...new Set(issues)];
}

export function inspectDatasetFile(file: string): { record: DatasetFileRecord; quarantines: Omit<DataQuarantineRecord, 'id' | 'datasetVersionId'>[] } {
  const stat = fs.statSync(file);
  const kind = kindFor(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((line) => line.trim());
  const issues = new Set<string>();
  const quarantines: Omit<DataQuarantineRecord, 'id' | 'datasetVersionId'>[] = [];
  let minEventTime: number | null = null;
  let maxEventTime: number | null = null;
  let priorTime = Number.NEGATIVE_INFINITY;
  lines.forEach((raw, index) => {
    try {
      const row = JSON.parse(raw) as Record<string, unknown>;
      const rowIssues = validateRow(kind, row);
      const eventTime = Number(row.t);
      if (Number.isFinite(eventTime)) {
        if (eventTime < priorTime) rowIssues.push('EVENT_TIME_NOT_MONOTONIC');
        priorTime = eventTime;
        minEventTime = minEventTime === null ? eventTime : Math.min(minEventTime, eventTime);
        maxEventTime = maxEventTime === null ? eventTime : Math.max(maxEventTime, eventTime);
      }
      for (const reason of new Set(rowIssues)) {
        issues.add(reason);
        quarantines.push({ file, line: index + 1, reason, rawHash: contentHash(raw), detectedAt: Date.now(),
          status: 'open', liveExecution: 'locked' });
      }
    } catch {
      issues.add('JSON_INVALID');
      quarantines.push({ file, line: index + 1, reason: 'JSON_INVALID', rawHash: contentHash(raw), detectedAt: Date.now(),
        status: 'open', liveExecution: 'locked' });
    }
  });
  if (!lines.length) {
    issues.add('DATASET_EMPTY');
    quarantines.push({ file, line: null, reason: 'DATASET_EMPTY', rawHash: null, detectedAt: Date.now(),
      status: 'open', liveExecution: 'locked' });
  }
  return {
    record: { path: file, kind, contentHash: fileHash(file), bytes: stat.size, records: lines.length,
      minEventTime, maxEventTime, status: issues.size ? 'quarantined' : 'valid', issues: [...issues].sort() },
    quarantines,
  };
}

export function createDatasetVersion(input: { files: string[]; source: string; createdAt?: number }): {
  version: DatasetVersion; quarantines: DataQuarantineRecord[];
} {
  const createdAt = input.createdAt ?? Date.now();
  const inspected = input.files.sort().map(inspectDatasetFile);
  const versionContentHash = contentHash(inspected.map((item) => item.record));
  const id = `dataset_${versionContentHash.slice(0, 20)}`;
  const version: DatasetVersion = { id, schemaVersion: 1, createdAt, source: input.source,
    files: inspected.map((item) => item.record), contentHash: versionContentHash, immutable: true, liveExecution: 'locked' };
  const quarantines = inspected.flatMap((item) => item.quarantines).map((item) => ({
    id: `quarantine_${contentHash({ datasetVersionId: id, file: item.file, line: item.line, reason: item.reason, rawHash: item.rawHash }).slice(0, 20)}`,
    datasetVersionId: id,
    ...item,
  }));
  return { version, quarantines };
}

export function makeCurrentMembership(input: {
  lane: FlywheelLane; symbols: string[]; at: number; sourceVersionId: string; authority: string;
}): UniverseMembership[] {
  return [...new Set(input.symbols)].sort().map((symbol) => {
    const base = { lane: input.lane, symbol, effectiveFrom: input.at, effectiveTo: null, knownAt: input.at,
      sourceVersionId: input.sourceVersionId, authority: input.authority,
      historyStatus: 'current_snapshot_only' as const, liveExecution: 'locked' as const };
    return { id: `membership_${contentHash(base).slice(0, 20)}`, ...base };
  });
}

export function createUniverseVersion(memberships: UniverseMembership[], createdAt = Date.now()): UniverseVersion {
  if (!memberships.length) throw new Error('UNIVERSE_VERSION_EMPTY');
  if (memberships.some((row) => row.liveExecution !== 'locked')) throw new Error('UNIVERSE_MEMBERSHIP_LIVE_NOT_LOCKED');
  const ordered = [...memberships].sort((left, right) => left.id.localeCompare(right.id));
  const versionContentHash = contentHash(ordered);
  const historical = ordered.filter((row) => row.historyStatus === 'historical_membership').length;
  const historyStatus = historical === ordered.length ? 'historical_membership'
    : historical === 0 ? 'current_snapshot_only' : 'mixed';
  return {
    id: `universe_${versionContentHash.slice(0, 20)}`,
    schemaVersion: 1,
    createdAt,
    membershipIds: ordered.map((row) => row.id),
    contentHash: versionContentHash,
    lanes: [...new Set(ordered.map((row) => row.lane))].sort(),
    historyStatus,
    survivorshipSafe: historyStatus === 'historical_membership',
    immutable: true,
    liveExecution: 'locked',
  };
}

export function selectAsOfUniverse(memberships: UniverseMembership[], lane: FlywheelLane, at: number,
  purpose: AsOfUniverseView['purpose'] = 'historical_research'): AsOfUniverseView {
  const laneRows = memberships.filter((row) => row.lane === lane);
  const eligibleSymbols: string[] = [];
  const excluded: Array<{ symbol: string; reason: string }> = [];
  for (const symbol of [...new Set(laneRows.map((row) => row.symbol))].sort()) {
    const rows = laneRows.filter((row) => row.symbol === symbol);
    const active = rows.find((row) => (purpose === 'paper_forward' || row.historyStatus === 'historical_membership') && row.knownAt <= at &&
      row.effectiveFrom <= at && (row.effectiveTo === null || at < row.effectiveTo));
    if (active) eligibleSymbols.push(symbol);
    else if (rows.some((row) => row.knownAt > at)) excluded.push({ symbol, reason: 'MEMBERSHIP_NOT_KNOWN_AS_OF_DATE' });
    else if (purpose === 'historical_research' && rows.every((row) => row.historyStatus === 'current_snapshot_only')) {
      excluded.push({ symbol, reason: 'CURRENT_MEMBERSHIP_NOT_HISTORICAL_EVIDENCE' });
    }
    else excluded.push({ symbol, reason: 'NOT_MEMBER_AS_OF_DATE' });
  }
  return { at, lane, purpose, eligibleSymbols, excluded, survivorshipSafe: eligibleSymbols.length > 0 &&
    (purpose === 'paper_forward' || eligibleSymbols.every((symbol) => laneRows.some((row) => row.symbol === symbol && row.historyStatus === 'historical_membership'))),
    liveExecution: 'locked' };
}
