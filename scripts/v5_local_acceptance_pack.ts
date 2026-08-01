import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const databaseUrl = path.resolve(process.env.DATABASE_URL || '');
if (process.env.METAEDGE_RESILIENCE_ISOLATED !== 'true'
  || !databaseUrl.includes('metaedge-v5-resilience.')
  || !databaseUrl.endsWith(`${path.sep}db.json`)) {
  throw new Error('V5_ACCEPTANCE_REQUIRES_ISOLATED_TEMP_DATABASE');
}
assert.equal(fs.existsSync(databaseUrl), false, 'refusing to overwrite an existing acceptance database');

const tsx = path.resolve('node_modules/.bin/tsx');
const environment = { ...process.env, DATABASE_URL: databaseUrl, METAEDGE_RESILIENCE_ISOLATED: 'true' };
const resilienceOutput = execFileSync(tsx, [path.resolve('scripts/v5_resilience_assurance.ts')], {
  cwd: process.cwd(), env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const resilience = JSON.parse(resilienceOutput);
assert.equal(resilience.passedScenarios, 7);

const burnInOutput = execFileSync(tsx, [path.resolve('scripts/v5_population_burnin.ts'), '10', '--summary-only'], {
  cwd: process.cwd(), env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
const burnInStart = burnInOutput.indexOf('{\n  "mode"');
assert.ok(burnInStart >= 0, 'population burn-in report missing');
const burnIn = JSON.parse(burnInOutput.slice(burnInStart));

const { assessPopulationBurnInV5 } = await import('../server/v5/population.js');
const { recordLocalAcceptanceBundleV5 } = await import('../server/v5/operator_truth.js');
const assessment = assessPopulationBurnInV5();
assert.equal(assessment.verdict, 'go_local_paper_operation', JSON.stringify(assessment));
assert.deepEqual(assessment.reasons, []);
assert.equal(assessment.liveExecution, 'locked');
const acceptanceBundle = recordLocalAcceptanceBundleV5();
assert.equal(acceptanceBundle.mechanicsVerdict, 'go_local_paper_operation');
assert.equal(acceptanceBundle.economicEdgeProven, false);
assert.equal(acceptanceBundle.deploymentAuthorized, false);
if (process.env.METAEDGE_ACCEPTANCE_BUNDLE_PATH) {
  fs.writeFileSync(process.env.METAEDGE_ACCEPTANCE_BUNDLE_PATH, `${JSON.stringify(acceptanceBundle, null, 2)}\n`, { flag: 'wx' });
}

console.log(JSON.stringify({
  mode: 'Paper money',
  scope: 'isolated_local_mechanics_only',
  economicEdgeProven: false,
  deploymentAuthorized: false,
  liveExecution: 'locked',
  databaseUrl,
  resilienceScenarios: resilience.passedScenarios,
  assuranceRecords: resilience.assuranceRecords.length,
  completedCycles: burnIn.completedCycles,
  cleanCycles: burnIn.cleanCycles,
  totalEvaluated: burnIn.totalEvaluated,
  totalRouted: burnIn.totalRouted,
  parity: burnIn.parity,
  assessment,
  acceptanceBundle,
}, null, 2));
