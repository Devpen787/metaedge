import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { FlywheelControlStore } from '../../server/discovery/control_store.js';
import { CouncilStore } from '../../server/discovery/council_store.js';
import { DataWorldStore } from '../../server/discovery/data_world_store.js';
import { FlywheelLedger } from '../../server/discovery/flywheel_store.js';
import { ForwardLearningStore } from '../../server/discovery/forward_learning_store.js';
import { LaneSignalStore } from '../../server/discovery/lane_signal_store.js';
import { buildV3OperatorSnapshot } from '../../server/discovery/operator_snapshot.js';
import { PortfolioOperationStore } from '../../server/discovery/portfolio_operation_store.js';
import { SignalResearchStore } from '../../server/discovery/signal_store.js';
import { ValidationStore } from '../../server/discovery/validation_store.js';
import { WorldStore } from '../../server/discovery/world_store.js';

test('unified v3 operator snapshot never confuses an empty paper operation with proven alpha', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-operator-'));
  try {
    const snapshot = buildV3OperatorSnapshot({ control: new FlywheelControlStore(path.join(root, 'control')),
      dataWorld: new DataWorldStore(path.join(root, 'data-world')), world: new WorldStore(path.join(root, 'world')),
      signals: new SignalResearchStore(path.join(root, 'signals')), lanes: new LaneSignalStore(path.join(root, 'lanes')),
      council: new CouncilStore(path.join(root, 'council')), validation: new ValidationStore(path.join(root, 'validation')),
      portfolio: new PortfolioOperationStore(path.join(root, 'portfolio')),
      forward: new ForwardLearningStore(path.join(root, 'forward')), flywheel: new FlywheelLedger(path.join(root, 'flywheel')),
      now: Date.UTC(2026, 6, 15) });
    assert.equal(snapshot.verdict.operationStatus, 'degraded');
    assert.equal(snapshot.verdict.economicResult, 'no_promoted_alpha');
    assert.equal(snapshot.verdict.capitalStatus, 'live_locked');
    assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
    assert.equal(snapshot.liveExecution, 'locked');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
