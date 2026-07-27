#!/usr/bin/env node
/**
 * GOLDEN CROSS BACKTEST — daily timeframe. Detect the classic golden cross
 * (fast SMA crossing UP through slow SMA, default 50/200) across the wide
 * universe, then answer the two questions directly:
 *   1. Of the coins that crossed, how many "popped" — closed >= +2% / +5% / +10%
 *      above the cross-day close — within a forward window?
 *   2. How long did it take to first tag each pop (days-to-pop)?
 *
 * DATA SOURCE (--source, default backfill):
 *  - backfill: the project's OWN deep-history DB — data/market/backfill-*-1h.jsonl
 *    (638 coins, Binance+Coinbase, up to ~730d hourly, maintained by
 *    refresh_universe.mjs). Resampled hourly->daily. No network, instant, and it is
 *    the sanctioned backtest universe. THIS IS THE DEFAULT — widest local sample.
 *  - binance: up to 1000 DAILY candles (~2.7yr) per live USDT pair, free, fast.
 *    Use to reach coins not yet in the backfill DB. Universe from the scan file,
 *    mapped to Binance pairs via exchangeInfo.
 *  - coingecko: 365d fallback. NOT recommended for 50/200 — a 50/200 cross needs
 *    200 days just to form, and CoinGecko's free 365d cap + hard bulk rate-limits
 *    make thousands-of-coins deep history infeasible (see refresh_universe.mjs).
 *
 * HONEST CAVEATS (also printed in the output):
 *  - SURVIVORSHIP: the universe is TODAY's coins, so anything that crossed then
 *    died/delisted is absent. This biases OPTIMISTICALLY. No edge here = decisive.
 *  - BASELINE: also reports the pop-rate from EVERY eligible day (same forward
 *    window) as a base rate, so the golden cross has to BEAT the ambient pop-rate,
 *    not just ride universe drift.
 *  - Daily close granularity, close-to-close. No intraday wicks.
 *  - Raw price move (measuring the pattern, not a tradeable P&L). One entry cost
 *    would shave ~1-3% off by mcap tier — a +2% "pop" is inside typical cost;
 *    +5% / +10% clear it. Costs are printed for context, not subtracted.
 *
 * Usage (VM):
 *   node scripts/golden_cross_backtest.mjs [--max 211] [--fast 50] [--slow 200] [--wait 30] [--source binance|coingecko]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIR = path.join(process.cwd(), 'data', 'market', 'momentum');
const MAX = Number(flag('max', '211'));
const FAST = Number(flag('fast', '50'));
const SLOW = Number(flag('slow', '200'));
const SOURCE = flag('source', 'backfill');   // backfill (local 638-coin DB) | binance (1000d) | coingecko (365d)
const CG_DAYS = Number(flag('days', '365'));  // coingecko fallback history
const WAIT = Number(flag('wait', '30'));      // forward window (days) to wait for a pop
const POPS = [2, 5, 10];                       // pop thresholds (%), close-to-close above cross day
// MANAGED EXIT (fast-exit variant): golden cross entry, but exit on these instead of waiting
// for the slow death cross. 0 = that leg off. Death cross + series-end remain as backstops.
const TRAIL = Number(flag('trail', '15'));    // trailing stop: exit when price gives back TRAIL% from the running peak
const TP = Number(flag('tp', '0'));            // take-profit: exit at +TP%
const STOP = Number(flag('stop', '0'));        // initial hard stop: exit at -STOP%
const TSTOP = Number(flag('tstop', '0'));      // time stop: exit after TSTOP days
// ENTRY-QUALITY FILTERS: only TAKE a golden cross that also passes these. Each 0 = off.
const SLOPE = Number(flag('slope', '0'));      // require 200-SMA strictly rising over the last SLOPE days (macro trend has turned)
const VOLMULT = Number(flag('volmult', '0'));  // require cross-day volume >= VOLMULT x its VOLWIN-day average (expansion, not a thin whipsaw)
const VOLWIN = Number(flag('volwin', '50'));   // lookback for the average-volume comparison
const FRESH = Number(flag('fresh', '0'));      // require no prior golden cross in the last FRESH days (true regime shift, not braiding chop)
const MINVOLUSD = Number(flag('min-vol-usd', '0'));  // absolute liquidity floor: require cross-day 24h quote volume (USDT≈USD) >= this. Kills unexecutable microcaps.
const BTCGATE = args.includes('--btc-regime');  // only TAKE a cross when BTC's own 50/200 is bull (close>SMA200 & SMA50>SMA200) — the macro kill switch
const CONC = Number(flag('conc', '5'));         // concurrent-position budget for the closed-trade equity curve (each trade sized 1/CONC of equity)
const EMIT_TRADES = flag('emit-trades', '');    // if set, write the managed-exit trade log as JSONL to this path (read-only research artifact)
const FEE = 0.002;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

async function getJson(url, { retryOn429 = true } = {}) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
    if (r.status === 429 && retryOn429) { await sleep(4000); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

// universe: distinct coins from the most recent scan (id + sym + representative mcap)
function universe() {
  const files = fs.readdirSync(DIR).filter((f) => f.startsWith('scan-')).sort();
  const map = new Map();
  for (const f of files) for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean)) {
    try { const r = JSON.parse(l); if (r.id) map.set(r.id, { id: r.id, sym: (r.sym || '').toUpperCase(), mcap: r.mcap }); } catch { /**/ }
  }
  return [...map.values()];
}

// ---- Backfill DB: the project's own deep-history universe (data/market/backfill-*-1h.jsonl) ----
const MARKET = path.join(process.cwd(), 'data', 'market');
function backfillUniverse() {
  return fs.readdirSync(MARKET)
    .filter((f) => /^backfill-.*-1h\.jsonl$/.test(f))
    .map((f) => { const sym = f.slice('backfill-'.length, -'-1h.jsonl'.length); return { id: sym, sym, mcap: null, file: path.join(MARKET, f) }; });
}
// resample hourly rows {t,c,qv} -> daily series (last close per UTC day, summed quote-vol)
function backfillDaily(file) {
  let lines;
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { return null; }
  const byDay = new Map();
  for (const l of lines) {
    if (!l) continue;
    let r; try { r = JSON.parse(l); } catch { continue; }
    const c = Number(r.c); if (!(c > 0)) continue;
    const day = Math.floor(r.t / 86400000);
    const prev = byDay.get(day);
    const hi = Math.max(Number(r.h) || c, prev ? prev.hi : c);   // intraday high across the day's hourly bars
    const lo = Math.min(Number(r.l) || c, prev ? prev.lo : c);   // intraday low across the day's hourly bars
    byDay.set(day, { t: r.t, p: c, hi, lo, mc: null, v: (prev ? prev.v : 0) + (Number(r.qv) || 0) });
  }
  const out = [...byDay.values()].sort((a, b) => a.t - b.t);
  return out.length > 40 ? out : null;
}

// ---- Binance: TRADING *USDT base assets, then 1000 daily candles per symbol ----
async function binanceUsdtSet() {
  const j = await getJson('https://api.binance.com/api/v3/exchangeInfo');
  const m = new Map();   // baseAsset -> full pair symbol (e.g. BTC -> BTCUSDT)
  if (j && Array.isArray(j.symbols)) for (const s of j.symbols) {
    if (s.quoteAsset === 'USDT' && s.status === 'TRADING') m.set(s.baseAsset, s.symbol);
  }
  return m;
}
// klines: [openTime, open, high, low, close, volume, closeTime, quoteVolume, ...]
async function binanceDaily(pair) {
  const k = await getJson(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`);
  if (!Array.isArray(k) || k.length < 40) return null;
  return k.map((c) => ({ t: c[0], p: Number(c[4]), hi: Number(c[2]), lo: Number(c[3]), mc: null, v: Number(c[7]) })).filter((d) => d.p > 0);
}

// ---- Gate.io: 2000+ USDT spot pairs, up to 1000 daily candles (deepest breadth+depth) ----
// candlestick row: [ts(s), quoteVol, close, high, low, open, baseVol, ...]
async function gateUsdtPairs() {
  const j = await getJson('https://api.gateio.ws/api/v4/spot/currency_pairs');
  const m = new Map();
  if (Array.isArray(j)) for (const p of j) if (p.quote === 'USDT' && p.trade_status === 'tradable') m.set(p.base, p.id);
  return m;
}
async function gateDaily(pair) {
  const k = await getJson(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=1d&limit=1000`);
  if (!Array.isArray(k) || k.length < 40) return null;
  return k.map((c) => ({ t: Number(c[0]) * 1000, p: Number(c[2]), hi: Number(c[3]), lo: Number(c[4]), mc: null, v: Number(c[1]) })).filter((d) => d.p > 0);
}

// ---- MEXC: 1700+ USDT spot pairs, Binance-format klines, ~500 daily candles ----
async function mexcUsdtPairs() {
  const j = await getJson('https://api.mexc.com/api/v3/exchangeInfo');
  const m = new Map();
  if (j && Array.isArray(j.symbols)) for (const s of j.symbols) if (s.quoteAsset === 'USDT') m.set(s.baseAsset, s.symbol);
  return m;
}
async function mexcDaily(pair) {
  const k = await getJson(`https://api.mexc.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`);
  if (!Array.isArray(k) || k.length < 40) return null;
  return k.map((c) => ({ t: c[0], p: Number(c[4]), hi: Number(c[2]), lo: Number(c[3]), mc: null, v: Number(c[7]) })).filter((d) => d.p > 0);
}

// stablecoins / wrapped / obvious non-momentum bases to drop from the multi universe
const STABLE = new Set(['USDT', 'USDC', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'USDE', 'PYUSD', 'GUSD', 'USDD', 'USDG', 'USD1', 'USDY', 'USDF', 'EUR', 'EURT', 'EURI', 'BUSD', 'WBTC', 'WETH', 'WBETH', 'STETH', 'WEETH']);

// MULTI universe: union of Gate + Binance + MEXC base assets, each assigned to its
// deepest-history venue (Binance/Gate = 1000d preferred over MEXC = 500d). Returns
// {id, sym, venue, ref} so the fetch loop pulls each coin exactly once.
async function multiUniverse() {
  const [gate, bnMap, mexc] = await Promise.all([gateUsdtPairs(), binanceUsdtSet(), mexcUsdtPairs()]);
  console.log(`  venue USDT pairs — gate:${gate.size} binance:${bnMap.size} mexc:${mexc.size}`);
  const out = new Map();   // base -> coin (first venue by priority wins)
  const add = (base, venue, ref) => { if (!STABLE.has(base) && !out.has(base)) out.set(base, { id: base, sym: base, venue, ref }); };
  for (const [b, ref] of bnMap) add(b, 'binance', ref);   // priority 1: Binance (clean 1000d)
  for (const [b, ref] of gate) add(b, 'gate', ref);        // priority 2: Gate (1000d, huge breadth)
  for (const [b, ref] of mexc) add(b, 'mexc', ref);        // priority 3: MEXC (500d, long tail)
  return [...out.values()];
}
async function venueDaily(venue, ref) {
  if (venue === 'binance') return binanceDaily(ref);
  if (venue === 'gate') return gateDaily(ref);
  if (venue === 'mexc') return mexcDaily(ref);
  return null;
}

// ---- CoinGecko fallback: granularity-agnostic daily buckets (last obs per day) ----
async function coingeckoDaily(id) {
  const chart = await getJson(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${CG_DAYS}`);
  if (!chart || !Array.isArray(chart.prices) || chart.prices.length < 30) return null;
  const mc = chart.market_caps || [], tv = chart.total_volumes || [];
  const byDay = new Map();
  for (let i = 0; i < chart.prices.length; i++) {
    const [t, p] = chart.prices[i];
    byDay.set(Math.floor(t / 86400000), { t, p, hi: p, lo: p, mc: mc[i] ? mc[i][1] : null, v: tv[i] ? tv[i][1] : null });   // no intraday OHLC from CG points → close proxy
  }
  const out = [...byDay.values()].sort((a, b) => a.t - b.t);
  return out.length > 40 ? out : null;
}

// trailing SMA of the close over `w` days, aligned to each index (null until enough history)
function sma(prices, w) {
  const out = new Array(prices.length).fill(null);
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= w) sum -= prices[i - w];
    if (i >= w - 1) out[i] = sum / w;
  }
  return out;
}

(async () => {
  console.log(`\n=== GOLDEN CROSS BACKTEST (daily ${FAST}/${SLOW} SMA, source=${SOURCE}) — wait ${WAIT}d ===`);
  const CACHE = path.join(DIR, `gccache-${SOURCE}`);   // daily series keyed by coin id; per-source so 1000d/365d never mix
  fs.mkdirSync(CACHE, { recursive: true });
  let allCoins;
  if (SOURCE === 'backfill') allCoins = backfillUniverse();
  else if (SOURCE === 'multi') allCoins = await multiUniverse();
  else allCoins = universe();
  const coins = allCoins.slice(0, MAX);
  console.log(`  universe: ${coins.length} coins (of ${allCoins.length} discovered)`);
  const bnMap = SOURCE === 'binance' ? await binanceUsdtSet() : null;
  if (bnMap) console.log(`  Binance TRADING *USDT pairs: ${bnMap.size}`);

  // BTC 50/200 macro regime map (dayNum -> bull) for the --btc-regime kill switch
  let btcBull = null;
  if (BTCGATE) {
    let bs = null;
    if (SOURCE === 'backfill') bs = backfillDaily(path.join(MARKET, 'backfill-BTC-1h.jsonl'));
    else { try { bs = JSON.parse(fs.readFileSync(path.join(CACHE, 'BTC.json'), 'utf8')); } catch { /**/ } }
    if (!bs || bs.length < SLOW + 1) { console.error(`--btc-regime: BTC daily series unavailable for source=${SOURCE}`); process.exit(1); }
    const bp = bs.map((d) => d.p), bf = sma(bp, FAST), bsl = sma(bp, SLOW);
    btcBull = new Map();
    for (let i = 0; i < bs.length; i++) btcBull.set(Math.floor(bs[i].t / 86400000), bf[i] != null && bsl[i] != null && bp[i] > bsl[i] && bf[i] > bsl[i]);
    console.log(`  BTC macro regime loaded: ${[...btcBull.values()].filter(Boolean).length}/${btcBull.size} days bull`);
  }

  // accumulators
  const crossTTP = {};   // {thr: [days-to-pop]} for cross events that popped
  const crossN = {};      // {thr: popped count}
  const baseN = {};       // {thr: base-rate popped count}
  for (const t of POPS) { crossTTP[t] = []; crossN[t] = 0; baseN[t] = 0; }
  let crosses = 0, rawCrosses = 0, baseDays = 0, coinsUsed = 0, tooShort = 0, fetched = 0, cached = 0, noPair = 0;
  const perCoinCrosses = [];   // {sym, day} for a readable event log tail
  // ROUND-TRIP: hold from golden cross to the next death cross. This is how the strategy
  // is actually TRADED — peak = how high it got (max favorable excursion, on intraday highs).
  const RT = { trade: [], peak: [], daysToPeak: [], hold: [], giveback: [], censored: 0 };
  // MANAGED-EXIT variant: same golden-cross entry, but exit on trailing stop / TP / hard stop /
  // time stop (death cross + series-end as backstops). Tests "capture the peak, don't give it back".
  const MG = { ret: [], hold: [], reason: {}, trades: [] };   // trades: {entryMs, exitMs, ret} for the closed-trade equity curve

  // score one coin's daily series: tally golden crosses, per-threshold pops + days-to-pop,
  // and the ambient baseline (every eligible day as a pseudo-entry). Mutates the accumulators above.
  function scoreSeries(c, s) {
    const price = s.map((d) => d.p);
    const fast = sma(price, FAST);
    const slow = sma(price, SLOW);
    const volAvg = VOLMULT > 0 ? sma(s.map((d) => d.v || 0), VOLWIN) : null;   // trailing avg volume for the surge test
    const end = s.length;
    let lastCross = -Infinity;   // index of the previous RAW golden cross (for the freshness filter)
    for (let i = SLOW; i < end - 1; i++) {
      if (fast[i - 1] == null || slow[i - 1] == null || fast[i] == null || slow[i] == null) continue;
      const entry = price[i];
      if (!(entry > 0)) continue;

      // ambient base rate: treat EVERY eligible day as a pseudo-entry
      const capBase = Math.min(i + WAIT, end - 1);
      baseDays++;
      for (const thr of POPS) {
        for (let j = i + 1; j <= capBase; j++) { if (price[j] >= entry * (1 + thr / 100)) { baseN[thr]++; break; } }
      }

      // golden cross: fast strictly below slow yesterday, strictly above today
      if (!(fast[i - 1] < slow[i - 1] && fast[i] > slow[i])) continue;
      rawCrosses++;
      const daysSinceLast = i - lastCross;   // measured on RAW crosses, before any filter
      lastCross = i;

      // ENTRY-QUALITY FILTERS — a cross must clear every ENABLED gate to be taken
      if (SLOPE > 0 && !(slow[i - SLOPE] != null && slow[i] > slow[i - SLOPE])) continue;         // 200-SMA must be rising
      if (VOLMULT > 0 && !(volAvg[i] > 0 && (s[i].v || 0) >= VOLMULT * volAvg[i])) continue;       // volume EXPANSION (relative to self) on the cross day
      if (MINVOLUSD > 0 && !((s[i].v || 0) >= MINVOLUSD)) continue;                                 // absolute liquidity floor — actual executable depth
      if (BTCGATE && !btcBull.get(Math.floor(s[i].t / 86400000))) continue;                         // MACRO KILL SWITCH — only take crosses while BTC 50/200 is bull
      if (FRESH > 0 && daysSinceLast < FRESH) continue;                                            // not a fresh regime shift

      crosses++;
      perCoinCrosses.push({ sym: c.sym || c.id, day: new Date(s[i].t).toISOString().slice(0, 10) });
      const cap = Math.min(i + WAIT, end - 1);
      for (const thr of POPS) {
        for (let j = i + 1; j <= cap; j++) {
          if (price[j] >= entry * (1 + thr / 100)) { crossN[thr]++; crossTTP[thr].push(j - i); break; }
        }
      }

      // round-trip: hold until the NEXT death cross (50 crossing back below 200). If none by
      // series end, the trade is still open (censored) — exit marked at the last bar.
      let dx = end - 1, open = true;
      for (let j = i + 1; j < end; j++) { if (fast[j - 1] > slow[j - 1] && fast[j] < slow[j]) { dx = j; open = false; break; } }
      let peak = entry, peakIdx = i;
      for (let j = i + 1; j <= dx; j++) { const hi = s[j].hi || price[j]; if (hi > peak) { peak = hi; peakIdx = j; } }
      const peakPct = (peak / entry - 1) * 100;
      const exitPct = (price[dx] / entry - 1) * 100;   // death-cross exit, close-to-close
      RT.trade.push(exitPct);
      RT.peak.push(peakPct);
      RT.daysToPeak.push(peakIdx - i);
      RT.hold.push(dx - i);
      RT.giveback.push(peakPct - exitPct);   // how much of the peak advance the death-cross exit gave back
      if (open) RT.censored++;

      // MANAGED EXIT: walk the same trade day-by-day on OHLC. Conservative intrabar ordering —
      // stops are checked before take-profit, so a bar that could hit both is scored as the stop.
      let run = s[i].hi || entry;   // running peak (intraday highs), seeds at the entry-day high
      let mret = null, mhold = 0, reason = 'open', exitIdx = end - 1, mexit = price[end - 1];
      for (let j = i + 1; j < end; j++) {
        const hi = s[j].hi ?? price[j], lo = s[j].lo ?? price[j], cl = price[j];
        if (STOP > 0 && lo <= entry * (1 - STOP / 100)) { mret = -STOP; mhold = j - i; reason = 'stop'; exitIdx = j; mexit = entry * (1 - STOP / 100); break; }
        if (TRAIL > 0 && lo <= run * (1 - TRAIL / 100)) { mret = (run * (1 - TRAIL / 100) / entry - 1) * 100; mhold = j - i; reason = 'trail'; exitIdx = j; mexit = run * (1 - TRAIL / 100); break; }
        if (TP > 0 && hi >= entry * (1 + TP / 100)) { mret = TP; mhold = j - i; reason = 'tp'; exitIdx = j; mexit = entry * (1 + TP / 100); break; }
        if (hi > run) run = hi;   // ratchet the peak up only after this bar's stop/TP checks
        if (TSTOP > 0 && j - i >= TSTOP) { mret = (cl / entry - 1) * 100; mhold = j - i; reason = 'time'; exitIdx = j; mexit = cl; break; }
        if (fast[j - 1] > slow[j - 1] && fast[j] < slow[j]) { mret = (cl / entry - 1) * 100; mhold = j - i; reason = 'death'; exitIdx = j; mexit = cl; break; }
      }
      if (mret == null) { mret = (price[end - 1] / entry - 1) * 100; mhold = end - 1 - i; reason = 'open'; exitIdx = end - 1; mexit = price[end - 1]; }
      MG.ret.push(mret); MG.hold.push(mhold); MG.reason[reason] = (MG.reason[reason] || 0) + 1;
      // read-only per-trade evidence record (does NOT affect any stat/verdict above)
      MG.trades.push({
        symbol: c.sym || c.id, venue: c.venue || SOURCE, entryDate: new Date(s[i].t).toISOString().slice(0, 10),
        entryMs: s[i].t, exitMs: s[exitIdx].t, entryPrice: entry, exitPrice: mexit,
        volMultiple: (volAvg && volAvg[i] > 0) ? Number((s[i].v / volAvg[i]).toFixed(2)) : null, turnoverUsd: Math.round(s[i].v || 0),
        exitReason: reason, holdDays: mhold, grossPct: Number(mret.toFixed(3)),
        costPct: Number((2 * FEE * 100).toFixed(3)), netPct: Number((mret - 2 * FEE * 100).toFixed(3)), ret: mret,
      });
    }
  }

  for (const c of coins) {
    if (SOURCE === 'backfill') {
      // local DB — read + resample straight off disk, no cache, no network
      const s = backfillDaily(c.file);
      if (!s) { tooShort++; continue; }
      cached++;
      if (s.length < SLOW + 3) { tooShort++; continue; }
      coinsUsed++;
      scoreSeries(c, s);
      continue;
    }
    const cf = path.join(CACHE, `${c.id}.json`);
    let s = null;
    if (fs.existsSync(cf)) { try { s = JSON.parse(fs.readFileSync(cf, 'utf8')); cached++; } catch { /**/ } }
    if (!s) {
      if (SOURCE === 'multi') {
        s = await venueDaily(c.venue, c.ref);
        await sleep(180);   // Gate/MEXC/Binance all tolerate this; keeps a ~3k pull to ~10 min
      } else if (SOURCE === 'binance') {
        const pair = bnMap.get(c.sym);
        if (!pair) { noPair++; continue; }   // not listed on Binance as a USDT pair — skip (mostly stablecoins / cex tokens)
        s = await binanceDaily(pair);
        await sleep(250);   // Binance klines is weight 2; 250ms keeps us well under 6000 weight/min
      } else {
        s = await coingeckoDaily(c.id);
        await sleep(2200);
      }
      if (s) { fs.writeFileSync(cf, JSON.stringify(s)); fetched++; }
    }
    if (!s) continue;
    if (s.length < SLOW + 3) { tooShort++; continue; }   // not enough history for the slow SMA + a forward day
    coinsUsed++;
    scoreSeries(c, s);
  }

  const filterDesc = [SLOPE > 0 ? `slope>${SLOPE}d` : null, VOLMULT > 0 ? `vol>=${VOLMULT}x${VOLWIN}d` : null, MINVOLUSD > 0 ? `minVol$${(MINVOLUSD / 1e3).toFixed(0)}k` : null, BTCGATE ? 'BTC-regime' : null, FRESH > 0 ? `fresh>=${FRESH}d` : null].filter(Boolean).join(' + ') || 'none';
  console.log(`  cache: ${cached} hit, ${fetched} fetched | usable coins: ${coinsUsed} | too-short (<${SLOW + 3}d): ${tooShort}${SOURCE === 'binance' ? ` | no Binance pair: ${noPair}` : ''}`);
  console.log(`  entry filters: ${filterDesc}`);
  console.log(`  golden-cross events: ${rawCrosses} raw -> ${crosses} passed filters (${rawCrosses ? (100 * crosses / rawCrosses).toFixed(0) : 0}% kept)  |  baseline pseudo-entries: ${baseDays}\n`);

  if (!crosses) {
    console.log(`  NO golden crosses found. Either history is too short (need >${SLOW} daily points) or the SMAs never crossed up in-window.`);
    console.log(`  Try shorter SMAs, e.g. --fast 20 --slow 50.\n`);
    return;
  }

  console.log(`  ${'pop >='.padEnd(8)} ${'popped'.padStart(11)} ${'never'.padStart(8)} ${'rate'.padStart(6)} ${'edge'.padStart(7)} ${'med'.padStart(5)} ${'p75'.padStart(5)} ${'p90'.padStart(5)} ${'p95'.padStart(5)}`);
  for (const thr of POPS) {
    const cr = 100 * crossN[thr] / crosses;
    const br = baseDays ? 100 * baseN[thr] / baseDays : 0;
    const ttp = crossTTP[thr];
    const never = crosses - crossN[thr];
    const dd = (q) => { const v = pct(ttp, q); return v == null ? '—' : v + 'd'; };
    console.log(`  ${('+' + thr + '%').padEnd(8)} ${`${crossN[thr]}/${crosses}`.padStart(11)} ${String(never).padStart(8)} ${(cr.toFixed(0) + '%').padStart(6)} ${((cr - br >= 0 ? '+' : '') + (cr - br).toFixed(1)).padStart(7)} ${(median(ttp) == null ? '—' : median(ttp) + 'd').padStart(5)} ${dd(0.75).padStart(5)} ${dd(0.90).padStart(5)} ${dd(0.95).padStart(5)}`);
  }

  // days-to-pop distribution per threshold: adaptive buckets out to the full WAIT window,
  // with the cumulative % so you can read "X% of the pops had happened by day D", plus the
  // tail — how many crosses NEVER reached the threshold inside the window at all.
  const edges = [3, 7, 14, 30, 45, 60, 90, 120, 180].filter((e) => e < WAIT).concat(WAIT);
  for (const thr of POPS) {
    const ttp = crossTTP[thr];
    if (!ttp.length) continue;
    const never = crosses - crossN[thr];
    const counts = edges.map(() => 0);
    for (const d of ttp) for (let k = 0; k < edges.length; k++) { if (d <= edges[k]) { counts[k]++; break; } }
    const max = Math.max(1, ...counts);
    console.log(`\n  time-to-first +${thr}% pop  (${ttp.length} reached it; ${never} of ${crosses} never did within ${WAIT}d):`);
    let cum = 0, lo = 1;
    for (let k = 0; k < edges.length; k++) {
      cum += counts[k];
      const label = `${lo}-${edges[k]}d`;
      console.log(`    ${label.padEnd(10)} ${String(counts[k]).padStart(5)}  ${(100 * cum / crosses).toFixed(0).padStart(3)}% cum  ${'#'.repeat(Math.round(38 * counts[k] / max))}`);
      lo = edges[k] + 1;
    }
  }

  // ---- ROUND-TRIP: golden cross -> death cross, the way the strategy is actually traded ----
  if (RT.trade.length) {
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const win = 100 * RT.trade.filter((r) => r > 0).length / RT.trade.length;
    console.log(`\n  === ROUND-TRIP: hold golden cross -> next death cross (${RT.trade.length} trades, ${RT.censored} still open at series end) ===`);
    console.log(`  ${'metric'.padEnd(22)} ${'median'.padStart(8)} ${'mean'.padStart(8)} ${'p75'.padStart(8)} ${'p90'.padStart(8)}`);
    const row = (label, arr, unit) => console.log(`  ${label.padEnd(22)} ${((median(arr) >= 0 ? '+' : '') + median(arr).toFixed(1) + unit).padStart(8)} ${((mean(arr) >= 0 ? '+' : '') + mean(arr).toFixed(1) + unit).padStart(8)} ${((pct(arr, 0.75) >= 0 ? '+' : '') + pct(arr, 0.75).toFixed(1) + unit).padStart(8)} ${((pct(arr, 0.90) >= 0 ? '+' : '') + pct(arr, 0.90).toFixed(1) + unit).padStart(8)}`);
    row('PEAK gain (how high)', RT.peak, '%');
    row('exit gain (at death X)', RT.trade, '%');
    row('giveback (peak->exit)', RT.giveback, '%');
    console.log(`  ${'days to peak'.padEnd(22)} ${(median(RT.daysToPeak) + 'd').padStart(8)} ${(mean(RT.daysToPeak).toFixed(0) + 'd').padStart(8)} ${(pct(RT.daysToPeak, 0.75) + 'd').padStart(8)} ${(pct(RT.daysToPeak, 0.90) + 'd').padStart(8)}`);
    console.log(`  ${'hold days (G->death)'.padEnd(22)} ${(median(RT.hold) + 'd').padStart(8)} ${(mean(RT.hold).toFixed(0) + 'd').padStart(8)} ${(pct(RT.hold, 0.75) + 'd').padStart(8)} ${(pct(RT.hold, 0.90) + 'd').padStart(8)}`);
    console.log(`  win rate (exit > entry): ${win.toFixed(0)}%  |  PEAK = max intraday high between the crosses; exit = close at the death cross.`);
    console.log(`  The gap between PEAK and exit gain IS the lag/giveback — how much of the run the death-cross rule hands back.\n`);
  }

  // ---- MANAGED EXIT: golden cross entry + a fast exit (this is the fast-exit variant) ----
  if (MG.ret.length) {
    const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const win = 100 * MG.ret.filter((r) => r > 0).length / MG.ret.length;
    const legs = [TRAIL > 0 ? `trail ${TRAIL}%` : null, TP > 0 ? `tp +${TP}%` : null, STOP > 0 ? `stop -${STOP}%` : null, TSTOP > 0 ? `time ${TSTOP}d` : null, 'death X', 'series-end'].filter(Boolean).join(' / ');
    const rtMed = median(RT.trade), rtMean = mean(RT.trade);
    console.log(`  === MANAGED EXIT (fast-exit variant) — entry: golden cross | exit on: ${legs} ===`);
    console.log(`  realized return   median ${(median(MG.ret) >= 0 ? '+' : '') + median(MG.ret).toFixed(1)}%   mean ${(mean(MG.ret) >= 0 ? '+' : '') + mean(MG.ret).toFixed(1)}%   p75 ${(pct(MG.ret, 0.75) >= 0 ? '+' : '') + pct(MG.ret, 0.75).toFixed(1)}%   p90 ${(pct(MG.ret, 0.9) >= 0 ? '+' : '') + pct(MG.ret, 0.9).toFixed(1)}%`);
    console.log(`  win rate ${win.toFixed(0)}%   |   median hold ${median(MG.hold)}d (vs ${median(RT.hold)}d for death-cross)`);
    const rn = Object.entries(MG.reason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(100 * v / MG.ret.length).toFixed(0)}%`).join('  ');
    console.log(`  exit reason mix: ${rn}`);
    console.log(`  vs DEATH-CROSS exit: median ${(rtMed >= 0 ? '+' : '') + rtMed.toFixed(1)}% -> ${(median(MG.ret) >= 0 ? '+' : '') + median(MG.ret).toFixed(1)}%   |   mean ${(rtMean >= 0 ? '+' : '') + rtMean.toFixed(1)}% -> ${(mean(MG.ret) >= 0 ? '+' : '') + mean(MG.ret).toFixed(1)}%   (raw price, no fees)`);

    // CLOSED-TRADE EQUITY: chain the trades in EXIT order, each sized 1/CONC of equity, fee on both sides.
    // Not a full concurrency model — a closed-trade curve — but its max-DD captures how losers CLUSTER
    // (which is exactly what the BTC-regime gate is meant to thin out).
    const tr = [...MG.trades].sort((a, b) => a.exitMs - b.exitMs);
    let eq = 1, peak = 1, dd = 0;
    for (const t of tr) { eq *= (1 + ((t.ret / 100) - 2 * FEE) / CONC); peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak); }
    console.log(`  closed-trade equity (1/${CONC} sized, ${(FEE * 200).toFixed(1)}% round-trip fee): total ${((eq - 1) * 100 >= 0 ? '+' : '') + ((eq - 1) * 100).toFixed(1)}%   max DD -${(dd * 100).toFixed(1)}%   (n=${tr.length})`);
    console.log(`  ${BTCGATE ? 'BTC-REGIME GATE ON — compare N / median / win / maxDD to the same run without --btc-regime.' : 'Run again with --btc-regime to gate these entries by the BTC 50/200 macro kill switch.'}\n`);
  }

  console.log(`  rate = share of crosses that reached the threshold within ${WAIT} days. never = the rest (censored — may pop later).`);
  console.log(`  med/p75/p90/p95 = days-to-first-tag AMONG those that reached it (ignores the never-hit tail).`);
  console.log(`  'X% cum' = share of ALL crosses (incl. never-hit) that had popped by the end of that bucket.`);
  console.log(`  cross rate = share of golden-cross events that closed >= threshold within ${WAIT} days.`);
  console.log(`  baseline   = same, but from EVERY eligible day (ambient pop-rate). edge = cross rate - baseline.`);
  console.log(`  Positive edge = the golden cross beats a coin-flip day; edge near/below 0 = the cross tells you nothing.`);
  console.log(`  CAVEAT: survivorship-biased OPTIMISTIC (today's coins). Costs (~1-3%/side by mcap) NOT subtracted — a +2% pop is inside cost.`);
  console.log(`  GOLDEN CROSS VERDICT ${new Date().toISOString()} coins=${coinsUsed} crosses=${crosses} fast=${FAST} slow=${SLOW} wait=${WAIT}\n`);

  if (EMIT_TRADES) {
    fs.writeFileSync(EMIT_TRADES, MG.trades.map((t) => JSON.stringify(t)).join('\n') + '\n');
    console.log(`  [emit-trades] wrote ${MG.trades.length} trade records → ${EMIT_TRADES}\n`);
  }
})();
