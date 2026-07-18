import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EconomicOperationStore } from '../../server/discovery/economic_store.js';
import { FastPerpEvidenceStore } from '../../server/discovery/fast_perp_store.js';
import { FAST_PERP_MAXIMUM_DECLARED_TRIALS, FAST_PERP_RESEARCH_POLICY_VERSION, fastPerpDeclaredTrialsForSymbols,
  compileFastPerpSamples, runFastPerpResearchCycle } from '../../server/discovery/fast_perp_research.js';
import type { FastPerpBookEvent, FastPerpContextEvent, FastPerpTradeEvent } from '../../server/discovery/fast_perp_types.js';

function book(index: number): FastPerpBookEvent {
  const eventTime = index * 5_000; const mid = 100 * (1.0008 ** index); const imbalance = index % 2 ? 0.7 : -0.7;
  const bestBid = mid - 0.005; const bestAsk = mid + 0.005;
  return { id: `book_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL',
    eventTime, receivedAt: eventTime + 1, bids: [{ price: bestBid, size: imbalance > 0 ? 50 : 5, orders: 1 }],
    asks: [{ price: bestAsk, size: imbalance > 0 ? 5 : 50, orders: 1 }], bestBid, bestAsk, midPrice: mid,
    spreadBps: (bestAsk - bestBid) / mid * 10_000, bidDepthUsd: bestBid * (imbalance > 0 ? 50 : 5),
    askDepthUsd: bestAsk * (imbalance > 0 ? 5 : 50), imbalance, liveExecution: 'locked' };
}

function trade(index: number): FastPerpTradeEvent {
  const eventTime = index * 5_000;
  return { id: `trade_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL',
    eventTime, receivedAt: eventTime + 2, tradeId: index, sourceHash: null, side: index % 2 ? 'buy' : 'sell',
    price: 100, size: 10, notionalUsd: 1_000, liquidation: null, liveExecution: 'locked' };
}

function trackedArray<T>(rows: T[]): { rows: T[]; numericReads: () => number } {
  let reads = 0;
  const tracked = new Proxy(rows, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  return { rows: tracked, numericReads: () => reads };
}

function trendingBook(index: number): FastPerpBookEvent {
  const row = book(index); const midPrice = row.midPrice * (1 + 0.0005 * Math.sin(index * 2.399));
  const bestBid = midPrice - 0.005; const bestAsk = midPrice + 0.005;
  return { ...row, midPrice, bestBid, bestAsk, spreadBps: (bestAsk - bestBid) / midPrice * 10_000,
    bids: [{ price: bestBid, size: 100, orders: 1 }], asks: [{ price: bestAsk, size: 100, orders: 1 }],
    bidDepthUsd: bestBid * 100, askDepthUsd: bestAsk * 100, imbalance: 0.8 };
}

test('historical fast-perp samples use executable L2 VWAP rather than mid-price returns', () => {
  const wide = (id: string, eventTime: number): FastPerpBookEvent => ({ id, schemaVersion: 1, venue: 'hyperliquid',
    sourceVersion: 'test', symbol: 'SOL', eventTime, receivedAt: eventTime + 1,
    bids: [{ price: 99, size: 100, orders: 1 }], asks: [{ price: 101, size: 100, orders: 1 }],
    bestBid: 99, bestAsk: 101, midPrice: 100, spreadBps: 200, bidDepthUsd: 9_900,
    askDepthUsd: 10_100, imbalance: 0.8, liveExecution: 'locked' });
  const samples = compileFastPerpSamples({ family: 'book_imbalance_continuation',
    parameters: { horizonMs: 1_000, lookbackMs: 0, threshold: 0.2 }, books: [wide('entry', 1_000), wide('exit', 2_000)],
    trades: [], contexts: [], costBps: 7.5 });
  assert.equal(samples.length, 1);
  assert.ok(samples[0].grossReturnBps < -100);
  assert.ok(Number(samples[0].executionCostBps) > 100);
  assert.equal(samples[0].filledNotionalUsd, 198);
});

test('windowed fast-perp families do not rescan the full event corpus for every book', () => {
  const books = Array.from({ length: 100 }, (_, index) => book(index));
  const denseTrades = Array.from({ length: 2_000 }, (_, index) => ({
    ...trade(index),
    eventTime: index * 250,
    receivedAt: index * 250 + 2,
    liquidation: true,
  }));
  const denseContexts: FastPerpContextEvent[] = Array.from({ length: 2_000 }, (_, index) => ({
    id: `context_${index}`, schemaVersion: 1, venue: 'hyperliquid', sourceVersion: 'test', symbol: 'SOL',
    eventTime: index * 250, receivedAt: index * 250 + 3, fundingRate: index % 2 ? 0.001 : -0.001,
    openInterest: 1_000_000, markPrice: 100, oraclePrice: 100, premium: 0, liveExecution: 'locked',
  }));
  const flow = trackedArray(denseTrades);
  compileFastPerpSamples({ family: 'aggressive_flow_continuation',
    parameters: { horizonMs: 1_000, lookbackMs: 1_000, threshold: 0.1 }, books,
    trades: flow.rows, contexts: [], costBps: 10 });
  assert.ok(flow.numericReads() < 10_000, `aggressive flow made ${flow.numericReads()} numeric corpus reads`);

  const liquidations = trackedArray(denseTrades);
  compileFastPerpSamples({ family: 'liquidation_rebound',
    parameters: { horizonMs: 1_000, lookbackMs: 1_000, threshold: 100 }, books,
    trades: liquidations.rows, contexts: [], costBps: 10 });
  assert.ok(liquidations.numericReads() < 10_000,
    `liquidation rebound made ${liquidations.numericReads()} numeric corpus reads`);

  const contexts = trackedArray(denseContexts);
  compileFastPerpSamples({ family: 'funding_crowding_reversal',
    parameters: { horizonMs: 1_000, lookbackMs: 0, threshold: 0.0001 }, books,
    trades: [], contexts: contexts.rows, costBps: 10 });
  assert.ok(contexts.numericReads() < 10_000, `funding reversal made ${contexts.numericReads()} numeric corpus reads`);
});

test('fast research charges the full grammar, records missing mechanisms, and emits canonical economic contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-research-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  evidence.appendBooks(Array.from({ length: 1_000 }, (_, index) => trendingBook(index)));
  evidence.appendTrades(Array.from({ length: 1_000 }, (_, index) => trade(index)));
  const run = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  assert.equal(run.evaluations.length, 20);
  assert.ok(run.declaredTrials >= 80);
  assert.ok(run.missingMechanismBlockers.includes('AUTHORITATIVE_LIQUIDATION_FLAG_MISSING'));
  assert.ok(run.missingMechanismBlockers.includes('POINT_IN_TIME_FAST_FUNDING_CONTEXT_NOT_JOINED'));
  const snapshot = economics.snapshot();
  assert.ok(snapshot.counts.contracts > 0);
  const eligibleEvaluationIds = new Set(run.evaluations.filter((row) => row.disposition === 'shadow_candidate').map((row) => row.id));
  assert.ok(snapshot.current.every((row) => eligibleEvaluationIds.has(row.contract.candidateId)));
  assert.ok(snapshot.current.every((row) => row.contract.costs.totalBps > 0));
  assert.ok(snapshot.current.every((row) => row.contract.costs.feeBps === 7
    && row.contract.provenance.feeProvenance === 'configured_conservative'));
  assert.ok(run.evaluations.every((row) => row.sourceEventIds.length <= 2));
  assert.ok(run.evaluations.every((row) => row.declaredTrials === run.globalDeclaredTrials));
  assert.ok(run.evaluations.every((row) => row.training.alphaSpent === 0.05 / run.globalDeclaredTrials));
  assert.ok(run.evaluations.filter((row) => row.selectedParameters).every((row) =>
    Number(row.validation.blockLengthMs) >= 5 * Number(row.selectedParameters?.horizonMs)));
  assert.ok(run.evaluations.every((row) => Number(row.validation.independentBlockCount) >= 0));
  assert.ok(run.evaluations.some((row) => (row.sourceEventCount ?? 0) > row.sourceEventIds.length));
  assert.ok(economics.readStrategyVersions().every((row) => row.softwareVersion === FAST_PERP_RESEARCH_POLICY_VERSION));
  assert.equal(snapshot.integrity.allLiveExecutionLocked, true);
});

test('unchanged fast evidence is idempotent rather than manufacturing more research', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-idempotent-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  evidence.appendBooks(Array.from({ length: 50 }, (_, index) => book(index)));
  const first = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  const second = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  assert.equal(first.id, second.id);
  assert.equal(evidence.snapshot().counts.researchRuns, 1);
});

test('insufficient and declined evaluations remain research summaries and never become contracts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-no-contract-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  evidence.appendBooks(Array.from({ length: 8 }, (_, index) => book(index)));
  const run = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  assert.ok(run.evaluations.length > 0);
  assert.ok(run.evaluations.every((row) => row.disposition !== 'shadow_candidate'));
  assert.equal(run.candidateContractIds.length, 0);
  assert.equal(economics.snapshot().counts.contracts, 0);
});

test('20-symbol grammar charges 2,800 global trials beneath the fixed 3,500 ceiling', () => {
  assert.equal(fastPerpDeclaredTrialsForSymbols(20), 2_800);
  assert.equal(FAST_PERP_MAXIMUM_DECLARED_TRIALS, 3_500);
  assert.ok(fastPerpDeclaredTrialsForSymbols(20) <= FAST_PERP_MAXIMUM_DECLARED_TRIALS);
});

test('a large report-only corpus computes its evidence watermark without argument-list overflow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-large-watermark-'));
  const symbols = Array.from({ length: 26 }, (_, index) => `S${String(index).padStart(2, '0')}`);
  const manyTrades = Array.from({ length: 150_000 }, (_, index) => ({
    ...trade(index), id: `large_trade_${index}`, symbol: symbols[0], eventTime: index, receivedAt: index + 1,
  }));
  const researchRuns: ReturnType<FastPerpEvidenceStore['readResearchRuns']> = [];
  const evidence = {
    snapshot: () => ({ symbols, freshness: { latestBookAt: 150_001, latestTradeAt: 150_001 } }),
    readBooks: () => [],
    readTrades: ({ symbol }: { symbol: string }) => symbol === symbols[0] ? manyTrades : [],
    readContexts: () => [],
    readResearchRuns: () => researchRuns,
    appendResearchRuns: (runs: typeof researchRuns) => researchRuns.push(...runs),
  } as unknown as FastPerpEvidenceStore;
  const run = runFastPerpResearchCycle({ evidenceStore: evidence,
    economicStore: new EconomicOperationStore(path.join(root, 'economics')), now: 150_001 });
  assert.equal(run.evaluations.length, 0);
  assert.ok(run.missingMechanismBlockers.includes('DECLARED_TRIAL_CEILING_EXCEEDED'));
  assert.equal(run.createdAt, 150_001);
});

test('new evidence may propose a challenger but cannot supersede an observing strategy', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-stable-version-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  evidence.appendBooks(Array.from({ length: 1_000 }, (_, index) => trendingBook(index)));
  runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  const observing = economics.readContracts()[0];
  economics.appendLifecycleEvents([{ id: 'explicit-observing-event', schemaVersion: 1, contractId: observing.id,
    from: 'research_candidate', to: 'shadow_paper', evaluatedAt: observing.createdAt + 1,
    evidence: { historicalSamples: 100, untouchedForwardSamples: 0, fundedPaperSamples: 0,
      forwardNetEdgeLowerBoundBps: null, costStressedNetEdgeLowerBoundBps: null, worstNetReturnBps: null,
      realizedNetPnlUsd: 0, fillRate: null, costCalibrationErrorFraction: null, maximumDrawdownUsd: 0,
      consecutiveLosses: 0, sourceObservationIds: ['explicit-observing'] }, passed: true, blockers: [],
    policyId: observing.objectivePolicyId, eligibleSampleIds: ['explicit-observing'], independentBlockCount: 1,
    statisticalLookNumber: 1, alphaSpent: 0.025,
    costEvidence: { expectedCostBps: observing.costs.totalBps, calibrationErrorFraction: null },
    riskEvidence: { maximumDrawdownUsd: 0, consecutiveLosses: 0 }, liveExecution: 'locked' }]);
  const before = economics.snapshot().current.find((row) => row.contract.id === observing.id);
  assert.equal(before?.currentState, 'shadow_paper');

  evidence.appendBooks(Array.from({ length: 300 }, (_, offset) => trendingBook(1_000 + offset)));
  runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics });
  const lineage = `${observing.strategyFamilyId.split(':')[0]}|${observing.speedTier}|${observing.instrument}|${observing.venue}|${observing.executionPolicy}`;
  const active = economics.snapshot().current.find((row) => `${row.contract.strategyFamilyId.split(':')[0]}|${row.contract.speedTier}`
    + `|${row.contract.instrument}|${row.contract.venue}|${row.contract.executionPolicy}` === lineage);
  assert.equal(active?.contract.id, observing.id);
  assert.equal(active?.currentState, 'shadow_paper');
});

test('research trial accounting rolls at each predeclared six-hour challenger boundary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-epoch-'));
  const evidence = new FastPerpEvidenceStore(path.join(root, 'evidence'));
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  const day = Date.UTC(2026, 6, 16);
  const rows = (prefix: string, offset: number) => Array.from({ length: 80 }, (_, index) => {
    const row = book(offset + index); const eventTime = day + (offset + index) * 5_000;
    return { ...row, id: `${prefix}_${index}`, eventTime, receivedAt: eventTime + 1 };
  });
  evidence.appendBooks(rows('first', 0));
  const first = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics, now: day + 60_000 });
  evidence.appendBooks(rows('second', 80));
  const sameEpoch = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics, now: day + 5 * 60 * 60_000 });
  assert.equal(sameEpoch.researchEpochId, first.researchEpochId);
  assert.equal(sameEpoch.researchLookNumber, 2);
  evidence.appendBooks(rows('third', 160).map((row) => ({ ...row, eventTime: row.eventTime + 6 * 60 * 60_000,
    receivedAt: row.receivedAt + 6 * 60 * 60_000 })));
  const nextEpoch = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics,
    now: day + 7 * 60 * 60_000 });
  assert.notEqual(nextEpoch.researchEpochId, first.researchEpochId);
  assert.equal(nextEpoch.researchLookNumber, 1);
  assert.equal(nextEpoch.globalDeclaredTrials, nextEpoch.declaredTrials);
});

test('challenger research reads only its bounded evidence window and ignores unrelated old partitions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metaedge-fast-bounded-research-'));
  const evidenceRoot = path.join(root, 'evidence'); const evidence = new FastPerpEvidenceStore(evidenceRoot);
  const economics = new EconomicOperationStore(path.join(root, 'economics'));
  const now = Date.UTC(2026, 6, 16, 12, 0);
  evidence.appendBooks(Array.from({ length: 80 }, (_, index) => {
    const row = book(index); const eventTime = now - 80 * 5_000 + index * 5_000;
    return { ...row, id: `current_${index}`, eventTime, receivedAt: eventTime + 1 };
  }));
  evidence.flush();
  const old = path.join(evidenceRoot, 'raw', '2026-05-01', '00', 'SOL', 'books.jsonl');
  fs.mkdirSync(path.dirname(old), { recursive: true }); fs.writeFileSync(old, '{malformed old partition\n');
  const run = runFastPerpResearchCycle({ evidenceStore: evidence, economicStore: economics, now });
  assert.ok(run.evaluations.length > 0);
  assert.equal(fs.existsSync(path.join(evidenceRoot, 'quarantine', 'malformed-jsonl.jsonl')), false);
});
