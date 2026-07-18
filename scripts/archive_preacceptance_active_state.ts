import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const project = process.cwd(); const activeRoot = path.join(project, 'data', 'opportunity-factory-v3');
const cutoverAt = Date.now(); const archiveRoot = path.join(project, 'data', 'archive',
  `flywheel-recovery-preacceptance-${cutoverAt}`);
const names = ['fast-perps', 'economics', 'live-review', 'operator'];

function filesBelow(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name); return entry.isDirectory() ? filesBelow(target) : [target];
  }).sort();
}

function directoriesBelow(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const target = path.join(root, entry.name);
    return [target, ...directoriesBelow(target)];
  }).sort();
}

function inventory(root: string) {
  const files = filesBelow(root); const hash = crypto.createHash('sha256'); let bytes = 0;
  for (const file of files) {
    const content = fs.readFileSync(file); const relative = path.relative(root, file); bytes += content.length;
    hash.update(relative); hash.update('\0'); hash.update(crypto.createHash('sha256').update(content).digest('hex')); hash.update('\n');
  }
  return { files: files.length, bytes, digest: hash.digest('hex') };
}

fs.mkdirSync(archiveRoot, { recursive: false }); const moved: Record<string, ReturnType<typeof inventory>> = {};
for (const name of names) {
  const source = path.join(activeRoot, name); if (!fs.existsSync(source)) continue;
  moved[name] = inventory(source); fs.renameSync(source, path.join(archiveRoot, name));
}
const cutover = { schemaVersion: 1, cutoverAt, reason: 'RECOVERY_PREACCEPTANCE_STATE_NOT_ACCEPTANCE_EVIDENCE',
  evidenceBeforeCutover: 'historical_replay', evidenceAtOrAfterCutover: 'paper_forward', archiveRoot,
  moved, promotable: false, liveExecution: 'locked' };
fs.writeFileSync(path.join(archiveRoot, 'manifest.json'), JSON.stringify(cutover, null, 2));
fs.writeFileSync(path.join(activeRoot, 'fast-perp-cutover.json'), JSON.stringify(cutover, null, 2));
for (const file of filesBelow(archiveRoot)) fs.chmodSync(file, 0o444);
for (const directory of [archiveRoot, ...directoriesBelow(archiveRoot)].reverse()) {
  fs.chmodSync(directory, 0o555);
}
console.log(JSON.stringify(cutover, null, 2));
