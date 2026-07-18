import fs from 'fs';
import path from 'path';
import { serverPrices } from './prices.js';

// Market-data recorder — the evidence foundation. Strategies and research
// cards can only test hypotheses against data we actually captured, so this
// persists a longitudinal record of the SAME feed the fleet trades on:
//   - every minute: price / 24h change / volume / range for every product symbol
//   - every hour: Hyperliquid funding for EVERY perp in the venue universe
//
// The funding capture used to hard-code ['ETH','BTC','SOL'] and discard the other
// ~197 perps that the SAME single API call already returns. Research was therefore
// blindfolded to ~5% of the market it could see for free, which is the binding
// constraint on finding a funding-carry edge (breadth ≈ 2.8x smaller detectable
// effect, per the power analysis). We now record the whole universe and apply the
// liquidity/quality criterion at ANALYSIS time (server/opportunity/feed.ts), not
// at capture — you can filter a wide record down later, but you cannot recover a
// name you threw away. `dayNtlVlm` (24h notional volume) is captured so the
// liquidity floor stays applyable point-in-time.
//
// Storage: one JSONL file per day under data/market/. Funding grows from 3 to
// ~200 rows/hour (~a few hundred KB/day), 30-day retention. Recording must never
// break trading — all failures are swallowed, and the criterion is NOT fetched
// here (that would put CoinGecko on the recorder's hot path).

const DIR = path.join(process.cwd(), 'data', 'market');
const KEEP_DAYS = 30;
const TICK_MS = 60_000;

function dayFile(prefix: string) {
  return path.join(DIR, `${prefix}-${new Date().toISOString().slice(0, 10)}.jsonl`);
}

function appendLines(file: string, lines: string[]) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(file, lines.join('\n') + '\n');
  } catch { /* recording never breaks trading */ }
}

function recordPrices() {
  const t = Date.now();
  const lines = Object.entries(serverPrices).map(([sym, p]) =>
    JSON.stringify({ t, sym, px: p.price, chg24h: p.change24h, vol24h: p.volume24h, hi24h: p.high24h, lo24h: p.low24h })
  );
  appendLines(dayFile('ticks'), lines);
}

async function recordFunding() {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' })
    });
    // An HTML error page from the venue would make .json() throw and be swallowed
    // by the catch below, leaving a silent gap in the funding series. Skip the tick
    // instead — a recorded gap is honest; a fabricated row is not.
    if (!res.ok) return;
    const [meta, ctxs] = await res.json() as any[];
    if (!meta?.universe || !Array.isArray(ctxs)) return; // malformed venue reply → honest gap
    const t = Date.now();
    const lines: string[] = [];
    meta.universe.forEach((u: any, i: number) => {
      const c = ctxs[i];
      if (!c) return;
      const funding = Number(c.funding);
      // Record every perp with a real funding number. A missing/NaN funding is a
      // gap, not a zero — skip it rather than fabricate a row (same rule the
      // scanner and units functions enforce everywhere else).
      if (!Number.isFinite(funding)) return;
      lines.push(JSON.stringify({
        t, sym: u.name,
        fundingHourly: funding,
        // `premium` (perp-vs-oracle basis, a FRACTION) feeds the hedged-carry
        // cost model's basis-drift term.
        premium: Number(c.premium ?? 0),
        openInterest: Number(c.openInterest || 0),
        markPx: Number(c.markPx || 0),
        // 24h notional volume — lets the liquidity floor be applied at analysis
        // time instead of curating the universe at capture.
        dayNtlVlm: Number(c.dayNtlVlm || 0),
      }));
    });
    if (lines.length) appendLines(dayFile('funding'), lines);
  } catch { /* funding capture is best-effort */ }
}

function rotate() {
  try {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const f of fs.readdirSync(DIR)) {
      const m = f.match(/(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (m && m[1] < cutoff) fs.unlinkSync(path.join(DIR, f));
    }
  } catch { /* rotation is best-effort */ }
}

// Hourly closes derived from OUR OWN recorded ticks — the honest source for
// hour-scale features (RSI14 needs 15 hourly closes; SMA200 needs 200 → ~8.3
// days of recording). Boot-loads from the tick files, then updates live every
// minute. Strategies that need more history than exists must DECLINE, never
// fake a lookback from another feed.
const HOURLY_MAX = 400;
// OHLC, not just close. Keeping only the close made two of our three screened
// candidates physically unexpressible live: ZEC/meanrev_stab needs "close above
// the prior bar's HIGH" and a stop at the lowest LOW of 6 bars; PAXG/vol_squeeze
// needs an ATR rank. Every tick already carries the price — the highs and lows
// were simply being thrown away.
//
// HONESTY LIMIT: these are SAMPLED extremes (one tick per 60s), not true
// exchange OHLC. A real bar's high/low can exceed what we sampled, so a backtest
// on exchange klines will trigger stops/targets this feed can miss. Any strategy
// using high/low must be judged on FORWARD paper from THIS feed — never assume
// kline-backtest fills are reproducible here.
const hourly: Record<string, { hour: number; open: number; high: number; low: number; close: number }[]> = {};

function pushHourly(sym: string, t: number, px: number) {
  const hour = Math.floor(t / 3_600_000);
  const arr = (hourly[sym] ||= []);
  const last = arr[arr.length - 1];
  if (last && last.hour === hour) {
    last.close = px;
    if (px > last.high) last.high = px;
    if (px < last.low) last.low = px;
  } else {
    arr.push({ hour, open: px, high: px, low: px, close: px });
    if (arr.length > HOURLY_MAX) arr.splice(0, arr.length - HOURLY_MAX);
  }
}

function loadHourlyFromFiles() {
  try {
    const files = fs.readdirSync(DIR).filter((f) => f.startsWith('ticks-')).sort();
    for (const f of files) {
      for (const line of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n')) {
        if (!line) continue;
        try { const e = JSON.parse(line); pushHourly(e.sym, e.t, e.px); } catch { /* skip bad line */ }
      }
    }
    const eth = hourly['ETH']?.length || 0;
    console.log(`[recorder] hourly history loaded: ${eth} hourly closes (need 15 for RSI, 201 for SMA200)`);
  } catch { /* no history yet — strategies will decline until it exists */ }
}

// Chronological hourly closes for a symbol (empty until recorded history exists).
export function getHourlyCloses(sym: string): number[] {
  return (hourly[sym] || []).map((h) => h.close);
}

// Same series, timestamped, for charting. The rule that governs strategies
// governs the UI too: render what was recorded, never interpolate across the
// gap before the recorder started.
export function getHourlySeries(sym: string): { t: number; close: number }[] {
  return (hourly[sym] || []).map((h) => ({ t: h.hour * 3_600_000, close: h.close }));
}

// Full sampled OHLC bars — required by any strategy that references highs, lows,
// or true range (ATR). Read the honesty limit on `hourly` above: these extremes
// are sampled at the tick cadence, not the exchange's true bar extremes.
export function getHourlyBars(sym: string): { t: number; o: number; h: number; l: number; c: number }[] {
  return (hourly[sym] || []).map((bar) => ({
    t: bar.hour * 3_600_000, o: bar.open, h: bar.high, l: bar.low, c: bar.close,
  }));
}

// In-memory ring of recent ticks so strategy brains can use SHORT-window
// signals (e.g. 1h change) without touching disk on the hot path.
const ring: Record<string, { t: number; px: number }[]> = {};
const RING_MAX = 24 * 60; // 24h of minutes

function updateRing() {
  const t = Date.now();
  for (const [sym, p] of Object.entries(serverPrices)) {
    (ring[sym] ||= []).push({ t, px: p.price });
    if (ring[sym].length > RING_MAX) ring[sym].splice(0, ring[sym].length - RING_MAX);
    pushHourly(sym, t, p.price);
  }
}

// Change over the last `windowMs`, in percent — null until enough history has
// been recorded (honest: no fabricated lookbacks before the recorder started).
export function shortChangePct(sym: string, windowMs: number): number | null {
  const r = ring[sym];
  if (!r || r.length < 2) return null;
  const cutoff = Date.now() - windowMs;
  const past = r.find((x) => x.t >= cutoff);
  if (!past || past.t > Date.now() - windowMs * 0.5) return null; // need ≥ half the window
  const now = r[r.length - 1].px;
  return ((now - past.px) / past.px) * 100;
}

export function startRecorder() {
  if (process.env.RECORDER_DISABLED === 'true') {
    console.log('[recorder] disabled via RECORDER_DISABLED');
    return;
  }
  loadHourlyFromFiles();
  setInterval(() => { recordPrices(); updateRing(); }, TICK_MS).unref();
  setInterval(recordFunding, 60 * 60 * 1000).unref();
  setInterval(rotate, 6 * 60 * 60 * 1000).unref();
  recordFunding();
  rotate();
  console.log(`[recorder] capturing ${Object.keys(serverPrices).length} product symbols every ${TICK_MS / 1000}s + hourly funding for the FULL Hyperliquid perp universe → data/market/ (${KEEP_DAYS}d retention)`);
}
