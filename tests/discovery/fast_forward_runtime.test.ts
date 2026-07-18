import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPaperTradeContract, evaluatePaperLifecycle } from '../../server/discovery/economic_runtime.js';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { commitFastForwardDecisions, resolveFastForwardOutcomes } from '../../server/discovery/fast_shadow_runtime.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import type { FastPerpBookEvent } from '../../server/discovery/fast_perp_types.js';
import type { FastPerpResearchRun } from '../../server/discovery/fast_perp_research_types.js';

function book(id: string, eventTime: number, receivedAt: number, midPrice = 100, imbalance = 0.8): FastPerpBookEvent {
  const bestBid = midPrice - 0.01; const bestAsk = midPrice + 0.01;
  return { id, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL', eventTime, receivedAt,
    bids: [{ price: bestBid, size: 100, orders: 1 }], asks: [{ price: bestAsk, size: 100, orders: 1 }],
    bestBid, bestAsk, midPrice, spreadBps: (bestAsk - bestBid) / midPrice * 10_000,
    bidDepthUsd: bestBid * 100, askDepthUsd: bestAsk * 100, imbalance, liveExecution: 'locked' };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-forward-runtime-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'), { flushIntervalMs: 60_000 });
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  const contract = buildPaperTradeContract({ candidateId: 'eval1', strategyFamilyId: 'book_imbalance_continuation',
    lane: 'perpetuals', speedTier: 'fast_event', mechanism: 'imbalance', trigger: 'imbalance', instrument: 'SOL-PERP',
    venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market', decisionAt: 1_000, evidenceCutoffAt: 1_000,
    edgeHalfLifeMs: 5_000, entryRule: 'next forward trigger', exitRule: '5 seconds', expiresAt: 6_000,
    predictedGrossEdgeBps: 20, costs: { feeBps: 2, spreadBps: 1, slippageBps: 1, impactBps: 1,
      fundingBps: 0, borrowBps: 0, adverseSelectionBps: 1, latencyBps: 1 }, uncertaintyBufferBps: 2,
    confidence: { confidenceLevel: 0.95, predictedWinProbability: 0.6, lowerBoundNetEdgeBps: 4,
      independentHistoricalSamples: 40, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
    capacity: { requestedPaperUsd: 250, deployableUsd: 10_000, participationRate: 0.1 }, opportunitiesPerDay: 100,
    maximumExistingCorrelation: 0, tailRiskPenaltyUsdPerDay: 1, drawdownPenaltyUsdPerDay: 1,
    riskLimits: { maximumPositionUsd: 250, maximumLossPerTradeUsd: 10, maximumStrategyDrawdownUsd: 100,
      maximumGrossExposureUsd: 500, maximumConsecutiveLosses: 8 },
    provenance: { datasetVersionId: 'd', universeVersionId: 'u', worldContractId: 'w', sourceEventIds: ['seed'],
      signalArtifactIds: ['eval1'], validationEvaluationIds: [], sourceVenue: 'hyperliquid', sourceVersion: 'test' },
    killRule: { maximumForwardLossBps: 50, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 8,
      minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true }, createdAt: 1_000 });
  economics.appendContracts([contract]);
  economics.appendLifecycleEvents([evaluatePaperLifecycle({ contract, currentState: 'research_candidate', requestedState: 'shadow_paper',
    evidence: { historicalSamples: 40, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: ['seed'] }, evaluatedAt: 1_000 })]);
  const evaluation = { id: 'eval1', schemaVersion: 1 as const, symbol: 'SOL', family: 'book_imbalance_continuation' as const,
    speedTier: 'fast_event' as const, selectedParameters: { horizonMs: 5_000, lookbackMs: 0, threshold: 0.2 },
    declaredTrials: 10, training: { samples: 30, meanGrossReturnBps: 10, meanNetReturnBps: 3,
      lowerBoundNetEdgeBps: 1, winRate: 0.6 }, validation: { samples: 20, meanGrossReturnBps: 10,
      meanNetReturnBps: 3, lowerBoundNetEdgeBps: 1, winRate: 0.6 }, holdout: { samples: 20,
      meanGrossReturnBps: 10, meanNetReturnBps: 3, lowerBoundNetEdgeBps: 1, winRate: 0.6 },
    independentSamples: 70, opportunitiesPerDay: 100, estimatedCapacityUsd: 10_000,
    disposition: 'shadow_candidate' as const, blockers: [], sourceEventIds: ['seed'], evidenceCutoffAt: 1_000,
    liveExecution: 'locked' as const };
  const run: FastPerpResearchRun = { id: 'run1', schemaVersion: 1, sourceVersion: 'test', researchPolicyVersion: 'test-policy',
    evidenceFingerprint: 'f', datasetVersionId: 'd', universeVersionId: 'u', worldContractId: 'w', createdAt: 1_000,
    symbols: ['SOL'], speedTiers: ['fast_event'], declaredTrials: 10, evaluations: [evaluation],
    candidateContractIds: [contract.id], shadowContractIds: [contract.id], missingMechanismBlockers: [], liveExecution: 'locked' };
  evidence.appendResearchRuns([run]);
  return { evidence, economics, contract };
}

test('paper-forward decision is durably committed before its outcome event is available', () => {
  const { evidence, economics } = fixture();
  evidence.appendBooks([book('signal', 2_000, 2_001)]); evidence.flush();
  const committed = commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  assert.equal(committed.createdDecisions, 1);
  assert.equal(economics.readShadowOutcomes().length, 0);
  const decision = economics.readShadowDecisions()[0];
  assert.equal(decision.recordedAt, 2_002);
  assert.equal(decision.evidenceMode, 'paper_forward');
  assert.ok(decision.sourceSignalEventIds.every((id) => id !== 'outcome'));

  evidence.appendBooks([book('entry', 2_252, 2_253, 100.1, 0), book('outcome', 7_000, 7_001, 101, 0)]); evidence.flush();
  const resolved = resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: 7_002 });
  assert.equal(resolved.createdOutcomes, 1);
  const outcome = economics.readShadowOutcomes()[0];
  assert.equal(outcome.status, 'filled');
  assert.equal(outcome.timingValid, true);
  assert.equal(outcome.promotable, true);
  assert.ok(outcome.sourceEventIds.includes('outcome'));
  assert.ok(Math.abs(outcome.netPnlUsd - (outcome.grossPnlUsd - outcome.feeUsd - outcome.fundingUsd - outcome.borrowUsd)) < 1e-9);
  assert.ok(Math.abs(outcome.navAfterUsd - (outcome.navBeforeUsd + outcome.netPnlUsd)) < 1e-9);
});

test('preloaded historical outcome cannot enter the paper-forward ledger and becomes unresolved', () => {
  const { evidence, economics } = fixture();
  evidence.appendBooks([book('signal', 2_000, 2_001), book('preloaded-future', 7_000, 1_500, 101, 0)]); evidence.flush();
  commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: 8_001 });
  const outcome = economics.readShadowOutcomes()[0];
  assert.equal(outcome.status, 'unresolved');
  assert.equal(outcome.timingValid, false);
  assert.equal(outcome.promotable, false);
  assert.equal(outcome.sourceEventIds.includes('preloaded-future'), false);
  assert.ok(outcome.blockers.includes('FORWARD_OUTCOME_NOT_RECEIVED_AFTER_DECISION'));
});

test('evidence received before the active cutover cannot create a paper-forward decision', () => {
  const { evidence, economics } = fixture();
  fs.writeFileSync(path.join(path.dirname(evidence.root), 'fast-perp-cutover.json'), JSON.stringify({ cutoverAt: 2_500 }));
  evidence.appendBooks([book('pre-cutover-signal', 2_000, 2_001)]); evidence.flush();
  const result = commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 3_000 });
  assert.equal(result.createdDecisions, 0);
  assert.equal(economics.readShadowDecisions().length, 0);
});

test('a book received after the timing tolerance cannot be backdated into promotable forward evidence', () => {
  const { evidence, economics } = fixture();
  evidence.appendBooks([book('signal', 2_000, 2_001)]); evidence.flush();
  commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  evidence.appendBooks([book('late-entry', 2_252, 20_000, 100.1, 0),
    book('late-outcome', 7_000, 20_001, 101, 0)]); evidence.flush();
  resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: 20_002 });
  const outcome = economics.readShadowOutcomes()[0];
  assert.equal(outcome.status, 'unresolved');
  assert.equal(outcome.promotable, false);
  assert.equal(outcome.sourceEventIds.includes('late-outcome'), false);
});

test('a report-only challenger run cannot detach an observing contract from its frozen trigger', () => {
  const { evidence, economics } = fixture();
  evidence.appendResearchRuns([{ id: 'run2-report-only', schemaVersion: 1, sourceVersion: 'test',
    researchPolicyVersion: 'test-policy', evidenceFingerprint: 'f2', datasetVersionId: 'd2', universeVersionId: 'u',
    worldContractId: 'w2', createdAt: 1_500, symbols: ['SOL'], speedTiers: ['fast_event'], declaredTrials: 3_600,
    evaluations: [], candidateContractIds: [], shadowContractIds: [],
    missingMechanismBlockers: ['DECLARED_TRIAL_CEILING_EXCEEDED'], liveExecution: 'locked' }]);
  evidence.appendBooks([book('signal-after-report-only', 2_000, 2_001)]); evidence.flush();
  const committed = commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  assert.equal(committed.createdDecisions, 1);
});

test('same-cycle paper reservations are included before a second contract can reserve the symbol', () => {
  const { evidence, economics, contract } = fixture();
  const second = { ...contract, id: 'contract_second', candidateId: 'eval2', strategyVersionId: 'version_second',
    strategyFamilyId: 'book_imbalance_reversal', mechanism: 'imbalance reversal' };
  economics.appendContracts([second]);
  economics.appendLifecycleEvents([evaluatePaperLifecycle({ contract: second, currentState: 'research_candidate',
    requestedState: 'shadow_paper', evidence: { historicalSamples: 40, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: ['seed'] }, evaluatedAt: 1_001 })]);
  const firstRun = evidence.readResearchRuns()[0]; const secondEvaluation = { ...firstRun.evaluations[0], id: 'eval2',
    family: 'book_imbalance_reversal' as const };
  evidence.appendResearchRuns([{ ...firstRun, id: 'run2', evidenceFingerprint: 'f2', createdAt: 1_001,
    evaluations: [secondEvaluation], candidateContractIds: [second.id], shadowContractIds: [second.id] }]);
  evidence.appendBooks([book('shared-signal', 2_000, 2_001)]); evidence.flush();
  const committed = commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  assert.equal(committed.createdDecisions, 2);
  assert.equal(committed.rejectedDecisions, 1);
  assert.equal(economics.readShadowDecisions().filter((row) => row.cohort !== 'no_trade').length, 1);
  assert.ok(economics.readShadowOutcomes().some((row) => row.status === 'risk_rejected'
    && row.blockers.some((blocker) => blocker === 'POSITION_LIMIT' || blocker === 'CORRELATION_EVIDENCE_MISSING')));
});

test('portfolio daily loss includes outcomes from other contracts before a new reservation', () => {
  const { evidence, economics, contract } = fixture();
  const lossContract = { ...contract, id: 'loss_contract', candidateId: 'loss_eval', strategyVersionId: 'loss_version',
    strategyFamilyId: 'loss_family' };
  economics.appendContracts([lossContract]);
  economics.appendShadowDecisions([{ id: 'loss_decision', schemaVersion: 1, contractId: lossContract.id,
    strategyVersionId: lossContract.strategyVersionId, candidateId: lossContract.candidateId,
    sourceSignalEventIds: ['loss_signal'], symbol: 'ETH', side: 'long', cohort: 'taker', evidenceMode: 'paper_forward',
    recordedAt: 1_100, decidedAt: 1_100, evidenceCutoffAt: 1_000, expiresAt: 1_200, horizonMs: 100,
    latencyMs: 10, requestedNotionalUsd: 250, participationRate: 0.1, referenceMidPrice: 100,
    primaryExecutionPolicy: 'taker_market', decisionLagMs: 100, riskReservationId: 'loss_reservation', liveExecution: 'locked' }]);
  economics.appendShadowOutcomes([{ id: 'loss_outcome', schemaVersion: 1, decisionId: 'loss_decision',
    contractId: lossContract.id, cohort: 'taker', evidenceMode: 'paper_forward', promotable: false, resolvedAt: 1_200,
    expectedResolutionAt: 1_200, timingDeviationMs: null, timingValid: false, status: 'filled', requestedNotionalUsd: 250,
    filledNotionalUsd: 250, fillRate: 1, queueAheadUsd: null, entryPrice: 100, exitPrice: 60, grossPnlUsd: -101,
    feeUsd: 0, spreadUsd: 0, slippageUsd: 0, impactUsd: 0, fundingUsd: 0, borrowUsd: 0,
    adverseSelectionUsd: 0, netPnlUsd: -101, noTradeCounterfactualNetPnlUsd: 0, navBeforeUsd: 10_000,
    navAfterUsd: 9_899, marginUsedUsd: 50, blockers: [], sourceEventIds: ['loss_signal', 'loss_outcome_event'],
    liveExecution: 'locked' }]);
  evidence.appendBooks([book('post-loss-signal', 2_000, 2_001)]); evidence.flush();
  const committed = commitFastForwardDecisions({ evidenceStore: evidence, economicStore: economics, now: 2_002 });
  assert.equal(committed.createdDecisions, 1);
  assert.equal(committed.rejectedDecisions, 1);
  assert.ok(economics.readShadowOutcomes().some((row) => row.decisionId !== 'loss_decision'
    && row.blockers.includes('DAILY_LOSS_LIMIT')));
});

test('restart recovery can never turn a persisted no-trade decision into a fill', () => {
  const { evidence, economics, contract } = fixture();
  economics.appendShadowDecisions([{ id: 'interrupted_rejection', schemaVersion: 1, contractId: contract.id,
    strategyVersionId: contract.strategyVersionId, candidateId: contract.candidateId, sourceSignalEventIds: ['signal'],
    symbol: 'SOL', side: 'long', cohort: 'no_trade', evidenceMode: 'paper_forward', recordedAt: 2_000, decidedAt: 2_000,
    evidenceCutoffAt: 2_000, expiresAt: 3_000, horizonMs: 1_000, latencyMs: 250, requestedNotionalUsd: 250,
    participationRate: 0.1, referenceMidPrice: 100, primaryExecutionPolicy: 'taker_market', decisionLagMs: 0,
    riskReservationId: 'interrupted_reservation', decisionBlockers: ['DAILY_LOSS_LIMIT'], liveExecution: 'locked' }]);
  evidence.appendBooks([book('entry-that-must-not-fill', 2_250, 2_251), book('exit-that-must-not-fill', 3_000, 3_001)]);
  evidence.flush();
  const result = resolveFastForwardOutcomes({ evidenceStore: evidence, economicStore: economics, now: 4_001 });
  assert.equal(result.createdOutcomes, 1);
  const outcome = economics.readShadowOutcomes()[0];
  assert.equal(outcome.status, 'risk_rejected');
  assert.equal(outcome.filledNotionalUsd, 0);
  assert.ok(outcome.blockers.includes('DAILY_LOSS_LIMIT'));
});
