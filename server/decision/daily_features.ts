import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getBroadTick, type BroadTickV5 } from '../broad_feed.js';
import { createMarketObservationV5 } from '../market_data_v5.js';

// DAILY FEATURES — the golden cross is a 200-DAY signal, but the live recorder keeps only ~16
// days of hourly closes. This bootstraps daily 50/200 SMAs + 50-day average volume from the
// on-disk daily cache (data/market/momentum/gccache-multi/*.json, ~2.7yr per symbol), and lets
// TODAY's bar evolve with the live price/volume from the broad feed — so a cross forming right
// now is detectable without re-fetching 200 days on every tick.
const DAILY_DIR = process.env.DAILY_BOOTSTRAP_DIR
  || path.join(process.cwd(), 'data', 'market', 'momentum', 'gccache-multi');
const MARKET_DIR = process.env.MARKET_DATA_DIR || path.join(process.cwd(), 'data', 'market');
const SETTLED_V5_DIR = path.join(MARKET_DIR, 'daily-v5');
const DAY_MS = 86_400_000;
const series = new Map<string, { t: number; p: number; v: number }[] | null>();   // parsed once per symbol, then cached

function load(base: string): { t: number; p: number; v: number }[] | null {
  const b = base.toUpperCase();
  if (series.has(b)) return series.get(b)!;
  let out: { t: number; p: number; v: number }[] | null = null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DAILY_DIR, `${b}.json`), 'utf8'));
    if (Array.isArray(raw)) out = raw.map((d: any) => ({ t: d.t, p: Number(d.p), v: Number(d.v) || 0 })).filter((d) => d.p > 0);
  } catch { /* no cache for this symbol */ }
  const persisted = readPersistedDailyBarsV5(b).map((bar) => ({
    t: bar.dayEndAt,
    p: bar.close,
    v: bar.volume24hUsd,
  }));
  if (persisted.length) {
    const byDay = new Map<number, { t: number; p: number; v: number }>();
    for (const bar of [...(out || []), ...persisted]) byDay.set(Math.floor(bar.t / DAY_MS), bar);
    out = [...byDay.values()].sort((left, right) => left.t - right.t);
  }
  series.set(b, out && out.length ? out : null);
  return series.get(b)!;
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

export interface DailyIndicators {
  sma50: number; sma200: number; sma50Prev: number; sma200Prev: number;   // today (with live) vs the prior settled day
  vol50dAvg: number;      // 50-day average DAILY quote volume (USD), from settled bars
  vol24hUsd: number | null;   // live 24h volume from the broad feed
  days: number;           // settled daily bars available
  lastClose: number;      // most recent settled close
  lastSettledAt: number;  // timestamp of the latest settled source bar
  return30dPct: number | null;      // price vs 30 settled days ago (recent momentum context)
  realizedVolPctDaily: number | null;   // stdev of the last 30 daily returns (%), for stop/size context
}

// Daily indicators for a base asset, evolving today's bar with the live price when supplied.
export function dailyIndicators(base: string, livePrice?: number, live24hUsd?: number): DailyIndicators | null {
  const s = load(base);
  if (!s || s.length < 200) return null;                      // need 200 settled days for a 200-SMA
  const closes = s.map((d) => d.p);
  const px = livePrice && livePrice > 0 ? livePrice : null;
  const lastDay = Math.floor(s[s.length - 1].t / DAY_MS), today = Math.floor(Date.now() / DAY_MS);
  // prev = SMA ending at the last SETTLED bar; today = same series with today's provisional close
  const settled = lastDay === today ? closes.slice(0, -1) : closes;          // don't double-count a same-day cache bar
  const todayCloses = px ? [...settled, px] : closes;
  const sma = (arr: number[], n: number) => arr.length >= n ? mean(arr.slice(-n)) : mean(arr);
  const nowPx = px ?? settled[settled.length - 1];
  const ret30 = settled.length > 30 ? (nowPx / settled[settled.length - 30] - 1) * 100 : null;
  // realized daily vol: stdev of the last 30 settled close-to-close returns (%)
  let rvol: number | null = null;
  if (settled.length > 31) {
    const rets: number[] = [];
    for (let k = settled.length - 30; k < settled.length; k++) if (settled[k - 1] > 0) rets.push((settled[k] / settled[k - 1] - 1) * 100);
    const m = mean(rets);
    rvol = Math.sqrt(rets.reduce((a, r) => a + (r - m) ** 2, 0) / (rets.length || 1));
  }
  return {
    sma50: sma(todayCloses, 50), sma200: sma(todayCloses, 200),
    sma50Prev: sma(settled, 50), sma200Prev: sma(settled, 200),
    vol50dAvg: mean(s.slice(-50).map((d) => d.v)),
    vol24hUsd: live24hUsd ?? getBroadTick(base)?.vol24hUsd ?? null,
    days: settled.length, lastClose: settled[settled.length - 1],
    lastSettledAt: s[Math.max(0, settled.length - 1)]?.t || 0,
    return30dPct: ret30, realizedVolPctDaily: rvol,
  };
}

// Extend a symbol's in-memory daily series with a settled bar (called by the daily roll so the
// SMAs stay current over time instead of decaying against a frozen cache snapshot).
export function appendDailyClose(base: string, close: number, vol: number, dayTs = Date.now()) {
  const b = base.toUpperCase();
  const s = load(b);
  if (!s || !(close > 0)) return;
  const day = Math.floor(dayTs / DAY_MS);
  if (Math.floor(s[s.length - 1].t / DAY_MS) === day) { s[s.length - 1] = { t: dayTs, p: close, v: vol }; }
  else s.push({ t: dayTs, p: close, v: vol });
}

// Per-symbol running close for the in-progress UTC day (the last price we observed today).
export interface SettledDailyBarV5 {
  authorityVersion: 5;
  schema: 'daily-bar.v5';
  symbol: string;
  day: number;
  dayEndAt: number;
  close: number;
  volume24hUsd: number;
  provider: string;
  venue: string;
  sourceObservationHash: string;
  observedAt: number;
  receivedAt: number;
  gapPolicy: 'do_not_fill';
  crossVenuePolicy: 'preserve_and_flag';
  barHash: string;
}

const dayState = new Map<string, {
  day: number;
  close: number;
  vol: number;
  observation: BroadTickV5['observation'];
}>();

function settledFile(day: number): string {
  return path.join(SETTLED_V5_DIR, `bars-${new Date(day * DAY_MS).toISOString().slice(0, 10)}.jsonl`);
}

function persistSettledDailyBarV5(
  symbol: string,
  state: NonNullable<ReturnType<typeof dayState.get>>,
  receivedAt: number,
): SettledDailyBarV5 | null {
  const payload = {
    authorityVersion: 5 as const,
    schema: 'daily-bar.v5' as const,
    symbol,
    day: state.day,
    dayEndAt: state.day * DAY_MS + DAY_MS - 1,
    close: state.close,
    volume24hUsd: state.vol,
    provider: state.observation.provider,
    venue: state.observation.venue,
    sourceObservationHash: state.observation.observationHash,
    observedAt: state.observation.observedAt,
    receivedAt,
    gapPolicy: 'do_not_fill' as const,
    crossVenuePolicy: 'preserve_and_flag' as const,
  };
  const bar: SettledDailyBarV5 = {
    ...payload,
    barHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
  };
  try {
    fs.mkdirSync(SETTLED_V5_DIR, { recursive: true });
    fs.appendFileSync(settledFile(state.day), `${JSON.stringify(bar)}\n`, 'utf8');
    return bar;
  } catch (error: any) {
    console.warn(`[daily-features-v5] failed to persist ${symbol} day=${state.day}:`, error?.message);
    return null;
  }
}

export function readPersistedDailyBarsV5(symbol: string): SettledDailyBarV5[] {
  const bars = new Map<number, SettledDailyBarV5>();
  try {
    const files = fs.readdirSync(SETTLED_V5_DIR).filter((file) => file.endsWith('.jsonl')).sort();
    for (const file of files) {
      for (const line of fs.readFileSync(path.join(SETTLED_V5_DIR, file), 'utf8').split('\n')) {
        if (!line) continue;
        try {
          const bar = JSON.parse(line) as SettledDailyBarV5;
          const { barHash, ...payload } = bar;
          const validHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex') === barHash;
          if (
            bar.authorityVersion === 5
            && bar.schema === 'daily-bar.v5'
            && bar.symbol === symbol.toUpperCase()
            && validHash
          ) bars.set(bar.day, bar);
        } catch { /* malformed evidence is ignored, never repaired in place */ }
      }
    }
  } catch { /* no settled v5 evidence yet */ }
  return [...bars.values()].sort((left, right) => left.day - right.day);
}

// One roll step: track each symbol's running close; when the UTC day rolls over, FINALIZE the
// PRIOR day's bar at its LAST-observed close (its actual close), dated to that day — NOT the new
// day's opening price. tickOf is injectable so the settlement rule can be proven deterministically.
export function dailyRollStep(
  nowMs: number = Date.now(),
  tickOf: (b: string) => BroadTickV5 | { price: number; vol24hUsd: number } | null = getBroadTick,
): number {
  const today = Math.floor(nowMs / DAY_MS);
  let finalized = 0;
  for (const b of series.keys()) {
    const t = tickOf(b); if (!t || !(t.price > 0)) continue;
    const st = dayState.get(b);
    if (st && today > st.day) {
      const persisted = persistSettledDailyBarV5(b, st, nowMs);
      if (persisted) {
        appendDailyClose(b, st.close, st.vol, persisted.dayEndAt);
        finalized++;
      }
    }
    const observation = 'observation' in t
      ? t.observation
      : createMarketObservationV5({
        symbol: b,
        price: t.price,
        volume24hUsd: t.vol24hUsd,
        provider: 'injected',
        venue: 'injected',
        dataset: 'daily_roll_input',
        observedAt: nowMs,
        receivedAt: nowMs,
      });
    dayState.set(b, { day: today, close: t.price, vol: t.vol24hUsd, observation });
  }
  return finalized;
}

// Keep the daily series current from the broad feed: track running closes, settle each day at
// rollover. OPEN BLOCKERS (logged, not fixed): forward bars come from the live feed venue (Gate on
// the VM) while bootstrap history may be Binance-sourced (cross-venue); and days between the cache
// fetch and the first roll are a gap.
export function startDailyRoll() {
  dailyRollStep();                              // seed today's running close immediately
  setInterval(() => { const n = dailyRollStep(); if (n) console.log(`[daily-features] settled ${n} prior-day bars`); }, 1_800_000).unref();
}

// test-only hooks (not used by production paths)
export function __seedSeries(base: string, bars: { t: number; p: number; v: number }[]) { series.set(base.toUpperCase(), bars); }
export function __getSeries(base: string) { return series.get(base.toUpperCase()); }
export function __resetDailyStateForTest() { series.clear(); dayState.clear(); }
