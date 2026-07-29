import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const burnin = path.resolve(process.argv[2] || '');
if (!burnin || !fs.existsSync(burnin)) throw new Error('BURNIN_RUN_DIRECTORY_REQUIRED');

const required = [
  path.join(burnin, 'summary.json'),
  path.join(burnin, 'series.jsonl'),
  'output/proof/flywheel-recovery/availability-burnin-verification.json',
  'output/proof/flywheel-recovery/availability-split-proof.json',
  'output/proof/flywheel-recovery/real-batch-proof.json',
  'output/proof/flywheel-recovery/persisted-state-verification.json',
  'output/proof/flywheel-recovery/deterministic-replay.json',
  'output/proof/flywheel-recovery/truth-mutation-proof.json',
  'output/proof/flywheel-recovery/final-verification-matrix.json',
  'output/playwright/flywheel-recovery/browser-proof.json',
  'output/playwright/flywheel-recovery/research-fleet-desktop.png',
  'output/playwright/flywheel-recovery/research-fleet-mobile.png',
  'data/archive/flywheel-recovery-preacceptance-1784201556251/manifest.json',
  'data/opportunity-factory-v3/fast-perp-cutover.json',
  'schemas/flywheel-recovery/v1/contracts.schema.json',
  'tests/fixtures/flywheel_recovery_contracts_v1.json',
  'docs/decision_records/2026-07-16-flywheel-availability-split.md',
].map((file) => path.isAbsolute(file) ? file : path.join(root, file));

const walk = (directory) => !fs.existsSync(directory) ? [] : fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) throw new Error(`PROOF_INPUT_MISSING:${missing.map((file) => path.relative(root, file)).join(',')}`);

const additional = [
  ...walk(path.join(root, 'output', 'proof', 'flywheel-recovery', 'command-logs')),
  ...walk(path.join(root, 'data', 'opportunity-factory-v3', 'research-bridge', 'attempts')),
  ...walk(path.join(root, 'data', 'opportunity-factory-v3', 'research-bridge', 'imports')),
  ...walk(path.join(root, 'output', 'proof', 'flywheel-recovery')).filter((file) => path.basename(file) === 'INVALIDATED.json'),
];

const sha256 = (file) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', (chunk) => hash.update(chunk)).on('error', reject)
    .on('end', () => resolve(hash.digest('hex')));
});

const files = [...new Set([...required, ...additional])].sort();
const entries = [];
for (const file of files) {
  const stat = fs.statSync(file);
  entries.push({ file: path.relative(root, file), bytes: stat.size, sha256: await sha256(file) });
}

const manifest = { schemaVersion: 1, generatedAt: Date.now(), burnin: path.relative(root, burnin),
  entries, missing: [], liveExecution: 'locked' };
const output = path.join(root, 'output', 'proof', 'flywheel-recovery', 'proof-manifest.json');
fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ output, files: entries.length, totalBytes: entries.reduce((sum, row) => sum + row.bytes, 0),
  liveExecution: manifest.liveExecution }, null, 2));
