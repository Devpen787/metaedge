import fs from 'node:fs';
import path from 'node:path';
import { contentHash } from './store.js';
import type { DataQuarantineRecord, DatasetVersion, UniverseMembership, UniverseVersion } from './data_world_types.js';

function readJsonl<T>(file: string): T[] { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T); } catch { return []; } }
function appendUnique<T extends { id: string }>(file: string, rows: T[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const known = new Set(readJsonl<T>(file).map((row) => row.id));
  const fresh = rows.filter((row) => { if (known.has(row.id)) return false; known.add(row.id); return true; });
  if (fresh.length) fs.appendFileSync(file, `${fresh.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

export class DataWorldStore {
  private versions: string; private quarantines: string; private memberships: string; private universeVersions: string;
  constructor(readonly root = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'data-world')) {
    this.versions = path.join(root, 'dataset-versions.jsonl');
    this.quarantines = path.join(root, 'quarantine.jsonl');
    this.memberships = path.join(root, 'universe-membership.jsonl');
    this.universeVersions = path.join(root, 'universe-versions.jsonl');
  }
  appendDatasetVersions(rows: DatasetVersion[]): void { appendUnique(this.versions, rows); }
  appendQuarantines(rows: DataQuarantineRecord[]): void { appendUnique(this.quarantines, rows); }
  appendMemberships(rows: UniverseMembership[]): void { appendUnique(this.memberships, rows); }
  appendUniverseVersions(rows: UniverseVersion[]): void { appendUnique(this.universeVersions, rows); }
  readDatasetVersions(): DatasetVersion[] { return readJsonl(this.versions); }
  readQuarantines(): DataQuarantineRecord[] { return readJsonl(this.quarantines); }
  readMemberships(): UniverseMembership[] { return readJsonl(this.memberships); }
  readUniverseVersions(): UniverseVersion[] { return readJsonl(this.universeVersions); }
  snapshot() {
    const datasetVersions = this.readDatasetVersions();
    const quarantines = this.readQuarantines();
    const memberships = this.readMemberships();
    const universeVersions = this.readUniverseVersions();
    const membershipsById = new Map(memberships.map((row) => [row.id, row]));
    const invalidUniverseVersionIds = universeVersions.filter((version) => {
      const rows = version.membershipIds.map((id) => membershipsById.get(id));
      if (rows.some((row) => !row)) return true;
      const ordered = (rows as UniverseMembership[]).sort((left, right) => left.id.localeCompare(right.id));
      const expectedHash = contentHash(ordered);
      return version.contentHash !== expectedHash || version.id !== `universe_${expectedHash.slice(0, 20)}`;
    }).map((version) => version.id);
    return { mode: 'Paper research', datasetVersions, quarantines, memberships, universeVersions,
      latestDatasetVersion: datasetVersions.at(-1) ?? null,
      latestUniverseVersion: universeVersions.at(-1) ?? null,
      integrity: { allImmutable: [...datasetVersions, ...universeVersions].every((item) => item.immutable),
        invalidUniverseVersionIds,
        allLiveExecutionLocked: [...datasetVersions, ...quarantines, ...memberships, ...universeVersions]
          .every((item) => item.liveExecution === 'locked') },
      liveExecution: 'locked' as const };
  }
}
