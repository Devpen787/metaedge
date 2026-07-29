import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import {
  ECONOMIC_OBJECTIVE_POLICY,
  buildPaperTradeContract,
  compoundPaperNav,
  evaluatePaperLifecycle,
  rankPaperTradeContracts,
} from '../../server/discovery/economic_runtime.js';

function contract(overrides: Partial<Parameters<typeof buildPaperTradeContract>[0]> = {}) {
  return buildPaperTradeContract({
    candidateId: 'candidate_fast_perp', strategyFamilyId: 'liquidation_rebound_v1', lane: 'perpetuals',
    speedTier: 'fast_event', mechanism: 'forced selling temporarily exhausts executable bids',
    trigger: 'liquidation burst followed by bid-depth recovery', instrument: 'SOL-PERP', venue: 'hyperliquid', side: 'long',
    executionPolicy: 'taker_market',
    decisionAt: 1_000, evidenceCutoffAt: 999, edgeHalfLifeMs: 60_000,
    entryRule: 'enter on first recovery frame', exitRule: 'exit at 20bps, -15bps, or 45 seconds', expiresAt: 46_000,
    predictedGrossEdgeBps: 16,
    costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1, fundingBps: 0,
      borrowBps: 0, adverseSelectionBps: 2, latencyBps: 1 }, uncertaintyBufferBps: 3,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.58, lowerBoundNetEdgeBps: 3,
      independentHistoricalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 500, deployableUsd: 2_000, participationRate: 0.02 }, opportunitiesPerDay: 8,
    maximumExistingCorrelation: 0.1, tailRiskPenaltyUsdPerDay: 0.1, drawdownPenaltyUsdPerDay: 0.05,
    riskLimits: { maximumPositionUsd: 500, maximumLossPerTradeUsd: 2, maximumStrategyDrawdownUsd: 50,
      maximumGrossExposureUsd: 1_000, maximumConsecutiveLosses: 8 },
    provenance: { datasetVersionId: 'dataset_1', universeVersionId: 'universe_1', worldContractId: 'world_1',
      sourceEventIds: ['event_1'], signalArtifactIds: [], validationEvaluationIds: [], sourceVenue: 'hyperliquid',
      sourceVersion: 'websocket-v1' },
    killRule: { maximumForwardLossBps: 30, maximumDrawdownUsd: 50, maximumConsecutiveLosses: 8,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true },
    createdAt: 1_001, ...overrides,
  });
}

test('economic objective admits small edges and ranks dollars per day rather than percentage moves', () => {
  const frequent = contract();
  assert.equal(frequent.conservativeNetEdgeBps, 5);
  assert.equal(frequent.confidence.lowerBoundNetEdgeBps, 3);
  assert.ok(frequent.economics.objectiveScoreUsdPerDay > 0);
  const rareLarge = contract({ candidateId: 'candidate_rare', strategyFamilyId: 'rare_large_move',
    predictedGrossEdgeBps: 500, uncertaintyBufferBps: 100, opportunitiesPerDay: 0.001,
    confidence: { ...contract().confidence, lowerBoundNetEdgeBps: 300 } });
  const ranked = rankPaperTradeContracts([rareLarge, frequent]);
  assert.equal(ranked[0].id, frequent.id);
});

test('contract makes costs, provenance, expiry, capacity, and immutable kill rule binding', () => {
  const row = contract();
  assert.equal(row.costs.totalBps, 8);
  assert.equal(row.lifecycleState, 'research_candidate');
  assert.deepEqual(row.lifecycleBlockers, []);
  assert.equal(row.liveExecution, 'locked');
  assert.throws(() => contract({ expiresAt: 70_000 }), /EXPIRY_EXCEEDS_EDGE_HALF_LIFE/);
  assert.throws(() => contract({ provenance: { ...row.provenance, sourceEventIds: [] } }), /PROVENANCE_INCOMPLETE/);
  assert.throws(() => contract({ killRule: { ...row.killRule, immutable: false as true } }), /KILL_RULE_NOT_IMMUTABLE/);
});

test('zero-valued placeholder tail and drawdown penalties are not promotion eligible', () => {
  const row = contract({ tailRiskPenaltyUsdPerDay: 0, drawdownPenaltyUsdPerDay: 0 });
  assert.ok(row.lifecycleBlockers.includes('TAIL_RISK_PENALTY_UNMEASURED'));
  assert.ok(row.lifecycleBlockers.includes('DRAWDOWN_PENALTY_UNMEASURED'));
  const event = evaluatePaperLifecycle({ contract: row, currentState: 'research_candidate', requestedState: 'shadow_paper',
    evidence: { historicalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: ['sample'] }, evaluatedAt: 2_000 });
  assert.equal(event.passed, false);
});

test('lifecycle is sequential and funded paper requires untouched executable evidence', () => {
  const row = contract();
  const baseEvidence = { historicalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0,
    forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
    realizedNetPnlUsd: 0, fillRate: null,
    costCalibrationErrorFraction: null, maximumDrawdownUsd: 0, consecutiveLosses: 0,
    sourceObservationIds: ['sample_1'] };
  const shadow = evaluatePaperLifecycle({ contract: row, currentState: 'research_candidate', requestedState: 'shadow_paper',
    evidence: baseEvidence, evaluatedAt: 2_000 });
  assert.equal(shadow.passed, true);
  const blockedFunding = evaluatePaperLifecycle({ contract: row, currentState: 'shadow_paper', requestedState: 'funded_paper',
    evidence: baseEvidence, evaluatedAt: 3_000 });
  assert.equal(blockedFunding.passed, false);
  assert.ok(blockedFunding.blockers.some((item) => item.startsWith('UNTOUCHED_FORWARD_SAMPLE_GATE')));
  const funded = evaluatePaperLifecycle({ contract: row, currentState: 'shadow_paper', requestedState: 'funded_paper',
    evidence: { ...baseEvidence, untouchedForwardSamples: 120, forwardNetEdgeLowerBoundBps: 2,
      costStressedNetEdgeLowerBoundBps: 1,
      realizedNetPnlUsd: 12, fillRate: 0.6, costCalibrationErrorFraction: 0.1,
      independentBlockCount: 10 }, evaluatedAt: 4_000 });
  assert.equal(funded.passed, true);
  assert.throws(() => evaluatePaperLifecycle({ contract: row, currentState: 'research_candidate', requestedState: 'funded_paper',
    evidence: baseEvidence }), /TRANSITION_NOT_SEQUENTIAL/);
});

test('small post-cost gains compound through sequential paper NAV', () => {
  const result = compoundPaperNav(1_000, Array.from({ length: 100 }, (_, index) => ({
    at: index, grossReturnBps: 8, totalCostBps: 3, netReturnBps: 0,
  })));
  assert.ok((result.at(-1)?.navAfterUsd ?? 0) > 1_051);
  assert.equal(result[0].netReturnBps, 5);
  assert.ok(result[99].pnlUsd > result[0].pnlUsd);
});

test('economic store is append-only, idempotent, and advances only passed transitions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-economics-'));
  const store = new EconomicOperationStore(root); const row = contract();
  store.appendContracts([row, row]);
  const evidence = { historicalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0,
    forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
    realizedNetPnlUsd: 0, fillRate: null,
    costCalibrationErrorFraction: null, maximumDrawdownUsd: 0, consecutiveLosses: 0,
    sourceObservationIds: ['sample_1'] };
  const shadow = evaluatePaperLifecycle({ contract: row, currentState: 'research_candidate', requestedState: 'shadow_paper',
    evidence, evaluatedAt: 2_000, policy: ECONOMIC_OBJECTIVE_POLICY });
  store.appendLifecycleEvents([shadow, shadow]);
  assert.equal(store.snapshot().counts.contracts, 1);
  assert.equal(store.snapshot().counts.shadow_paper, 1);
  assert.equal(store.snapshot().integrity.allLiveExecutionLocked, true);
});

test('new evidence supersedes the active contract lineage without deleting audit history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-economic-lineage-'));
  const store = new EconomicOperationStore(root); const first = contract();
  const next = contract({ decisionAt: 2_000, evidenceCutoffAt: 2_000, expiresAt: 47_000, createdAt: 2_001,
    provenance: { ...first.provenance, sourceEventIds: ['event_2'] } });
  store.appendContracts([first, next]); const snapshot = store.snapshot();
  assert.equal(snapshot.counts.contracts, 2);
  assert.equal(snapshot.counts.activeContracts, 1);
  assert.equal(snapshot.counts.supersededContracts, 1);
  assert.equal(snapshot.current[0].contract.id, next.id);
  assert.deepEqual(snapshot.integrity.supersededContractIds, [first.id]);
});
