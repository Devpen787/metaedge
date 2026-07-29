import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPaperTradeContract, evaluatePaperLifecycle } from '../../server/discovery/economic_runtime.js';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import { runFastShadowCycle } from '../../server/discovery/fast_shadow_runtime.js';
import type { FastPerpBookEvent, FastPerpTradeEvent } from '../../server/discovery/fast_perp_types.js';
import type { FastPerpResearchRun } from '../../server/discovery/fast_perp_research_types.js';

function book(index: number): FastPerpBookEvent {
  const eventTime = index * 5_000; const mid = 100 + index * 0.05; const bestBid = mid - 0.01; const bestAsk = mid + 0.01;
  return { id: `b${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL', eventTime,
    receivedAt: eventTime + 1, bids: [{ price: bestBid, size: 100, orders: 1 }], asks: [{ price: bestAsk, size: 100, orders: 1 }],
    bestBid, bestAsk, midPrice: mid, spreadBps: (bestAsk - bestBid) / mid * 10_000,
    bidDepthUsd: bestBid * 100, askDepthUsd: bestAsk * 100, imbalance: 0.8, liveExecution: 'locked' };
}
function trade(index: number): FastPerpTradeEvent {
  const eventTime = index * 5_000;
  return { id: `t${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL', eventTime,
    receivedAt: eventTime + 2, tradeId: index, sourceHash: null, side: 'sell', price: 100, size: 1_000,
    notionalUsd: 100_000, liquidation: null, liveExecution: 'locked' };
}

test('forward-only fast signals create deterministic shadow cohorts, fills, no-trade counterfactuals, and sequential NAV', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-shadow-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  const books = Array.from({ length: 80 }, (_, index) => book(index)); const trades = Array.from({ length: 80 }, (_, index) => trade(index));
  evidence.appendBooks(books); evidence.appendTrades(trades);
  const contract = buildPaperTradeContract({ candidateId: 'eval1', strategyFamilyId: 'book_imbalance_continuation',
    lane: 'perpetuals', speedTier: 'fast_event', mechanism: 'imbalance', trigger: 'imbalance', instrument: 'SOL-PERP',
    venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market', decisionAt: 200_001, evidenceCutoffAt: 200_001, edgeHalfLifeMs: 15_000,
    entryRule: 'next forward trigger', exitRule: '15 seconds', expiresAt: 215_001, predictedGrossEdgeBps: 20,
    costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1, fundingBps: 0, borrowBps: 0,
      adverseSelectionBps: 1, latencyBps: 1 }, uncertaintyBufferBps: 2,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.6, lowerBoundNetEdgeBps: 4,
      independentHistoricalSamples: 40, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 250, deployableUsd: 10_000, participationRate: 0.1 }, opportunitiesPerDay: 100,
    maximumExistingCorrelation: 0, tailRiskPenaltyUsdPerDay: 1, drawdownPenaltyUsdPerDay: 1,
    riskLimits: { maximumPositionUsd: 250, maximumLossPerTradeUsd: 10, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 500, maximumConsecutiveLosses: 8 },
    provenance: { datasetVersionId: 'd', universeVersionId: 'u', worldContractId: 'w', sourceEventIds: ['b0'],
      signalArtifactIds: ['eval1'], validationEvaluationIds: [], sourceVenue: 'hyperliquid', sourceVersion: 'test' },
    killRule: { maximumForwardLossBps: 50, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 8,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true }, createdAt: 200_001 });
  economics.appendContracts([contract]);
  economics.appendLifecycleEvents([evaluatePaperLifecycle({ contract, currentState: 'research_candidate', requestedState: 'shadow_paper',
    evidence: { historicalSamples: 40, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null,
      maximumDrawdownUsd: 0, consecutiveLosses: 0, sourceObservationIds: ['b0'] }, evaluatedAt: 200_001 })]);
  const evaluation = { id: 'eval1', schemaVersion: 1 as const, symbol: 'SOL', family: 'book_imbalance_continuation' as const,
    speedTier: 'fast_event' as const,
    selectedParameters: { horizonMs: 15_000, lookbackMs: 0, threshold: 0.2 }, declaredTrials: 10,
    training: { samples: 30, meanGrossReturnBps: 10, meanNetReturnBps: 3, lowerBoundNetEdgeBps: 1, winRate: 0.6 },
    validation: { samples: 20, meanGrossReturnBps: 10, meanNetReturnBps: 3, lowerBoundNetEdgeBps: 1, winRate: 0.6 },
    holdout: { samples: 20, meanGrossReturnBps: 10, meanNetReturnBps: 3, lowerBoundNetEdgeBps: 1, winRate: 0.6 },
    independentSamples: 70, opportunitiesPerDay: 100, estimatedCapacityUsd: 10_000,
    disposition: 'shadow_candidate' as const, blockers: [], sourceEventIds: ['b0'], evidenceCutoffAt: 200_001,
    liveExecution: 'locked' as const };
  const run: FastPerpResearchRun = { id: 'run1', schemaVersion: 1, sourceVersion: 'test', researchPolicyVersion: 'test-policy', evidenceFingerprint: 'f',
    datasetVersionId: 'd', universeVersionId: 'u', worldContractId: 'w', createdAt: 200_001, symbols: ['SOL'],
    speedTiers: ['fast_event'],
    declaredTrials: 10, evaluations: [evaluation], candidateContractIds: [contract.id], shadowContractIds: [contract.id],
    missingMechanismBlockers: [], liveExecution: 'locked' };
  evidence.appendResearchRuns([run]);
  const result = runFastShadowCycle({ evidenceStore: evidence, economicStore: economics });
  assert.ok(result.createdDecisions > 0); assert.ok(result.createdOutcomes > 0);
  const snapshot = economics.snapshot();
  assert.ok(snapshot.counts.shadowOutcomes > 0);
  assert.ok(snapshot.recentShadowOutcomes.every((row) => row.noTradeCounterfactualNetPnlUsd === 0));
  assert.ok(snapshot.recentShadowOutcomes.every((row) => Math.abs(row.navAfterUsd - row.navBeforeUsd - row.netPnlUsd) < 1e-6));
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});
