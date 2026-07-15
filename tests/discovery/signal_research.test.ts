import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildParameterSurface, buildSignalResearchArtifact, compileSignalPoints, makeSignalTransformSpec,
} from '../../server/discovery/signal_research.js';
import { SignalResearchStore } from '../../server/discovery/signal_store.js';
import type { SignalInputPoint } from '../../server/discovery/signal_types.js';

function inputs(count = 360): SignalInputPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const benchmarkReturnBps = Math.sin(index / 7) * 35 + Math.cos(index / 17) * 10;
    const idiosyncratic = Math.sin(index / 13) * 22 + (index % 29 === 0 ? 40 : 0);
    return { at: index * 1_000, availableAt: index * 1_000 + 500,
      assetReturnBps: 1.4 * benchmarkReturnBps + idiosyncratic, benchmarkReturnBps,
      sourceEventIds: [`event_${index}`] };
  });
}

test('signal transforms are causal, residualized, normalized, smoothed, and calibrated from training only', () => {
  const spec = makeSignalTransformSpec({ normalization: 'causal_zscore', normalizationWindow: 20,
    smoothing: 'ema', smoothingAlpha: 0.3, residualization: 'rolling_ols_beta', residualWindow: 20,
    calibration: 'training_quantile_laplace', calibrationBins: 5, orientation: 'follow', declaredTrials: 12 });
  const source = inputs();
  const first = compileSignalPoints(source, spec, 5);
  const changedFuture = source.map((row, index) => index < 300 ? row : { ...row, assetReturnBps: row.assetReturnBps + 10_000 });
  const second = compileSignalPoints(changedFuture, spec, 5);
  assert.deepEqual(first.slice(0, 250).map((row) => [row.residualized, row.normalized, row.smoothed, row.calibratedProbability]),
    second.slice(0, 250).map((row) => [row.residualized, row.normalized, row.smoothed, row.calibratedProbability]));
  assert.ok(first.slice(50).some((row) => row.residualized != null));
  assert.ok(first.slice(50).some((row) => row.normalized != null));
  assert.ok(first.slice(50).some((row) => row.smoothed != null));
  assert.ok(first.some((row) => row.calibratedProbability != null));
  assert.ok(first.every((row) => row.availableAt >= row.at));
});

test('parameter surface counts every tested choice and reports plateau evidence without inventing robustness', () => {
  const result = buildParameterSurface(inputs(), { normalization: 'causal_robust_zscore',
    normalizationWindows: [20, 40], smoothingAlphas: [0.2, 0.5], eventThresholds: [0.5, 1, 1.5],
    horizonBars: 5, toleranceFraction: 0.15 });
  assert.equal(result.points.length, 12);
  assert.equal(result.plateau.nearBestPoints.length / result.points.length, result.plateau.plateauFraction);
  assert.equal(result.plateau.robust,
    result.plateau.nearBestPoints.length >= 3 && result.plateau.adjacentNearBestPoints >= 2 && result.plateau.plateauFraction >= 0.2);
});

test('signal artifact binds transformations, event studies, information horizons, traffic, trials, and eligibility', () => {
  const artifact = buildSignalResearchArtifact({ datasetVersionId: 'dataset-v1', universeVersionId: 'universe-v1',
    worldContractId: 'world-v1', lane: 'spot_crypto', symbol: 'TEST', benchmark: 'BTC', points: inputs(),
    normalization: 'causal_zscore', normalizationWindows: [20, 40], smoothingAlphas: [0.2, 0.5],
    eventThresholds: [0.5, 1], horizons: [1, 5, 20], historicalResearchEligible: false,
    paperForwardEligible: true, blockers: ['HISTORICAL_MEMBERSHIP_UNAVAILABLE'], createdAt: 100 });
  assert.equal(artifact.transform.declaredTrials, 15);
  assert.equal(artifact.researchChoices.reduce((sum, choice) => sum + choice.trialCost, 0), 15);
  assert.ok(['follow', 'invert'].includes(artifact.transform.orientation));
  assert.equal(artifact.parameterSurface.length, 8);
  assert.equal(artifact.eventStudies.length, 18);
  assert.equal(artifact.informationHorizon.length, 3);
  assert.ok(artifact.traffic.length > 0);
  assert.equal(artifact.historicalResearchEligible, false);
  assert.equal(artifact.paperForwardEligible, true);
  assert.equal(artifact.methodDisposition, 'insufficient');
  assert.equal(artifact.promotionDisposition, 'blocked');
  assert.ok(artifact.decisionReasons.includes('HISTORICAL_RESEARCH_NOT_ELIGIBLE'));
  assert.equal(artifact.liveExecution, 'locked');
  const store = new SignalResearchStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-signal-store-')));
  store.appendArtifacts([artifact, artifact]);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.counts, { artifacts: 1, currentSignals: 1 });
  assert.deepEqual(snapshot.integrity.invalidArtifactIds, []);
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});
