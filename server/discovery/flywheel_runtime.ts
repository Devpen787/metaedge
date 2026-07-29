import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { computeCarryTrial, type CarryTrialConfig } from '../opportunity/carry_trial.js';
import { readLatestFunding } from '../opportunity/snapshot.js';
import { compilePointInTimeState, evidenceFingerprint } from './flywheel.js';
import { FlywheelLedger } from './flywheel_store.js';
import { attributeResolvedForwards, buildLifecycleAndResearchQueue } from './forward_runtime.js';
import { buildPredictionForwardObservations, type PredictionResolutionRow, type PredictionSnapshotRow } from './prediction_forward.js';
import { runPriceAlphaResearch } from './price_alpha_runtime.js';
import { buildResearchDecisions } from './research_decisions.js';
import { runOpportunityFactory } from './runtime.js';
import { readBars, readFactoryConfig } from './sources.js';
import { contentHash, readOpportunityCards, readRelationships } from './store.js';
import type {
  AlphaCandidateSpec, AlphaFamily, AlphaTrial, FlywheelCoverage, FlywheelLane, ForwardObservation, PointInTimeState,
} from './flywheel_types.js';
import type { OpportunityCard } from './types.js';

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function trialId(candidateHash: string, fingerprint: string): string {
  return `trial_${candidateHash.slice(0, 12)}_${fingerprint.slice(0, 12)}`;
}

function makeCandidate(input: Omit<AlphaCandidateSpec, 'id' | 'contentHash' | 'liveExecution'>): AlphaCandidateSpec {
  const payload = { ...input, liveExecution: 'locked' as const };
  const hash = contentHash(payload);
  return { ...payload, id: `candidate_${hash.slice(0, 20)}`, contentHash: hash };
}

function latestCards(): OpportunityCard[] {
  const cards = readOpportunityCards(500);
  const latest = new Map<string, OpportunityCard>();
  for (const card of cards) if (!latest.has(card.experimentId)) latest.set(card.experimentId, card);
  return [...latest.values()];
}

function mapLane(lane: OpportunityCard['lane']): FlywheelLane {
  if (lane === 'crypto') return 'spot_crypto';
  return lane;
}

function baselineResearch(cards: OpportunityCard[]): { candidates: AlphaCandidateSpec[]; trials: AlphaTrial[] } {
  const cfg = readFactoryConfig();
  const candidates: AlphaCandidateSpec[] = [];
  const trials = cards.map((card) => {
    const lane = mapLane(card.lane);
    const family: AlphaFamily = card.lane === 'stocks' ? 'signed_event_drift' : card.lane === 'crypto' ? 'momentum' : 'regime_momentum';
    const laneConfig = card.lane === 'stocks' ? cfg.stock : card.lane === 'crypto' ? cfg.crypto : cfg.memecoins;
    const scopeSymbols = card.lane === 'stocks' ? cfg.stock.symbols.map((item) => item.symbol)
      : card.lane === 'crypto' ? cfg.crypto.symbols : cfg.memecoins.symbols;
    const candidate = makeCandidate({ lane, family, scopeSymbols,
      lookbackBars: 'momentumLookbackBars' in laneConfig ? laneConfig.momentumLookbackBars : 1,
      horizonBars: laneConfig.horizonBars, roundTripCostBps: laneConfig.roundTripCostBps,
      declaredTrials: card.evidence.holdout.multipleTestingTrials, targetKind: 'benchmark_relative_return',
      rule: `${card.mechanism}; ${card.precommittedRule}; ${card.outcomeDefinition}` });
    candidates.push(candidate);
    const sourceHashes = card.provenance.map((source) => stableHash({ provider: source.provider, path: source.sourcePath, observedAt: source.observedAt }));
    const resolvedLabelIds = [stableHash({ sampleCount: card.sampleCount, evidence: card.evidence })];
    const fingerprint = evidenceFingerprint({ sourceHashes, resolvedLabelIds, contractHash: candidate.contentHash });
    const status: AlphaTrial['status'] = card.disposition === 'forward_paper_candidate' ? 'candidate'
      : card.disposition === 'declined' ? 'declined' : 'blocked';
    return {
      id: trialId(candidate.contentHash, fingerprint), candidateHash: candidate.contentHash, evidenceFingerprint: fingerprint, lane,
      family: card.experimentId, startedAt: card.createdAt, completedAt: card.createdAt,
      status,
      reason: card.reason, declaredTrials: card.evidence.holdout.multipleTestingTrials,
      support: card.sampleCount, liveExecution: 'locked' as const,
    };
  });
  return { candidates, trials };
}

function barStates(): PointInTimeState[] {
  const cfg = readFactoryConfig();
  const groups: Array<{ lane: FlywheelLane; symbols: string[]; interval: '1h' | '1d'; delayMs: number }> = [
    { lane: 'stocks', symbols: cfg.stock.symbols.map((item) => item.symbol), interval: '1d', delayMs: 86_400_000 },
    { lane: 'spot_crypto', symbols: cfg.crypto.symbols, interval: '1h', delayMs: 3_600_000 },
    { lane: 'memecoins', symbols: cfg.memecoins.symbols, interval: '1h', delayMs: 3_600_000 },
  ];
  const states: PointInTimeState[] = [];
  for (const group of groups) for (const symbol of group.symbols) {
    try {
      const { bars, provenance } = readBars(symbol, group.interval);
      const bar = bars.at(-1); if (!bar) continue;
      const availableAt = bar.t + group.delayMs;
      const sourceHash = stableHash({ path: provenance.sourcePath, t: bar.t, c: bar.c, v: bar.v, qv: bar.qv, trades: bar.trades });
      states.push(compilePointInTimeState({ lane: group.lane, symbol, observedAt: bar.t, decisionAt: availableAt, features: [
        { key: 'close', value: bar.c, observedAt: bar.t, availableAt, pointInTime: true, sourceHash },
        { key: 'volume', value: bar.v, observedAt: bar.t, availableAt, pointInTime: true, sourceHash },
        { key: 'quote_volume', value: bar.qv ?? null, observedAt: bar.t, availableAt, pointInTime: true, sourceHash },
        { key: 'trade_count', value: bar.trades ?? null, observedAt: bar.t, availableAt, pointInTime: true, sourceHash },
      ] }));
    } catch { /* missing lane history becomes a coverage blocker elsewhere */ }
  }
  return states;
}

function predictionRows(): PredictionSnapshotRow[] {
  const dir = path.join(process.cwd(), 'data', 'market', 'predictions');
  try {
    return fs.readdirSync(dir).filter((file) => file.startsWith('odds-') && file.endsWith('.jsonl')).sort()
      .flatMap((file) => fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)));
  } catch { return []; }
}

function predictionResolutionRows(): PredictionResolutionRow[] {
  const dir = path.join(process.cwd(), 'data', 'market', 'predictions');
  try {
    return fs.readdirSync(dir).filter((file) => file.startsWith('resolutions-') && file.endsWith('.jsonl')).sort()
      .flatMap((file) => fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)));
  } catch { return []; }
}

function predictionStates(rows: any[]): PointInTimeState[] {
  const latestAt = Math.max(0, ...rows.map((row) => Number(row.t) || 0));
  const latest = rows.filter((row) => row.t === latestAt).slice(0, 500);
  return latest.flatMap((row) => {
    const probability = Number(row.prices?.[0]);
    if (!(probability >= 0 && probability <= 1)) return [];
    const sourceHash = stableHash(row);
    return [compilePointInTimeState({ lane: 'prediction_markets', symbol: String(row.id), observedAt: row.t, decisionAt: row.t,
      features: [
        { key: 'outcome_0_probability', value: probability, observedAt: row.t, availableAt: row.t, pointInTime: true, sourceHash },
        { key: 'liquidity_usd', value: Number(row.liquidityUsd) || 0, observedAt: row.t, availableAt: row.t, pointInTime: true, sourceHash },
        { key: 'volume_usd', value: Number(row.volumeUsd) || 0, observedAt: row.t, availableAt: row.t, pointInTime: true, sourceHash },
      ] })];
  });
}

function perpsEvidence(): { states: PointInTimeState[]; candidate: AlphaCandidateSpec; trial: AlphaTrial; forward: ForwardObservation; blockers: string[]; observations: number } {
  const configPath = path.join(process.cwd(), 'config', 'research', 'carry-trial-v2.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as CarryTrialConfig;
  const carry = computeCarryTrial(config);
  const states = config.coins.flatMap((symbol) => {
    const funding = readLatestFunding(symbol);
    if (funding.fundingHourly == null) return [];
    const sourceHash = stableHash(funding);
    return [compilePointInTimeState({ lane: 'perpetuals', symbol: `${symbol}-PERP`, observedAt: funding.t, decisionAt: funding.t,
      features: [
        { key: 'funding_hourly', value: funding.fundingHourly, observedAt: funding.t, availableAt: funding.t, pointInTime: true, sourceHash },
        { key: 'funding_apr', value: funding.fundingApr, observedAt: funding.t, availableAt: funding.t, pointInTime: true, sourceHash },
        { key: 'open_interest_usd', value: funding.openInterestUsd, observedAt: funding.t, availableAt: funding.t, pointInTime: true, sourceHash },
      ] })];
  });
  const candidate = makeCandidate({ lane: 'perpetuals', family: 'funding_carry', scopeSymbols: config.coins.map((coin) => `${coin}-PERP`),
    lookbackBars: 1, horizonBars: config.trialDays * 24, roundTripCostBps: config.roundTripCostFraction * 10_000,
    declaredTrials: 1, targetKind: 'funding_adjusted_return', rule: `delta-neutral spot-perp carry for ${config.trialDays} days; kill below ${config.killFloorAprOnCapital}% APR on deployed capital` });
  const fingerprint = evidenceFingerprint({
    sourceHashes: carry.legs.map((leg) => stableHash({ symbol: leg.symbol, hours: leg.hoursAccrued, funding: leg.accruedFundingFraction, basis: leg.basisPnlFraction })),
    resolvedLabelIds: carry.verdict === 'ACCRUING' ? [] : [stableHash({ verdict: carry.verdict, apr: carry.portfolioAprOnCapital })],
    contractHash: candidate.contentHash,
  });
  const status = carry.verdict === 'KILL' ? 'declined' : carry.verdict === 'HOLD' ? 'candidate' : 'blocked';
  const blockers = ['ORDER_BOOK_DEPTH_HISTORY_MISSING', 'LIQUIDATION_HISTORY_MISSING'];
  if (carry.verdict === 'ACCRUING') blockers.unshift('FORWARD_WINDOW_INCOMPLETE');
  if (carry.verdict === 'INSUFFICIENT_DATA') blockers.unshift('FUNDING_CAPTURE_INSUFFICIENT');
  const trial: AlphaTrial = { id: trialId(candidate.contentHash, fingerprint), candidateHash: candidate.contentHash, evidenceFingerprint: fingerprint, lane: 'perpetuals',
      family: config.id, startedAt: Date.parse(config.trialStart), completedAt: carry.t, status, reason: carry.reason,
      declaredTrials: 1, support: carry.legs.reduce((sum, leg) => sum + leg.hoursAccrued, 0), liveExecution: 'locked' };
  const resolved = carry.verdict === 'HOLD' || carry.verdict === 'KILL';
  const resolveAt = Date.parse(config.trialStart) + config.trialDays * 86_400_000;
  const expired = carry.verdict === 'INSUFFICIENT_DATA' && carry.t >= resolveAt;
  const forwardStatus: ForwardObservation['status'] = resolved ? 'resolved' : expired ? 'expired' : 'pending';
  const averageReturnOnCapital = carry.legs.length
    ? carry.legs.reduce((sum, leg) => sum + leg.netFraction / config.capitalMultiple, 0) / carry.legs.length : null;
  const forwardPayload = { candidateHash: candidate.contentHash, forecastAt: Date.parse(config.trialStart),
    status: forwardStatus, realizedValue: resolved ? carry.portfolioAprOnCapital : null };
  const forward: ForwardObservation = {
    id: `forward_carry_${contentHash(forwardPayload).slice(0, 20)}`, trialId: trial.id, candidateHash: candidate.contentHash,
    lane: 'perpetuals', kind: 'carry_trial', forecastAt: Date.parse(config.trialStart), resolveAt,
    status: forwardStatus, predictedValue: config.killFloorAprOnCapital,
    realizedValue: resolved ? carry.portfolioAprOnCapital : null,
    netPaperPnlBps: resolved && averageReturnOnCapital != null ? averageReturnOnCapital * 10_000 : null,
    executionQuality: resolved ? carry.minCaptureCoverage : null,
  };
  return { states, candidate, trial, forward, observations: carry.legs.reduce((sum, leg) => sum + leg.hoursAccrued, 0), blockers };
}

function blockedTrial(candidate: AlphaCandidateSpec, reason: string, support: number, evidence: unknown): AlphaTrial {
  const fingerprint = evidenceFingerprint({ sourceHashes: [stableHash(evidence)], resolvedLabelIds: [], contractHash: candidate.contentHash });
  return { id: trialId(candidate.contentHash, fingerprint), candidateHash: candidate.contentHash, evidenceFingerprint: fingerprint,
    lane: candidate.lane, family: candidate.family,
    startedAt: Date.now(), completedAt: Date.now(), status: 'blocked', reason, declaredTrials: 1, support, liveExecution: 'locked' };
}

function relationshipResearch(): { candidates: AlphaCandidateSpec[]; trials: AlphaTrial[] } {
  const latest = new Map<string, ReturnType<typeof readRelationships>[number]>();
  for (const row of readRelationships(500)) {
    const key = `${row.sourceSymbol}|${row.targetSymbol}|${row.lagBars}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const rows = [...latest.values()];
  const candidates: AlphaCandidateSpec[] = [];
  const trials: AlphaTrial[] = [];
  for (const row of rows) {
    const candidate = makeCandidate({ lane: 'spot_crypto', family: 'cross_market_relationship',
      scopeSymbols: [row.sourceSymbol, row.targetSymbol], lookbackBars: row.lagBars, horizonBars: 1,
      roundTripCostBps: 20, declaredTrials: Math.max(1, rows.length), targetKind: 'benchmark_relative_return',
      rule: `${row.sourceSymbol} daily return at lag ${row.lagBars} predicts ${row.targetSymbol}; must clear adjusted relationship and separate purged forward validation` });
    candidates.push(candidate);
    const fingerprint = evidenceFingerprint({ sourceHashes: [stableHash(row)], resolvedLabelIds: [], contractHash: candidate.contentHash });
    trials.push({ id: trialId(candidate.contentHash, fingerprint), candidateHash: candidate.contentHash,
      evidenceFingerprint: fingerprint, lane: 'spot_crypto', family: candidate.family,
      startedAt: row.createdAt, completedAt: row.createdAt,
      status: row.disposition === 'declined' ? 'declined' : 'blocked',
      reason: row.disposition === 'declined' ? row.reason : 'RELATIONSHIP_REQUIRES_PURGED_FORWARD_VALIDATION',
      declaredTrials: candidate.declaredTrials, support: row.sampleCount, liveExecution: 'locked' });
  }
  return { candidates, trials };
}

function legacyCandidateStubs(ledger: FlywheelLedger): AlphaCandidateSpec[] {
  const snapshot = ledger.snapshot();
  const trials = new Map(snapshot.trials.map((trial) => [trial.id, trial]));
  return snapshot.integrity.orphanTrialIds.flatMap((id) => {
    const trial = trials.get(id); if (!trial) return [];
    // These rows predate the candidate registry. Preserve the original hash and
    // explicitly mark the missing contract instead of deleting history or
    // pretending the original parameters can be reconstructed.
    return [{ id: `candidate_legacy_${trial.candidateHash.slice(0, 13)}`, contentHash: trial.candidateHash,
      lane: trial.lane, family: 'legacy_import' as const, scopeSymbols: [], lookbackBars: 1, horizonBars: 1,
      roundTripCostBps: 0, declaredTrials: trial.declaredTrials, targetKind: 'benchmark_relative_return' as const,
      rule: `Legacy pre-registry trial ${trial.id}; original candidate parameters unavailable; retained for audit and ineligible for promotion`,
      liveExecution: 'locked' as const }];
  });
}

export async function runFlywheelCycle(options: { refreshBaseline?: boolean; ledger?: FlywheelLedger } = {}) {
  if (options.refreshBaseline) await runOpportunityFactory();
  const ledger = options.ledger ?? new FlywheelLedger();
  const legacyCandidates = legacyCandidateStubs(ledger);
  const cards = latestCards();
  const baseline = baselineResearch(cards);
  const trials = [...baseline.trials];
  const auxiliaryCandidates: AlphaCandidateSpec[] = [...baseline.candidates];
  const states = barStates();
  const perps = perpsEvidence();
  const predictions = predictionRows();
  const predictionResolutions = predictionResolutionRows();
  const predictionStateRows = predictionStates(predictions);
  const predictionCandidate = makeCandidate({ lane: 'prediction_markets', family: 'prediction_calibration', scopeSymbols: [],
    lookbackBars: 1, horizonBars: 1, roundTripCostBps: 0, declaredTrials: 1, targetKind: 'binary_resolution_probability',
    rule: 'compare point-in-time market probability with independently resolved binary outcome; score Brier, log loss, and closing-line value' });
  const predictionTrial = blockedTrial(predictionCandidate, 'RESOLVED_OUTCOME_LABELS_MISSING', predictions.length,
    { rows: predictions.length, latest: Math.max(0, ...predictions.map((row) => Number(row.t) || 0)) });
  const crossChainCandidate = makeCandidate({ lane: 'cross_chain', family: 'executable_arbitrage', scopeSymbols: [],
    lookbackBars: 1, horizonBars: 1, roundTripCostBps: 0, declaredTrials: 1, targetKind: 'executable_spread',
    rule: 'synchronized executable destination-source spread must remain positive after gas, fees, bridge/finality, failure, inventory, and slippage costs' });
  const crossChainTrial = blockedTrial(crossChainCandidate, 'EXECUTABLE_SYNCHRONIZED_QUOTES_MISSING', 0, { authorizedQuoteSource: false });
  const spotMicrostructure = makeCandidate({ lane: 'spot_crypto', family: 'microstructure_imbalance', scopeSymbols: [],
    lookbackBars: 1, horizonBars: 1, roundTripCostBps: 0, declaredTrials: 1, targetKind: 'benchmark_relative_return',
    rule: 'point-in-time order-flow and queue imbalance predict next mid-price move after fill, adverse-selection, fee, and impact simulation' });
  const perpMicrostructure = makeCandidate({ lane: 'perpetuals', family: 'microstructure_imbalance', scopeSymbols: [],
    lookbackBars: 1, horizonBars: 1, roundTripCostBps: 0, declaredTrials: 1, targetKind: 'funding_adjusted_return',
    rule: 'order-flow imbalance conditioned on funding, open interest, liquidation, depth, and volatility predicts next perp mid-price move' });
  const relationship = relationshipResearch();
  auxiliaryCandidates.push(perps.candidate, predictionCandidate, crossChainCandidate, spotMicrostructure, perpMicrostructure, ...relationship.candidates);
  const priceResearch = runPriceAlphaResearch();
  trials.push(perps.trial, predictionTrial, crossChainTrial,
    blockedTrial(spotMicrostructure, 'ORDER_BOOK_AND_ORDER_FLOW_HISTORY_MISSING', 0, { collector: false }),
    blockedTrial(perpMicrostructure, 'ORDER_BOOK_LIQUIDATION_AND_DEPTH_HISTORY_MISSING', 0, { collector: false }),
    ...relationship.trials, ...priceResearch.trials);
  states.push(...perps.states, ...predictionStateRows);
  const allCandidates = [...legacyCandidates, ...auxiliaryCandidates, ...priceResearch.candidates];
  const researchDecisions = buildResearchDecisions({ candidates: allCandidates, validations: priceResearch.validations,
    trials, novelty: priceResearch.novelty });
  const forwardObservations = [perps.forward, ...buildPredictionForwardObservations({ snapshots: predictions,
    resolutions: predictionResolutions, candidateHash: predictionCandidate.contentHash, trialId: predictionTrial.id })];

  const byLane = new Map<FlywheelLane, AlphaTrial[]>();
  for (const trial of trials) { const lane = byLane.get(trial.lane) || []; lane.push(trial); byLane.set(trial.lane, lane); }
  const memeCard = cards.find((card) => card.lane === 'memecoins');
  const coverage: FlywheelCoverage = { generatedAt: Date.now(), liveExecution: 'locked', lanes: {
    stocks: { status: 'partial', observations: cards.find((card) => card.lane === 'stocks')?.sampleCount ?? 0,
      trials: byLane.get('stocks')?.length ?? 0, blockers: ['SIGNED_SURPRISE_FEATURES_MISSING', 'POINT_IN_TIME_EXPECTATIONS_MISSING'],
      symbols: priceResearch.lanes.find((lane) => lane.lane === 'stocks')?.symbols,
      universeAuthority: priceResearch.lanes.find((lane) => lane.lane === 'stocks')?.universeAuthority },
    spot_crypto: { status: 'partial', observations: cards.find((card) => card.lane === 'crypto')?.sampleCount ?? 0,
      trials: byLane.get('spot_crypto')?.length ?? 0, blockers: ['INDEPENDENT_ATTENTION_SOURCE_MISSING', 'ORDER_FLOW_HISTORY_MISSING'],
      symbols: priceResearch.lanes.find((lane) => lane.lane === 'spot_crypto')?.symbols,
      universeAuthority: priceResearch.lanes.find((lane) => lane.lane === 'spot_crypto')?.universeAuthority },
    perpetuals: { status: 'partial', observations: perps.observations, trials: byLane.get('perpetuals')?.length ?? 0, blockers: perps.blockers },
    memecoins: { status: 'blocked', observations: memeCard?.sampleCount ?? 0, trials: byLane.get('memecoins')?.length ?? 0,
      blockers: memeCard?.memeRisk?.blockers ?? ['HOLDER_GRAPH_MISSING', 'LP_EVIDENCE_MISSING'],
      symbols: priceResearch.lanes.find((lane) => lane.lane === 'memecoins')?.symbols,
      universeAuthority: priceResearch.lanes.find((lane) => lane.lane === 'memecoins')?.universeAuthority },
    prediction_markets: { status: 'partial', observations: predictions.length, trials: byLane.get('prediction_markets')?.length ?? 0,
      blockers: predictionResolutions.length
        ? ['RESOLVED_OUTCOME_SUPPORT_BELOW_30', 'INDEPENDENT_SETTLEMENT_AUDIT_MISSING']
        : ['RESOLVED_OUTCOME_LABELS_MISSING', 'INDEPENDENT_SETTLEMENT_AUDIT_MISSING'] },
    cross_chain: { status: 'blocked', observations: 0, trials: byLane.get('cross_chain')?.length ?? 0,
      blockers: ['EXECUTABLE_SYNCHRONIZED_QUOTES_MISSING', 'GAS_BRIDGE_FINALITY_AND_INVENTORY_MODEL_MISSING'] },
  } };
  ledger.appendStates(states);
  ledger.appendCandidates(allCandidates);
  ledger.appendValidations(priceResearch.validations);
  ledger.appendNovelty(priceResearch.novelty);
  ledger.appendPortfolioDecisions(researchDecisions.portfolioDecisions);
  ledger.appendExecutionDecisions(researchDecisions.executionDecisions);
  ledger.appendTrials(trials);
  ledger.appendForwardObservations(forwardObservations);
  ledger.writeCoverage(coverage);
  const beforeAttribution = ledger.snapshot();
  ledger.appendAttributions(attributeResolvedForwards(beforeAttribution.forwardObservations));
  const beforeLifecycle = ledger.snapshot();
  const lifecycle = buildLifecycleAndResearchQueue({ trials: beforeLifecycle.trials,
    attributions: beforeLifecycle.attributions, existingLifecycle: beforeLifecycle.lifecycle });
  ledger.appendLifecycle(lifecycle.lifecycle);
  ledger.appendResearchQueue(lifecycle.researchQueue);
  return ledger.snapshot();
}
