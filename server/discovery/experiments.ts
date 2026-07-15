import crypto from 'node:crypto';
import { correlationPUpperBound, edgeStatistics, labelUpswing, pearsonCorrelation } from './math.js';
import {
  alignBars, dailyCloseReturns, momentumAttentionObservations, readBars,
  readFactoryConfig, stockFilingObservations,
} from './sources.js';
import { contentHash } from './store.js';
import type {
  AgentStageEvidence, CatalystObservation, FactoryDisposition, MarketLane, MemeRiskGate,
  OpportunityCard, PriceBar, RelationshipHypothesis, SourceProvenance, UpswingLabel, WalkForwardEvidence,
} from './types.js';

interface LabeledSample { at: number; label: UpswingLabel; provenance: SourceProvenance[]; }

function findEntryIndex(bars: PriceBar[], availableAt: number): number {
  return bars.findIndex((bar) => bar.t >= availableAt);
}

function labelObservations(
  observations: CatalystObservation[],
  series: Map<string, { asset: PriceBar[]; benchmark: PriceBar[] }>,
  contract: { horizonBars: number; upperBarrierBps: number; lowerBarrierBps: number; roundTripCostBps: number },
): LabeledSample[] {
  const samples: LabeledSample[] = [];
  for (const observation of observations) {
    const aligned = series.get(observation.symbol);
    if (!aligned) continue;
    const entryIndex = findEntryIndex(aligned.asset, observation.availableAt);
    if (entryIndex < 0) continue;
    const label = labelUpswing(aligned.asset, aligned.benchmark, entryIndex, contract);
    if (label.outcome === 'unresolved' || label.realizedNetRelativeBps == null) continue;
    samples.push({ at: observation.availableAt, label, provenance: observation.provenance });
  }
  return samples.sort((a, b) => a.at - b.at);
}

function splitSamples(samples: LabeledSample[]): [LabeledSample[], LabeledSample[], LabeledSample[]] {
  const trainEnd = Math.floor(samples.length * 0.6);
  const validationEnd = Math.floor(samples.length * 0.8);
  return [samples.slice(0, trainEnd), samples.slice(trainEnd, validationEnd), samples.slice(validationEnd)];
}

function statistics(samples: LabeledSample[], alpha: number, trials: number) {
  return edgeStatistics(samples.map((s) => s.label.realizedNetRelativeBps as number), samples.map((s) => s.label.outcome), alpha, trials);
}

function collapseIntoTimeBlocks(samples: LabeledSample[], blockMs: number): LabeledSample[] {
  const grouped = new Map<number, LabeledSample[]>();
  for (const sample of samples) {
    const key = Math.floor(sample.at / blockMs);
    const rows = grouped.get(key) || []; rows.push(sample); grouped.set(key, rows);
  }
  return [...grouped.entries()].sort(([a], [b]) => a - b).map(([key, rows]) => {
    const value = rows.reduce((s, row) => s + (row.label.realizedNetRelativeBps as number), 0) / rows.length;
    return { at: key * blockMs, provenance: rows.flatMap((row) => row.provenance), label: {
      ...rows[0].label, realizedNetRelativeBps: value,
      outcome: value > 0 ? 'upper' : value < 0 ? 'lower' : 'timeout',
    } };
  });
}

function evidence(samples: LabeledSample[], alpha: number, trials: number, baseCost: number, blockMs: number): WalkForwardEvidence {
  const [train, validation, holdout] = splitSamples(samples);
  const stats = (rows: LabeledSample[], extraCost = 0) => {
    const independentBlocks = collapseIntoTimeBlocks(rows, blockMs);
    return edgeStatistics(independentBlocks.map((s) => (s.label.realizedNetRelativeBps as number) - extraCost), independentBlocks.map((s) => s.label.outcome), alpha, trials);
  };
  const validationStats = stats(validation); const holdoutStats = stats(holdout);
  const costs = [...new Set([baseCost, baseCost + 20, baseCost + 40])];
  const preHoldout = samples.slice(0, Math.floor(samples.length * 0.8));
  const chunk = Math.max(1, Math.floor(preHoldout.length / 4));
  const folds = [1, 2, 3].map((fold) => {
    const trainRows = preHoldout.slice(0, chunk * fold);
    const testRows = fold === 3 ? preHoldout.slice(chunk * fold) : preHoldout.slice(chunk * fold, chunk * (fold + 1));
    return { fold, trainSamples: trainRows.length, testSamples: testRows.length, test: stats(testRows) };
  });
  const positiveFoldRatio = folds.filter((fold) => (fold.test.edgeLowerConfidenceBps ?? -Infinity) > 0).length / folds.length;
  return {
    train: statistics(train, alpha, trials), validation: validationStats, holdout: holdoutStats,
    folds, positiveFoldRatio,
    positiveValidation: (validationStats.edgeLowerConfidenceBps ?? -Infinity) > 0,
    positiveHoldout: (holdoutStats.edgeLowerConfidenceBps ?? -Infinity) > 0,
    costSensitivity: costs.map((cost) => ({ roundTripCostBps: cost, holdoutEdgeLcbBps: stats(holdout, cost - baseCost).edgeLowerConfidenceBps })),
  };
}

function stages(observations: number, samples: number, evidenceValue: WalkForwardEvidence, enough: boolean, disposition: FactoryDisposition): AgentStageEvidence[] {
  const now = Date.now(); const validationPass = evidenceValue.positiveValidation && evidenceValue.positiveHoldout;
  return [
    { role: 'observer', at: now, status: observations > 0 ? 'pass' : 'decline', summary: `${observations} causal observations recorded with provenance` },
    { role: 'miner', at: now, status: samples > 0 ? 'pass' : 'decline', summary: `${samples} resolved post-cost barrier outcomes mined` },
    { role: 'compiler', at: now, status: observations > 0 ? 'pass' : 'decline', summary: 'Precommitted rule compiled without changing thresholds after results' },
    { role: 'skeptic', at: now, status: enough ? 'pass' : 'decline', summary: enough ? 'Minimum evaluation sample held' : 'Insufficient independent evaluation samples' },
    { role: 'validator', at: now, status: validationPass && evidenceValue.positiveFoldRatio >= 2 / 3 ? 'pass' : 'decline', summary: validationPass && evidenceValue.positiveFoldRatio >= 2 / 3 ? 'Walk-forward folds, validation, and untouched holdout cleared' : `Confidence-aware validation failed; positive walk-forward fold ratio=${evidenceValue.positiveFoldRatio.toFixed(2)}` },
    { role: 'paper_operator', at: now, status: disposition === 'forward_paper_candidate' ? 'pending' : 'decline', summary: disposition === 'forward_paper_candidate' ? 'Eligible for separate forward-paper review; no order emitted' : 'No paper order authorized' },
    { role: 'research_memory', at: now, status: 'pass', summary: 'Immutable result card appended to persistent research memory' },
  ];
}

function makeCard(input: Omit<OpportunityCard, 'id' | 'schemaVersion' | 'analysisVersion' | 'contentHash' | 'createdAt' | 'liveExecution'>): OpportunityCard {
  const createdAt = Date.now();
  const payload = { ...input, schemaVersion: 'opportunity-card-v1' as const, analysisVersion: 'causal-events-clustered-v2' as const, createdAt, liveExecution: 'locked' as const };
  const hash = contentHash(payload);
  return { ...payload, id: `card_${hash.slice(0, 20)}`, contentHash: hash };
}

function uniqueProvenance(samples: LabeledSample[]): SourceProvenance[] {
  const seen = new Map<string, SourceProvenance>();
  for (const sample of samples) for (const source of sample.provenance) seen.set(`${source.provider}|${source.sourcePath}`, source);
  return [...seen.values()];
}

function dispositionFor(e: WalkForwardEvidence, minimum: number, memeRisk?: MemeRiskGate): { disposition: FactoryDisposition; reason: string } {
  const enough = e.validation.n >= minimum && e.holdout.n >= minimum;
  const stressed = e.costSensitivity.at(-1)?.holdoutEdgeLcbBps ?? -Infinity;
  if (memeRisk && !memeRisk.passed) return { disposition: 'declined', reason: `MEME_RISK_GATE:${memeRisk.blockers.join(',')}` };
  if (!enough) return { disposition: 'research_hypothesis', reason: 'INSUFFICIENT_INDEPENDENT_SAMPLES' };
  if (e.positiveFoldRatio < 2 / 3) return { disposition: 'declined', reason: 'WALK_FORWARD_ROBUSTNESS_FAILED' };
  if (!e.positiveValidation || !e.positiveHoldout) return { disposition: 'declined', reason: 'EDGE_LCB_NOT_POSITIVE_ON_VALIDATION_AND_HOLDOUT' };
  if (!(stressed > 0)) return { disposition: 'declined', reason: 'COST_STRESS_FAILED' };
  return { disposition: 'forward_paper_candidate', reason: 'INDEPENDENT_POST_COST_EDGE_LCB_POSITIVE' };
}

function buildMemeGate(observations: CatalystObservation[], requested: number, cfg: ReturnType<typeof readFactoryConfig>['memecoins']): MemeRiskGate {
  const quoteVolumes = observations.map((o) => Number(o.features.quoteVolumeLookbackUsd)).filter(Number.isFinite);
  const volumeAccelerations = observations.map((o) => Number(o.features.volumeAcceleration)).filter(Number.isFinite);
  const tradeAccelerations = observations.map((o) => Number(o.features.tradeCountAcceleration)).filter(Number.isFinite);
  const liquidityUsd = quoteVolumes.length ? Math.min(...quoteVolumes) : null;
  const exitCapacityUsd = liquidityUsd == null ? null : liquidityUsd * cfg.maximumExitShareOfQuoteVolume;
  const blockers: string[] = [];
  if (liquidityUsd == null || liquidityUsd < cfg.minimumQuoteVolume24hUsd) blockers.push('LIQUIDITY_FLOOR');
  if (exitCapacityUsd == null || exitCapacityUsd < requested) blockers.push('EXIT_CAPACITY');
  // OHLCV cannot establish holder concentration or market-cap turnover. Missing
  // on-chain evidence is a hard blocker, never an assumed-safe zero.
  blockers.push('HOLDER_CONCENTRATION_UNMEASURED', 'TURNOVER_UNMEASURED');
  return {
    liquidityUsd, exitCapacityUsd, requestedNotionalUsd: requested,
    holderConcentrationTop10Pct: null, turnoverRatio: null,
    volumeAcceleration: volumeAccelerations.length ? Math.min(...volumeAccelerations) : null,
    tradeCountAcceleration: tradeAccelerations.length ? Math.min(...tradeAccelerations) : null,
    passed: blockers.length === 0, blockers,
  };
}

export async function runCatalystExperiments(runId: string): Promise<{ cards: OpportunityCard[]; observations: number; errors: string[] }> {
  const cfg = readFactoryConfig(); const cards: OpportunityCard[] = []; const errors: string[] = []; let observationCount = 0;

  // Experiment 1: SEC filing drift in liquid US equities.
  const sec = await stockFilingObservations(cfg.stock); errors.push(...sec.errors); observationCount += sec.observations.length;
  const stockSeries = new Map<string, { asset: PriceBar[]; benchmark: PriceBar[] }>();
  const stockBenchmark = readBars(cfg.stock.benchmark, '1d');
  for (const item of cfg.stock.symbols) {
    try { const data = readBars(item.symbol, '1d'); stockSeries.set(item.symbol, alignBars(data.bars, stockBenchmark.bars)); }
    catch (error: any) { errors.push(`STOCK_${item.symbol}:${error.message}`); }
  }
  const stockSamples = labelObservations(sec.observations, stockSeries, cfg.stock);
  const stockEvidence = evidence(stockSamples, cfg.alpha, cfg.stock.forms.length, cfg.stock.roundTripCostBps, 14 * 86_400_000);
  const stockStatus = dispositionFor(stockEvidence, cfg.minimumSamplesPerEvaluationSplit);
  const stockEnough = stockEvidence.validation.n >= cfg.minimumSamplesPerEvaluationSplit && stockEvidence.holdout.n >= cfg.minimumSamplesPerEvaluationSplit;
  cards.push(makeCard({ runId, lane: 'stocks', experimentId: 'stock-filing-event-drift-v1', symbol: 'EXPLICIT_STOCK_UNIVERSE', benchmark: cfg.stock.benchmark,
    mechanism: 'Public filing arrival may cause delayed benchmark-relative price discovery',
    precommittedRule: `SEC forms ${cfg.stock.forms.join(',')}; enter first daily bar available after filing acceptance`,
    outcomeDefinition: `${cfg.stock.upperBarrierBps}/${cfg.stock.lowerBarrierBps}bps barriers within ${cfg.stock.horizonBars} daily bars after ${cfg.stock.roundTripCostBps}bps costs`,
    disposition: stockStatus.disposition, reason: stockStatus.reason, sampleCount: stockSamples.length, evidence: stockEvidence,
    stages: stages(sec.observations.length, stockSamples.length, stockEvidence, stockEnough, stockStatus.disposition),
    provenance: uniqueProvenance(stockSamples), paperRouting: stockStatus.disposition === 'forward_paper_candidate' ? 'eligible_after_independent_validation' : 'research_only' }));

  for (const lane of ['crypto', 'memecoins'] as const) {
    const laneCfg = cfg[lane]; const benchmarkData = readBars(laneCfg.benchmark, '1h');
    const observations: CatalystObservation[] = []; const series = new Map<string, { asset: PriceBar[]; benchmark: PriceBar[] }>();
    for (const symbol of laneCfg.symbols) {
      try {
        const data = readBars(symbol, '1h'); const aligned = alignBars(data.bars, benchmarkData.bars); series.set(symbol, aligned);
        observations.push(...momentumAttentionObservations(lane, symbol, laneCfg.benchmark, aligned.asset, data.provenance,
          laneCfg.momentumLookbackBars, laneCfg.minimumMomentumBps, laneCfg.minimumVolumeAcceleration,
          lane === 'memecoins' ? cfg.memecoins.minimumTradeCountAcceleration : 0));
      } catch (error: any) { errors.push(`${lane.toUpperCase()}_${symbol}:${error.message}`); }
    }
    observationCount += observations.length;
    const samples = labelObservations(observations, series, laneCfg);
    const trialCount = laneCfg.symbols.length;
    const e = evidence(samples, cfg.alpha, trialCount, laneCfg.roundTripCostBps, 24 * 60 * 60_000);
    const memeRisk = lane === 'memecoins' ? buildMemeGate(observations, cfg.requestedPaperNotionalUsd, cfg.memecoins) : undefined;
    const status = dispositionFor(e, cfg.minimumSamplesPerEvaluationSplit, memeRisk);
    const enough = e.validation.n >= cfg.minimumSamplesPerEvaluationSplit && e.holdout.n >= cfg.minimumSamplesPerEvaluationSplit;
    cards.push(makeCard({ runId, lane, experimentId: lane === 'crypto' ? 'crypto-momentum-attention-v1' : 'meme-participation-manipulation-v1',
      symbol: lane === 'crypto' ? 'EXPLICIT_CRYPTO_UNIVERSE' : 'EXPLICIT_MEME_UNIVERSE', benchmark: laneCfg.benchmark,
      mechanism: lane === 'crypto' ? 'Momentum continuation conditioned on independently observed quote-volume attention' : 'Attention and participation continuation only when manipulation and exit gates are measurable and safe',
      precommittedRule: `${laneCfg.momentumLookbackBars}h momentum >= ${laneCfg.minimumMomentumBps}bps and quote-volume acceleration >= ${laneCfg.minimumVolumeAcceleration}x`,
      outcomeDefinition: `${laneCfg.upperBarrierBps}/${laneCfg.lowerBarrierBps}bps barriers within ${laneCfg.horizonBars} hourly bars after ${laneCfg.roundTripCostBps}bps costs`,
      disposition: status.disposition, reason: status.reason, sampleCount: samples.length, evidence: e, memeRisk,
      stages: stages(observations.length, samples.length, e, enough, status.disposition), provenance: uniqueProvenance(samples),
      paperRouting: status.disposition === 'forward_paper_candidate' ? 'eligible_after_independent_validation' : 'research_only' }));
  }
  return { cards, observations: observationCount, errors };
}

function returnMap(bars: PriceBar[]): Map<string, number> {
  return new Map(dailyCloseReturns(bars).map((row) => [new Date(row.t).toISOString().slice(0, 10), row.value]));
}

export function discoverCrossMarketRelationships(runId: string): { relationships: RelationshipHypothesis[]; errors: string[] } {
  const cfg = readFactoryConfig(); const errors: string[] = [];
  const stockSymbols = cfg.stock.symbols.slice(0, 4).map((x) => x.symbol);
  const cryptoSymbols = [cfg.crypto.benchmark, ...cfg.crypto.symbols.slice(0, 4)];
  const stocks = new Map<string, Map<string, number>>(); const cryptoReturns = new Map<string, Map<string, number>>();
  for (const symbol of stockSymbols) { try { stocks.set(symbol, returnMap(readBars(symbol, '1d').bars)); } catch (e: any) { errors.push(`REL_STOCK_${symbol}:${e.message}`); } }
  for (const symbol of cryptoSymbols) { try { cryptoReturns.set(symbol, returnMap(readBars(symbol, '1h').bars)); } catch (e: any) { errors.push(`REL_CRYPTO_${symbol}:${e.message}`); } }
  const trials = Math.max(1, stocks.size * cryptoReturns.size * 3); const rows: RelationshipHypothesis[] = [];
  for (const [sourceSymbol, source] of stocks) for (const [targetSymbol, target] of cryptoReturns) {
    const dates = [...source.keys()].filter((date) => target.has(date)).sort();
    for (let lag = 1; lag <= 3; lag++) {
      const xs: number[] = []; const ys: number[] = [];
      for (let i = lag; i < dates.length; i++) { xs.push(source.get(dates[i - lag]) as number); ys.push(target.get(dates[i]) as number); }
      const correlation = pearsonCorrelation(xs, ys); if (correlation == null) continue;
      const adjusted = Math.min(1, correlationPUpperBound(correlation, xs.length) * trials);
      const content = { runId, sourceSymbol, targetSymbol, lag, correlation, n: xs.length, adjusted };
      const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
      const interesting = adjusted < 0.05 && Math.abs(correlation) >= 0.1;
      rows.push({ id: `rel_${hash.slice(0, 20)}`, runId, createdAt: Date.now(), sourceLane: 'stocks', sourceSymbol,
        targetLane: 'crypto', targetSymbol, lagBars: lag, correlation, sampleCount: xs.length,
        bonferroniAdjustedPUpperBound: adjusted, disposition: interesting ? 'research_hypothesis' : 'declined',
        reason: interesting ? 'MULTIPLE_TEST_ADJUSTED_LEAD_LAG_WORTH_FORWARD_TESTING' : 'RELATIONSHIP_NOT_DISTINCT_AFTER_MULTIPLE_TESTING', liveExecution: 'locked' });
    }
  }
  rows.sort((a, b) => a.bonferroniAdjustedPUpperBound - b.bonferroniAdjustedPUpperBound);
  return { relationships: rows.slice(0, 20), errors };
}
