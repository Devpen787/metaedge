import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CatalystObservation, MarketLane, PriceBar, SourceProvenance } from './types.js';

export interface FactoryConfig {
  version: string;
  minimumSamplesPerEvaluationSplit: number;
  alpha: number;
  requestedPaperNotionalUsd: number;
  stock: {
    symbols: Array<{ symbol: string; cik: string }>;
    benchmark: string; forms: string[]; horizonBars: number;
    upperBarrierBps: number; lowerBarrierBps: number; roundTripCostBps: number;
  };
  crypto: {
    symbols: string[]; benchmark: string; momentumLookbackBars: number;
    minimumMomentumBps: number; minimumVolumeAcceleration: number; horizonBars: number;
    upperBarrierBps: number; lowerBarrierBps: number; roundTripCostBps: number;
  };
  memecoins: {
    symbols: string[]; benchmark: string; momentumLookbackBars: number;
    minimumMomentumBps: number; minimumVolumeAcceleration: number;
    minimumTradeCountAcceleration: number; minimumQuoteVolume24hUsd: number;
    maximumExitShareOfQuoteVolume: number; maximumTop10HolderConcentrationPct: number;
    horizonBars: number; upperBarrierBps: number; lowerBarrierBps: number; roundTripCostBps: number;
  };
}

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'config', 'research', 'opportunity-factory-v1.json');
const SEC_CACHE = path.join(ROOT, 'data', 'opportunity-factory', 'sec-events.json');

export function readFactoryConfig(): FactoryConfig {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as FactoryConfig;
}

function validBar(row: any): row is PriceBar {
  return Number.isFinite(row?.t) && Number.isFinite(row?.o) && row.o > 0 &&
    Number.isFinite(row?.h) && Number.isFinite(row?.l) && Number.isFinite(row?.c) && row.c > 0 &&
    Number.isFinite(row?.v) && row.v >= 0;
}

export function readBars(symbol: string, interval: '1h' | '1d'): { bars: PriceBar[]; provenance: SourceProvenance } {
  const sourcePath = path.join(ROOT, 'data', 'market', `backfill-${symbol}-${interval}.jsonl`);
  const rows = fs.readFileSync(sourcePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter(validBar);
  rows.sort((a, b) => a.t - b.t);
  const deduped = rows.filter((row, i) => i === 0 || row.t !== rows[i - 1].t);
  return {
    bars: deduped,
    provenance: {
      provider: interval === '1d' ? 'yahoo_public_chart' : 'binance',
      dataset: `${interval}_ohlcv`, sourcePath: path.relative(ROOT, sourcePath),
      observedAt: deduped.at(-1)?.t || 0, retrievedAt: fs.statSync(sourcePath).mtimeMs, pointInTime: true,
    },
  };
}

export function alignBars(asset: PriceBar[], benchmark: PriceBar[]): { asset: PriceBar[]; benchmark: PriceBar[] } {
  const bench = new Map(benchmark.map((bar) => [bar.t, bar]));
  const alignedAsset: PriceBar[] = []; const alignedBenchmark: PriceBar[] = [];
  for (const bar of asset) {
    const match = bench.get(bar.t);
    if (match) { alignedAsset.push(bar); alignedBenchmark.push(match); }
  }
  return { asset: alignedAsset, benchmark: alignedBenchmark };
}

function observationId(parts: Array<string | number>): string {
  return `obs_${crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20)}`;
}

function sum(values: number[]): number { return values.reduce((s, v) => s + v, 0); }

export function momentumAttentionObservations(
  lane: Extract<MarketLane, 'crypto' | 'memecoins'>,
  symbol: string,
  benchmark: string,
  bars: PriceBar[],
  provenance: SourceProvenance,
  lookback: number,
  minimumMomentumBps: number,
  minimumVolumeAcceleration: number,
  minimumTradeCountAcceleration = 0,
): CatalystObservation[] {
  const observations: CatalystObservation[] = [];
  const minimumIndex = lookback * 2;
  let previouslyQualified = false;
  let lastSignalIndex = -Infinity;
  for (let i = minimumIndex; i < bars.length; i++) {
    const momentumBps = (bars[i].c / bars[i - lookback].c - 1) * 10_000;
    const recentQuote = sum(bars.slice(i - lookback + 1, i + 1).map((b) => b.qv ?? b.v * b.c));
    const priorQuote = sum(bars.slice(i - lookback * 2 + 1, i - lookback + 1).map((b) => b.qv ?? b.v * b.c));
    const volumeAcceleration = priorQuote > 0 ? recentQuote / priorQuote : 0;
    const recentTrades = sum(bars.slice(i - lookback + 1, i + 1).map((b) => b.trades ?? 0));
    const priorTrades = sum(bars.slice(i - lookback * 2 + 1, i - lookback + 1).map((b) => b.trades ?? 0));
    const tradeCountAcceleration = priorTrades > 0 ? recentTrades / priorTrades : null;
    const qualified = momentumBps >= minimumMomentumBps && volumeAcceleration >= minimumVolumeAcceleration &&
      (minimumTradeCountAcceleration <= 0 || (tradeCountAcceleration != null && tradeCountAcceleration >= minimumTradeCountAcceleration));
    if (!qualified) { previouslyQualified = false; continue; }
    // A condition is an event when it becomes observable, not on every bar that
    // remains true. The lookback cooldown additionally prevents overlapping
    // forward paths from masquerading as independent observations.
    if (previouslyQualified || i - lastSignalIndex < lookback) continue;
    previouslyQualified = true; lastSignalIndex = i;
    observations.push({
      id: observationId([lane, symbol, bars[i].t, momentumBps.toFixed(4), volumeAcceleration.toFixed(6)]),
      lane, symbol, benchmark, instrument: 'spot',
      kind: lane === 'memecoins' ? 'meme_participation_spike' : 'momentum_attention',
      occurredAt: bars[i].t, availableAt: bars[i].t + 3_600_000, featureCutoffAt: bars[i].t,
      features: { momentumBps, quoteVolumeLookbackUsd: recentQuote, volumeAcceleration, tradeCountAcceleration },
      provenance: [provenance],
    });
  }
  return observations;
}

interface SecSubmissionRow { symbol: string; form: string; filedAt: string; accessionNumber: string; primaryDocument: string; }

function readSecCache(): SecSubmissionRow[] {
  try { return JSON.parse(fs.readFileSync(SEC_CACHE, 'utf8')); } catch { return []; }
}

function writeSecCache(rows: SecSubmissionRow[]) {
  fs.mkdirSync(path.dirname(SEC_CACHE), { recursive: true });
  const tmp = `${SEC_CACHE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2)); fs.renameSync(tmp, SEC_CACHE);
}

export async function stockFilingObservations(config: FactoryConfig['stock']): Promise<{ observations: CatalystObservation[]; errors: string[] }> {
  const errors: string[] = []; const cached = readSecCache(); const byKey = new Map(cached.map((r) => [`${r.symbol}|${r.accessionNumber}`, r]));
  const cacheRetrievedAt = (() => { try { return fs.statSync(SEC_CACHE).mtimeMs; } catch { return 0; } })();
  const refreshedSymbols = new Set<string>();
  const userAgent = process.env.SEC_USER_AGENT || 'MetaEdge research research@metaedge.local';
  for (const item of config.symbols) {
    try {
      const res = await fetch(`https://data.sec.gov/submissions/CIK${item.cik}.json`, { headers: { 'User-Agent': userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const recent = (await res.json() as any)?.filings?.recent;
      if (!recent?.accessionNumber) throw new Error('unexpected submissions shape');
      refreshedSymbols.add(item.symbol);
      for (let i = 0; i < recent.accessionNumber.length; i++) {
        if (!config.forms.includes(recent.form[i])) continue;
        const filedAt = recent.acceptanceDateTime?.[i] || `${recent.filingDate[i]}T21:00:00.000Z`;
        const row = { symbol: item.symbol, form: recent.form[i], filedAt, accessionNumber: recent.accessionNumber[i], primaryDocument: recent.primaryDocument[i] };
        byKey.set(`${row.symbol}|${row.accessionNumber}`, row);
      }
    } catch (error: any) { errors.push(`SEC_${item.symbol}:${error.message}`); }
  }
  const rows = [...byKey.values()].sort((a, b) => Date.parse(a.filedAt) - Date.parse(b.filedAt));
  if (rows.length) writeSecCache(rows);
  const retrievedAt = Date.now();
  return {
    observations: rows.map((row) => {
      const availableAt = Date.parse(row.filedAt);
      return {
        id: observationId(['stocks', row.symbol, row.accessionNumber]), lane: 'stocks', symbol: row.symbol,
        benchmark: config.benchmark, instrument: 'equity', kind: 'filing_event',
        occurredAt: availableAt, availableAt, featureCutoffAt: availableAt,
        features: { form: row.form, accessionNumber: row.accessionNumber, primaryDocument: row.primaryDocument },
        provenance: [{ provider: 'sec_edgar', dataset: 'company_submissions', sourcePath: `https://data.sec.gov/submissions/CIK*.json`, observedAt: availableAt,
          retrievedAt: refreshedSymbols.has(row.symbol) ? retrievedAt : cacheRetrievedAt, pointInTime: true }],
      } satisfies CatalystObservation;
    }),
    errors,
  };
}

export function dailyCloseReturns(bars: PriceBar[]): Array<{ t: number; value: number }> {
  const daily = new Map<string, PriceBar>();
  for (const bar of bars) daily.set(new Date(bar.t).toISOString().slice(0, 10), bar);
  const ordered = [...daily.values()].sort((a, b) => a.t - b.t);
  return ordered.slice(1).map((bar, i) => ({ t: bar.t, value: Math.log(bar.c / ordered[i].c) }));
}
