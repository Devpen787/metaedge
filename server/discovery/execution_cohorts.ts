import { simulateOrders } from './order_runtime.js';
import { contentHash } from './store.js';
import type { ExecutionCohort, ExecutionCohortOutcome, ExecutionCohortStudy, ExecutionDecisionPoint } from './execution_cohort_types.js';
import type { PaperOrder } from './execution_types.js';

const COHORTS: ExecutionCohort[] = ['maker', 'taker', 'delayed', 'no_trade'];
function mean(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }

function assign(decisions: ExecutionDecisionPoint[], seed: number): Array<{ decision: ExecutionDecisionPoint; cohort: ExecutionCohort }> {
  return [...decisions].sort((left, right) => contentHash({ seed, id: left.id }).localeCompare(contentHash({ seed, id: right.id })))
    .map((decision, index) => ({ decision, cohort: COHORTS[index % COHORTS.length] }));
}

function outcome(decision: ExecutionDecisionPoint, cohort: ExecutionCohort, options: { makerOffsetBps: number;
  feeBps: number; slippageBps: number; participationRate: number }): ExecutionCohortOutcome {
  const bars = [...decision.bars].sort((left, right) => left.openAt - right.openAt);
  const exitPrice = bars.at(-1)?.close ?? decision.referencePrice; const side = decision.side === 'buy' ? 1 : -1;
  const grossAlphaBps = side * (exitPrice / decision.referencePrice - 1) * 10_000;
  if (cohort === 'no_trade') {
    const identity = { decisionId: decision.id, cohort, grossAlphaBps };
    return { id: `execution_outcome_${contentHash(identity).slice(0, 20)}`, decisionId: decision.id, cohort,
      filled: false, fillPrice: null, fillDelayBars: null, grossAlphaBps, realizedNetBps: 0,
      alphaDecayBps: 0, adverseSelectionBps: 0, impactBps: 0,
      implementationShortfallBps: grossAlphaBps, liveExecution: 'locked' };
  }
  const submittedAt = cohort === 'delayed' && bars[0] ? bars[0].openAt : decision.signalAt;
  const order: PaperOrder = { id: `cohort_order_${decision.id}_${cohort}`, submittedAt, symbol: decision.symbol,
    side: decision.side, quantity: decision.quantity, type: cohort === 'maker' ? 'limit' : 'market',
    limitPrice: cohort === 'maker' ? decision.referencePrice * (1 - side * options.makerOffsetBps / 10_000) : undefined,
    participationRate: options.participationRate, timeInForceBars: Math.max(1, bars.length), reduceOnly: false };
  const simulation = simulateOrders({ initialCash: Math.max(1_000_000, decision.quantity * decision.referencePrice * 10),
    orders: [order], bars, feeBps: options.feeBps, slippageBps: options.slippageBps,
    maxGrossExposure: 1, initialMarginRate: 0.5, maintenanceMarginRate: 0.25, allowShort: true });
  const fill = simulation.fills[0];
  if (!fill) {
    const identity = { decisionId: decision.id, cohort, grossAlphaBps, filled: false };
    return { id: `execution_outcome_${contentHash(identity).slice(0, 20)}`, decisionId: decision.id, cohort,
      filled: false, fillPrice: null, fillDelayBars: null, grossAlphaBps, realizedNetBps: 0,
      alphaDecayBps: grossAlphaBps, adverseSelectionBps: 0, impactBps: 0,
      implementationShortfallBps: grossAlphaBps, liveExecution: 'locked' };
  }
  const fillBarIndex = bars.findIndex((bar) => bar.openAt === fill.filledAt);
  const postFillPrice = bars[Math.min(bars.length - 1, fillBarIndex + 1)]?.close ?? fill.price;
  const alphaAtFillBps = side * (exitPrice / fill.price - 1) * 10_000;
  const feeBps = fill.feeUsd / Math.max(1e-12, fill.quantity * fill.price) * 10_000;
  const realizedNetBps = alphaAtFillBps - feeBps;
  const alphaDecayBps = grossAlphaBps - alphaAtFillBps;
  const adverseSelectionBps = Math.max(0, -side * (postFillPrice / fill.price - 1) * 10_000);
  const impactBps = Math.max(0, side * (fill.price / decision.referencePrice - 1) * 10_000);
  const implementationShortfallBps = grossAlphaBps - realizedNetBps;
  const identity = { decisionId: decision.id, cohort, fillId: fill.id, exitPrice };
  return { id: `execution_outcome_${contentHash(identity).slice(0, 20)}`, decisionId: decision.id, cohort,
    filled: true, fillPrice: fill.price, fillDelayBars: fillBarIndex + 1, grossAlphaBps, realizedNetBps,
    alphaDecayBps, adverseSelectionBps, impactBps, implementationShortfallBps, liveExecution: 'locked' };
}

export function runExecutionCohortStudy(input: { decisions: ExecutionDecisionPoint[]; sourceEvaluationIds: string[];
  seed: number; makerOffsetBps: number; feeBps: number; slippageBps: number; participationRate: number;
  minimumOutcomesPerCohort?: number; createdAt?: number }): ExecutionCohortStudy {
  const outcomes = assign(input.decisions, input.seed).map(({ decision, cohort }) => outcome(decision, cohort, input));
  const aggregates = Object.fromEntries(COHORTS.map((cohort) => {
    const rows = outcomes.filter((row) => row.cohort === cohort); const filled = rows.filter((row) => row.filled);
    return [cohort, { assigned: rows.length, fills: filled.length, fillRate: rows.length ? filled.length / rows.length : null,
      meanNetBps: mean(rows.map((row) => row.realizedNetBps)), meanAlphaDecayBps: mean(rows.map((row) => row.alphaDecayBps)),
      meanAdverseSelectionBps: mean(rows.map((row) => row.adverseSelectionBps)), meanImpactBps: mean(rows.map((row) => row.impactBps)),
      meanShortfallBps: mean(rows.map((row) => row.implementationShortfallBps)) }];
  })) as ExecutionCohortStudy['aggregates'];
  const minimumOutcomesPerCohort = input.minimumOutcomesPerCohort ?? 30;
  const blockers: string[] = [];
  if (!input.sourceEvaluationIds.length) blockers.push('NO_FORWARD_CANDIDATE_EVALUATIONS');
  if (!input.decisions.length) blockers.push('NO_FORWARD_EXECUTION_DECISIONS');
  const status = blockers.length ? 'blocked' : COHORTS.every((cohort) => aggregates[cohort].assigned >= minimumOutcomesPerCohort)
    ? 'sufficient' : 'collecting';
  const identity = { sourceEvaluationIds: [...input.sourceEvaluationIds].sort(), seed: input.seed,
    outcomeIds: outcomes.map((row) => row.id), minimumOutcomesPerCohort, blockers };
  return { id: `execution_cohort_study_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    createdAt: input.createdAt ?? Date.now(), sourceEvaluationIds: [...input.sourceEvaluationIds].sort(), seed: input.seed,
    outcomes, aggregates, minimumOutcomesPerCohort, status, blockers, liveExecution: 'locked' };
}
