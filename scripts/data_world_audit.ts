import fs from 'node:fs';
import path from 'node:path';
import { createDatasetVersion, createUniverseVersion, makeCurrentMembership } from '../server/discovery/data_world.js';
import { DataWorldStore } from '../server/discovery/data_world_store.js';
import { FlywheelLedger } from '../server/discovery/flywheel_store.js';
import type { FlywheelLane } from '../server/discovery/flywheel_types.js';

function jsonlFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name); const stat = fs.statSync(full);
      if (stat.isDirectory()) visit(full); else if (stat.isFile() && name.endsWith('.jsonl')) files.push(full);
    }
  };
  visit(root); return files;
}

const now = Date.now();
const store = new DataWorldStore();
const { version, quarantines } = createDatasetVersion({ files: jsonlFiles(path.join(process.cwd(), 'data', 'market')),
  source: 'local-market-evidence', createdAt: now });
store.appendDatasetVersions([version]);
store.appendQuarantines(quarantines);
const coverage = new FlywheelLedger().snapshot().coverage;
if (coverage) {
  for (const [lane, entry] of Object.entries(coverage.lanes) as Array<[FlywheelLane, { symbols?: string[]; universeAuthority?: string }]>) {
    if (!entry.symbols?.length) continue;
    store.appendMemberships(makeCurrentMembership({ lane, symbols: entry.symbols, at: now,
      sourceVersionId: version.id, authority: entry.universeAuthority ?? 'current flywheel coverage snapshot' }));
  }
}
const allMemberships = store.readMemberships();
if (allMemberships.length) store.appendUniverseVersions([createUniverseVersion(allMemberships, now)]);
const snapshot = store.snapshot();
const quarantinedFiles = version.files.filter((file) => file.status === 'quarantined');
console.log(JSON.stringify({ status: quarantinedFiles.length ? 'quarantined' : 'pass', datasetVersionId: version.id,
  files: version.files.length, records: version.files.reduce((sum, file) => sum + file.records, 0),
  validFiles: version.files.filter((file) => file.status === 'valid').length,
  quarantinedFiles: quarantinedFiles.map((file) => ({ path: file.path, issues: file.issues })),
  quarantineRecords: quarantines.length, currentSnapshotMemberships: snapshot.memberships.length,
  historicalMemberships: snapshot.memberships.filter((item) => item.historyStatus === 'historical_membership').length,
  universeVersionId: snapshot.latestUniverseVersion?.id ?? null,
  universeHistoryStatus: snapshot.latestUniverseVersion?.historyStatus ?? null,
  survivorshipSafe: snapshot.latestUniverseVersion?.survivorshipSafe ?? false,
  survivorshipWarning: 'Current snapshot memberships are persisted but are ineligible for historical as-of claims.',
  integrity: snapshot.integrity, liveExecution: snapshot.liveExecution }, null, 2));
