import { buildPaperTradeContract, ECONOMIC_OBJECTIVE_POLICY, evaluatePaperLifecycle } from './economic_runtime.js';
import { EconomicOperationStore } from './economic_store.js';
import { edgeStatistics } from './math.js';
import { contentHash } from './store.js';
import { blockBootstrapLowerBound, chooseBlockLength } from './fast_statistics.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import type { FastPerpBookEvent, FastPerpContextEvent, FastPerpTradeEvent } from './fast_perp_types.js';
import type {
  FastPerpFamily,
  FastPerpFamilyEvaluation,
  FastPerpParameterChoice,
  FastPerpResearchRun,
  FastPerpResearchSample,
  FastPerpSplitMetrics,
} from './fast_perp_research_types.js';

const SOURCE_VERSION = 'fast-perp-research-v2';
export const FAST_PERP_RESEARCH_POLICY_VERSION = 'fast-perp-research-policy-v7' as const;
const FAMILIES: FastPerpFamily[] = [
  'book_imbalance_continuation', 'book_imbalance_reversal',
  'short_momentum_continuation', 'short_momentum_reversal',
  'aggressive_flow_continuation', 'aggressive_flow_reversal',
  'liquidity_withdrawal_continuation', 'liquidity_withdrawal_reversal',
  'liquidation_rebound', 'funding_crowding_reversal',
];
const SPEED_GRIDS = {
  microstructure: { horizons: [1_000, 2_500], lookbacks: [1_000, 2_500] },
  fast_event: { horizons: [5_000, 15_000, 30_000], lookbacks: [5_000, 15_000] },
} as const;
// Conservative round-trip taker allowance (entry plus exit). The ledger
// charges this total once rather than applying one side twice elsewhere.
const COSTS = { feeBps: 7, spreadBps: 0, slippageBps: 1, impactBps: 1, fundingBps: 0,
  borrowBps: 0, adverseSelectionBps: 1, latencyBps: 1 };
const UNCERTAINTY_BUFFER_BPS = 2;
export const FAST_PERP_MAXIMUM_DECLARED_TRIALS = 3_500 as const;

function mean(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function firstIndexAtOrAfter<T extends { eventTime: number }>(rows: T[], at: number): number {
  let low = 0; let high = rows.length;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (rows[middle].eventTime < at) low = middle + 1; else high = middle; }
  return low;
}
function firstIndexAfter<T extends { eventTime: number }>(rows: T[], at: number): number {
  let low = 0; let high = rows.length;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (rows[middle].eventTime <= at) low = middle + 1; else high = middle; }
  return low;
}
function firstAtOrAfter<T extends { eventTime: number }>(rows: T[], at: number): T | null {
  return rows[firstIndexAtOrAfter(rows, at)] ?? null;
}
function lastAtOrBefore<T extends { eventTime: number }>(rows: T[], at: number): T | null {
  const low = firstIndexAfter(rows, at);
  return rows[low - 1] ?? null;
}

function levelVwap(levels: FastPerpBookEvent['bids'], notionalUsd: number): number | null {
  let remaining = notionalUsd; let quantity = 0; let spent = 0;
  for (const level of levels) {
    const availableNotional = level.price * level.size; const used = Math.min(remaining, availableNotional);
    quantity += used / level.price; spent += used; remaining -= used; if (remaining <= 1e-9) break;
  }
  return remaining <= 1e-9 && quantity > 0 ? spent / quantity : null;
}

function parameterGrid(family: FastPerpFamily, speedTier: 'microstructure' | 'fast_event'): FastPerpParameterChoice[] {
  const horizons = [...SPEED_GRIDS[speedTier].horizons]; const lookbacks = [...SPEED_GRIDS[speedTier].lookbacks];
  if (family.startsWith('book_imbalance')) return horizons.flatMap((horizonMs) => [0.2, 0.4]
    .map((threshold) => ({ horizonMs, lookbackMs: 0, threshold })));
  if (family.startsWith('short_momentum')) return horizons.flatMap((horizonMs) => lookbacks.flatMap((lookbackMs) => [2, 5]
    .map((threshold) => ({ horizonMs, lookbackMs, threshold }))));
  if (family.startsWith('aggressive_flow')) return horizons.flatMap((horizonMs) => lookbacks.flatMap((lookbackMs) => [0.2, 0.4]
    .map((threshold) => ({ horizonMs, lookbackMs, threshold }))));
  if (family.startsWith('liquidity_withdrawal')) return horizons.flatMap((horizonMs) => [0.3, 0.5]
    .map((threshold) => ({ horizonMs, lookbackMs: lookbacks.at(-1) ?? horizonMs, threshold })));
  if (family === 'funding_crowding_reversal') return horizons.flatMap((horizonMs) => [0.00005, 0.0001]
    .map((threshold) => ({ horizonMs, lookbackMs: 0, threshold })));
  return horizons.flatMap((horizonMs) => [100_000, 500_000]
    .map((threshold) => ({ horizonMs, lookbackMs: lookbacks.at(-1) ?? horizonMs, threshold })));
}

export function fastPerpDeclaredTrialsForSymbols(symbols: number): number {
  return Math.max(0, symbols) * (['microstructure', 'fast_event'] as const)
    .reduce((tierSum, tier) => tierSum + FAMILIES.reduce((sum, family) => sum + parameterGrid(family, tier).length, 0), 0);
}

function signedFlow(trades: FastPerpTradeEvent[], from: number, to: number): { signed: number; total: number; ids: string[] } {
  let signed = 0; let total = 0; const ids: string[] = [];
  const end = firstIndexAfter(trades, to);
  for (let index = firstIndexAtOrAfter(trades, from); index < end; index += 1) {
    const trade = trades[index];
    total += trade.notionalUsd; signed += trade.notionalUsd * (trade.side === 'buy' ? 1 : -1); ids.push(trade.id);
  }
  return { signed, total, ids };
}

function liquidationFlow(trades: FastPerpTradeEvent[], from: number, to: number): {
  sell: number; buy: number; ids: string[];
} {
  let sell = 0; let buy = 0; const ids: string[] = [];
  const end = firstIndexAfter(trades, to);
  for (let index = firstIndexAtOrAfter(trades, from); index < end; index += 1) {
    const trade = trades[index];
    if (trade.liquidation !== true) continue;
    if (trade.side === 'sell') sell += trade.notionalUsd; else buy += trade.notionalUsd;
    ids.push(trade.id);
  }
  return { sell, buy, ids };
}

export function compileFastPerpSamples(input: { family: FastPerpFamily; parameters: FastPerpParameterChoice;
  books: FastPerpBookEvent[]; trades: FastPerpTradeEvent[]; contexts?: FastPerpContextEvent[];
  costBps: number }): FastPerpResearchSample[] {
  const rows = input.books; const output: FastPerpResearchSample[] = []; let nextAllowed = Number.NEGATIVE_INFINITY;
  for (const book of rows) {
    if (book.eventTime < nextAllowed) continue;
    const future = firstAtOrAfter(rows, book.eventTime + input.parameters.horizonMs);
    if (!future) continue;
    let sign: -1 | 1 | 0 = 0; const sourceEventIds = [book.id, future.id];
    const reverse = input.family.endsWith('_reversal') || input.family === 'liquidation_rebound';
    if (input.family.startsWith('book_imbalance')) {
      if (Math.abs(book.imbalance) < input.parameters.threshold) continue;
      sign = book.imbalance > 0 ? 1 : -1;
    } else if (input.family.startsWith('short_momentum')) {
      const prior = lastAtOrBefore(rows, book.eventTime - input.parameters.lookbackMs); if (!prior) continue;
      const momentumBps = (book.midPrice / prior.midPrice - 1) * 10_000;
      if (Math.abs(momentumBps) < input.parameters.threshold) continue;
      sign = momentumBps > 0 ? 1 : -1; sourceEventIds.push(prior.id);
    } else if (input.family.startsWith('aggressive_flow')) {
      const flow = signedFlow(input.trades, book.eventTime - input.parameters.lookbackMs, book.eventTime);
      if (!(flow.total > 0) || Math.abs(flow.signed / flow.total) < input.parameters.threshold) continue;
      sign = flow.signed > 0 ? 1 : -1; sourceEventIds.push(...flow.ids);
    } else if (input.family.startsWith('liquidity_withdrawal')) {
      const prior = lastAtOrBefore(rows, book.eventTime - input.parameters.lookbackMs); if (!prior) continue;
      const priorDepth = prior.bidDepthUsd + prior.askDepthUsd; const currentDepth = book.bidDepthUsd + book.askDepthUsd;
      if (!(priorDepth > 0) || 1 - currentDepth / priorDepth < input.parameters.threshold) continue;
      const momentum = book.midPrice / prior.midPrice - 1; if (!momentum) continue;
      sign = momentum > 0 ? 1 : -1; sourceEventIds.push(prior.id);
    } else if (input.family === 'liquidation_rebound') {
      const liquidations = liquidationFlow(input.trades, book.eventTime - input.parameters.lookbackMs, book.eventTime);
      if (Math.max(liquidations.sell, liquidations.buy) < input.parameters.threshold
        || liquidations.sell === liquidations.buy) continue;
      sign = liquidations.sell > liquidations.buy ? 1 : -1; sourceEventIds.push(...liquidations.ids);
    } else if (input.family === 'funding_crowding_reversal') {
      const context = lastAtOrBefore(input.contexts ?? [], book.eventTime);
      if (!context || Math.abs(context.fundingRate) < input.parameters.threshold) continue;
      sign = context.fundingRate > 0 ? 1 : -1; sourceEventIds.push(context.id);
    } else {
      continue;
    }
    if (reverse) sign = sign === 1 ? -1 : 1;
    const capacityUsd = Math.min(sign > 0 ? book.askDepthUsd : book.bidDepthUsd,
      sign > 0 ? future.bidDepthUsd : future.askDepthUsd) * 0.02;
    const filledNotionalUsd = Math.min(250, capacityUsd);
    if (!(filledNotionalUsd > 0)) continue;
    const entryPrice = levelVwap(sign > 0 ? book.asks : book.bids, filledNotionalUsd);
    const exitPrice = levelVwap(sign > 0 ? future.bids : future.asks, filledNotionalUsd);
    if (entryPrice == null || exitPrice == null) continue;
    const midGrossReturnBps = sign * (future.midPrice / book.midPrice - 1) * 10_000;
    const grossReturnBps = sign * (exitPrice / entryPrice - 1) * 10_000;
    const executionCostBps = midGrossReturnBps - grossReturnBps;
    const identity = { family: input.family, parameters: input.parameters, symbol: book.symbol,
      decisionAt: book.eventTime, resolvedAt: future.eventTime, sourceEventIds: [...new Set(sourceEventIds)].sort() };
    output.push({ id: `fast_perp_sample_${contentHash(identity).slice(0, 20)}`, symbol: book.symbol,
      family: input.family, sign, decisionAt: book.eventTime, resolvedAt: future.eventTime,
      grossReturnBps, netReturnBps: grossReturnBps - input.costBps, executionCostBps,
      filledNotionalUsd, sourceEventIds: identity.sourceEventIds });
    nextAllowed = book.eventTime + input.parameters.horizonMs;
  }
  return output;
}

function split(samples: FastPerpResearchSample[]) {
  const ordered = [...samples].sort((left, right) => left.decisionAt - right.decisionAt);
  const trainEnd = Math.floor(ordered.length * 0.6); const validationEnd = Math.floor(ordered.length * 0.8);
  return { training: ordered.slice(0, trainEnd), validation: ordered.slice(trainEnd, validationEnd),
    holdout: ordered.slice(validationEnd) };
}

function screeningMetrics(samples: FastPerpResearchSample[], declaredTrials: number): FastPerpSplitMetrics {
  const gross = samples.map((row) => row.grossReturnBps); const net = samples.map((row) => row.netReturnBps);
  const stats = edgeStatistics(net, net.map((value) => value > 0 ? 'upper' : 'lower'), 0.05, declaredTrials);
  return { samples: samples.length, meanGrossReturnBps: mean(gross), meanNetReturnBps: mean(net),
    lowerBoundNetEdgeBps: stats.edgeLowerConfidenceBps,
    winRate: samples.length ? samples.filter((row) => row.netReturnBps > 0).length / samples.length : null };
}

function robustMetrics(samples: FastPerpResearchSample[], declaredTrials: number, edgeHalfLifeMs: number): FastPerpSplitMetrics {
  const gross = samples.map((row) => row.grossReturnBps); const net = samples.map((row) => row.netReturnBps);
  const block = chooseBlockLength({ values: net, times: samples.map((row) => row.resolvedAt), edgeHalfLifeMs });
  const alphaSpent = 0.05 / Math.max(1, declaredTrials);
  return { samples: samples.length, meanGrossReturnBps: mean(gross), meanNetReturnBps: mean(net),
    lowerBoundNetEdgeBps: blockBootstrapLowerBound(net, block.blockLengthSamples, alphaSpent),
    winRate: samples.length ? samples.filter((row) => row.netReturnBps > 0).length / samples.length : null,
    independentBlockCount: samples.length ? block.independentBlockCount : 0,
    blockLengthMs: block.blockLengthMs, alphaSpent };
}

function evaluateFamily(symbol: string, family: FastPerpFamily, speedTier: 'microstructure' | 'fast_event',
  books: FastPerpBookEvent[], trades: FastPerpTradeEvent[], contexts: FastPerpContextEvent[],
  declaredTrials: number, costBps: number): FastPerpFamilyEvaluation {
  const choices = parameterGrid(family, speedTier).map((parameters) => {
    const samples = compileFastPerpSamples({ family, parameters, books, trades, contexts, costBps }); const parts = split(samples);
    return { parameters, samples, parts, training: screeningMetrics(parts.training, declaredTrials) };
  });
  const selected = [...choices].sort((left, right) => (right.training.lowerBoundNetEdgeBps ?? -Infinity)
    - (left.training.lowerBoundNetEdgeBps ?? -Infinity) || right.training.samples - left.training.samples)[0] ?? null;
  const selectedHorizonMs = selected?.parameters.horizonMs ?? 1;
  const training = robustMetrics(selected?.parts.training ?? [], declaredTrials, selectedHorizonMs);
  const validation = robustMetrics(selected?.parts.validation ?? [], declaredTrials, selectedHorizonMs);
  const holdout = robustMetrics(selected?.parts.holdout ?? [], declaredTrials, selectedHorizonMs);
  // Do not annualize a few startup seconds into thousands of supposed daily
  // opportunities. Until a full day has been observed, the conservative rate
  // is samples per one day; after that it uses actual exposure duration.
  const samples = selected?.samples ?? []; const durationDays = books.length > 1
    ? Math.max(1, (books.at(-1)!.eventTime - books[0].eventTime) / 86_400_000) : 1;
  const blockers: string[] = [];
  if (family === 'funding_crowding_reversal' && !contexts.length) blockers.push('POINT_IN_TIME_FAST_FUNDING_CONTEXT_NOT_JOINED');
  if (family === 'liquidation_rebound' && !trades.some((row) => row.liquidation === true)) blockers.push('AUTHORITATIVE_LIQUIDATION_FLAG_MISSING');
  if (validation.samples < 20 || holdout.samples < 20) blockers.push('FAST_EVENT_SPLIT_SUPPORT_BELOW_20');
  if ((validation.independentBlockCount ?? 0) < 4 || (holdout.independentBlockCount ?? 0) < 4) {
    blockers.push('FAST_EVENT_INDEPENDENT_BLOCK_SUPPORT_BELOW_4');
  }
  if (!((validation.lowerBoundNetEdgeBps ?? -Infinity) > 0)) blockers.push('FAST_EVENT_VALIDATION_EDGE_NOT_POSITIVE');
  if (!((holdout.lowerBoundNetEdgeBps ?? -Infinity) > 0)) blockers.push('FAST_EVENT_HOLDOUT_EDGE_NOT_POSITIVE');
  const disposition = blockers.some((row) => row.includes('MISSING') || row.includes('SUPPORT')) ? 'insufficient'
    : blockers.length ? 'declined' : 'shadow_candidate';
  const allSourceEventIds = [...new Set(samples.flatMap((row) => row.sourceEventIds))].sort();
  const sourceEventIds = [...new Set([allSourceEventIds[0], allSourceEventIds.at(-1)].filter((row): row is string => Boolean(row)))];
  const sampleDigest = contentHash({ family, symbol, speedTier, parameters: selected?.parameters ?? null,
    sampleIds: samples.map((row) => row.id), sourceEventIds: allSourceEventIds });
  const evidenceCutoffAt = trades.reduce((latest, row) => Math.max(latest, row.receivedAt),
    books.reduce((latest, row) => Math.max(latest, row.receivedAt), 0));
  const identity = { symbol, family, speedTier, selectedParameters: selected?.parameters ?? null, declaredTrials,
    training, validation, holdout, sourceEventIds, evidenceCutoffAt };
  const fullBlock = chooseBlockLength({ values: samples.map((row) => row.netReturnBps),
    times: samples.map((row) => row.resolvedAt), edgeHalfLifeMs: selectedHorizonMs });
  return { id: `fast_perp_evaluation_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1, ...identity,
    sampleDigest, sourceEventCount: allSourceEventIds.length,
    independentSamples: samples.length ? fullBlock.independentBlockCount : 0, opportunitiesPerDay: samples.length / durationDays,
    estimatedCapacityUsd: books.length ? books.reduce((minimum, row) => Math.min(minimum,
      Math.min(row.bidDepthUsd, row.askDepthUsd) * 0.02), Number.POSITIVE_INFINITY) : 0,
    disposition, blockers: [...new Set(blockers)].sort(), liveExecution: 'locked' };
}

function mechanism(family: FastPerpFamily): string {
  if (family.startsWith('book_imbalance')) return 'executable bid/ask depth imbalance predicts short-horizon price pressure';
  if (family.startsWith('short_momentum')) return 'short-horizon perp price movement persists or mean-reverts before the edge decays';
  if (family.startsWith('aggressive_flow')) return 'aggressive buyer/seller flow predicts the next executable mid-price move';
  if (family.startsWith('liquidity_withdrawal')) return 'rapid depth withdrawal amplifies or reverses the contemporaneous price move';
  if (family === 'liquidation_rebound') return 'forced liquidation flow exhausts and rebounds after executable liquidity recovers';
  return 'funding and basis crowding predicts a short-horizon perp reversal';
}

export function runFastPerpResearchCycle(options: { evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore; now?: number } = {}): FastPerpResearchRun {
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore();
  const evidenceSnapshot = evidenceStore.snapshot(options.now ?? Date.now());
  const researchAt = options.now ?? Math.max(0, evidenceSnapshot.freshness.latestBookAt ?? 0,
    evidenceSnapshot.freshness.latestTradeAt ?? 0);
  const fromReceivedAt = Math.max(0, researchAt - 48 * 60 * 60_000);
  const symbols = [...evidenceSnapshot.symbols].sort();
  const allBooks = symbols.flatMap((symbol) => evidenceStore.readBooks({ symbol, fromReceivedAt,
    toReceivedAt: researchAt, limit: 50_000 }));
  const allTrades = symbols.flatMap((symbol) => evidenceStore.readTrades({ symbol, fromReceivedAt,
    toReceivedAt: researchAt, limit: 100_000 }));
  const allContexts = symbols.flatMap((symbol) => evidenceStore.readContexts({ symbol, fromReceivedAt,
    toReceivedAt: researchAt, limit: 20_000 }));
  const evidenceFingerprint = contentHash({ researchPolicyVersion: FAST_PERP_RESEARCH_POLICY_VERSION,
    bookIds: allBooks.map((row) => row.id), tradeIds: allTrades.map((row) => row.id),
    contextIds: allContexts.map((row) => row.id) });
  const priorRuns = evidenceStore.readResearchRuns();
  const unchanged = priorRuns.find((row) => row.researchPolicyVersion === FAST_PERP_RESEARCH_POLICY_VERSION
    && row.evidenceFingerprint === evidenceFingerprint);
  if (unchanged) return unchanged;
  const datasetVersionId = `fast_dataset_${evidenceFingerprint.slice(0, 20)}`;
  const universeVersionId = `fast_universe_${contentHash(symbols).slice(0, 20)}`;
  const worldContractId = `fast_world_${contentHash({ datasetVersionId, universeVersionId, sourceVersion: SOURCE_VERSION }).slice(0, 20)}`;
  const declaredTrials = fastPerpDeclaredTrialsForSymbols(symbols.length);
  const researchEpochMs = 6 * 60 * 60_000;
  const researchEpochStart = Math.floor(researchAt / researchEpochMs) * researchEpochMs;
  const researchEpochId = `fast_epoch_${contentHash({ researchPolicyVersion: FAST_PERP_RESEARCH_POLICY_VERSION,
    universeVersionId, researchEpochStart, grammar: { families: FAMILIES, speedGrids: SPEED_GRIDS } }).slice(0, 20)}`;
  const researchLookNumber = priorRuns.filter((row) => row.researchEpochId === researchEpochId).length + 1;
  const globalDeclaredTrials = declaredTrials * researchLookNumber;
  const costBps = Object.values(COSTS).reduce((sum, value) => sum + value, 0);
  const speedTiers = ['microstructure', 'fast_event'] as const;
  const evaluations = globalDeclaredTrials > FAST_PERP_MAXIMUM_DECLARED_TRIALS ? [] : symbols.flatMap((symbol) => {
    const books = allBooks.filter((row) => row.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime).slice(-50_000);
    const trades = allTrades.filter((row) => row.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime).slice(-100_000);
    const contexts = allContexts.filter((row) => row.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime).slice(-20_000);
    return speedTiers.flatMap((speedTier) => FAMILIES.map((family) => evaluateFamily(symbol, family, speedTier,
      books, trades, contexts, globalDeclaredTrials, costBps)));
  });
  const proposedContracts = evaluations.filter((evaluation) => evaluation.disposition === 'shadow_candidate'
    && evaluation.sourceEventIds.length && evaluation.selectedParameters).map((evaluation) => {
    const parameters = evaluation.selectedParameters as FastPerpParameterChoice;
    const predictedGrossEdgeBps = evaluation.holdout.meanGrossReturnBps ?? evaluation.validation.meanGrossReturnBps
      ?? evaluation.training.meanGrossReturnBps ?? 0;
    return buildPaperTradeContract({ candidateId: evaluation.id, strategyFamilyId: `${evaluation.family}:${evaluation.speedTier}`,
      lane: 'perpetuals', speedTier: evaluation.speedTier, mechanism: mechanism(evaluation.family),
      trigger: `${evaluation.family}:${JSON.stringify(parameters)}`, instrument: `${evaluation.symbol}-PERP`,
      venue: 'hyperliquid', side: 'both', executionPolicy: 'taker_market', decisionAt: evaluation.evidenceCutoffAt,
      evidenceCutoffAt: evaluation.evidenceCutoffAt, edgeHalfLifeMs: parameters.horizonMs,
      entryRule: 'observe a new post-cutoff trigger and submit the precommitted taker-market execution policy',
      exitRule: `exit after ${parameters.horizonMs}ms or immutable risk rule`, expiresAt: evaluation.evidenceCutoffAt + parameters.horizonMs,
      predictedGrossEdgeBps, costs: COSTS, uncertaintyBufferBps: UNCERTAINTY_BUFFER_BPS,
      confidence: { confidenceLevel: 0.95, predictedWinProbability: evaluation.holdout.winRate,
        lowerBoundNetEdgeBps: evaluation.holdout.lowerBoundNetEdgeBps,
        independentHistoricalSamples: evaluation.independentSamples, untouchedForwardSamples: 0, fundedPaperSamples: 0 },
      capacity: { requestedPaperUsd: 250, deployableUsd: evaluation.estimatedCapacityUsd, participationRate: 0.02 },
      opportunitiesPerDay: evaluation.opportunitiesPerDay, maximumExistingCorrelation: 0,
      tailRiskPenaltyUsdPerDay: Math.max(0.01, Math.min(10, evaluation.opportunitiesPerDay) * 250 * 40 / 10_000),
      drawdownPenaltyUsdPerDay: 100 / 30,
      riskLimits: { maximumPositionUsd: 250, maximumLossPerTradeUsd: 5, maximumStrategyDrawdownUsd: 100,
        maximumGrossExposureUsd: 500, maximumConsecutiveLosses: 8 },
      provenance: { datasetVersionId, universeVersionId, worldContractId, sourceEventIds: evaluation.sourceEventIds,
        signalArtifactIds: [evaluation.id], validationEvaluationIds: [], sourceVenue: 'hyperliquid',
        sourceVersion: FAST_PERP_RESEARCH_POLICY_VERSION },
      killRule: { maximumForwardLossBps: 40, maximumDrawdownUsd: 100, maximumConsecutiveLosses: 8,
        minimumForwardNetEdgeBps: 0, minimumForwardFillRate: 0.4, action: 'kill_and_research', immutable: true },
      softwareVersion: FAST_PERP_RESEARCH_POLICY_VERSION,
      createdAt: evaluation.evidenceCutoffAt,
    });
  });
  const existingContracts = economicStore.readContracts();
  const existingByVersion = new Map(existingContracts.map((row) => [row.strategyVersionId, row]));
  const contracts = proposedContracts.map((row) => existingByVersion.get(row.strategyVersionId) ?? row);
  economicStore.appendContracts(contracts.filter((row) => !existingContracts.some((prior) => prior.id === row.id)));
  const contractsByCandidate = new Map(proposedContracts.map((row, index) => [row.candidateId, contracts[index]]));
  const priorLineages = new Set(existingContracts.map((row) => `${row.strategyFamilyId.split(':')[0]}|${row.speedTier}`
    + `|${row.instrument}|${row.venue}|${row.executionPolicy}`));
  const shadowEvents = evaluations.filter((row) => row.disposition === 'shadow_candidate').flatMap((evaluation) => {
    const contract = contractsByCandidate.get(evaluation.id); if (!contract) return [];
    const lineage = `${contract.strategyFamilyId.split(':')[0]}|${contract.speedTier}|${contract.instrument}`
      + `|${contract.venue}|${contract.executionPolicy}`;
    if (priorLineages.has(lineage)) return [];
    return [evaluatePaperLifecycle({ contract, currentState: 'research_candidate', requestedState: 'shadow_paper',
      evidence: { historicalSamples: evaluation.independentSamples, untouchedForwardSamples: 0, fundedPaperSamples: 0,
        forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
        realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null,
        maximumDrawdownUsd: 0, consecutiveLosses: 0, sourceObservationIds: evaluation.sourceEventIds },
      evaluatedAt: evaluation.evidenceCutoffAt, policy: ECONOMIC_OBJECTIVE_POLICY })];
  });
  if (shadowEvents.length) economicStore.appendLifecycleEvents(shadowEvents);
  const missingMechanismBlockers = [...new Set(evaluations.flatMap((row) => row.blockers)
    .filter((row) => row.includes('MISSING') || row.includes('NOT_JOINED'))
    .concat(globalDeclaredTrials > FAST_PERP_MAXIMUM_DECLARED_TRIALS ? ['DECLARED_TRIAL_CEILING_EXCEEDED'] : []))].sort();
  const createdAt = allTrades.reduce((latest, row) => Math.max(latest, row.receivedAt),
    allBooks.reduce((latest, row) => Math.max(latest, row.receivedAt), options.now ?? 0));
  const identity = { sourceVersion: SOURCE_VERSION, researchPolicyVersion: FAST_PERP_RESEARCH_POLICY_VERSION,
    evidenceFingerprint, datasetVersionId, universeVersionId,
    worldContractId, symbols, speedTiers: [...speedTiers], declaredTrials: globalDeclaredTrials,
    evaluationIds: evaluations.map((row) => row.id), candidateContractIds: contracts.map((row) => row.id),
    shadowContractIds: shadowEvents.filter((row) => row.passed).map((row) => row.contractId), missingMechanismBlockers };
  const run: FastPerpResearchRun = { id: `fast_perp_research_${contentHash(identity).slice(0, 20)}`, schemaVersion: 1,
    ...identity, researchEpochId, researchLookNumber, globalDeclaredTrials, createdAt, evaluations,
    datasetManifest: { tradeCount: allTrades.length, bookCount: allBooks.length,
      contextCount: allContexts.length, sampleDigest: evidenceFingerprint }, liveExecution: 'locked' };
  evidenceStore.appendResearchRuns([run]); return run;
}
