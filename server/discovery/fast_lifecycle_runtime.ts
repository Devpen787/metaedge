import type {
  FastShadowOutcome,
  PaperTradeContract,
  PaperTradeLifecycleEvidence,
  ShadowExecutionCohort,
} from './economic_types.js';
import { EconomicOperationStore } from './economic_store.js';
import { evaluatePaperKillRule, evaluatePaperLifecycle } from './economic_runtime.js';
import { alphaSpending, blockBootstrapLowerBound, chooseBlockLength } from './fast_statistics.js';

function cohortFor(contract: PaperTradeContract): ShadowExecutionCohort {
  if (contract.executionPolicy === 'maker_limit') return 'maker';
  if (contract.executionPolicy === 'delayed_taker') return 'delayed';
  return 'taker';
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeFastLifecycleEvidence(input: {
  contract: PaperTradeContract;
  outcomes: FastShadowOutcome[];
  fundedPaper: boolean;
  statisticalLookNumber?: number;
}): PaperTradeLifecycleEvidence {
  const expectedCohort = cohortFor(input.contract);
  const rows = input.outcomes.filter((row) => row.cohort === expectedCohort && row.evidenceMode === 'paper_forward'
    && row.promotable && row.timingValid)
    .sort((left, right) => left.resolvedAt - right.resolvedAt || left.id.localeCompare(right.id));
  const returnsBps = rows.map((row) => row.requestedNotionalUsd > 0
    ? row.netPnlUsd / row.requestedNotionalUsd * 10_000 : 0);
  const block = chooseBlockLength({ values: returnsBps, times: rows.map((row) => row.resolvedAt),
    edgeHalfLifeMs: input.contract.edgeHalfLifeMs });
  const statisticalLookNumber = input.statisticalLookNumber ?? 1; const alphaSpent = alphaSpending(statisticalLookNumber);
  const forwardLower = blockBootstrapLowerBound(returnsBps, block.blockLengthSamples, alphaSpent);
  // Ask whether the lower bound survives an additional 50% of the declared
  // venue and execution costs, rather than trusting the point estimate.
  const stressedLower = forwardLower == null ? null : forwardLower - input.contract.costs.totalBps * 0.5;
  const requested = rows.reduce((sum, row) => sum + row.requestedNotionalUsd, 0);
  const filled = rows.reduce((sum, row) => sum + row.filledNotionalUsd, 0);
  const filledRows = rows.filter((row) => row.filledNotionalUsd > 0);
  const observedCostBps = filledRows.map((row) => (row.feeUsd + row.spreadUsd + row.slippageUsd + row.impactUsd
    + row.fundingUsd + row.borrowUsd + row.adverseSelectionUsd) / row.filledNotionalUsd * 10_000);
  const observedMeanCostBps = mean(observedCostBps);
  const expectedCostBps = input.contract.costs.totalBps;
  const costCalibrationErrorFraction = observedMeanCostBps == null || !(expectedCostBps > 0) ? null
    : Math.abs(observedMeanCostBps - expectedCostBps) / expectedCostBps;
  let nav = 10_000; let high = nav; let maximumDrawdownUsd = 0; let consecutiveLosses = 0; let maximumConsecutiveLosses = 0;
  for (const row of rows) {
    nav += row.netPnlUsd; high = Math.max(high, nav); maximumDrawdownUsd = Math.max(maximumDrawdownUsd, high - nav);
    consecutiveLosses = row.netPnlUsd < 0 ? consecutiveLosses + 1 : 0;
    maximumConsecutiveLosses = Math.max(maximumConsecutiveLosses, consecutiveLosses);
  }
  return {
    historicalSamples: input.contract.confidence.independentHistoricalSamples,
    untouchedForwardSamples: input.fundedPaper ? 0 : rows.length,
    fundedPaperSamples: input.fundedPaper ? rows.length : 0,
    forwardNetEdgeLowerBoundBps: Number.isFinite(forwardLower) ? forwardLower : null,
    costStressedNetEdgeLowerBoundBps: Number.isFinite(stressedLower) ? stressedLower : null,
    worstNetReturnBps: returnsBps.length ? Math.min(...returnsBps) : null,
    realizedNetPnlUsd: rows.reduce((sum, row) => sum + row.netPnlUsd, 0),
    fillRate: requested > 0 ? filled / requested : null,
    costCalibrationErrorFraction,
    maximumDrawdownUsd,
    consecutiveLosses: maximumConsecutiveLosses,
    sourceObservationIds: rows.map((row) => row.id),
    eligibleSampleIds: rows.map((row) => row.id), independentBlockCount: block.independentBlockCount,
    blockLengthMs: block.blockLengthMs, statisticalLookNumber, alphaSpent,
  };
}

export function runFastLifecycleCycle(options: { economicStore?: EconomicOperationStore } = {}) {
  const store = options.economicStore ?? new EconomicOperationStore();
  const snapshot = store.snapshot(); const outcomes = store.readShadowOutcomes(); const events = store.readLifecycleEvents();
  const evaluated = [];
  for (const row of snapshot.current) {
    if (row.killed || (row.currentState !== 'shadow_paper' && row.currentState !== 'funded_paper'
      && row.currentState !== 'live_review')) continue;
    const stateEnteredAt = events.filter((event) => event.contractId === row.contract.id && event.passed
      && event.to === row.currentState).sort((left, right) => right.evaluatedAt - left.evaluatedAt)[0]?.evaluatedAt
      ?? row.contract.evidenceCutoffAt;
    const eligible = outcomes.filter((outcome) => outcome.contractId === row.contract.id && outcome.resolvedAt > stateEnteredAt
      && outcome.evidenceMode === 'paper_forward' && outcome.promotable && outcome.timingValid);
    if (!eligible.length) continue;
    const gate = snapshot.objectivePolicy.tierGates[row.contract.speedTier];
    const milestoneSize = row.currentState === 'shadow_paper' ? gate.minimumUntouchedForwardSamplesForFunding
      : gate.minimumFundedPaperSamplesForLiveReview;
    const statisticalLookNumber = Math.floor(eligible.length / milestoneSize);
    const priorLook = Math.max(0, ...events.filter((event) => event.contractId === row.contract.id && event.from === row.currentState)
      .map((event) => event.statisticalLookNumber ?? 0));
    if (row.currentState !== 'live_review' && (statisticalLookNumber < 1 || statisticalLookNumber <= priorLook)) continue;
    const evidence = summarizeFastLifecycleEvidence({ contract: row.contract, outcomes: eligible,
      fundedPaper: row.currentState !== 'shadow_paper', statisticalLookNumber: Math.max(1, statisticalLookNumber) });
    const evaluatedAt = Math.max(...eligible.map((outcome) => outcome.resolvedAt));
    if (row.currentState === 'live_review') {
      const kill = evaluatePaperKillRule({ contract: row.contract, evidence, evaluatedAt });
      store.appendKillEvents([kill]); evaluated.push(kill); continue;
    }
    const event = evaluatePaperLifecycle({ contract: row.contract, currentState: row.currentState,
      requestedState: row.currentState === 'shadow_paper' ? 'funded_paper' : 'live_review', evidence, evaluatedAt });
    store.appendLifecycleEvents([event]); evaluated.push(event);
  }
  return { evaluated: evaluated.length, passed: evaluated.filter((row) => 'passed' in row && row.passed).length,
    killed: evaluated.filter((row) => row.blockers.some((blocker) => blocker.includes('KILL_RULE_TRIGGERED'))).length,
    events: evaluated, queueDepth: 0, queueLagMs: 0, liveExecution: 'locked' as const };
}
