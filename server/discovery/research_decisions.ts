import { chooseExecutionPolicy, portfolioRiskGate } from './flywheel.js';
import { contentHash } from './store.js';
import type {
  AlphaCandidateSpec, AlphaNoveltyRecord, AlphaTrial, AlphaValidationRecord, ExecutionDecisionRecord,
  PortfolioDecisionRecord,
} from './flywheel_types.js';

function tailBudget(lane: AlphaCandidateSpec['lane']): { remaining: number; maximumDrawdown: number } {
  if (lane === 'stocks') return { remaining: 500, maximumDrawdown: 750 };
  if (lane === 'spot_crypto') return { remaining: 750, maximumDrawdown: 1_000 };
  if (lane === 'memecoins') return { remaining: 400, maximumDrawdown: 600 };
  return { remaining: 400, maximumDrawdown: 600 };
}

export function buildResearchDecisions(input: {
  candidates: AlphaCandidateSpec[];
  validations: AlphaValidationRecord[];
  trials: AlphaTrial[];
  novelty: AlphaNoveltyRecord[];
}): { portfolioDecisions: PortfolioDecisionRecord[]; executionDecisions: ExecutionDecisionRecord[] } {
  const candidates = new Map(input.candidates.map((candidate) => [candidate.contentHash, candidate]));
  const trials = new Map(input.trials.filter((trial) => trial.validationId).map((trial) => [trial.validationId as string, trial]));
  const novelty = new Map(input.novelty.map((record) => [record.candidateHash, record]));
  const portfolioDecisions: PortfolioDecisionRecord[] = [];
  const executionDecisions: ExecutionDecisionRecord[] = [];
  for (const validation of input.validations) {
    const candidate = candidates.get(validation.candidateHash);
    const trial = trials.get(validation.id);
    if (!candidate || !trial) continue;
    const noveltyRecord = novelty.get(candidate.contentHash);
    const maximumExistingCorrelation = noveltyRecord?.maximumAbsoluteCorrelation ?? 1;
    const crowdingScore = noveltyRecord == null ? 1 : Math.min(1, maximumExistingCorrelation);
    const budget = tailBudget(candidate.lane);
    const stressedLossBps = validation.tailLossBps ?? 1_000_000;
    const portfolio = portfolioRiskGate({
      conservativeNetEdgeBps: validation.holdout.edgeLowerConfidenceBps ?? -1_000_000,
      maximumExistingCorrelation, crowdingScore, stressedLossBps,
      remainingTailBudgetBps: budget.remaining, currentDrawdownBps: 0,
      maximumDrawdownBps: budget.maximumDrawdown, maximumAllowedCorrelation: 0.8, maximumCrowdingScore: 0.8,
    });
    const portfolioPayload = { trialId: trial.id, candidateHash: candidate.contentHash, ...portfolio,
      maximumExistingCorrelation, crowdingScore, stressedLossBps };
    portfolioDecisions.push({ id: `portfolio_${contentHash(portfolioPayload).slice(0, 20)}`, ...portfolioPayload, createdAt: Date.now() });

    const gross = validation.holdout.meanGrossReturnBps ?? 0;
    const uncertainty = Math.max(0, (validation.holdout.meanNetReturnBps ?? 0) - (validation.holdout.edgeLowerConfidenceBps ?? -1_000_000));
    const cost = candidate.roundTripCostBps;
    const modeled = chooseExecutionPolicy({ predictedGrossEdgeBps: gross, uncertaintyBufferBps: uncertainty, minimumNetEdgeBps: 5,
      taker: { enabled: true, feeBps: cost * 0.25, halfSpreadBps: cost * 0.25, slippageBps: cost * 0.25, impactBps: cost * 0.25, fundingBps: 0 },
      maker: { enabled: true, feeBps: cost * 0.1, adverseSelectionBps: cost * 0.4, impactBps: cost * 0.1, fundingBps: 0, fillProbability: 0.5 },
      delayed: { enabled: true, feeBps: cost * 0.2, halfSpreadBps: cost * 0.2, slippageBps: cost * 0.2,
        impactBps: cost * 0.2, fundingBps: 0, edgeRetention: 0.75, delayBars: 1 },
    });
    const promoted = trial.status === 'candidate' && validation.disposition === 'candidate' && portfolio.allowed;
    const blockers = [...modeled.blockers];
    if (trial.status !== 'candidate' || validation.disposition !== 'candidate') blockers.push('VALIDATION_NOT_PROMOTED');
    if (!portfolio.allowed) blockers.push(...portfolio.blockers.map((blocker) => `PORTFOLIO_${blocker}`));
    const decision = promoted ? modeled : { ...modeled, policy: 'no_trade' as const, fillProbability: 0, blockers: [...new Set(blockers)] };
    const reason = promoted ? `CONSERVATIVE_${modeled.policy.toUpperCase()}_POLICY_SELECTED` : 'NO_TRADE_AFTER_VALIDATION_AND_PORTFOLIO_GATES';
    const executionPayload = { trialId: trial.id, candidateHash: candidate.contentHash, ...decision, reason };
    executionDecisions.push({ id: `execution_${contentHash(executionPayload).slice(0, 20)}`, ...executionPayload, createdAt: Date.now() });
  }
  return { portfolioDecisions, executionDecisions };
}
