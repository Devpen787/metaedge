import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPaperTradeContract } from '../../server/discovery/economic_runtime.js';
import {
  buildLiveReviewPreparation,
  LIVE_REVIEW_CONFIRMATION,
  MetaMaskLiveReviewStore,
} from '../../server/discovery/metamask_live_review.js';

function contract() {
  return buildPaperTradeContract({
    candidateId: 'candidate_btc', strategyFamilyId: 'book_imbalance_continuation', lane: 'perpetuals',
    speedTier: 'fast_event', mechanism: 'persistent executable bid imbalance', trigger: 'imbalance > 0.5',
    instrument: 'BTC-PERP', venue: 'hyperliquid', side: 'long', executionPolicy: 'taker_market', decisionAt: 1_000, evidenceCutoffAt: 999,
    edgeHalfLifeMs: 10 * 60_000, entryRule: 'market after quote', exitRule: 'time stop', expiresAt: 60_000,
    predictedGrossEdgeBps: 20,
    costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1, fundingBps: 0, borrowBps: 0,
      adverseSelectionBps: 2, latencyBps: 1 }, uncertaintyBufferBps: 3,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.57, lowerBoundNetEdgeBps: 4,
      independentHistoricalSamples: 200, untouchedForwardSamples: 120, fundedPaperSamples: 350 },
    capacity: { requestedPaperUsd: 500, deployableUsd: 1_000, participationRate: 0.01 }, opportunitiesPerDay: 5,
    maximumExistingCorrelation: 0.1, tailRiskPenaltyUsdPerDay: 0.1, drawdownPenaltyUsdPerDay: 0.1,
    riskLimits: { maximumPositionUsd: 500, maximumLossPerTradeUsd: 5, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 1_000, maximumConsecutiveLosses: 5 },
    provenance: { datasetVersionId: 'dataset_1', universeVersionId: 'universe_1', worldContractId: 'world_1',
      sourceEventIds: ['event_1'], signalArtifactIds: ['signal_1'], validationEvaluationIds: ['validation_1'],
      sourceVenue: 'hyperliquid', sourceVersion: 'websocket-v1', feeProvenance: 'authenticated_venue' },
    killRule: { maximumForwardLossBps: 30, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 5,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.5, action: 'kill_and_research', immutable: true },
    createdAt: 1_001,
  });
}

const readyChecks = [
  { id: 'wallet_connected', status: 'ready' as const, summary: 'ready' },
  { id: 'canonical_wallet', status: 'ready' as const, summary: 'ready' },
  { id: 'policy', status: 'ready' as const, summary: 'ready' },
  { id: 'live_lock', status: 'blocked' as const, summary: 'runtime remains locked' },
];

function preparation(overrides: Partial<Parameters<typeof buildLiveReviewPreparation>[0]> = {}) {
  return buildLiveReviewPreparation({
    contract: contract(), lifecycleState: 'live_review', userId: 'usr_owner1',
    trade: { symbol: 'BTC', side: 'long', size: 0.005, leverage: 2, orderType: 'market' },
    signal: { decisionId: 'shadow_decision_current', evidenceMode: 'paper_forward', decidedAt: 9_900, expiresAt: 40_000,
      sourceEventIds: ['book_event_current', 'trade_event_current'], symbol: 'BTC', side: 'long' },
    promotionEvidence: { historicalSamples: 200, untouchedForwardSamples: 120, fundedPaperSamples: 350,
      forwardNetEdgeLowerBoundBps: 4, costStressedNetEdgeLowerBoundBps: 2, worstNetReturnBps: -20,
      realizedNetPnlUsd: 40, fillRate: 0.8, costCalibrationErrorFraction: 0.1, maximumDrawdownUsd: 20,
      consecutiveLosses: 2, sourceObservationIds: ['funded_outcome_1'] },
    quote: { quoteReference: 'quote_12345678', quotedAt: 10_000, quoteLatencyMs: 500, notionalUsd: 400,
      entryPrice: 80_000, estimatedFeeUsd: 0.2, estimatedLiquidationPrice: 42_000 },
    readinessChecks: readyChecks, now: 10_000, ...overrides,
  });
}

test('live-review packet binds contract, quote, risk, wallet readiness, and exact trade', () => {
  const row = preparation();
  assert.equal(row.executableAfterHumanApproval, true);
  assert.equal(row.blockers.length, 0);
  assert.equal(row.trade.symbol, 'BTC');
  assert.equal(row.contractLimits.killRule.immutable, true);
  assert.equal(row.executionBounds.maximumSlippageBps, 50);
  assert.equal(row.executionBounds.maximumNotionalUsd, 500);
  assert.match(row.packetDigest, /^[a-f0-9]{64}$/);
  assert.equal(row.liveExecution, 'locked_until_explicit_runtime_authorization');
  assert.throws(() => preparation({ trade: { symbol: 'ETH', side: 'long', size: 1, leverage: 2, orderType: 'market' } }),
    /SYMBOL_CONTRACT_MISMATCH/);
});

test('non-live-review, oversized, stale, and latency-incompatible packets remain blocked', () => {
  const row = preparation({ lifecycleState: 'funded_paper', quote: { ...preparation().quote, notionalUsd: 700,
    quotedAt: 1_000, quoteLatencyMs: 250_000 } });
  assert.equal(row.executableAfterHumanApproval, false);
  assert.ok(row.blockers.includes('CONTRACT_NOT_IN_LIVE_REVIEW'));
  assert.ok(row.blockers.includes('QUOTE_EXCEEDS_CONTRACT_POSITION_LIMIT'));
  assert.ok(row.blockers.includes('EXECUTION_LATENCY_TOO_LARGE_FOR_EDGE_HALF_LIFE'));
});

test('canary and historical decisions can never prepare a live execution packet', () => {
  assert.throws(() => preparation({ signal: { ...preparation().signal, evidenceMode: 'canary' } }),
    /SIGNAL_NOT_PAPER_FORWARD/);
});

test('human authorization is exact, owner-bound, expiring, and one-use', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-live-review-'));
  const store = new MetaMaskLiveReviewStore(root);
  const row = preparation();
  store.appendPreparation(row);
  assert.throws(() => store.authorize({ preparationId: row.id, packetDigest: row.packetDigest, userId: row.userId,
    confirmation: 'yes', now: 10_001 }), /EXPLICIT_CONFIRMATION_REQUIRED/);
  assert.throws(() => store.authorize({ preparationId: row.id, packetDigest: row.packetDigest, userId: 'usr_other1',
    confirmation: LIVE_REVIEW_CONFIRMATION, now: 10_001 }), /PREPARATION_NOT_FOUND/);
  const authorization = store.authorize({ preparationId: row.id, packetDigest: row.packetDigest, userId: row.userId,
    confirmation: LIVE_REVIEW_CONFIRMATION, now: 10_001 });
  const validated = store.validateForConsumption({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: row.trade, now: 10_002 });
  assert.equal(validated.id, authorization.id);
  assert.throws(() => store.validateForConsumption({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: { ...row.trade, leverage: 3 }, now: 10_002 }), /TRADE_MUTATED/);
  const reservation = store.reserveForExecution({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: row.trade, now: 10_003 });
  store.consume(authorization, 'hyperliquid_order_1', 10_004, reservation.id);
  assert.throws(() => store.validateForConsumption({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: row.trade, now: 10_004 }), /ALREADY_USED/);
  assert.equal(store.snapshot().integrity.allLiveExecutionLocked, true);
});

test('50 concurrent execution reservations allow exactly one wallet invocation owner', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-live-review-race-'));
  const store = new MetaMaskLiveReviewStore(root); const row = preparation(); store.appendPreparation(row);
  const authorization = store.authorize({ preparationId: row.id, packetDigest: row.packetDigest, userId: row.userId,
    confirmation: LIVE_REVIEW_CONFIRMATION, now: 10_001 });
  const attempts = await Promise.allSettled(Array.from({ length: 50 }, () => Promise.resolve().then(() =>
    store.reserveForExecution({ authorizationId: authorization.id, packetDigest: row.packetDigest,
      userId: row.userId, trade: row.trade, now: 10_002 }))));
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(store.snapshot().counts.reserved, 1);
});

test('a failed or uncertain wallet reservation is terminal and cannot invoke the wallet again', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-live-review-terminal-'));
  const store = new MetaMaskLiveReviewStore(root); const row = preparation(); store.appendPreparation(row);
  const authorization = store.authorize({ preparationId: row.id, packetDigest: row.packetDigest, userId: row.userId,
    confirmation: LIVE_REVIEW_CONFIRMATION, now: 10_001 });
  store.reserveForExecution({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: row.trade, now: 10_002 });
  store.failReservation(authorization.id, 'WALLET_RESULT_UNCERTAIN', 10_003);
  assert.throws(() => store.reserveForExecution({ authorizationId: authorization.id, packetDigest: row.packetDigest,
    userId: row.userId, trade: row.trade, now: 10_004 }), /ALREADY_RESERVED|TERMINAL/);
});

test('live-lock snapshot reflects the current runtime switch instead of a constant label', () => {
  const before = process.env.LIVE_EXECUTION_ENABLED;
  try {
    process.env.LIVE_EXECUTION_ENABLED = 'true';
    process.env.LIVE_REVIEW_EXECUTION_CERTIFIED = 'true';
    const snapshot = new MetaMaskLiveReviewStore(fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-live-truth-'))).snapshot();
    assert.equal(snapshot.integrity.allLiveExecutionLocked, false);
    assert.equal(snapshot.liveExecution, 'enabled');
  } finally {
    if (before == null) delete process.env.LIVE_EXECUTION_ENABLED; else process.env.LIVE_EXECUTION_ENABLED = before;
    delete process.env.LIVE_REVIEW_EXECUTION_CERTIFIED;
  }
});

test('one malformed authorization row preserves valid rows and creates a quarantine record', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-live-quarantine-'));
  const store = new MetaMaskLiveReviewStore(root); const row = preparation(); store.appendPreparation(row);
  fs.appendFileSync(path.join(root, 'preparations.jsonl'), '{malformed\n');
  assert.equal(store.readPreparations().length, 1);
  assert.equal(fs.existsSync(path.join(root, 'quarantine', 'malformed-jsonl.jsonl')), true);
});
