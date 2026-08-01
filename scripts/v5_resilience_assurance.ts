import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl = path.resolve(process.env.DATABASE_URL || '');
if (process.env.METAEDGE_RESILIENCE_ISOLATED !== 'true'
  || !databaseUrl.includes('metaedge-v5-resilience.')
  || !databaseUrl.endsWith(`${path.sep}db.json`)) {
  throw new Error('V5_RESILIENCE_REQUIRES_ISOLATED_TEMP_DATABASE');
}
assert.equal(fs.existsSync(databaseUrl), false, 'refusing to overwrite an existing assurance database');

const tsx = path.resolve('node_modules/.bin/tsx');
const phaseScript = path.resolve('scripts/v5_resilience_phase.ts');
const phases = [
  'setup',
  'lifecycle_prepare', 'lifecycle_verify',
  'portfolio_veto_verify',
  'intent_prepare', 'intent_verify',
  'partial_prepare', 'partial_verify',
  'outcome_prepare', 'outcome_verify',
  'stale_verify',
  'write_failure_verify',
];
const phaseResults = phases.map((phase) => {
  const output = execFileSync(tsx, [phaseScript, phase], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const line = output.split('\n').filter(Boolean).at(-1);
  assert.ok(line, `missing result for ${phase}`);
  const parsed = JSON.parse(line);
  assert.equal(parsed.passed, true, `phase did not pass: ${phase}`);
  return parsed;
});

const { assessPopulationBurnInV5 } = await import('../server/v5/population.js');
const { readDatabase } = await import('../server/storage.js');
const db = readDatabase();
const assessment = assessPopulationBurnInV5(db);
const records = db.populationOperationsV5?.assuranceRecords || [];
assert.equal(records.length, 7);
for (const key of [
  'portfolioVetoObserved',
  'lifecycleReactivationObserved',
  'intentRestartRecoveryVerified',
  'partialFillRestartRecoveryVerified',
  'outcomeRestartRecoveryVerified',
  'staleDataRejectionVerified',
  'writeFailureInjectionVerified',
] as const) assert.equal(assessment.evidence[key], true, `${key} not earned`);

console.log(JSON.stringify({
  mode: 'Paper money',
  liveExecution: 'locked',
  databaseUrl,
  passedScenarios: 7,
  assuranceRecords: records,
  assessment,
  phaseResults,
}, null, 2));
