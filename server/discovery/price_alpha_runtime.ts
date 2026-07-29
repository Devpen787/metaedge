import fs from 'node:fs';
import path from 'node:path';
import {
  buildPriceAlphaSamples, collapseSimultaneousSamples, generatePriceCandidateSpecs, purgedTemporalSplit,
  validateAlphaCandidate, type PriceSeriesMap,
} from './alpha_factory.js';
import { pearsonCorrelation } from './math.js';
import { alignBars, readBars, readFactoryConfig } from './sources.js';
import { contentHash } from './store.js';
import type { AlphaCandidateSpec, AlphaNoveltyRecord, AlphaTrial, AlphaValidationRecord, FlywheelLane } from './flywheel_types.js';

interface LaneResearchResult {
  lane: Extract<FlywheelLane, 'stocks' | 'spot_crypto' | 'memecoins'>;
  symbols: string[];
  universeAuthority: string;
  candidates: AlphaCandidateSpec[];
  validations: AlphaValidationRecord[];
  novelty: AlphaNoveltyRecord[];
  trials: AlphaTrial[];
  rawSampleCount: number;
}

export interface PriceAlphaResearchResult {
  lanes: LaneResearchResult[];
  candidates: AlphaCandidateSpec[];
  validations: AlphaValidationRecord[];
  novelty: AlphaNoveltyRecord[];
  trials: AlphaTrial[];
}

function availableSymbols(interval: '1d' | '1h'): string[] {
  const dir = path.join(process.cwd(), 'data', 'market');
  const suffix = `-${interval}.jsonl`;
  try {
    return fs.readdirSync(dir).filter((file) => file.startsWith('backfill-') && file.endsWith(suffix))
      .map((file) => file.slice('backfill-'.length, -suffix.length)).sort();
  } catch { return []; }
}

function averageRecentDollarVolume(bars: ReturnType<typeof readBars>['bars'], count: number): number {
  const rows = bars.slice(-count);
  return rows.length ? rows.reduce((sum, bar) => sum + (bar.qv ?? bar.v * bar.c), 0) / rows.length : 0;
}

function criterionSeries(input: {
  interval: '1d' | '1h'; benchmark: string; excluded: Set<string>; minimumBars: number; minimumDailyDollarVolume: number;
}): { symbols: string[]; series: PriceSeriesMap } {
  const benchmark = readBars(input.benchmark, input.interval).bars;
  const series: PriceSeriesMap = new Map();
  for (const symbol of availableSymbols(input.interval)) {
    if (symbol === input.benchmark || input.excluded.has(symbol)) continue;
    try {
      const asset = readBars(symbol, input.interval).bars;
      const dailyDollarVolume = averageRecentDollarVolume(asset, input.interval === '1d' ? 20 : 24 * 30) * (input.interval === '1h' ? 24 : 1);
      if (asset.length < input.minimumBars || dailyDollarVolume < input.minimumDailyDollarVolume) continue;
      const aligned = alignBars(asset, benchmark);
      if (aligned.asset.length < input.minimumBars) continue;
      series.set(symbol, aligned);
    } catch { /* malformed or missing histories are not members */ }
  }
  return { symbols: [...series.keys()].sort(), series };
}

function explicitMemeSeries(): { symbols: string[]; series: PriceSeriesMap } {
  const cfg = readFactoryConfig();
  const benchmark = readBars(cfg.memecoins.benchmark, '1h').bars;
  const series: PriceSeriesMap = new Map();
  for (const symbol of cfg.memecoins.symbols) {
    try {
      const asset = readBars(symbol, '1h').bars;
      const aligned = alignBars(asset, benchmark);
      if (aligned.asset.length >= 24 * 365) series.set(symbol, aligned);
    } catch { /* missing history remains excluded */ }
  }
  return { symbols: [...series.keys()].sort(), series };
}

function runLane(input: {
  lane: LaneResearchResult['lane']; symbols: string[]; series: PriceSeriesMap; universeAuthority: string;
  lookbacks: number[]; horizons: number[]; costBps: number; blockPromotionReason?: string;
}): LaneResearchResult {
  if (!input.symbols.length) return { lane: input.lane, symbols: [], universeAuthority: input.universeAuthority,
    candidates: [], validations: [], novelty: [], trials: [], rawSampleCount: 0 };
  const candidates = generatePriceCandidateSpecs({ lane: input.lane, symbols: input.symbols,
    lookbacks: input.lookbacks, horizons: input.horizons, roundTripCostBps: input.costBps });
  const validations: AlphaValidationRecord[] = [];
  const trials: AlphaTrial[] = [];
  const holdoutReturns = new Map<string, Map<number, number>>();
  let rawSampleCount = 0;
  for (const candidate of candidates) {
    const startedAt = Date.now();
    const samples = buildPriceAlphaSamples(candidate, input.series);
    rawSampleCount += samples.length;
    const validation = validateAlphaCandidate(candidate, samples,
      { alpha: 0.05, minimumSplitSamples: 20, stressedExtraCostBps: 20, requestedNotionalUsd: 250 });
    validations.push(validation);
    const independent = collapseSimultaneousSamples(samples);
    const holdout = purgedTemporalSplit(independent, candidate.horizonBars).holdout;
    holdoutReturns.set(candidate.contentHash, new Map(holdout.map((sample) => [sample.enteredAt, sample.netReturnBps])));
    const statisticallyPromoted = validation.disposition === 'candidate';
    const laneBlocked = statisticallyPromoted && Boolean(input.blockPromotionReason);
    trials.push({
      id: `trial_${validation.id.slice('validation_'.length)}`, candidateHash: candidate.contentHash,
      evidenceFingerprint: validation.evidenceFingerprint, lane: input.lane, family: candidate.family,
      startedAt, completedAt: Date.now(),
      status: laneBlocked ? 'blocked' : validation.disposition,
      reason: laneBlocked ? input.blockPromotionReason as string : validation.reason,
      declaredTrials: candidate.declaredTrials,
      support: validation.train.n + validation.validation.n + validation.holdout.n,
      validationId: validation.id, liveExecution: 'locked',
    });
  }
  const novelty: AlphaNoveltyRecord[] = candidates.map((candidate) => {
    const source = holdoutReturns.get(candidate.contentHash) || new Map<number, number>();
    let nearestCandidateHash: string | null = null; let maximumAbsoluteCorrelation = 0; let overlap = 0;
    for (const other of candidates) {
      if (other.contentHash === candidate.contentHash) continue;
      const target = holdoutReturns.get(other.contentHash) || new Map<number, number>();
      const times = [...source.keys()].filter((time) => target.has(time));
      if (times.length < 20) continue;
      const correlation = pearsonCorrelation(times.map((time) => source.get(time) as number), times.map((time) => target.get(time) as number));
      if (correlation == null || Math.abs(correlation) <= maximumAbsoluteCorrelation) continue;
      maximumAbsoluteCorrelation = Math.abs(correlation); nearestCandidateHash = other.contentHash; overlap = times.length;
    }
    const distinct = nearestCandidateHash == null || maximumAbsoluteCorrelation < 0.8;
    const payload = { candidateHash: candidate.contentHash, nearestCandidateHash, maximumAbsoluteCorrelation, overlap };
    return { id: `novelty_${contentHash(payload).slice(0, 20)}`, ...payload, distinct,
      reason: nearestCandidateHash == null ? 'NO_COMPARABLE_HOLDOUT_SERIES' : distinct ? 'HOLDOUT_RETURN_CORRELATION_BELOW_DUPLICATE_LIMIT' : 'DUPLICATE_OR_NEAR_DUPLICATE_HOLDOUT_RETURNS',
      createdAt: Date.now() };
  });
  return { lane: input.lane, symbols: input.symbols, universeAuthority: input.universeAuthority,
    candidates, validations, novelty, trials, rawSampleCount };
}

export function runPriceAlphaResearch(): PriceAlphaResearchResult {
  const cfg = readFactoryConfig();
  const memeSet = new Set(cfg.memecoins.symbols);
  const stock = criterionSeries({ interval: '1d', benchmark: cfg.stock.benchmark, excluded: new Set(),
    minimumBars: 1_260, minimumDailyDollarVolume: 10_000_000 });
  const crypto = criterionSeries({ interval: '1h', benchmark: cfg.crypto.benchmark, excluded: memeSet,
    minimumBars: 24 * 365, minimumDailyDollarVolume: 10_000_000 });
  const memes = explicitMemeSeries();
  const lanes = [
    runLane({ lane: 'stocks', ...stock,
      universeAuthority: 'criterion: >=1260 daily bars and >=$10m average recent daily dollar volume; SPY benchmark excluded',
      lookbacks: [1, 5, 20, 60], horizons: [1, 5, 10], costBps: cfg.stock.roundTripCostBps }),
    runLane({ lane: 'spot_crypto', ...crypto,
      universeAuthority: 'criterion: >=8760 hourly bars and >=$10m annualized recent daily quote volume; BTC benchmark and explicit meme lane excluded',
      lookbacks: [1, 6, 24, 72], horizons: [1, 6, 24], costBps: cfg.crypto.roundTripCostBps }),
    runLane({ lane: 'memecoins', ...memes,
      universeAuthority: 'explicit research-only meme set from opportunity-factory-v1; membership is not criterion-complete',
      lookbacks: [1, 6, 24], horizons: [1, 6, 12], costBps: cfg.memecoins.roundTripCostBps,
      blockPromotionReason: 'LANE_MANIPULATION_AND_EXIT_EVIDENCE_BLOCKED' }),
  ];
  return { lanes, candidates: lanes.flatMap((lane) => lane.candidates), validations: lanes.flatMap((lane) => lane.validations),
    novelty: lanes.flatMap((lane) => lane.novelty),
    trials: lanes.flatMap((lane) => lane.trials) };
}
