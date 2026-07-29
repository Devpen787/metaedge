#!/usr/bin/env node
/**
 * REGIME FILTER BACKTEST — does the daily 50/200 golden-cross regime, used as a RISK
 * OVERLAY (not an entry signal), reduce the drawdown of a momentum book?
 *
 * HONEST FRAMING (read this first):
 *  - This is NOT a claim that the momentum signal has alpha. momentum_backtest.mjs graded
 *    the signal as "no edge that beats baseline after costs", and practice_book.mjs's own
 *    header says its engines never passed the operating-model gate and its PnL is not a
 *    target. A regime filter's job is orthogonal: cut exposure to bad environments. So the
 *    ONLY claim tested here is "does the 50/200 overlay lower MaxDD / raise risk-adjusted
 *    return?" — a property of the FILTER, reported as such, not validation of momentum.
 *  - The base book: a daily-scored, weekly-rebalanced, top-K equal-weight LONG momentum
 *    portfolio using momentum_backtest.mjs's exact score (minus its turnover term — the
 *    multi-cache has no mcap; both filtered and unfiltered use the identical base signal,
 *    so the filter's MARGINAL effect is unaffected). Liquidity floor keeps it tradeable.
 *  - Data: the daily multi-exchange cache from golden_cross_backtest.mjs
 *    (data/market/momentum/gccache-multi/*.json). Survivorship-biased optimistic. Raw price,
 *    a per-rebalance turnover fee is charged. Spot long only.
 *
 * Conditions compared:
 *   1. UNFILTERED           — always in the market, hold top-K momentum every week.
 *   2. BTC REGIME (global)  — a kill switch: only hold when BTC's 50/200 is bull, else cash.
 *   3. PER-ASSET REGIME     — only hold a name whose OWN 50/200 is bull (name-level gate).
 *
 * Bull regime = close > SMA200 AND SMA50 > SMA200. Bear/chop = anything else.
 *
 * Usage: node scripts/regime_filter_backtest.mjs [--k 10] [--hold 7] [--min-vol-usd 500000]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SOURCE = flag('source', 'backfill');       // backfill (clean 638-coin Binance+Coinbase DB) | multi (dirty 2900-coin long tail)
const CACHE = path.join(process.cwd(), 'data', 'market', 'momentum', 'gccache-multi');
const MARKET = path.join(process.cwd(), 'data', 'market');
const K = Number(flag('k', '10'));               // names held (equal weight)
const HOLD = Number(flag('hold', '7'));          // bars held / rebalance cadence (daily bars ~ days)
const MINVOLUSD = Number(flag('min-vol-usd', '500000'));  // liquidity floor so the book is executable
const CAP = Number(flag('cap', '0.5'));          // winsorize per-name weekly return to +/-CAP (models un-fillable illiquid spikes; same cap across all conditions)
const FAST = 50, SLOW = 200;
const FEE = 0.002;                                // per side; charged on turnover each rebalance

const sma = (a, w, i) => { if (i < w - 1) return null; let s = 0; for (let j = i - w + 1; j <= i; j++) s += a[j]; return s / w; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const maxDD = (eq) => { let peak = -Infinity, dd = 0; for (const e of eq) { peak = Math.max(peak, e); dd = Math.max(dd, 1 - e / peak); } return dd; };

// momentum_backtest.mjs score, minus the turnover term (no mcap in this cache)
function momoScore(p, i) {
  if (i < 30 || !(p[i] > 0) || !(p[i - 1] > 0) || !(p[i - 7] > 0) || !(p[i - 30] > 0)) return null;
  const h24 = (p[i] / p[i - 1] - 1) * 100, d7 = (p[i] / p[i - 7] - 1) * 100, d30 = (p[i] / p[i - 30] - 1) * 100;
  const accel = h24 - d7 / 7;
  let s = 0;
  s += Math.min(25, Math.max(0, h24) * 1.5);
  s += Math.min(20, Math.max(0, accel) * 1.5);
  s += (d7 > 5 && d7 < 80) ? 15 : 0;
  if (d7 > 120) s -= Math.min(25, (d7 - 120) / 10);
  if (d30 > 300) s -= 15;
  return s;
}
const isBull = (close, i) => { const f = sma(close, FAST, i), s = sma(close, SLOW, i); return f != null && s != null && close[i] > s && f > s; };

// resample an hourly backfill jsonl (data/market/backfill-SYM-1h.jsonl) to a daily series
function backfillDaily(file) {
  let lines; try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { return null; }
  const byDay = new Map();
  for (const l of lines) {
    if (!l) continue; let r; try { r = JSON.parse(l); } catch { continue; }
    const c = Number(r.c); if (!(c > 0)) continue;
    const day = Math.floor(r.t / 86400000); const prev = byDay.get(day);
    byDay.set(day, { t: r.t, p: c, v: (prev ? prev.v : 0) + (Number(r.qv) || 0) });
  }
  const out = [...byDay.values()].sort((a, b) => a.t - b.t);
  return out.length > SLOW ? out : null;
}
// enumerate {sym, series} for the chosen source
function* loadSource() {
  if (SOURCE === 'multi') {
    for (const f of fs.readdirSync(CACHE).filter((f) => f.endsWith('.json'))) {
      let s; try { s = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
      if (Array.isArray(s)) yield { sym: f.slice(0, -5), series: s };
    }
  } else {
    for (const f of fs.readdirSync(MARKET).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f))) {
      const s = backfillDaily(path.join(MARKET, f));
      if (s) yield { sym: f.slice('backfill-'.length, -'-1h.jsonl'.length), series: s };
    }
  }
}

// ---- load into aligned per-coin series keyed by UTC day number ----
const coins = new Map();   // sym -> { day:[], p:[], v:[], idxByDay:Map }
let btc = null;
for (const { sym, series: s } of loadSource()) {
  if (!Array.isArray(s) || s.length < SLOW + HOLD + 2) continue;
  const day = s.map((d) => Math.floor(d.t / 86400000));
  const rec = { day, p: s.map((d) => d.p), v: s.map((d) => d.v || 0), idxByDay: new Map(day.map((d, i) => [d, i])) };
  coins.set(sym, rec);
  if (sym === 'BTC') btc = rec;
}
if (!btc) { console.error(`No BTC series in source=${SOURCE} — needed for the global regime clock.`); process.exit(1); }

// master timeline = BTC's days; rebalance every HOLD bars once BTC has 200d of history
const rebalIdx = [];
for (let r = SLOW; r + HOLD < btc.day.length; r += HOLD) rebalIdx.push(r);

// books share the base signal; each carries its own equity + held-set + trade tally.
// The MARKET books (equal-weight ALL eligible liquid names, no momentum selection) are the
// non-degenerate reference — they isolate the regime filter's pure risk effect on plain beta.
const mk = () => ({ ret: [], eq: [1], held: new Set(), trades: 0, inMkt: 0 });
const books = { momo: mk(), momo_btc: mk(), momo_perAsset: mk(), market: mk(), market_btc: mk() };
const btcHold = { eq: [1] };   // BTC buy-and-hold reference over the same rebalance clock

for (const r of rebalIdx) {
  const day = btc.day[r];
  const btcBull = isBull(btc.p, r);

  // candidates: coins present at this day with >=30d history, room to hold, and liquidity
  const cand = [];
  for (const [sym, c] of coins) {
    const i = c.idxByDay.get(day);
    if (i == null || i < 30 || i + HOLD >= c.p.length) continue;
    if (!(c.v[i] >= MINVOLUSD)) continue;
    const sc = momoScore(c.p, i);
    if (sc == null) continue;
    let fwd = c.p[i + HOLD] / c.p[i] - 1;   // this week's realized return for the name
    if (!Number.isFinite(fwd)) continue;
    fwd = Math.max(-CAP, Math.min(CAP, fwd));   // winsorize: a real book can't capture an un-fillable illiquid spike
    if (!Number.isFinite(fwd)) continue;
    cand.push({ sym, sc, fwd, bull: i >= SLOW ? isBull(c.p, i) : false });
  }
  if (!cand.length) { for (const b of Object.values(books)) { b.ret.push(0); b.eq.push(b.eq[b.eq.length - 1]); } continue; }
  cand.sort((a, b) => b.sc - a.sc);

  // pick the held basket for each condition, settle its weekly return net of turnover fees
  const settle = (book, basket, inMarket) => {
    let gross = 0, nextHeld = new Set();
    if (basket.length) { for (const x of basket) { gross += x.fwd; nextHeld.add(x.sym); } gross /= basket.length; }
    // turnover = names entered/exited vs last week; each changed name pays FEE in + FEE out
    let changed = 0; for (const s of nextHeld) if (!book.held.has(s)) changed++;
    for (const s of book.held) if (!nextHeld.has(s)) changed++;
    const turnoverFrac = basket.length ? changed / (2 * basket.length) : (book.held.size ? 1 : 0);
    const feeDrag = 2 * FEE * turnoverFrac;
    const net = gross - feeDrag;
    book.trades += [...nextHeld].filter((s) => !book.held.has(s)).length;
    book.held = nextHeld;
    book.ret.push(net);
    book.eq.push(book.eq[book.eq.length - 1] * (1 + net));
    if (inMarket) book.inMkt++;
  };

  settle(books.momo, cand.slice(0, K), true);
  settle(books.momo_btc, btcBull ? cand.slice(0, K) : [], btcBull);              // global kill switch
  settle(books.momo_perAsset, cand.filter((x) => x.bull).slice(0, K), true);      // name-level gate
  settle(books.market, cand, true);                                              // equal-weight all eligible (beta reference)
  settle(books.market_btc, btcBull ? cand : [], btcBull);                        // beta + BTC kill switch
  // BTC buy-and-hold over the same period (fwd already winsorized upstream? no — compute raw here)
  const bf = btc.p[r + HOLD] / btc.p[r] - 1;
  btcHold.eq.push(btcHold.eq[btcHold.eq.length - 1] * (1 + (Number.isFinite(bf) ? bf : 0)));
}

// ---- report ----
const periods = rebalIdx.length;
const annualize = Math.sqrt(365 / HOLD);   // ~52 for weekly
console.log(`\n=== REGIME FILTER BACKTEST — top-${K} weekly momentum, source=${SOURCE}, ${coins.size} coins, min 24h vol $${(MINVOLUSD / 1e3).toFixed(0)}k ===`);
console.log(`  base signal: momentum_backtest.mjs score (long only) | ${periods} rebalances (${HOLD}-bar) | fee ${FEE * 100}%/side on turnover | per-name weekly return winsorized to +/-${(CAP * 100).toFixed(0)}%`);
console.log(`  regime = close>SMA200 AND SMA50>SMA200. RISK OVERLAY test — not a claim of momentum alpha.\n`);
console.log(`  ${'condition'.padEnd(20)} ${'totalRet'.padStart(9)} ${'maxDD'.padStart(7)} ${'Sharpe'.padStart(7)} ${'Sortino'.padStart(8)} ${'exposure'.padStart(9)} ${'trades'.padStart(7)}`);
for (const [name, b] of Object.entries(books)) {
  const R = b.ret;
  const tot = (b.eq[b.eq.length - 1] - 1) * 100;
  const dd = maxDD(b.eq) * 100;
  const sh = std(R) ? mean(R) / std(R) * annualize : 0;
  const downs = R.filter((x) => x < 0);
  const dstd = std(downs.length ? downs : [0]);
  const so = dstd ? mean(R) / dstd * annualize : 0;
  const exp = 100 * b.inMkt / periods;
  console.log(`  ${name.padEnd(20)} ${((tot >= 0 ? '+' : '') + tot.toFixed(1) + '%').padStart(9)} ${('-' + dd.toFixed(1) + '%').padStart(7)} ${sh.toFixed(2).padStart(7)} ${so.toFixed(2).padStart(8)} ${(exp.toFixed(0) + '%').padStart(9)} ${String(b.trades).padStart(7)}`);
}
const bhTot = (btcHold.eq[btcHold.eq.length - 1] - 1) * 100, bhDD = maxDD(btcHold.eq) * 100;
console.log(`  ${'BTC buy&hold (ref)'.padEnd(20)} ${((bhTot >= 0 ? '+' : '') + bhTot.toFixed(1) + '%').padStart(9)} ${('-' + bhDD.toFixed(1) + '%').padStart(7)} ${''.padStart(7)} ${''.padStart(8)} ${'100%'.padStart(9)} ${'-'.padStart(7)}`);
console.log(`\n  totalRet/maxDD net of turnover fees. Sharpe/Sortino annualized (x${annualize.toFixed(1)}). exposure = % of weeks holding (not in cash).`);
console.log(`  READ: compare each book to its regime-filtered twin (momo vs momo_btc; market vs market_btc). If the filter cuts maxDD and lifts Sharpe/Sortino, the 50/200 overlay works as a risk kill switch.`);
console.log(`  CAVEAT: survivorship-biased optimistic; base momentum signal is UNVALIDATED (this measures the filter's risk effect only); spot-long; raw ex-fee slippage.\n`);
