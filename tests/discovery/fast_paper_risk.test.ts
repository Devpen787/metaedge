import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaperTradeContract } from '../../server/discovery/economic_runtime.js';
import { evaluatePaperRiskReservation, type PaperPortfolioRiskState } from '../../server/discovery/fast_paper_risk.js';

function contract() {
  return buildPaperTradeContract({ candidateId: 'risk', strategyFamilyId: 'risk-family', lane: 'perpetuals', speedTier: 'fast_event',
    mechanism: 'test', trigger: 'test', instrument: 'SOL-PERP', venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market',
    decisionAt: 1_000, evidenceCutoffAt: 1_000, edgeHalfLifeMs: 5_000, entryRule: 'test', exitRule: 'test', expiresAt: 6_000,
    predictedGrossEdgeBps: 20, costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1, fundingBps: 0,
      borrowBps: 0, adverseSelectionBps: 1, latencyBps: 1 }, uncertaintyBufferBps: 2,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.6, lowerBoundNetEdgeBps: 5,
      independentHistoricalSamples: 100, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 250, deployableUsd: 250, participationRate: 0.1 }, opportunitiesPerDay: 10,
    maximumExistingCorrelation: 0, tailRiskPenaltyUsdPerDay: 1, drawdownPenaltyUsdPerDay: 1,
    riskLimits: { maximumPositionUsd: 250, maximumLossPerTradeUsd: 10, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 500, maximumConsecutiveLosses: 8 }, provenance: { datasetVersionId: 'd', universeVersionId: 'u',
      worldContractId: 'w', sourceEventIds: ['e'], signalArtifactIds: [], validationEvaluationIds: [], sourceVenue: 'test', sourceVersion: 'test' },
    killRule: { maximumForwardLossBps: 50, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 8,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true } });
}

const healthy: PaperPortfolioRiskState = { aggregateOpenExposureUsd: 0, symbolOpenExposureUsd: 0, dailyNetPnlUsd: 0,
  strategyDrawdownUsd: 0, maximumPairwiseCorrelation: 0, remainingCapacityUsd: 250, killed: false };

test('kill, daily loss, drawdown, correlation, capacity, and exposure gates veto independently', () => {
  const row = contract();
  assert.deepEqual(evaluatePaperRiskReservation({ contract: row, requestedNotionalUsd: 100, state: healthy }), []);
  const cases: Array<[Partial<PaperPortfolioRiskState>, string]> = [
    [{ killed: true }, 'CONTRACT_KILLED'],
    [{ dailyNetPnlUsd: -100 }, 'DAILY_LOSS_LIMIT'],
    [{ strategyDrawdownUsd: 100 }, 'STRATEGY_DRAWDOWN_LIMIT'],
    [{ maximumPairwiseCorrelation: 0.9 }, 'CORRELATION_LIMIT'],
    [{ remainingCapacityUsd: 50 }, 'CAPACITY_LIMIT'],
    [{ aggregateOpenExposureUsd: 450 }, 'AGGREGATE_EXPOSURE_LIMIT'],
    [{ symbolOpenExposureUsd: 200 }, 'POSITION_LIMIT'],
  ];
  for (const [change, expected] of cases) {
    assert.ok(evaluatePaperRiskReservation({ contract: row, requestedNotionalUsd: 100, state: { ...healthy, ...change } }).includes(expected));
  }
  assert.ok(evaluatePaperRiskReservation({ contract: row, requestedNotionalUsd: 100,
    state: { ...healthy, maximumPairwiseCorrelation: null } }).includes('CORRELATION_EVIDENCE_MISSING'));
});
