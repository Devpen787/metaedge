import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FlywheelControlStore } from '../../server/discovery/control_store.js';
import { CouncilStore } from '../../server/discovery/council_store.js';
import { DataWorldStore } from '../../server/discovery/data_world_store.js';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import { FlywheelLedger } from '../../server/discovery/flywheel_store.js';
import { ForwardLearningStore } from '../../server/discovery/forward_learning_store.js';
import { LaneSignalStore } from '../../server/discovery/lane_signal_store.js';
import { MetaMaskLiveReviewStore } from '../../server/discovery/metamask_live_review.js';
import { buildV5OperatorSnapshot } from '../../server/discovery/operator_snapshot.js';
import { PortfolioOperationStore } from '../../server/discovery/portfolio_operation_store.js';
import { SignalResearchStore } from '../../server/discovery/signal_store.js';
import { ValidationStore } from '../../server/discovery/validation_store.js';
import { WorldStore } from '../../server/discovery/world_store.js';

function emptyOperatorStores(root: string) {
  return { control: new FlywheelControlStore(path.join(root, 'control')),
    dataWorld: new DataWorldStore(path.join(root, 'data-world')), world: new WorldStore(path.join(root, 'world')),
    signals: new SignalResearchStore(path.join(root, 'signals')), lanes: new LaneSignalStore(path.join(root, 'lanes')),
    council: new CouncilStore(path.join(root, 'council')), validation: new ValidationStore(path.join(root, 'validation')),
    portfolio: new PortfolioOperationStore(path.join(root, 'portfolio')),
    forward: new ForwardLearningStore(path.join(root, 'forward')),
    economics: new EconomicOperationStore(path.join(root, 'economics')),
    fastPerps: new FastPerpEvidenceStore(path.join(root, 'fast-perps')),
    liveReview: new MetaMaskLiveReviewStore(path.join(root, 'live-review')),
    flywheel: new FlywheelLedger(path.join(root, 'flywheel')) };
}

test('unified v5 operator snapshot never confuses an empty paper operation with proven alpha', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-operator-'));
  try {
    const snapshot = buildV5OperatorSnapshot({ ...emptyOperatorStores(root), now: Date.UTC(2026, 6, 15) });
    assert.equal(snapshot.authorityVersion, 5);
    assert.equal(snapshot.schema, 'opportunity-factory-operator.v5');
    assert.equal(snapshot.schemaVersion, 5);
    assert.equal(snapshot.legacyComponentsReadOnly, true);
    assert.equal(snapshot.verdict.operationStatus, 'degraded');
    assert.equal(snapshot.verdict.economicResult, 'no_promoted_alpha');
    assert.equal(snapshot.verdict.capitalStatus, 'live_locked');
    assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
    assert.equal(snapshot.liveExecution, 'locked');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('operator snapshot exposes an enabled two-key runtime instead of painting the live lock green', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-operator-enabled-'));
  const previousEnabled = process.env.LIVE_EXECUTION_ENABLED;
  const previousCertified = process.env.LIVE_REVIEW_EXECUTION_CERTIFIED;
  process.env.LIVE_EXECUTION_ENABLED = 'true';
  process.env.LIVE_REVIEW_EXECUTION_CERTIFIED = 'true';
  try {
    const snapshot = buildV5OperatorSnapshot({ ...emptyOperatorStores(root), now: Date.UTC(2026, 6, 15) });
    assert.equal(snapshot.verdict.capitalStatus, 'live_enabled');
    assert.equal(snapshot.metaMaskLiveReview.liveExecution, 'enabled');
    assert.equal(snapshot.integrity.allLiveExecutionLocked, false);
    assert.equal(snapshot.liveExecution, 'enabled');
  } finally {
    if (previousEnabled == null) delete process.env.LIVE_EXECUTION_ENABLED;
    else process.env.LIVE_EXECUTION_ENABLED = previousEnabled;
    if (previousCertified == null) delete process.env.LIVE_REVIEW_EXECUTION_CERTIFIED;
    else process.env.LIVE_REVIEW_EXECUTION_CERTIFIED = previousCertified;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
