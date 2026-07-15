import { contentHash } from './store.js';
import type { FlywheelSnapshot, PointInTimeState } from './flywheel_types.js';
import type { LaneSignalPacket, ResearchStream } from './lane_signal_types.js';
import type { SignalResearchArtifact } from './signal_types.js';
import type { WorldParityAudit } from './world_types.js';

function latestStates(states: PointInTimeState[], stream: ResearchStream): PointInTimeState[] {
  if (stream === 'cross_market_quant') return [];
  const latest = new Map<string, PointInTimeState>();
  for (const state of states.filter((row) => row.lane === stream).sort((a, b) => a.decisionAt - b.decisionAt)) latest.set(state.symbol, state);
  return [...latest.values()];
}

function featureMean(states: PointInTimeState[], key: string): number | null {
  const values = states.flatMap((state) => state.features.filter((feature) => feature.key === key)
    .map((feature) => Number(feature.value))).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function currentSignalArtifacts(artifacts: SignalResearchArtifact[]): SignalResearchArtifact[] {
  const latest = new Map<string, SignalResearchArtifact>();
  for (const artifact of artifacts) latest.set(`${artifact.lane}:${artifact.symbol}`, artifact);
  return [...latest.values()];
}

function streamBlockers(stream: ResearchStream, flywheel: FlywheelSnapshot, signalArtifacts: SignalResearchArtifact[]): string[] {
  const coverage = stream === 'cross_market_quant' ? null : flywheel.coverage?.lanes[stream];
  const blockers = [...(coverage?.blockers ?? [])];
  for (const artifact of signalArtifacts.filter((row) => row.lane === stream)) {
    blockers.push(...artifact.blockers, ...(artifact.decisionReasons ?? []));
  }
  if (stream === 'cross_market_quant') {
    const relationships = flywheel.candidates.filter((candidate) => candidate.family === 'cross_market_relationship');
    if (!relationships.length) blockers.push('CROSS_MARKET_RELATIONSHIPS_NOT_MEASURED');
    if (relationships.length) blockers.push('PURGED_FORWARD_RELATIONSHIP_VALIDATION_MISSING');
  }
  return [...new Set(blockers)].sort();
}

function measurements(stream: ResearchStream, states: PointInTimeState[], flywheel: FlywheelSnapshot,
  signalArtifacts: SignalResearchArtifact[]): Record<string, number | null> {
  const trials = flywheel.trials.filter((trial) => stream === 'cross_market_quant'
    ? trial.family === 'cross_market_relationship' : trial.lane === stream);
  const forwards = flywheel.forwardObservations.filter((row) => stream === 'cross_market_quant' ? false : row.lane === stream);
  const base: Record<string, number | null> = {
    currentStates: states.length,
    validStates: states.filter((state) => state.valid).length,
    declaredTrials: trials.reduce((sum, trial) => sum + trial.declaredTrials, 0),
    recordedTrials: trials.length,
    supportedTrials: trials.filter((trial) => trial.support > 0).length,
    candidateTrials: trials.filter((trial) => trial.status === 'candidate').length,
    declinedTrials: trials.filter((trial) => trial.status === 'declined').length,
    blockedTrials: trials.filter((trial) => trial.status === 'blocked').length,
    pendingForwards: forwards.filter((row) => row.status === 'pending').length,
    resolvedForwards: forwards.filter((row) => row.status === 'resolved').length,
    transformArtifacts: signalArtifacts.filter((row) => row.lane === stream).length,
    robustParameterSurfaces: signalArtifacts.filter((row) => row.lane === stream && row.plateau.robust).length,
  };
  if (stream === 'perpetuals') {
    base.meanFundingHourly = featureMean(states, 'funding_hourly'); base.meanFundingApr = featureMean(states, 'funding_apr');
    base.meanOpenInterestUsd = featureMean(states, 'open_interest_usd');
  }
  if (stream === 'prediction_markets') {
    base.meanProbability = featureMean(states, 'outcome_0_probability'); base.meanLiquidityUsd = featureMean(states, 'liquidity_usd');
  }
  if (stream === 'stocks' || stream === 'spot_crypto' || stream === 'memecoins') {
    base.meanClose = featureMean(states, 'close'); base.meanVolume = featureMean(states, 'volume');
  }
  return base;
}

export function buildLaneSignalPackets(input: { flywheel: FlywheelSnapshot; signalArtifacts: SignalResearchArtifact[];
  worldAudit: WorldParityAudit | null; createdAt?: number }): LaneSignalPacket[] {
  const createdAt = input.createdAt ?? Date.now();
  const signalArtifacts = currentSignalArtifacts(input.signalArtifacts);
  const streams: ResearchStream[] = ['stocks', 'spot_crypto', 'perpetuals', 'memecoins', 'prediction_markets', 'cross_chain', 'cross_market_quant'];
  return streams.map((stream) => {
    const states = latestStates(input.flywheel.states, stream);
    const streamSignals = signalArtifacts.filter((artifact) => artifact.lane === stream);
    const blockers = streamBlockers(stream, input.flywheel, signalArtifacts);
    const packetMeasurements = measurements(stream, states, input.flywheel, signalArtifacts);
    const streamForwards = input.flywheel.forwardObservations.filter((row) => stream !== 'cross_market_quant' && row.lane === stream);
    const pointInTimeStateFraction = states.length ? states.filter((state) => state.valid).length / states.length : 0;
    const resolvedForwardFraction = streamForwards.length
      ? streamForwards.filter((row) => row.status === 'resolved').length / streamForwards.length : 0;
    const executionEvidenceMissing = blockers.some((blocker) => ['ORDER_BOOK', 'ORDER_FLOW', 'DEPTH', 'EXECUTABLE',
      'LIQUIDITY', 'GAS_BRIDGE', 'HOLDER_', 'TURNOVER_'].some((token) => blocker.includes(token)));
    const evidenceComponents = [states.length > 0, (packetMeasurements.supportedTrials ?? 0) > 0,
      (packetMeasurements.resolvedForwards ?? 0) > 0, !executionEvidenceMissing,
      (packetMeasurements.robustParameterSurfaces ?? 0) > 0];
    const evidenceCompleteness = evidenceComponents.filter(Boolean).length / evidenceComponents.length;
    const score = (pointInTimeStateFraction + resolvedForwardFraction + evidenceCompleteness) / 3;
    const measured = states.length > 0 || streamSignals.length > 0
      || (stream === 'cross_market_quant' && input.flywheel.candidates.some((candidate) => candidate.family === 'cross_market_relationship'));
    const evidenceStatus = !measured ? 'blocked' : blockers.length ? 'partial' : 'measured';
    const signalDisposition = streamSignals.at(-1)?.promotionDisposition;
    const researchDisposition = signalDisposition === 'forward_candidate' ? 'forward_candidate'
      : signalDisposition === 'declined' ? 'rejected'
        : signalDisposition === 'blocked' ? 'blocked'
          : !measured ? 'blocked' : blockers.length ? 'insufficient' : 'rejected';
    const candidateAction = researchDisposition === 'forward_candidate' && input.worldAudit?.paperForwardEligible
      ? 'observe_forward' : evidenceStatus === 'partial' ? 'research_only' : 'no_trade';
    const sourceArtifactIds = [...new Set([
      ...states.map((state) => state.id), ...streamSignals.map((artifact) => artifact.id),
      ...input.flywheel.trials.filter((trial) => stream === 'cross_market_quant'
        ? trial.family === 'cross_market_relationship' : trial.lane === stream).map((trial) => trial.id),
    ])].sort();
    const identity = { stream, datasetVersionId: input.worldAudit?.datasetVersionId ?? null,
      universeVersionId: input.worldAudit?.universeVersionId ?? null, worldContractId: input.worldAudit?.contractId ?? null,
      sourceArtifactIds, measurements: packetMeasurements,
      quality: { pointInTimeStateFraction, resolvedForwardFraction, evidenceCompleteness, score },
      blockers, researchDisposition, candidateAction };
    return { id: `lane_signal_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, createdAt, stream,
      datasetVersionId: input.worldAudit?.datasetVersionId ?? null,
      universeVersionId: input.worldAudit?.universeVersionId ?? null,
      worldContractId: input.worldAudit?.contractId ?? null,
      asOf: states.length ? Math.max(...states.map((state) => state.decisionAt)) : null,
      observedSymbols: states.map((state) => state.symbol).sort(), sourceArtifactIds,
      measurements: packetMeasurements,
      quality: { pointInTimeStateFraction, resolvedForwardFraction, evidenceCompleteness, score }, evidenceStatus,
      researchDisposition, candidateAction, blockers, liveExecution: 'locked' };
  });
}
