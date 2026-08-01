import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('seven isolated cross-process resilience scenarios earn exactly seven linked V5 assurance records', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-v5-resilience.'));
  const databaseUrl = path.join(dir, 'db.json');
  try {
    const output = execFileSync(path.resolve('node_modules/.bin/tsx'), [path.resolve('scripts/v5_resilience_assurance.ts')], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl, METAEDGE_RESILIENCE_ISOLATED: 'true' },
      encoding: 'utf8',
    });
    const report = JSON.parse(output);
    assert.equal(report.passedScenarios, 7);
    assert.equal(report.assuranceRecords.length, 7);
    assert.equal(report.liveExecution, 'locked');
    assert.equal(report.assessment.evidence.intentRestartRecoveryVerified, true);
    assert.equal(report.assessment.evidence.partialFillRestartRecoveryVerified, true);
    assert.equal(report.assessment.evidence.outcomeRestartRecoveryVerified, true);
    assert.equal(report.assessment.evidence.staleDataRejectionVerified, true);
    assert.equal(report.assessment.evidence.writeFailureInjectionVerified, true);
    assert.equal(report.assessment.evidence.portfolioVetoObserved, true);
    assert.equal(report.assessment.evidence.lifecycleReactivationObserved, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
