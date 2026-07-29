import fs from 'node:fs';
import path from 'node:path';
import { materializeV3OperatorSnapshot } from '../server/discovery/operator_snapshot.js';
import { FastPerpEvidenceStore } from '../server/discovery/fast_perp_store.js';

const snapshot = materializeV3OperatorSnapshot({ now: Date.now() });
const maintenanceFile = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'partition-maintenance.json');
let lastMaintenanceAt = 0;
try { lastMaintenanceAt = Number(JSON.parse(fs.readFileSync(maintenanceFile, 'utf8')).completedAt) || 0; } catch { /* first janitor run */ }
if (snapshot.generatedAt - lastMaintenanceAt >= 60_000) {
  const result = new FastPerpEvidenceStore().maintainPartitions(snapshot.generatedAt, 30, 2);
  const completedAt = result.remainingCompressionFiles > 0 ? lastMaintenanceAt : snapshot.generatedAt;
  const temporary = `${maintenanceFile}.${process.pid}.tmp`; fs.writeFileSync(temporary,
    JSON.stringify({ schemaVersion: 1, completedAt, attemptedAt: snapshot.generatedAt, ...result })); fs.renameSync(temporary, maintenanceFile);
}
const storageFile = path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'operator', 'storage-health.json');
const storageRoots = [path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'fast-perps'),
  path.join(process.cwd(), 'data', 'opportunity-factory-v3', 'economics')];
const bytes = (target: string): number => {
  try {
    const stat = fs.statSync(target); if (stat.isFile()) return stat.size;
    return fs.readdirSync(target).reduce((sum, entry) => sum + bytes(path.join(target, entry)), 0);
  } catch { return 0; }
};
const totalBytes = storageRoots.reduce((sum, root) => sum + bytes(root), 0);
let prior: { baselineAt: number; baselineBytes: number } | null = null;
try { prior = JSON.parse(fs.readFileSync(storageFile, 'utf8')); } catch { /* first materialization */ }
const baselineAt = Number(prior?.baselineAt) || snapshot.generatedAt;
const baselineBytes = Number(prior?.baselineBytes) || totalBytes;
const elapsedMs = Math.max(0, snapshot.generatedAt - baselineAt);
const diskGrowthBytesPerDay = elapsedMs > 0 ? Math.max(0, totalBytes - baselineBytes) / elapsedMs * 86_400_000 : null;
const storage = { schemaVersion: 1, sampledAt: snapshot.generatedAt, baselineAt, baselineBytes, totalBytes,
  diskGrowthBytesPerDay, healthy: elapsedMs < 5 * 60_000 || diskGrowthBytesPerDay == null
    || diskGrowthBytesPerDay <= 2 * 1024 * 1024 * 1024 };
fs.mkdirSync(path.dirname(storageFile), { recursive: true }); const temporary = `${storageFile}.${process.pid}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(storage)); fs.renameSync(temporary, storageFile);
console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, operationStatus: snapshot.verdict.operationStatus,
  storage, liveExecution: snapshot.liveExecution }));
