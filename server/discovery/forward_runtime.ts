import { transitionLifecycle } from './flywheel.js';
import { edgeStatistics } from './math.js';
import { contentHash } from './store.js';
import type {
  AlphaLifecycle, AlphaLifecycleRecord, AlphaTrial, AttributionRecord, ForwardObservation, ResearchQueueItem,
} from './flywheel_types.js';

export function attributeResolvedForwards(forwards: ForwardObservation[]): AttributionRecord[] {
  return forwards.filter((forward) => forward.status === 'resolved' && forward.realizedValue != null && forward.candidateHash)
    .map((forward) => {
      const isProbability = forward.kind === 'calibration_forecast';
      const directionalHit = forward.kind === 'carry_trial' ? null
        : isProbability ? ((forward.predictedValue >= 0.5) === (forward.realizedValue === 1))
          : ((forward.predictedValue >= 0) === ((forward.realizedValue as number) >= 0));
      const calibrationSquaredError = isProbability ? (forward.predictedValue - (forward.realizedValue as number)) ** 2 : null;
      const payload = { forwardObservationId: forward.id, trialId: forward.trialId,
        candidateHash: forward.candidateHash, realizedValue: forward.realizedValue, netPaperPnlBps: forward.netPaperPnlBps };
      return { id: `attribution_${contentHash(payload).slice(0, 20)}`, forwardObservationId: forward.id,
        trialId: forward.trialId, candidateHash: forward.candidateHash, resolvedAt: forward.resolveAt,
        directionalHit, calibrationSquaredError, netPaperPnlBps: forward.netPaperPnlBps,
        executionQuality: forward.executionQuality };
    });
}

export function buildLifecycleAndResearchQueue(input: {
  trials: AlphaTrial[];
  attributions: AttributionRecord[];
  existingLifecycle: AlphaLifecycleRecord[];
}): { lifecycle: AlphaLifecycleRecord[]; researchQueue: ResearchQueueItem[] } {
  const latestTrials = new Map<string, AlphaTrial>();
  for (const trial of [...input.trials].sort((a, b) => a.completedAt - b.completedAt)) latestTrials.set(trial.candidateHash, trial);
  const latestLifecycle = new Map<string, AlphaLifecycleRecord>();
  for (const record of [...input.existingLifecycle].sort((a, b) => a.at - b.at)) latestLifecycle.set(record.candidateHash, record);
  const lifecycle: AlphaLifecycleRecord[] = [];
  const researchQueue: ResearchQueueItem[] = [];
  for (const trial of latestTrials.values()) {
    const prior = latestLifecycle.get(trial.candidateHash);
    const resolved = input.attributions.filter((row) => row.candidateHash === trial.candidateHash);
    const pnl = resolved.map((row) => row.netPaperPnlBps).filter((value): value is number => value != null && Number.isFinite(value));
    const edge = edgeStatistics(pnl, pnl.map((value) => value > 0 ? 'upper' : 'lower'), 0.05, 1);
    const hardRiskBreach = resolved.some((row) => (row.executionQuality != null && row.executionQuality < 0.5) || (row.netPaperPnlBps ?? 0) < -1_000);
    let next: AlphaLifecycle;
    let reason: string;
    if (trial.status === 'declined') { next = 'killed'; reason = `HISTORICAL_VALIDATION_DECLINED:${trial.reason}`; }
    else if (trial.status === 'failed') { next = 're_research'; reason = `TRIAL_FAILED:${trial.reason}`; }
    else if (trial.status === 'blocked') { next = 'research'; reason = `EVIDENCE_BLOCKED:${trial.reason}`; }
    else {
      const current = prior?.state === 'validated' ? 'paper_shadow' : prior?.state ?? 'validated';
      next = transitionLifecycle(current, { forwardResolved: resolved.length,
        netEdgeLcbBps: edge.edgeLowerConfidenceBps, decayRatio: pnl.length && (edge.meanNetRelativeBps ?? 0) <= 0 ? 0 : 1,
        hardRiskBreach });
      reason = next === 'paper_shadow' ? 'VALIDATED_CANDIDATE_ENTERED_FORWARD_PAPER_SHADOW'
        : next === 're_research' ? 'FORWARD_EDGE_DECAYED_BELOW_PROMOTION_EVIDENCE'
          : next === 'killed' ? 'HARD_FORWARD_RISK_BREACH' : `FORWARD_STATE_${next.toUpperCase()}`;
    }
    const payload = { candidateHash: trial.candidateHash, trialId: trial.id, state: next, reason,
      resolvedForwardObservations: resolved.length, evidenceFingerprint: trial.evidenceFingerprint };
    const id = `lifecycle_${contentHash(payload).slice(0, 20)}`;
    if (!input.existingLifecycle.some((record) => record.id === id)) lifecycle.push({ id, candidateHash: trial.candidateHash,
      trialId: trial.id, state: next, at: Date.now(), reason, resolvedForwardObservations: resolved.length, liveExecution: 'locked' });
    if (next === 're_research') {
      const queuePayload = { candidateHash: trial.candidateHash, sourceTrialId: trial.id, trigger: 'FORWARD_DECAY', reason };
      researchQueue.push({ id: `research_${contentHash(queuePayload).slice(0, 20)}`, ...queuePayload,
        trigger: 'FORWARD_DECAY', status: 'open', createdAt: Date.now() });
    }
  }
  return { lifecycle, researchQueue };
}
