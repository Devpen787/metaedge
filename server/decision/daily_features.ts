import fs from 'node:fs';
import path from 'node:path';
import { getBroadTick } from '../broad_feed.js';

// DAILY FEATURES — the golden cross is a 200-DAY signal, but the live recorder keeps only ~16
// days of hourly closes. This bootstraps daily 50/200 SMAs + 50-day average volume from the
// on-disk daily cache (data/market/momentum/gccache-multi/*.json, ~2.7yr per symbol), and lets
// TODAY's bar evolve with the live price/volume from the broad feed — so a cross forming right
// now is detectable without re-fetching 200 days on every tick.
const DAILY_DIR = path.join(process.cwd(), 'data', 'market', 'momentum', 'gccache-multi');
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
  return {
    sma50: sma(todayCloses, 50), sma200: sma(todayCloses, 200),
    sma50Prev: sma(settled, 50), sma200Prev: sma(settled, 200),
    vol50dAvg: mean(s.slice(-50).map((d) => d.v)),
    vol24hUsd: live24hUsd ?? getBroadTick(base)?.vol24hUsd ?? null,
    days: settled.length, lastClose: settled[settled.length - 1],
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

// Once per UTC day, snapshot the broad feed into a settled daily bar for every symbol we track,
// so the daily series never decays against the frozen bootstrap cache. Cheap: reuses the feed
// we already poll, no extra fetching.
export function startDailyRoll() {
  let lastRolled = -1;
  const roll = () => {
    const day = Math.floor(Date.now() / DAY_MS);
    if (day === lastRolled) return;
    lastRolled = day;
    let rolled = 0;
    for (const b of series.keys()) { const t = getBroadTick(b); if (t) { appendDailyClose(b, t.price, t.vol24hUsd, Date.now()); rolled++; } }
    if (rolled) console.log(`[daily-features] rolled ${rolled} daily bars`);
  };
  setInterval(roll, 3_600_000).unref();   // hourly check; acts once per new UTC day
}
