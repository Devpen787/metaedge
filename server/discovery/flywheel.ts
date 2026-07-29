import crypto from 'node:crypto';
import { inverseStandardNormal } from './math.js';
import type {
  AlphaLifecycle,
  BinaryTransitionEvidence,
  ExecutionPolicyDecision,
  ExecutionPolicyInput,
  PointInTimeState,
  PointInTimeStateInput,
  PortfolioRiskDecision,
  PortfolioRiskInput,
} from './flywheel_types.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}

function nonNegative(value: number, name: string): number {
  finite(value, name);
  if (value < 0) throw new Error(`${name} must be non-negative`);
  return value;
}

export function compilePointInTimeState(input: PointInTimeStateInput): PointInTimeState {
  if (!input.symbol.trim()) throw new Error('symbol is required');
  if (!Number.isFinite(input.observedAt) || !Number.isFinite(input.decisionAt)) throw new Error('state timestamps must be finite');
  const features = [...input.features].sort((a, b) => a.key.localeCompare(b.key));
  const duplicate = features.find((feature, index) => index > 0 && feature.key === features[index - 1].key);
  if (duplicate) throw new Error(`duplicate state feature: ${duplicate.key}`);
  const blockers: string[] = [];
  for (const feature of features) {
    if (feature.observedAt > input.decisionAt || feature.availableAt > input.decisionAt) {
      blockers.push(`FEATURE_AFTER_DECISION:${feature.key}`);
    }
    if (!feature.pointInTime) blockers.push(`NON_POINT_IN_TIME:${feature.key}`);
  }
  const payload = { ...input, features };
  const contentHash = hash(payload);
  return {
    ...payload,
    id: `state_${contentHash.slice(0, 20)}`,
    contentHash,
    valid: blockers.length === 0,
    blockers,
    liveExecution: 'locked',
  };
}

export function estimateBinaryTransition(
  outcomes: boolean[],
  options: { alpha: number; declaredTrials: number; minimumSupport: number; baselineProbability?: number },
): BinaryTransitionEvidence {
  if (!(options.alpha > 0 && options.alpha < 0.5)) throw new Error('alpha must be in (0,0.5)');
  if (!Number.isInteger(options.declaredTrials) || options.declaredTrials < 1) throw new Error('declaredTrials must be positive');
  if (!Number.isInteger(options.minimumSupport) || options.minimumSupport < 1) throw new Error('minimumSupport must be positive');
  const baseline = options.baselineProbability ?? 0.5;
  if (!(baseline > 0 && baseline < 1)) throw new Error('baselineProbability must be in (0,1)');
  const support = outcomes.length;
  const successes = outcomes.filter(Boolean).length;
  // Beta(1,1) posterior mean avoids treating a perfect tiny sample as certainty.
  const posteriorProbability = (successes + 1) / (support + 2);
  const raw = support ? successes / support : 0;
  const z = inverseStandardNormal(1 - options.alpha / options.declaredTrials);
  const denominator = 1 + (z * z) / Math.max(1, support);
  const center = raw + (z * z) / (2 * Math.max(1, support));
  const radius = z * Math.sqrt((raw * (1 - raw) + (z * z) / (4 * Math.max(1, support))) / Math.max(1, support));
  const adjustedLowerBound = support ? Math.max(0, (center - radius) / denominator) : 0;
  if (support < options.minimumSupport) {
    return { support, successes, posteriorProbability, adjustedLowerBound, baselineProbability: baseline,
      alpha: options.alpha, declaredTrials: options.declaredTrials, minimumSupport: options.minimumSupport,
      disposition: 'blocked', reason: 'INSUFFICIENT_STATE_SUPPORT' };
  }
  if (!(adjustedLowerBound > baseline)) {
    return { support, successes, posteriorProbability, adjustedLowerBound, baselineProbability: baseline,
      alpha: options.alpha, declaredTrials: options.declaredTrials, minimumSupport: options.minimumSupport,
      disposition: 'declined', reason: 'TRANSITION_NOT_DISTINCT_AFTER_TRIAL_ADJUSTMENT' };
  }
  return { support, successes, posteriorProbability, adjustedLowerBound, baselineProbability: baseline,
    alpha: options.alpha, declaredTrials: options.declaredTrials, minimumSupport: options.minimumSupport,
    disposition: 'candidate', reason: 'ADJUSTED_TRANSITION_PROBABILITY_ABOVE_BASELINE' };
}

export function evidenceFingerprint(input: { sourceHashes: string[]; resolvedLabelIds: string[]; contractHash: string }): string {
  return hash({
    sourceHashes: [...new Set(input.sourceHashes)].sort(),
    resolvedLabelIds: [...new Set(input.resolvedLabelIds)].sort(),
    contractHash: input.contractHash,
  });
}

export function chooseExecutionPolicy(input: ExecutionPolicyInput): ExecutionPolicyDecision {
  finite(input.predictedGrossEdgeBps, 'predictedGrossEdgeBps');
  nonNegative(input.uncertaintyBufferBps, 'uncertaintyBufferBps');
  nonNegative(input.minimumNetEdgeBps, 'minimumNetEdgeBps');
  const candidates: ExecutionPolicyDecision[] = [];
  if (input.taker.enabled) {
    const costs = nonNegative(input.taker.feeBps, 'taker.feeBps') + nonNegative(input.taker.halfSpreadBps, 'taker.halfSpreadBps') +
      nonNegative(input.taker.slippageBps, 'taker.slippageBps') + nonNegative(input.taker.impactBps, 'taker.impactBps') +
      nonNegative(input.taker.fundingBps, 'taker.fundingBps');
    candidates.push({ policy: 'taker', estimatedCostBps: costs, fillProbability: 1,
      conservativeNetEdgeBps: input.predictedGrossEdgeBps - input.uncertaintyBufferBps - costs,
      blockers: [], liveExecution: 'locked' });
  }
  if (input.maker.enabled) {
    if (!(input.maker.fillProbability >= 0 && input.maker.fillProbability <= 1)) throw new Error('maker.fillProbability must be in [0,1]');
    const costs = nonNegative(input.maker.feeBps, 'maker.feeBps') + nonNegative(input.maker.adverseSelectionBps, 'maker.adverseSelectionBps') +
      nonNegative(input.maker.impactBps, 'maker.impactBps') + nonNegative(input.maker.fundingBps, 'maker.fundingBps');
    candidates.push({ policy: 'maker', estimatedCostBps: costs, fillProbability: input.maker.fillProbability,
      conservativeNetEdgeBps: input.maker.fillProbability * (input.predictedGrossEdgeBps - input.uncertaintyBufferBps - costs),
      blockers: [], liveExecution: 'locked' });
  }
  if (input.delayed?.enabled) {
    if (!(input.delayed.edgeRetention >= 0 && input.delayed.edgeRetention <= 1)) throw new Error('delayed.edgeRetention must be in [0,1]');
    if (!Number.isInteger(input.delayed.delayBars) || input.delayed.delayBars < 1) throw new Error('delayed.delayBars must be positive');
    const costs = nonNegative(input.delayed.feeBps, 'delayed.feeBps') + nonNegative(input.delayed.halfSpreadBps, 'delayed.halfSpreadBps') +
      nonNegative(input.delayed.slippageBps, 'delayed.slippageBps') + nonNegative(input.delayed.impactBps, 'delayed.impactBps') +
      nonNegative(input.delayed.fundingBps, 'delayed.fundingBps');
    candidates.push({ policy: 'delayed', estimatedCostBps: costs, fillProbability: 1,
      conservativeNetEdgeBps: input.delayed.edgeRetention * (input.predictedGrossEdgeBps - input.uncertaintyBufferBps) - costs,
      blockers: [], liveExecution: 'locked' });
  }
  candidates.sort((a, b) => b.conservativeNetEdgeBps - a.conservativeNetEdgeBps);
  const best = candidates[0];
  if (!best || !(best.conservativeNetEdgeBps > input.minimumNetEdgeBps)) {
    return { policy: 'no_trade', conservativeNetEdgeBps: best?.conservativeNetEdgeBps ?? 0,
      estimatedCostBps: best?.estimatedCostBps ?? 0, fillProbability: 0,
      blockers: ['CONSERVATIVE_NET_EV_BELOW_FLOOR'], liveExecution: 'locked' };
  }
  return best;
}

export function portfolioRiskGate(input: PortfolioRiskInput): PortfolioRiskDecision {
  const blockers: string[] = [];
  if (input.maximumExistingCorrelation > input.maximumAllowedCorrelation) blockers.push('DUPLICATE_OR_CORRELATED_ALPHA');
  if (input.crowdingScore > input.maximumCrowdingScore) blockers.push('CROWDING_LIMIT');
  if (input.stressedLossBps > input.remainingTailBudgetBps) blockers.push('TAIL_BUDGET_EXCEEDED');
  if (input.currentDrawdownBps + input.stressedLossBps > input.maximumDrawdownBps) blockers.push('DRAWDOWN_LIMIT');
  if (!(input.conservativeNetEdgeBps > 0)) blockers.push('NON_POSITIVE_NET_EDGE');
  return {
    allowed: blockers.length === 0,
    blockers,
    incrementalEdgeAfterCorrelationBps: input.conservativeNetEdgeBps * Math.max(0, 1 - Math.abs(input.maximumExistingCorrelation)),
    paperOnly: true,
  };
}

export function transitionLifecycle(
  current: AlphaLifecycle,
  evidence: { forwardResolved: number; netEdgeLcbBps: number | null; decayRatio: number | null; hardRiskBreach: boolean },
): AlphaLifecycle {
  if (current === 'killed' || evidence.hardRiskBreach) return 'killed';
  const forwardState = current === 'validated' ? 'paper_shadow' : current;
  if (forwardState === 'paper_shadow' || forwardState === 'decaying') {
    if (evidence.forwardResolved >= 30 && ((evidence.netEdgeLcbBps ?? -Infinity) <= 0 || (evidence.decayRatio ?? 1) < 0.6)) return 're_research';
    if (evidence.forwardResolved >= 20 && (evidence.decayRatio ?? 1) < 0.8) return 'decaying';
  }
  return forwardState;
}
