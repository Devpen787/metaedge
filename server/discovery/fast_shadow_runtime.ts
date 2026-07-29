import fs from 'node:fs';
import path from 'node:path';
import type {
  EvidenceMode,
  FastShadowDecision,
  FastShadowOutcome,
  PaperTradeContract,
  ShadowExecutionCohort,
} from './economic_types.js';
import { EconomicOperationStore } from './economic_store.js';
import { FastPerpEvidenceStore } from './fast_perp_store.js';
import { compileFastPerpSamples } from './fast_perp_research.js';
import type { FastPerpFamilyEvaluation, FastPerpParameterChoice } from './fast_perp_research_types.js';
import type { FastPerpBookEvent, FastPerpBookLevel, FastPerpContextEvent, FastPerpTradeEvent } from './fast_perp_types.js';
import { contentHash } from './store.js';
import { evaluatePaperRiskReservation } from './fast_paper_risk.js';

const COHORTS: ShadowExecutionCohort[] = ['maker', 'taker', 'delayed', 'no_trade'];
const INITIAL_NAV_USD = 10_000;

function paperForwardCutover(evidenceStore: FastPerpEvidenceStore): number {
  try {
    const row = JSON.parse(fs.readFileSync(path.join(path.dirname(evidenceStore.root), 'fast-perp-cutover.json'), 'utf8'));
    return Number(row.cutoverAt) || 0;
  } catch { return 0; }
}

function firstBook(rows: FastPerpBookEvent[], at: number): FastPerpBookEvent | null {
  return rows.find((row) => row.eventTime >= at) ?? null;
}

function assignedCohort(contractId: string, sourceEventIds: string[]): ShadowExecutionCohort {
  const hash = contentHash({ contractId, sourceEventIds });
  return COHORTS[Number.parseInt(hash.slice(0, 8), 16) % COHORTS.length];
}

function createDecision(contract: PaperTradeContract, evaluation: FastPerpFamilyEvaluation,
  sample: ReturnType<typeof compileFastPerpSamples>[number], reference: FastPerpBookEvent): FastShadowDecision {
  const parameters = evaluation.selectedParameters as FastPerpParameterChoice;
  const base = { contractId: contract.id, strategyVersionId: contract.strategyVersionId, candidateId: contract.candidateId,
    sourceSignalEventIds: [...sample.sourceEventIds].sort(), symbol: reference.symbol,
    side: sample.sign > 0 ? 'long' as const : 'short' as const,
    cohort: assignedCohort(contract.id, sample.sourceEventIds), evidenceMode: 'canary' as const,
    recordedAt: sample.decisionAt, decidedAt: sample.decisionAt,
    evidenceCutoffAt: contract.evidenceCutoffAt, expiresAt: sample.decisionAt + parameters.horizonMs,
    horizonMs: parameters.horizonMs, latencyMs: 250,
    requestedNotionalUsd: Math.min(contract.capacity.requestedPaperUsd, contract.capacity.deployableUsd,
      contract.riskLimits.maximumPositionUsd), participationRate: contract.capacity.participationRate,
    referenceMidPrice: reference.midPrice, primaryExecutionPolicy: contract.executionPolicy,
    decisionLagMs: 0, riskReservationId: `legacy_canary_${contract.id}_${reference.symbol}`,
    liveExecution: 'locked' as const };
  return { id: `shadow_decision_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
}

function vwap(levels: FastPerpBookLevel[], targetNotionalUsd: number): number | null {
  let remaining = targetNotionalUsd; let quantity = 0; let notional = 0;
  for (const level of levels) {
    if (!(remaining > 0)) break;
    const available = level.price * level.size; const used = Math.min(remaining, available);
    quantity += used / level.price; notional += used; remaining -= used;
  }
  return quantity > 0 && remaining <= 1e-6 ? notional / quantity : null;
}

function simulateTaker(decision: FastShadowDecision, contract: PaperTradeContract, books: FastPerpBookEvent[],
  entryDelayMs: number, navBeforeUsd: number) {
  const entry = firstBook(books, decision.decidedAt + decision.latencyMs + entryDelayMs);
  const exit = firstBook(books, decision.decidedAt + decision.horizonMs);
  if (!entry || !exit) return null;
  const requested = Math.min(decision.requestedNotionalUsd, navBeforeUsd * contract.riskLimits.maximumGrossExposureUsd
    / Math.max(1, contract.riskLimits.maximumPositionUsd));
  const long = decision.side === 'long';
  const entryCapacity = (long ? entry.askDepthUsd : entry.bidDepthUsd) * decision.participationRate;
  const exitCapacity = (long ? exit.bidDepthUsd : exit.askDepthUsd) * decision.participationRate;
  const filledNotionalUsd = Math.min(requested, entryCapacity, exitCapacity);
  const entryPrice = filledNotionalUsd > 0 ? vwap(long ? entry.asks : entry.bids, filledNotionalUsd)
    : (long ? entry.bestAsk : entry.bestBid);
  const exitPrice = filledNotionalUsd > 0 ? vwap(long ? exit.bids : exit.asks, filledNotionalUsd)
    : (long ? exit.bestBid : exit.bestAsk);
  if (entryPrice == null || exitPrice == null) return null;
  return { entry, exit, entryPrice, exitPrice, requested,
    filledNotionalUsd, queueAheadUsd: null as number | null };
}

function simulateMaker(decision: FastShadowDecision, contract: PaperTradeContract, books: FastPerpBookEvent[],
  trades: FastPerpTradeEvent[], navBeforeUsd: number) {
  const entryBook = firstBook(books, decision.decidedAt + decision.latencyMs);
  const exit = firstBook(books, decision.decidedAt + decision.horizonMs);
  if (!entryBook || !exit) return null;
  const long = decision.side === 'long'; const entryPrice = long ? entryBook.bestBid : entryBook.bestAsk;
  const queueAheadUsd = (long ? entryBook.bidDepthUsd : entryBook.askDepthUsd);
  const executable = trades.filter((trade) => trade.eventTime >= entryBook.eventTime && trade.eventTime <= decision.expiresAt
    && (long ? trade.side === 'sell' : trade.side === 'buy')).reduce((sum, trade) => sum + trade.notionalUsd, 0);
  const requested = Math.min(decision.requestedNotionalUsd, navBeforeUsd);
  const filledNotionalUsd = Math.min(requested, Math.max(0, executable - queueAheadUsd) * decision.participationRate);
  const exitPrice = filledNotionalUsd > 0 ? vwap(long ? exit.bids : exit.asks, filledNotionalUsd)
    : (long ? exit.bestBid : exit.bestAsk);
  if (exitPrice == null) return null;
  return { entry: entryBook, exit, entryPrice, exitPrice, requested, filledNotionalUsd, queueAheadUsd };
}

function outcome(decision: FastShadowDecision, contract: PaperTradeContract, books: FastPerpBookEvent[],
  trades: FastPerpTradeEvent[], navBeforeUsd: number): FastShadowOutcome | null {
  const takerCounterfactual = simulateTaker({ ...decision, cohort: 'taker' }, contract, books, 0, navBeforeUsd);
  if (!takerCounterfactual) return null;
  const simulated = decision.cohort === 'maker' ? simulateMaker(decision, contract, books, trades, navBeforeUsd)
    : decision.cohort === 'delayed' ? simulateTaker(decision, contract, books, 1_000, navBeforeUsd)
      : decision.cohort === 'taker' ? takerCounterfactual : takerCounterfactual;
  if (!simulated) return null;
  const calculate = (row: typeof simulated, actual: boolean) => {
    const filled = actual && decision.cohort === 'no_trade' ? 0 : row.filledNotionalUsd;
    if (!(filled > 0)) return { gross: 0, fee: 0, funding: 0, net: 0 };
    const quantity = filled / row.entryPrice; const sign = decision.side === 'long' ? 1 : -1;
    const gross = sign * quantity * (row.exitPrice - row.entryPrice);
    // Contract cost fields are round-trip totals; research subtracts the same
    // aggregate once, so shadow accounting must not silently double fees.
    const fee = filled * contract.costs.feeBps / 10_000;
    const funding = filled * contract.costs.fundingBps / 10_000;
    return { gross, fee, funding, net: gross - fee - funding };
  };
  const actual = calculate(simulated, true);
  const filledNotionalUsd = decision.cohort === 'no_trade' ? 0 : simulated.filledNotionalUsd;
  const fillRate = decision.requestedNotionalUsd > 0 ? filledNotionalUsd / decision.requestedNotionalUsd : 0;
  const status: FastShadowOutcome['status'] = decision.cohort === 'no_trade' ? 'no_trade'
    : !(filledNotionalUsd > 0) ? 'cancelled' : fillRate < 0.999 ? 'partial' : 'filled';
  const entryMid = simulated.entry.midPrice; const adverseBook = firstBook(books, simulated.entry.eventTime + 5_000);
  const adverseSelectionUsd = adverseBook && filledNotionalUsd > 0
    ? Math.max(0, -(decision.side === 'long' ? 1 : -1) * (adverseBook.midPrice / entryMid - 1) * filledNotionalUsd) : 0;
  const long = decision.side === 'long'; const entryBest = long ? simulated.entry.bestAsk : simulated.entry.bestBid;
  const exitBest = long ? simulated.exit.bestBid : simulated.exit.bestAsk;
  const spreadUsd = filledNotionalUsd * (Math.abs(entryBest - simulated.entry.midPrice) / simulated.entry.midPrice
    + Math.abs(exitBest - simulated.exit.midPrice) / simulated.exit.midPrice);
  const impactUsd = filledNotionalUsd * (Math.abs(simulated.entryPrice - entryBest) / simulated.entry.midPrice
    + Math.abs(simulated.exitPrice - exitBest) / simulated.exit.midPrice);
  const sign = long ? 1 : -1;
  const slippageUsd = filledNotionalUsd * Math.max(0,
    sign * (simulated.entry.midPrice - decision.referenceMidPrice) / decision.referenceMidPrice);
  const blockers = [...(status === 'cancelled' ? ['SHADOW_ORDER_NOT_FILLED'] : []),
    ...(filledNotionalUsd > contract.riskLimits.maximumGrossExposureUsd ? ['SHADOW_GROSS_EXPOSURE_LIMIT'] : [])];
  const netPnlUsd = blockers.includes('SHADOW_GROSS_EXPOSURE_LIMIT') ? 0 : actual.net;
  const resolvedAt = simulated.exit.eventTime; const sourceEventIds = [...new Set([
    ...decision.sourceSignalEventIds, simulated.entry.id, simulated.exit.id,
    ...trades.filter((trade) => trade.eventTime >= simulated.entry.eventTime && trade.eventTime <= resolvedAt).map((trade) => trade.id),
  ])].sort();
  const base = { decisionId: decision.id, contractId: contract.id, cohort: decision.cohort,
    evidenceMode: decision.evidenceMode, promotable: false, resolvedAt, expectedResolutionAt: decision.expiresAt,
    timingDeviationMs: resolvedAt - decision.expiresAt, timingValid: false,
    status: blockers.includes('SHADOW_GROSS_EXPOSURE_LIMIT') ? 'risk_rejected' as const : status,
    requestedNotionalUsd: decision.requestedNotionalUsd, filledNotionalUsd, fillRate,
    queueAheadUsd: simulated.queueAheadUsd, entryPrice: filledNotionalUsd ? simulated.entryPrice : null,
    exitPrice: filledNotionalUsd ? simulated.exitPrice : null, grossPnlUsd: actual.gross, feeUsd: actual.fee,
    spreadUsd, slippageUsd, impactUsd, fundingUsd: actual.funding, borrowUsd: 0, adverseSelectionUsd,
    netPnlUsd, noTradeCounterfactualNetPnlUsd: 0, navBeforeUsd, navAfterUsd: navBeforeUsd + netPnlUsd,
    marginUsedUsd: filledNotionalUsd * 0.2, blockers, sourceEventIds, liveExecution: 'locked' as const };
  return { id: `shadow_outcome_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
}

function primaryCohort(policy: PaperTradeContract['executionPolicy']): Exclude<ShadowExecutionCohort, 'no_trade'> {
  return policy === 'maker_limit' ? 'maker' : policy === 'delayed_taker' ? 'delayed' : 'taker';
}

function latestAtOrBefore(rows: FastPerpBookEvent[], at: number): FastPerpBookEvent | null {
  return [...rows].reverse().find((row) => row.eventTime <= at) ?? null;
}

function onlineTrigger(evaluation: FastPerpFamilyEvaluation, books: FastPerpBookEvent[], trades: FastPerpTradeEvent[],
  contexts: FastPerpContextEvent[], now: number): { book: FastPerpBookEvent; sign: -1 | 1; sourceEventIds: string[] } | null {
  const parameters = evaluation.selectedParameters; if (!parameters) return null;
  const eligible = books.filter((row) => row.receivedAt <= now && row.eventTime <= now)
    .sort((left, right) => left.eventTime - right.eventTime || left.id.localeCompare(right.id));
  for (const book of [...eligible].reverse()) {
    if (book.eventTime + parameters.horizonMs <= now) continue;
    let sign: -1 | 1 | 0 = 0; const sourceEventIds = [book.id];
    const reverse = evaluation.family.endsWith('_reversal') || evaluation.family === 'liquidation_rebound';
    if (evaluation.family.startsWith('book_imbalance')) {
      if (Math.abs(book.imbalance) < parameters.threshold) continue;
      sign = book.imbalance > 0 ? 1 : -1;
    } else if (evaluation.family.startsWith('short_momentum')) {
      const prior = latestAtOrBefore(eligible, book.eventTime - parameters.lookbackMs); if (!prior) continue;
      const momentumBps = (book.midPrice / prior.midPrice - 1) * 10_000;
      if (Math.abs(momentumBps) < parameters.threshold) continue;
      sign = momentumBps > 0 ? 1 : -1; sourceEventIds.push(prior.id);
    } else if (evaluation.family.startsWith('aggressive_flow')) {
      const window = trades.filter((row) => row.receivedAt <= now && row.eventTime >= book.eventTime - parameters.lookbackMs
        && row.eventTime <= book.eventTime);
      const total = window.reduce((sum, row) => sum + row.notionalUsd, 0);
      const signed = window.reduce((sum, row) => sum + row.notionalUsd * (row.side === 'buy' ? 1 : -1), 0);
      if (!(total > 0) || Math.abs(signed / total) < parameters.threshold) continue;
      sign = signed > 0 ? 1 : -1; sourceEventIds.push(...window.map((row) => row.id));
    } else if (evaluation.family.startsWith('liquidity_withdrawal')) {
      const prior = latestAtOrBefore(eligible, book.eventTime - parameters.lookbackMs); if (!prior) continue;
      const priorDepth = prior.bidDepthUsd + prior.askDepthUsd; const depth = book.bidDepthUsd + book.askDepthUsd;
      if (!(priorDepth > 0) || 1 - depth / priorDepth < parameters.threshold) continue;
      const momentum = book.midPrice / prior.midPrice - 1; if (!momentum) continue;
      sign = momentum > 0 ? 1 : -1; sourceEventIds.push(prior.id);
    } else if (evaluation.family === 'liquidation_rebound') {
      const window = trades.filter((row) => row.receivedAt <= now && row.liquidation === true
        && row.eventTime >= book.eventTime - parameters.lookbackMs && row.eventTime <= book.eventTime);
      const sells = window.filter((row) => row.side === 'sell').reduce((sum, row) => sum + row.notionalUsd, 0);
      const buys = window.filter((row) => row.side === 'buy').reduce((sum, row) => sum + row.notionalUsd, 0);
      if (Math.max(sells, buys) < parameters.threshold || sells === buys) continue;
      sign = sells > buys ? 1 : -1; sourceEventIds.push(...window.map((row) => row.id));
    } else if (evaluation.family === 'funding_crowding_reversal') {
      const context = [...contexts].reverse().find((row) => row.receivedAt <= now && row.eventTime <= book.eventTime);
      if (!context || Math.abs(context.fundingRate) < parameters.threshold) continue;
      sign = context.fundingRate > 0 ? 1 : -1; sourceEventIds.push(context.id);
    }
    if (!sign) continue;
    if (reverse) sign = sign === 1 ? -1 : 1;
    return { book, sign, sourceEventIds: [...new Set(sourceEventIds)].sort() };
  }
  return null;
}

export function commitFastForwardDecisions(options: { evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore; now?: number; evidenceMode?: EvidenceMode } = {}) {
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore();
  const now = options.now ?? Date.now(); const evidenceMode = options.evidenceMode ?? 'paper_forward';
  const forwardCutoverAt = evidenceMode === 'paper_forward' ? paperForwardCutover(evidenceStore) : 0;
  if (evidenceMode === 'paper_forward' && now < forwardCutoverAt) {
    return { createdDecisions: 0, blockers: ['PAPER_FORWARD_CUTOVER_NOT_REACHED'], liveExecution: 'locked' as const };
  }
  const researchRuns = evidenceStore.readResearchRuns();
  if (!researchRuns.length) return { createdDecisions: 0, blockers: ['FAST_PERP_RESEARCH_RUN_MISSING'], liveExecution: 'locked' as const };
  const evaluationById = new Map(researchRuns.flatMap((research) => research.evaluations).map((row) => [row.id, row]));
  const economics = economicStore.snapshot(); const allPriorOutcomes = economicStore.readShadowOutcomes();
  const outcomes = new Set(allPriorOutcomes.map((row) => row.decisionId));
  const existingDecisions = economicStore.readShadowDecisions();
  const openDecisions = existingDecisions.filter((row) => !outcomes.has(row.id));
  const openKeys = new Set(openDecisions
    .map((row) => `${row.contractId}|${row.symbol}`));
  const seenSignalKeys = new Set(existingDecisions.map((row) => `${row.contractId}|${row.sourceSignalEventIds.join(',')}`));
  const decisions: FastShadowDecision[] = []; const rejectedOutcomes: FastShadowOutcome[] = [];
  const evidenceBySymbol = new Map<string, { books: FastPerpBookEvent[]; trades: FastPerpTradeEvent[];
    contexts: FastPerpContextEvent[] }>();
  for (const current of economics.current.filter((row) => !row.killed && row.currentState !== 'research_candidate')) {
    const contract = current.contract; const evaluation = evaluationById.get(contract.candidateId);
    if (!evaluation?.selectedParameters) continue;
    const symbol = contract.instrument.replace(/-PERP$/, ''); const openKey = `${contract.id}|${symbol}`;
    let symbolEvidence = evidenceBySymbol.get(symbol);
    if (!symbolEvidence) {
      const fromReceivedAt = Math.max(contract.evidenceCutoffAt, now - 60_000);
      symbolEvidence = { books: evidenceStore.readBooks({ symbol, fromReceivedAt, toReceivedAt: now }),
        trades: evidenceStore.readTrades({ symbol, fromReceivedAt, toReceivedAt: now }),
        contexts: evidenceStore.readContexts({ symbol, fromReceivedAt, toReceivedAt: now }) };
      evidenceBySymbol.set(symbol, symbolEvidence);
    }
    const { books, trades, contexts } = symbolEvidence;
    const trigger = onlineTrigger(evaluation, books, trades, contexts, now); if (!trigger) continue;
    const signalKey = `${contract.id}|${trigger.sourceEventIds.join(',')}`; if (seenSignalKeys.has(signalKey)) continue;
    const sourceRows = [...books, ...trades, ...contexts].filter((row) => trigger.sourceEventIds.includes(row.id));
    const evidenceCutoffAt = Math.max(0, ...sourceRows.map((row) => row.receivedAt));
    if (sourceRows.some((row) => row.receivedAt > now || (evidenceMode === 'paper_forward' && row.receivedAt < forwardCutoverAt))
      || evidenceCutoffAt > now) continue;
    const expiresAt = trigger.book.eventTime + evaluation.selectedParameters.horizonMs;
    if (expiresAt <= now) continue;
    const requestedNotionalUsd = Math.min(contract.capacity.requestedPaperUsd, contract.capacity.deployableUsd,
      contract.riskLimits.maximumPositionUsd);
    const priorOutcomes = allPriorOutcomes.filter((row) => row.contractId === contract.id);
    let highNav = INITIAL_NAV_USD; let drawdown = 0;
    for (const row of priorOutcomes.sort((left, right) => left.resolvedAt - right.resolvedAt)) {
      highNav = Math.max(highNav, row.navAfterUsd); drawdown = Math.max(drawdown, highNav - row.navAfterUsd);
    }
    const cycleReservations = decisions.filter((row) => row.cohort !== 'no_trade');
    const allReservations = [...openDecisions, ...cycleReservations];
    const contractOpen = allReservations.filter((row) => row.contractId === contract.id);
    const symbolOpen = allReservations.filter((row) => row.symbol === symbol);
    const riskBlockers = [...(openKeys.has(openKey) ? ['ALREADY_EXPOSED'] : []), ...evaluatePaperRiskReservation({ contract,
      requestedNotionalUsd, state: { aggregateOpenExposureUsd: allReservations.reduce((sum, row) => sum + row.requestedNotionalUsd, 0),
        symbolOpenExposureUsd: symbolOpen.reduce((sum, row) => sum + row.requestedNotionalUsd, 0),
        dailyNetPnlUsd: allPriorOutcomes.filter((row) => row.resolvedAt >= now - 86_400_000)
          .reduce((sum, row) => sum + row.netPnlUsd, 0),
        strategyDrawdownUsd: drawdown, maximumPairwiseCorrelation: allReservations.length ? null : 0,
        remainingCapacityUsd: Math.max(0, contract.capacity.deployableUsd
          - contractOpen.reduce((sum, row) => sum + row.requestedNotionalUsd, 0)), killed: current.killed } })];
    const base = { contractId: contract.id, strategyVersionId: contract.strategyVersionId, candidateId: contract.candidateId,
      sourceSignalEventIds: trigger.sourceEventIds, symbol, side: trigger.sign > 0 ? 'long' as const : 'short' as const,
      cohort: riskBlockers.length ? 'no_trade' as const : primaryCohort(contract.executionPolicy),
      evidenceMode, recordedAt: now, decidedAt: trigger.book.eventTime,
      evidenceCutoffAt, expiresAt, horizonMs: evaluation.selectedParameters.horizonMs, latencyMs: 250,
      requestedNotionalUsd, participationRate: contract.capacity.participationRate,
      referenceMidPrice: trigger.book.midPrice, primaryExecutionPolicy: contract.executionPolicy,
      decisionLagMs: now - evidenceCutoffAt,
      riskReservationId: `paper_reservation_${contentHash({ contractId: contract.id, symbol, recordedAt: now }).slice(0, 20)}`,
      decisionBlockers: [...new Set(riskBlockers)].sort(),
      liveExecution: 'locked' as const };
    const decision: FastShadowDecision = { id: `shadow_decision_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
    decisions.push(decision); seenSignalKeys.add(signalKey);
    if (riskBlockers.length) {
      const rejectedBase = { decisionId: decision.id, contractId: contract.id, cohort: 'no_trade' as const,
        evidenceMode, promotable: false, resolvedAt: now, expectedResolutionAt: expiresAt, timingDeviationMs: null,
        timingValid: false, status: 'risk_rejected' as const, requestedNotionalUsd, filledNotionalUsd: 0, fillRate: 0,
        queueAheadUsd: null, entryPrice: null, exitPrice: null, grossPnlUsd: 0, feeUsd: 0, spreadUsd: 0,
        slippageUsd: 0, impactUsd: 0, fundingUsd: 0, borrowUsd: 0, adverseSelectionUsd: 0, netPnlUsd: 0,
        noTradeCounterfactualNetPnlUsd: 0, navBeforeUsd: priorOutcomes.at(-1)?.navAfterUsd ?? INITIAL_NAV_USD,
        navAfterUsd: priorOutcomes.at(-1)?.navAfterUsd ?? INITIAL_NAV_USD, marginUsedUsd: 0,
        blockers: [...new Set(riskBlockers)].sort(), sourceEventIds: trigger.sourceEventIds, liveExecution: 'locked' as const };
      rejectedOutcomes.push({ id: `shadow_outcome_${contentHash(rejectedBase).slice(0, 20)}`, schemaVersion: 1, ...rejectedBase });
    } else openKeys.add(openKey);
  }
  economicStore.appendShadowDecisions(decisions);
  economicStore.appendShadowOutcomes(rejectedOutcomes);
  return { createdDecisions: decisions.length, rejectedDecisions: rejectedOutcomes.length, queueDepth: 0, queueLagMs: 0,
    blockers: [], liveExecution: 'locked' as const };
}

function unresolvedForwardOutcome(decision: FastShadowDecision, navBeforeUsd: number, blocker: string): FastShadowOutcome {
  const base = { decisionId: decision.id, contractId: decision.contractId, cohort: decision.cohort,
    evidenceMode: decision.evidenceMode, promotable: false, resolvedAt: decision.expiresAt,
    expectedResolutionAt: decision.expiresAt, timingDeviationMs: null, timingValid: false,
    status: 'unresolved' as const, requestedNotionalUsd: decision.requestedNotionalUsd, filledNotionalUsd: 0,
    fillRate: 0, queueAheadUsd: null, entryPrice: null, exitPrice: null, grossPnlUsd: 0, feeUsd: 0,
    spreadUsd: 0, slippageUsd: 0, impactUsd: 0, fundingUsd: 0, borrowUsd: 0, adverseSelectionUsd: 0,
    netPnlUsd: 0, noTradeCounterfactualNetPnlUsd: 0, navBeforeUsd, navAfterUsd: navBeforeUsd,
    marginUsedUsd: 0, blockers: [blocker], sourceEventIds: [...decision.sourceSignalEventIds], liveExecution: 'locked' as const };
  return { id: `shadow_outcome_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
}

function recoveredRiskRejectedOutcome(decision: FastShadowDecision, navBeforeUsd: number): FastShadowOutcome {
  const base = { decisionId: decision.id, contractId: decision.contractId, cohort: 'no_trade' as const,
    evidenceMode: decision.evidenceMode, promotable: false, resolvedAt: decision.recordedAt,
    expectedResolutionAt: decision.expiresAt, timingDeviationMs: null, timingValid: false, status: 'risk_rejected' as const,
    requestedNotionalUsd: decision.requestedNotionalUsd, filledNotionalUsd: 0, fillRate: 0, queueAheadUsd: null,
    entryPrice: null, exitPrice: null, grossPnlUsd: 0, feeUsd: 0, spreadUsd: 0, slippageUsd: 0, impactUsd: 0,
    fundingUsd: 0, borrowUsd: 0, adverseSelectionUsd: 0, netPnlUsd: 0, noTradeCounterfactualNetPnlUsd: 0,
    navBeforeUsd, navAfterUsd: navBeforeUsd, marginUsedUsd: 0,
    blockers: decision.decisionBlockers?.length ? [...new Set(decision.decisionBlockers)].sort()
      : ['RECOVERED_NO_TRADE_DECISION'], sourceEventIds: [...decision.sourceSignalEventIds], liveExecution: 'locked' as const };
  return { id: `shadow_outcome_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
}

export function resolveFastForwardOutcomes(options: { evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore; now?: number } = {}) {
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore(); const now = options.now ?? Date.now();
  const existing = new Set(economicStore.readShadowOutcomes().map((row) => row.decisionId));
  const contracts = new Map(economicStore.readContracts().map((row) => [row.id, row]));
  const prior = economicStore.readShadowOutcomes().sort((left, right) => left.resolvedAt - right.resolvedAt);
  const navByContract = new Map<string, number>(); for (const row of prior) navByContract.set(row.contractId, row.navAfterUsd);
  const outcomes: FastShadowOutcome[] = [];
  for (const decision of economicStore.readShadowDecisions()
    .filter((row) => !existing.has(row.id) && (row.expiresAt <= now || row.cohort === 'no_trade'))
    .sort((left, right) => left.expiresAt - right.expiresAt || left.id.localeCompare(right.id))) {
    const contract = contracts.get(decision.contractId); if (!contract) continue;
    const navBeforeUsd = navByContract.get(contract.id) ?? INITIAL_NAV_USD;
    if (decision.cohort === 'no_trade') {
      const rejected = recoveredRiskRejectedOutcome(decision, navBeforeUsd);
      outcomes.push(rejected); navByContract.set(contract.id, rejected.navAfterUsd); continue;
    }
    const toleranceMs = contract.speedTier === 'microstructure' ? 250 : 1_000;
    const books = evidenceStore.readBooks({ symbol: decision.symbol, fromReceivedAt: decision.recordedAt + 1,
      toReceivedAt: now });
    const entryExpectedAt = decision.recordedAt + decision.latencyMs;
    const entry = books.find((row) => row.receivedAt >= entryExpectedAt && row.receivedAt <= entryExpectedAt + toleranceMs
      && row.eventTime >= entryExpectedAt && row.eventTime <= entryExpectedAt + toleranceMs);
    const exit = books.find((row) => row.receivedAt >= decision.expiresAt && row.receivedAt <= decision.expiresAt + toleranceMs
      && row.eventTime >= decision.expiresAt && row.eventTime <= decision.expiresAt + toleranceMs);
    if (!entry || !exit) {
      if (now <= decision.expiresAt + toleranceMs) continue;
      const unresolved = unresolvedForwardOutcome(decision, navBeforeUsd, 'FORWARD_OUTCOME_NOT_RECEIVED_AFTER_DECISION');
      outcomes.push(unresolved); navByContract.set(contract.id, unresolved.navAfterUsd); continue;
    }
    const long = decision.side === 'long'; const capacity = Math.min((long ? entry.askDepthUsd : entry.bidDepthUsd),
      (long ? exit.bidDepthUsd : exit.askDepthUsd)) * decision.participationRate;
    const filledNotionalUsd = Math.min(decision.requestedNotionalUsd, capacity);
    const entryPrice = vwap(long ? entry.asks : entry.bids, filledNotionalUsd);
    const exitPrice = vwap(long ? exit.bids : exit.asks, filledNotionalUsd);
    if (!(filledNotionalUsd > 0) || entryPrice == null || exitPrice == null) {
      const unresolved = unresolvedForwardOutcome(decision, navBeforeUsd, 'FORWARD_L2_CAPACITY_UNAVAILABLE');
      outcomes.push(unresolved); navByContract.set(contract.id, unresolved.navAfterUsd); continue;
    }
    const quantity = filledNotionalUsd / entryPrice; const sign = long ? 1 : -1;
    const grossPnlUsd = sign * quantity * (exitPrice - entryPrice);
    const feeUsd = filledNotionalUsd * contract.costs.feeBps / 10_000;
    const fundingUsd = filledNotionalUsd * contract.costs.fundingBps / 10_000;
    const borrowUsd = filledNotionalUsd * contract.costs.borrowBps / 10_000;
    const netPnlUsd = grossPnlUsd - feeUsd - fundingUsd - borrowUsd;
    const entryBest = long ? entry.bestAsk : entry.bestBid; const exitBest = long ? exit.bestBid : exit.bestAsk;
    const spreadUsd = filledNotionalUsd * (Math.abs(entryBest - entry.midPrice) / entry.midPrice
      + Math.abs(exitBest - exit.midPrice) / exit.midPrice);
    const impactUsd = filledNotionalUsd * (Math.abs(entryPrice - entryBest) / entry.midPrice
      + Math.abs(exitPrice - exitBest) / exit.midPrice);
    const slippageUsd = filledNotionalUsd * Math.max(0, sign * (entry.midPrice - decision.referenceMidPrice)
      / decision.referenceMidPrice);
    const timingDeviationMs = exit.receivedAt - decision.expiresAt; const timingValid = Math.abs(timingDeviationMs) <= toleranceMs;
    const base = { decisionId: decision.id, contractId: contract.id, cohort: decision.cohort,
      evidenceMode: decision.evidenceMode, promotable: decision.evidenceMode === 'paper_forward' && timingValid,
      resolvedAt: exit.receivedAt, expectedResolutionAt: decision.expiresAt, timingDeviationMs, timingValid,
      status: 'filled' as const, requestedNotionalUsd: decision.requestedNotionalUsd, filledNotionalUsd,
      fillRate: filledNotionalUsd / decision.requestedNotionalUsd, queueAheadUsd: null, entryPrice, exitPrice,
      grossPnlUsd, feeUsd, spreadUsd, slippageUsd, impactUsd, fundingUsd, borrowUsd, adverseSelectionUsd: 0,
      netPnlUsd, noTradeCounterfactualNetPnlUsd: 0, navBeforeUsd, navAfterUsd: navBeforeUsd + netPnlUsd,
      marginUsedUsd: filledNotionalUsd * 0.2, blockers: timingValid ? [] : ['FORWARD_OUTCOME_TIMING_DEVIATION'],
      sourceEventIds: [...new Set([...decision.sourceSignalEventIds, entry.id, exit.id])].sort(), liveExecution: 'locked' as const };
    const result: FastShadowOutcome = { id: `shadow_outcome_${contentHash(base).slice(0, 20)}`, schemaVersion: 1, ...base };
    outcomes.push(result); navByContract.set(contract.id, result.navAfterUsd);
  }
  economicStore.appendShadowOutcomes(outcomes);
  const resolvedIds = new Set(economicStore.readShadowOutcomes().map((row) => row.decisionId));
  const queued = economicStore.readShadowDecisions().filter((row) => row.expiresAt <= now && !resolvedIds.has(row.id));
  return { createdOutcomes: outcomes.length, unresolved: outcomes.filter((row) => row.status === 'unresolved').length,
    promotable: outcomes.filter((row) => row.promotable).length, queueDepth: queued.length,
    queueLagMs: queued.length ? Math.max(...queued.map((row) => now - row.expiresAt)) : 0,
    liveExecution: 'locked' as const };
}

export function runFastShadowCycle(options: { evidenceStore?: FastPerpEvidenceStore;
  economicStore?: EconomicOperationStore } = {}) {
  const evidenceStore = options.evidenceStore ?? new FastPerpEvidenceStore();
  const economicStore = options.economicStore ?? new EconomicOperationStore();
  const economics = economicStore.snapshot(); const researchRuns = evidenceStore.readResearchRuns();
  if (!researchRuns.length) return { createdDecisions: 0, createdOutcomes: 0, blockers: ['FAST_PERP_RESEARCH_RUN_MISSING'], liveExecution: 'locked' as const };
  const evaluationById = new Map(researchRuns.flatMap((research) => research.evaluations).map((row) => [row.id, row]));
  const books = evidenceStore.readBooks(); const trades = evidenceStore.readTrades(); const contexts = evidenceStore.readContexts();
  const decisions: FastShadowDecision[] = [];
  // Forward observation must continue after promotion. funded_paper measures
  // capital allocation and live_review still needs a fresh expiring signal;
  // neither may reuse the original research event.
  for (const row of economics.current.filter((item) => !item.killed && (item.currentState === 'shadow_paper'
    || item.currentState === 'funded_paper' || item.currentState === 'live_review'))) {
    const contract = row.contract; const evaluation = evaluationById.get(contract.candidateId);
    if (!evaluation?.selectedParameters) continue;
    const symbol = contract.instrument.replace(/-PERP$/, '');
    const symbolBooks = books.filter((item) => item.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime);
    const symbolTrades = trades.filter((item) => item.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime);
    const symbolContexts = contexts.filter((item) => item.symbol === symbol).sort((left, right) => left.eventTime - right.eventTime);
    const samples = compileFastPerpSamples({ family: evaluation.family, parameters: evaluation.selectedParameters,
      books: symbolBooks, trades: symbolTrades, contexts: symbolContexts,
      costBps: contract.costs.totalBps + contract.uncertaintyBufferBps });
    for (const sample of samples.filter((item) => item.decisionAt > contract.evidenceCutoffAt)) {
      const reference = symbolBooks.find((item) => item.id === sample.sourceEventIds[0])
        ?? firstBook(symbolBooks, sample.decisionAt); if (!reference) continue;
      decisions.push(createDecision(contract, evaluation, sample, reference));
    }
  }
  economicStore.appendShadowDecisions(decisions);
  const existingOutcomeDecisionIds = new Set(economicStore.readShadowOutcomes().map((row) => row.decisionId));
  const allDecisions = economicStore.readShadowDecisions().filter((row) => !existingOutcomeDecisionIds.has(row.id));
  const outcomes: FastShadowOutcome[] = [];
  const navByContract = new Map<string, number>();
  for (const prior of economicStore.readShadowOutcomes().sort((left, right) => left.resolvedAt - right.resolvedAt)) {
    navByContract.set(prior.contractId, prior.navAfterUsd);
  }
  const contracts = new Map(economicStore.readContracts().map((row) => [row.id, row]));
  for (const decision of allDecisions.sort((left, right) => left.decidedAt - right.decidedAt || left.id.localeCompare(right.id))) {
    const contract = contracts.get(decision.contractId); if (!contract) continue;
    const symbolBooks = books.filter((row) => row.symbol === decision.symbol).sort((left, right) => left.eventTime - right.eventTime);
    const symbolTrades = trades.filter((row) => row.symbol === decision.symbol).sort((left, right) => left.eventTime - right.eventTime);
    const result = outcome(decision, contract, symbolBooks, symbolTrades, navByContract.get(contract.id) ?? INITIAL_NAV_USD);
    if (result) { outcomes.push(result); navByContract.set(contract.id, result.navAfterUsd); }
  }
  economicStore.appendShadowOutcomes(outcomes);
  return { createdDecisions: decisions.length, createdOutcomes: outcomes.length,
    openDecisions: economicStore.readShadowDecisions().length - economicStore.readShadowOutcomes().length,
    netPnlUsd: outcomes.reduce((sum, row) => sum + row.netPnlUsd, 0), blockers: [], liveExecution: 'locked' as const };
}
