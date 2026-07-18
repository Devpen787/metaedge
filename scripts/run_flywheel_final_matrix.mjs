import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd(); const logRoot = path.join(root, 'output', 'proof', 'flywheel-recovery', 'command-logs');
fs.rmSync(logRoot, { recursive: true, force: true }); fs.mkdirSync(logRoot, { recursive: true });
const burnin = process.argv[2]; if (!burnin) throw new Error('BURNIN_RUN_DIRECTORY_REQUIRED');
const commands = [
  ['verify-burnin', 'node', ['scripts/verify_fast_perp_availability_burnin.mjs', burnin]],
  ['persisted-state', 'npx', ['tsx', 'scripts/verify_flywheel_recovery.ts']],
  ['discovery-tests', 'npm', ['run', 'test:discovery']],
  ['decision-tests', 'npm', ['run', 'test:decision']],
  ['reference-parity', 'npm', ['run', 'discovery:reference']],
  ['truth-mutations', 'npm', ['run', 'test:truth-mutations']],
  ['availability-proof', 'npm', ['run', 'fast-perp:availability-proof']],
  ['typecheck', 'npm', ['run', 'lint']],
  ['production-build', 'npm', ['run', 'build']],
  ['browser-smoke', 'npm', ['run', 'smoke:tabs']],
  ['capability-matrix', 'node', ['scripts/capability_matrix.mjs', '--strict']],
  ['diff-check', 'git', ['diff', '--check']],
];
const results = [];
for (const [name, command, args] of commands) {
  const startedAt = Date.now(); const result = spawnSync(command, args, { cwd: root, encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024, env: { ...process.env, LIVE_EXECUTION_ENABLED: 'false',
      LIVE_REVIEW_EXECUTION_CERTIFIED: 'false', VERIFY_RUNTIME_REQUIRED: name === 'persisted-state' ? 'true' : 'false' } });
  const output = `${result.stdout || ''}${result.stderr || ''}`; const file = path.join(logRoot, `${name}.log`);
  fs.writeFileSync(file, output); results.push({ name, command: [command, ...args].join(' '),
    startedAt, completedAt: Date.now(), exitCode: result.status, signal: result.signal,
    bytes: Buffer.byteLength(output), sha256: crypto.createHash('sha256').update(output).digest('hex'),
    log: path.relative(root, file) });
  if (result.status !== 0) break;
}
const summary = { schemaVersion: 1, generatedAt: Date.now(), burnin: path.resolve(burnin), results,
  passed: results.length === commands.length && results.every((row) => row.exitCode === 0), liveExecution: 'locked' };
const output = path.join(root, 'output', 'proof', 'flywheel-recovery', 'final-verification-matrix.json');
fs.writeFileSync(output, JSON.stringify(summary, null, 2)); console.log(JSON.stringify({ output, ...summary }, null, 2));
if (!summary.passed) process.exitCode = 1;
