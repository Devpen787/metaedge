import crypto from 'node:crypto';
import { buildVersionedFeatures } from './features.js';
import { evaluateDecisionGates } from './gates.js';
import { realizedVolPctPerHour, simpleMovingAverageSeries, wilderRsiSeries } from '../feature_math.mjs';
import type { DecisionContext, FrozenStrategySpec, StrategyPlugin, ValidationRecord } from './types.js';

export interface HistoricalBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  qv: number;
  trades?: number;
}

export interface HistoricalDataset {
  id: string;
  hash: string;
  provider: string;
  venue: string;
  symbol: string;
  bars: HistoricalBar[];
}

export interface HistoricalValidationConfig {
  warmupBars: number;
  foldBars: number;
  embargoBars: number;
  costBpsPerSide: number;
  minimumTrades: number;
  minimumProfitFactor: number;
  minimumPositiveFoldRatio: number;
  minimumTstat: number;
  requireBenchmarkOutperformance: boolean;
}

const DEFAULT_CONFIG: HistoricalValidationConfig = {
  warmupBars: 240,
  foldBars: 1_440,
  embargoBars: 48,
  costBpsPerSide: 10,
  minimumTrades: 30,
  minimumProfitFactor: 1.1,
  minimumPositiveFoldRatio: 0.55,
  minimumTstat: 2,
  requireBenchmarkOutperformance: true,
};

interface TradeResult { ret: number }

function metrics(trades: TradeResult[]) {
  const returns = trades.map((trade) => trade.ret);
  if (!returns.length) return { trades: 0, expectancyPct: 0, profitFactor: 0, maxDrawdownPct: 0, tstat: 0, totalReturnPct: 0 };
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value <= 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = -losses.reduce((sum, value) => sum + value, 0);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const standardDeviation = Math.sqrt(variance) || 1e-9;
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity *= 1 + value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, 1 - equity / peak);
  }
  return {
    trades: returns.length,
    expectancyPct: mean * 100,
    // Persisted validation records are JSON. Keep every metric finite so a
    // perfect no-loss fixture cannot silently serialize Infinity as null.
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 1_000_000 : 0,
    maxDrawdownPct: maxDrawdown * 100,
    tstat: mean / (standardDeviation / Math.sqrt(returns.length)),
    totalReturnPct: (equity - 1) * 100,
  };
}

interface PrecomputedFeatures { rsi14: Array<number | null>; sma200: Array<number | null> }

function simulateFold(dataset: HistoricalDataset, plugin: StrategyPlugin, from: number, to: number, config: HistoricalValidationConfig, precomputed: PrecomputedFeatures) {
  const bars = dataset.bars;
  const closes = bars.map((bar) => bar.c);
  const trades: TradeResult[] = [];
  let holding = false;
  let averageEntryPrice = 0;
  let heldSince: number | undefined;
  const cost = config.costBpsPerSide / 10_000;

  for (let i = Math.max(from, config.warmupBars); i < Math.min(to, bars.length - 1); i++) {
    const bar = bars[i];
    const lookback = bars.slice(Math.max(0, i - 23), i + 1);
    const observedAt = bar.t;
    const source = { provider: dataset.provider, dataset: dataset.id, venue: dataset.venue, observedAt, retrievedAt: observedAt };
    const features = buildVersionedFeatures({
      symbol: dataset.symbol,
      price: bar.c,
      change24hPct: i >= 24 ? ((bar.c - bars[i - 24].c) / bars[i - 24].c) * 100 : null,
      volume24hUsd: lookback.reduce((sum, item) => sum + (item.qv || 0), 0),
      high24h: Math.max(...lookback.map((item) => item.h)),
      low24h: Math.min(...lookback.map((item) => item.l)),
      hourlyCloses: closes.slice(Math.max(0, i - 199), i + 1),
      fundingHourly: null,
      openInterestUsd: null,
      sources: { market: source, history: source, funding: { ...source, dataset: `${dataset.id}:no-funding` } },
      staleBudgets: { market: 1, history: 1, funding: 1 },
      precomputed: {
        rsi14: precomputed.rsi14[i],
        sma200: precomputed.sma200[i],
        realizedVolPctPerHour: realizedVolPctPerHour(closes.slice(Math.max(0, i - 24), i + 1)),
      },
    });
    const context: DecisionContext = {
      cycleId: `validation:${dataset.id}:${from}:${i}`,
      evaluatedAt: observedAt,
      symbol: dataset.symbol,
      instrument: plugin.instrument,
      universe: { tier: 1, included: true, reason: 'frozen validation universe', observedAt, quality: 'good' },
      features,
      position: { holding, openNotionalUsd: holding ? 250 : 0, averageEntryPrice, heldSince },
      limits: {
        liquidityFloorUsd: 1,
        staleBudgetMs: 1,
        modeledRoundTripCostBps: config.costBpsPerSide * 2,
        maxRoundTripCostBps: config.costBpsPerSide * 2,
        requestedNotionalUsd: 250,
        riskBudgetUsd: 250,
        portfolioOpenNotionalUsd: holding ? 250 : 0,
        portfolioMaxNotionalUsd: 2_500,
      },
    };
    if (evaluateDecisionGates(context, plugin).some((gate) => gate.status === 'decline')) continue;
    const signal = plugin.generateSignal(context);
    const nextOpen = bars[i + 1].o;
    if (!holding && signal.action === 'buy') {
      holding = true;
      averageEntryPrice = nextOpen * (1 + cost);
      heldSince = bars[i + 1].t;
    } else if (holding && signal.action === 'sell') {
      const exit = nextOpen * (1 - cost);
      trades.push({ ret: (exit - averageEntryPrice) / averageEntryPrice });
      holding = false;
      averageEntryPrice = 0;
      heldSince = undefined;
    }
  }
  if (holding) {
    const exit = bars[Math.min(to - 1, bars.length - 1)].c * (1 - cost);
    trades.push({ ret: (exit - averageEntryPrice) / averageEntryPrice });
  }
  const start = bars[Math.max(from, config.warmupBars)]?.o;
  const end = bars[Math.min(to - 1, bars.length - 1)]?.c;
  const benchmarkReturnPct = start > 0 && end > 0 ? ((end * (1 - cost)) / (start * (1 + cost)) - 1) * 100 : 0;
  return { trades, benchmarkReturnPct, metrics: metrics(trades) };
}

export function validateFrozenStrategy(
  spec: FrozenStrategySpec,
  plugin: StrategyPlugin,
  datasets: HistoricalDataset[],
  options: { config?: Partial<HistoricalValidationConfig>; codeCommit: string; validatedAt?: number },
): ValidationRecord {
  if (spec.pluginId !== plugin.id || spec.pluginVersion !== plugin.version) throw new Error('Plugin does not match frozen strategy spec');
  const config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
  const configHash = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
  const foldMetrics: NonNullable<ValidationRecord['foldMetrics']> = [];
  const allTrades: TradeResult[] = [];
  let benchmarkEquity = 1;
  let positiveFolds = 0;
  let foldCount = 0;

  for (const dataset of datasets) {
    const closes = dataset.bars.map((bar) => bar.c);
    const precomputed: PrecomputedFeatures = {
      rsi14: wilderRsiSeries(closes, 14),
      sma200: simpleMovingAverageSeries(closes, 200),
    };
    let fold = 0;
    for (let from = config.warmupBars + config.embargoBars; from + config.foldBars <= dataset.bars.length; from += config.foldBars) {
      const simulated = simulateFold(dataset, plugin, from, from + config.foldBars, config, precomputed);
      allTrades.push(...simulated.trades);
      benchmarkEquity *= 1 + simulated.benchmarkReturnPct / 100;
      if (simulated.metrics.expectancyPct > 0) positiveFolds++;
      foldCount++;
      foldMetrics.push({
        symbol: dataset.symbol,
        fold,
        split: from + config.foldBars * 2 > dataset.bars.length ? 'holdout' : 'validation',
        trades: simulated.metrics.trades,
        expectancyPct: simulated.metrics.expectancyPct,
        profitFactor: simulated.metrics.profitFactor,
        totalReturnPct: simulated.metrics.totalReturnPct,
        benchmarkReturnPct: simulated.benchmarkReturnPct,
      });
      fold++;
    }
  }

  const aggregate = metrics(allTrades);
  const benchmarkReturnPct = (benchmarkEquity - 1) * 100;
  const positiveFoldRatio = foldCount ? positiveFolds / foldCount : 0;
  const reasons: string[] = [];
  if (plugin.instrument !== 'spot') reasons.push('VALIDATOR_SPOT_ONLY');
  if (aggregate.trades < config.minimumTrades) reasons.push('SAMPLE_INSUFFICIENT');
  if (aggregate.expectancyPct <= 0) reasons.push('EXPECTANCY_NOT_POSITIVE');
  if (aggregate.profitFactor < config.minimumProfitFactor) reasons.push('PROFIT_FACTOR_FLOOR');
  if (positiveFoldRatio < config.minimumPositiveFoldRatio) reasons.push('FOLD_ROBUSTNESS_FLOOR');
  if (aggregate.tstat < config.minimumTstat) reasons.push('TSTAT_FLOOR');
  if (config.requireBenchmarkOutperformance && aggregate.totalReturnPct <= benchmarkReturnPct) reasons.push('BENCHMARK_NOT_BEATEN');
  const status: ValidationRecord['status'] = reasons.length === 0
    ? 'forward_paper_candidate'
    : aggregate.trades < config.minimumTrades ? 'inconclusive' : 'rejected';
  const datasetHash = crypto.createHash('sha256').update(datasets.map((dataset) => `${dataset.id}:${dataset.hash}`).sort().join('|')).digest('hex');
  const validatedAt = options.validatedAt ?? Date.now();
  const idSeed = `${spec.hash}|${datasetHash}|${configHash}|${options.codeCommit}`;
  return {
    id: `validation_${crypto.createHash('sha256').update(idSeed).digest('hex').slice(0, 20)}`,
    strategyHash: spec.hash,
    status,
    datasetId: datasets.map((dataset) => dataset.id).join(','),
    datasetHash,
    codeCommit: options.codeCommit,
    folds: foldCount,
    costBpsPerSide: config.costBpsPerSide,
    benchmark: spec.benchmark,
    reasons: reasons.length ? reasons : ['ALL_PRECOMMITTED_GATES_PASSED'],
    validatedAt,
    configHash,
    symbols: datasets.map((dataset) => dataset.symbol),
    featureVersions: [...spec.requiredFeatures],
    metrics: {
      ...aggregate,
      positiveFoldRatio,
      benchmarkReturnPct,
    },
    foldMetrics,
  };
}
