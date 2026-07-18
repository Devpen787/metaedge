import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { FastShadowDecision, FastShadowOutcome } from '../../server/discovery/economic_types.js';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { buildPaperTradeContract, evaluatePaperLifecycle } from '../../server/discovery/economic_runtime.js';
import { runFastLifecycleCycle, summarizeFastLifecycleEvidence } from '../../server/discovery/fast_lifecycle_runtime.js';

function contract() {
  return buildPaperTradeContract({ candidateId: 'candidate_lifecycle', strategyFamilyId: 'fast_positive', lane: 'perpetuals',
    speedTier: 'fast_event', mechanism: 'temporary imbalance', trigger: 'declared trigger', instrument: 'BTC-PERP',
    venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market', decisionAt: 1_000, evidenceCutoffAt: 1_000,
    edgeHalfLifeMs: 30_000, entryRule: 'fresh trigger only', exitRule: '30 second exit', expiresAt: 31_000,
    predictedGrossEdgeBps: 31, costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1,
      fundingBps: 0, borrowBps: 0, adverseSelectionBps: 2, latencyBps: 1 }, uncertaintyBufferBps: 3,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.6, lowerBoundNetEdgeBps: 10,
      independentHistoricalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 250, deployableUsd: 1_000, participationRate: 0.02 }, opportunitiesPerDay: 20,
    maximumExistingCorrelation: 0, tailRiskPenaltyUsdPerDay: 1, drawdownPenaltyUsdPerDay: 1,
    riskLimits: { maximumPositionUsd: 250, maximumLossPerTradeUsd: 5, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 500, maximumConsecutiveLosses: 8 },
    provenance: { datasetVersionId: 'dataset', universeVersionId: 'universe', worldContractId: 'world',
      sourceEventIds: ['historical_event'], signalArtifactIds: ['signal'], validationEvaluationIds: ['validation'],
      sourceVenue: 'hyperliquid', sourceVersion: 'test', feeProvenance: 'authenticated_venue' },
    killRule: { maximumForwardLossBps: 40, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 8,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true },
    createdAt: 1_000,
  });
}

function sample(rowContract: ReturnType<typeof contract>, index: number, resolvedAt: number) {
  const decision: FastShadowDecision = { id: `decision_${index}`, schemaVersion: 1, contractId: rowContract.id,
    strategyVersionId: rowContract.strategyVersionId,
    candidateId: rowContract.candidateId, sourceSignalEventIds: [`event_${index}`], symbol: 'BTC', side: 'long',
    cohort: 'taker', evidenceMode: 'paper_forward', recordedAt: resolvedAt - 999,
    decidedAt: resolvedAt - 1_000, evidenceCutoffAt: resolvedAt - 999, expiresAt: resolvedAt,
    horizonMs: 1_000, latencyMs: 50, requestedNotionalUsd: 250, participationRate: 0.02,
    referenceMidPrice: 80_000, primaryExecutionPolicy: 'taker_market', decisionLagMs: 0,
    riskReservationId: `reservation_${index}`, liveExecution: 'locked' };
  const outcome: FastShadowOutcome = { id: `outcome_${index}`, schemaVersion: 1, decisionId: decision.id,
    contractId: rowContract.id, cohort: 'taker', evidenceMode: 'paper_forward', promotable: true,
    resolvedAt, expectedResolutionAt: resolvedAt, timingDeviationMs: 0, timingValid: true,
    status: 'filled', requestedNotionalUsd: 250,
    filledNotionalUsd: 250, fillRate: 1, queueAheadUsd: null, entryPrice: 80_000, exitPrice: 80_200,
    grossPnlUsd: 0.7, feeUsd: 0.05, spreadUsd: 0.05, slippageUsd: 0.05, impactUsd: 0.05,
    fundingUsd: 0, borrowUsd: 0, adverseSelectionUsd: 0, netPnlUsd: 0.5, noTradeCounterfactualNetPnlUsd: 0,
    navBeforeUsd: 10_000 + index * 0.5, navAfterUsd: 10_000 + (index + 1) * 0.5, marginUsedUsd: 50,
    blockers: [], sourceEventIds: [`event_${index}`], liveExecution: 'locked' };
  return { decision, outcome };
}

test('lifecycle evidence uses only the frozen taker policy and survives explicit cost stress', () => {
  const row = contract(); const outcomes = Array.from({ length: 100 }, (_, index) => sample(row, index, 200_000 + index * 160_000).outcome);
  const evidence = summarizeFastLifecycleEvidence({ contract: row, outcomes: [
    ...outcomes,
    { ...outcomes[0], id: 'maker_diagnostic', cohort: 'maker', netPnlUsd: -1_000 },
    { ...outcomes[0], id: 'historical_canary', evidenceMode: 'canary', promotable: false, netPnlUsd: 100_000 },
  ], fundedPaper: false });
  assert.equal(evidence.untouchedForwardSamples, 100);
  assert.equal(evidence.fillRate, 1);
  assert.equal(evidence.costCalibrationErrorFraction, 0);
  assert.ok((evidence.costStressedNetEdgeLowerBoundBps ?? 0) > 0);
});

test('controlled evidence advances shadow to funded paper and then live review without skipping gates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-lifecycle-'));
  const store = new EconomicOperationStore(root); const row = contract(); store.appendContracts([row]);
  const researchEvidence = { historicalSamples: 60, untouchedForwardSamples: 0, fundedPaperSamples: 0,
    forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
    realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
    consecutiveLosses: 0, sourceObservationIds: ['historical_event'] };
  store.appendLifecycleEvents([evaluatePaperLifecycle({ contract: row, currentState: 'research_candidate',
    requestedState: 'shadow_paper', evidence: researchEvidence, evaluatedAt: 1_100 })]);
  const forward = Array.from({ length: 100 }, (_, index) => sample(row, index, 200_000 + index * 160_000));
  store.appendShadowDecisions(forward.map((item) => item.decision)); store.appendShadowOutcomes(forward.map((item) => item.outcome));
  const funded = runFastLifecycleCycle({ economicStore: store });
  assert.equal(funded.passed, 1); assert.equal(store.currentState(row.id), 'funded_paper');
  const fundedRows = Array.from({ length: 300 }, (_, offset) => sample(row, 100 + offset, 20_000_000 + offset * 160_000));
  store.appendShadowDecisions(fundedRows.map((item) => item.decision)); store.appendShadowOutcomes(fundedRows.map((item) => item.outcome));
  const reviewed = runFastLifecycleCycle({ economicStore: store });
  assert.equal(reviewed.passed, 1); assert.equal(store.currentState(row.id), 'live_review');
  const losing = sample(row, 400, 70_000_000);
  losing.outcome.netPnlUsd = -1.25;
  losing.outcome.navAfterUsd = losing.outcome.navBeforeUsd - 1.25;
  store.appendShadowDecisions([losing.decision]); store.appendShadowOutcomes([losing.outcome]);
  const killed = runFastLifecycleCycle({ economicStore: store });
  assert.equal(killed.killed, 1); assert.equal(store.snapshot().current[0].killed, true);
  assert.equal(store.snapshot().integrity.allLiveExecutionLocked, true);
});
