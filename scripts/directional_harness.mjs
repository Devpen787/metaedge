#!/usr/bin/env node
/**
 * DIRECTIONAL HARNESS — the shared forward-paper engine for momentum/memecoin/
 * stocks/perps/fx-style lanes (entry + stop/target/hold, as opposed to Kalshi's
 * binary-payout mechanic, which has its own bespoke harness).
 *
 * ADAPTER INTERFACE (per lane): { discover(): candidates[], priceOf(symbols):
 * Map<symbol,price> }. Split deliberately: discovery scans a WIDE universe
 * (stocks: ~9,900 tickers, memecoin: hundreds of pools) which is too slow to
 * re-run every tick just to price a handful of already-open positions.
 * Tracking only needs a TARGETED lookup for the specific symbols still open —
 * a different, cheaper operation, not a full re-scan.
 *
 * DIRECTIONAL (long/short), not just long-only: a candidate may carry
 * `direction: 'short'` (perps fade-the-funding, FX counter-trend are both
 * real short signals). spinUp()/tick() size the stop and sign the return by
 * direction. This was a real gap fixed alongside adding the perp/FX adapters
 * — the original three adapters (momentum/memecoin/stocks) are all
 * implicitly long-only, so `direction` defaults to 'long' when a candidate
 * doesn't specify one, preserving their exact prior behavior.
 *
 * Uses a lightweight, trivially-persistable JSON position tracker (not the full
 * portfolio/ledger.mjs Map-based ledger — not cheaply serializable across
 * separate cron invocations, and this only ever holds one position per symbol,
 * so it doesn't need the ledger's multi-engine attribution machinery). Applies
 * the same real-cost discipline as everything else in this codebase: COST_RT
 * deducted on close — an earlier version shipped with an unused ledger import
 * standing in for real cost logic (zero-cost fills), caught before deploy.
 *
 * Called by edge_watcher.mjs's spinUp(lane) on a NEW FLAGS>0 flip, and by its
 * own tick() on a regular cadence (marks every open position across every
 * lane with a built adapter: hard stop, time-stop, records the close).
 *
 * HONEST SCOPE: all 5 directional-kind lanes now have a built adapter (crypto
 * momentum, memecoin pops, stocks momentum, perps funding-fade, FX trend).
 * Each adapter here was proven with a synthetic stop/time-stop injection test
 * before deploy, not assumed to work — the perp/FX adapters were specifically
 * tested with a synthetic SHORT stop-out (not just long) since that's the new
 * code path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fxUniverseSymbols } from './lib/fx_universe.mjs';
import { nextLongStop, nextShortStop } from './lib/trailing_stop.mjs';

// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md. This
// file's own header comment already states the adapter interface, scope, and
// honest gaps in prose; this const is the machine-readable mirror.
export const LEGIBILITY = {
  doing: 'Shared forward-paper engine (entry + hard-stop/time-stop/hold, long or short, cooldown-gated re-entry) for directional-mechanic lanes, called on a NEW FLAGS flip (edge_watcher.mjs) and on a regular tick() that marks every open position.',
  notYet: [
    'Scaled exits are tick-granularity, not intrabar — a level crossed and reversed between two ticks is missed, an honest limitation of periodic snapshots vs practice_book.mjs\'s OHLC bars.',
    'No emergency/liquidation/custom-exit reasons beyond stop_hard/stop_trailed/time — this taxonomy grew from 2 to 3 close reasons plus a separate scale-out event log, matched to what this harness actually needs (Freqtrade\'s full ExitType enum has categories like LIQUIDATION that don\'t apply here — no leverage, no liquidation risk in these lanes yet).',
    'Perp/FX adapters were added for the FLAGS>0 auto-harness gap specifically — the underlying perp/fx graders themselves still don\'t clear their own FLAGS bar as of this writing (this is a real, standing gap between "the adapter can open positions" and "the grader has actually validated an edge to open positions FOR"), but the Perps adapter has now opened real forward-paper positions (a live spinUp() call while verifying Cluster 1d\'s cooldown guard found 2 real candidates — ACE long, XMR short — and opened both) — the adapter code path is proven live, not just synthetically.',
    'Cooldown/low-profit guard is portfolio-wide-Risk-OS-adjacent but per-symbol PER LANE — a symbol blocked in one lane (e.g. BTC blocked in Crypto momentum) is not blocked in another (e.g. BTC in Perps) — each lane\'s state.closed history is independent, by design (the mechanics and cost models differ per lane, a bad crypto-momentum trade on BTC says nothing about a perp-funding-fade trade on BTC).',
  ],
  why: [
    'discover()/priceOf() are deliberately split (not one function) because discovery scans a wide universe (stocks ~9,900 tickers, memecoin hundreds of pools) too slow to re-run every tick just to price a few open positions — an earlier single-function design made a position permanently untrackable once its score naturally fell below the discovery bar, caught via synthetic injection testing.',
    'Stop trails the best price observed since entry (scripts/lib/trailing_stop.mjs, step profile, ratchets one-directionally) rather than staying fixed at the entry-derived hard stop — "let a winner run and protect the gain as it goes," the real gap flagged in EXTERNAL_REPO_ADOPTION_CHECKLIST.md. This tick-level version only sees one price per tick (not intrabar OHLC like practice_book.mjs), so "peak" here means best-observed-across-ticks, a coarser but still real and ratchet-safe approximation.',
    'COST_RT=0.003 (0.3% round-trip) is applied explicitly on close because an earlier version imported portfolio/ledger.mjs but never called it, meaning zero-cost fills — caught before deploy, not after.',
    'Uses a lightweight JSON position tracker instead of the full portfolio/ledger.mjs Map-based ledger because this only ever holds one position per symbol per lane and needs to be trivially serializable across separate cron invocations — the ledger\'s multi-engine attribution machinery is unnecessary overhead here.',
    'direction defaults to \'long\' when a candidate omits it, specifically so the pre-existing momentum/memecoin/stocks adapters needed zero behavioral change when short support was added for perps/FX — confirmed with a synthetic injection test on a long position (stocks/AAPL, entry far below a trivially-crossed stop) alongside a new synthetic short-stop-out test (perps/BTC, entry set below the real live price so the short was genuinely underwater, confirming both the stop trigger AND the return-sign math for the new short code path).',
    'Scaled exits (SCALE_LEVELS: +4%->sell 33%, +8%->sell 33%, remainder rides the trail) fill at the TRIGGER price, not the (better) observed price, and each tranche pays its own COST_RT share — a real scaled exit is genuinely more transactions, not a free lunch. The reported retPct on a closed position is the BLENDED weighted-average return across every tranche, not just the last remaining slice — verified against a hand-calculated case (two tranches at +4%/+8%, final tranche at -5%) before trusting the live output.',
    'Cooldown (6h since ANY close) + low-profit guard (last 2 closes both losers -> blocked until performance improves) reuses state.closed directly rather than a new tracked structure — every close ever recorded for a symbol is already sitting right there, so no separate history log needed. Per EXTERNAL_REPO_ADOPTION_CHECKLIST.md: the Risk OS was portfolio-wide only (hard stop + time-stop per position), with a symbol that just stopped us out twice getting no cooldown and no deprioritization, free to re-enter on the very next spinUp().',
  ],
};

const DIR = path.join(process.cwd(), 'data', 'edgeops', 'directional_harness');
const STOP_PCT = 0.06, TIME_STOP_HOURS = 72, COST_RT = 0.003; // 0.3% RT, liquid crypto/stocks — matches confluence_search.mjs's assumption
// Laddered/scaled exits (Cluster 1b, same design as practice_book.mjs): sell
// a fixed fraction of the ORIGINAL position at each favorable-move trigger,
// direction-aware (works for shorts too), letting the remainder ride the
// trailing stop. Each tranche (partial or final) pays its own COST_RT share
// — a real scaled exit is genuinely more transactions, not a free lunch.
const SCALE_LEVELS = [
  { trigger: 0.04, fraction: 0.33 },
  { trigger: 0.08, fraction: 0.33 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(DIR, { recursive: true });

function ledgerFile(lane) { return path.join(DIR, `${lane.replace(/\W+/g, '_')}.json`); }
function loadLedgerState(lane) {
  const fp = ledgerFile(lane);
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8'));
  return { positions: {}, closed: [] };
}
function saveLedgerState(lane, s) { fs.writeFileSync(ledgerFile(lane), JSON.stringify(s, null, 1)); }
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ============================================================== crypto momentum
// Score identical to momentum_scout.mjs (copied, not reimplemented differently).
// Discovery bar 75 = momentum_grader's real flagged band, not the looser 60
// screening bar.
//
// BUG (pre-existing, found live 2026-07-21 while checking a separate but
// identical bug in perpAdapter — see its comment for the full story):
// priceOf() used to reuse the SAME volume/mcap-filtered momentumUniverse()
// as discover(). A coin that crashes below the $100k-volume/$1M-mcap floor
// after entry would silently vanish from priceOf() too, making the open
// position permanently untrackable — never marked, never stopped out. Fixed
// the same way as perpAdapter: priceOf() now uses momentumRawRows() (no
// liquidity filter); discover() applies the floor separately. One residual,
// honestly-stated limitation this does NOT fix: this only ever fetches ONE
// page of ~250 coins by market-cap rank — a coin that crashes far enough to
// fall OUT of the top 250 by market cap would still disappear from both
// functions, since neither call ever looks further than page 1. That's a
// real, different limitation (ranking-window size, not the liquidity floor)
// worth a real fix later if it ever bites in practice.
function momentumScore(c) {
  const h24 = N(c.price_change_percentage_24h_in_currency) || 0;
  const d7 = N(c.price_change_percentage_7d_in_currency) || 0;
  const d30 = N(c.price_change_percentage_30d_in_currency) || 0;
  const turnover = c.market_cap > 0 ? c.total_volume / c.market_cap : 0;
  const dailyPace7 = d7 / 7, accel = h24 - dailyPace7;
  let s = 0;
  s += Math.min(25, Math.max(0, h24) * 1.5);
  s += Math.min(20, Math.max(0, accel) * 1.5);
  s += Math.min(25, turnover * 60);
  s += (d7 > 5 && d7 < 80) ? 15 : 0;
  if (d7 > 120) s -= Math.min(25, (d7 - 120) / 10);
  if (d30 > 300) s -= 15;
  return Math.round(Math.max(0, s));
}
async function momentumRawRows() {
  const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d,30d', { headers: { 'User-Agent': 'MetaEdge/1.0' } });
  if (!r.ok) return [];
  const rows = await r.json();
  return rows.map((c) => ({ symbol: c.id, price: c.current_price, total_volume: c.total_volume, market_cap: c.market_cap, score: momentumScore(c) }));
}
async function momentumUniverse() {
  const all = await momentumRawRows();
  return all.filter((c) => c.total_volume >= 100000 && c.market_cap >= 1e6);   // DISCOVERY only, never pricing
}
const cryptoMomentumAdapter = {
  async discover() { const all = await momentumUniverse(); return all.filter((c) => c.score >= 75); },
  async priceOf() { const all = await momentumRawRows(); return new Map(all.map((c) => [c.symbol, c.price])); },   // UNFILTERED — see the bug note above momentumScore()
};

// =================================================================== memecoin
// Score identical to memecoin_grader.mjs's isCandidate()+score(). Discovery
// bar 60 = the grader's real flagged band. Pools are volatile/short-lived by
// nature; priceOf() re-scans the same new/trending sources (a delisted/rugged
// pool simply returns no price -> tick() leaves it open and retries, which is
// honest: we don't invent a price for a pool GeckoTerminal no longer serves).
const MEME_CHAINS = ['solana', 'base', 'eth', 'bsc'];
const GT = 'https://api.geckoterminal.com/api/v2';
function memeScore(a) {
  const v5 = N(a.volume_usd?.m5) || 0, liq = N(a.reserve_in_usd) || 0;
  const tx5 = a.transactions?.m5 || {};
  const buyers = N(tx5.buyers) || 0, sellers = N(tx5.sellers) || 0, buys = N(tx5.buys) || 0, sells = N(tx5.sells) || 0;
  const turnover = liq > 0 ? v5 / liq : 0;
  const volScore = Math.min(25, turnover * 100);
  const buyDom = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;
  const buyerAccel = (buyers + sellers) > 0 ? buyers / (buyers + sellers) : 0.5;
  const flowScore = Math.min(25, (buyDom * 0.5 + buyerAccel * 0.5) * 50 - 15);
  const liqScore = Math.min(20, Math.log10(Math.max(1, liq / 3000)) * 12);
  const chg5 = N(a.price_change_percentage?.m5) || 0;
  const extPenalty = chg5 > 60 ? Math.min(20, (chg5 - 60) / 10) : 0;
  return Math.max(0, Math.round(volScore + flowScore + liqScore + (15 - extPenalty)));
}
function memeIsCandidate(a, poolCreatedAt) {
  const liq = N(a.reserve_in_usd) || 0;
  const ageMin = poolCreatedAt ? (Date.now() - Date.parse(poolCreatedAt)) / 60000 : Infinity;
  const v5 = N(a.volume_usd?.m5) || 0;
  const buyers = N(a.transactions?.m5?.buyers) || 0;
  return liq >= 3000 && ageMin <= 45 && v5 >= 500 && buyers >= 1;
}
// MAX_PAGES=10: reuses the SAME verified depth ceiling as memecoin_scout.mjs
// (pages 1/5/10 confirmed to return 20 pools each there; page 15 errors — that
// finding lives in that file's history, not re-derived here). A page=1-only
// version of this exact function shipped first and silently lost open
// positions the moment their pool scrolled off the top-20 within a few
// minutes — caught by the synthetic stop-injection test, not assumed fixed.
async function memePoolsSnapshot() {
  const out = [];
  for (const chain of MEME_CHAINS) {
    for (const ep of ['new_pools', 'trending_pools']) {
      for (let page = 1; page <= 10; page++) {
        const r = await fetch(`${GT}/networks/${chain}/${ep}?page=${page}`, { headers: { Accept: 'application/json', 'User-Agent': 'MetaEdge/1.0' } });
        if (!r.ok) break;
        const j = await r.json();
        const got = j.data || [];
        if (!got.length) break;
        for (const p of got) {
          const a = p.attributes || {};
          if (!a.address || !N(a.base_token_price_usd)) continue;
          out.push({ symbol: `${chain}:${a.address}`, price: N(a.base_token_price_usd), attrs: a, createdAt: a.pool_created_at });
        }
        await sleep(1200);
      }
    }
  }
  return out;
}
const memecoinAdapter = {
  async discover() {
    const pools = await memePoolsSnapshot();
    return pools.filter((p) => memeIsCandidate(p.attrs, p.createdAt))
      .map((p) => ({ symbol: p.symbol, price: p.price, score: memeScore(p.attrs) }))
      .filter((c) => c.score >= 60);
  },
  async priceOf() { const pools = await memePoolsSnapshot(); return new Map(pools.map((p) => [p.symbol, p.price])); },
};

// ===================================================================== stocks
// Score identical to stock_scout.mjs / stock_scout_wide.mjs. Discovery bar 60
// = stock_grader's real flagged band. Universe is ~9,900 tickers (too slow to
// rescan every 30-min tick just to price open positions), so priceOf() does a
// TARGETED per-symbol Yahoo chart lookup instead of a full rotation pass —
// discover() reuses the existing screeners (fast, pre-filtered to movers,
// which is exactly what discovery wants) rather than the full SEC universe
// (that's stock_scout_wide's job, run on its own schedule; this only needs to
// notice today's movers, not re-derive the whole market every 15 minutes).
function stockScore({ chg1d, surge, chg52w }) {
  let s = 0;
  s += Math.min(25, Math.max(0, chg1d) * 3);
  s += Math.min(25, Math.max(0, surge - 1) * 12);
  s += (chg52w > -30 && chg52w < 150) ? 15 : 0;
  if (chg52w > 300) s -= 15;
  if (chg1d < -2) s -= 10;
  return Math.round(Math.max(0, s));
}
async function stockDiscoverUniverse() {
  const screeners = ['most_actives', 'day_gainers', 'small_cap_gainers', 'aggressive_small_caps'];
  const seen = new Set(), out = [];
  for (const sc of screeners) {
    const r = await fetch(`https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${sc}&count=100`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (!r.ok) continue;
    const j = await r.json();
    for (const q of j?.finance?.result?.[0]?.quotes || []) {
      if (!q.symbol || seen.has(q.symbol)) continue; seen.add(q.symbol);
      const price = N(q.regularMarketPrice), vol = N(q.regularMarketVolume);
      if (!(price > 0 && vol > 0) || !((price * vol) >= 1e6)) continue;
      const chg1d = N(q.regularMarketChangePercent) || 0;
      const avgVol = N(q.averageDailyVolume3Month) || 0;
      const surge = avgVol > 0 ? vol / avgVol : 0;
      const chg52w = N(q.fiftyTwoWeekChangePercent) || 0;
      out.push({ symbol: q.symbol, price, score: stockScore({ chg1d, surge, chg52w }) });
    }
    await sleep(600);
  }
  return out;
}
async function stockPriceOf(symbols) {
  const out = new Map();
  for (const sym of symbols) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }).catch(() => null);
    if (!r || !r.ok) { await sleep(300); continue; }
    const j = await r.json().catch(() => null);
    const cl = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    const px = Array.isArray(cl) ? cl[cl.length - 1] : null;
    if (px > 0) out.set(sym, px);
    await sleep(300);
  }
  return out;
}
const stocksAdapter = {
  async discover() { const all = await stockDiscoverUniverse(); return all.filter((c) => c.score >= 60); },
  async priceOf(symbols) { return stockPriceOf(symbols); },
};

// ====================================================================== perps
// Score + direction identical to perp_scout.mjs (contrarian-funding fade).
// Discovery bar 40 = perp_grader's real flagged ("40+ extreme") band, not the
// scout's looser screening threshold — same pattern as every other adapter
// here.
//
// BUG FOUND live in production (2026-07-21): priceOf() originally reused the
// SAME liquidity-filtered perpUniverse() as discover(). A real open position
// (ACE) lost enough open interest to drop below the OI floor after entry —
// price then fell ~20%, well past its stop — but priceOf() silently excluded
// it from every subsequent tick(), so it never got marked or closed. This is
// the EXACT bug class the file's own history already fixed for memecoin/
// stocks/fx (discover()/priceOf() split specifically so a position can't go
// permanently untrackable once its score/liquidity falls below the discovery
// bar) — cryptoMomentumAdapter has this same flaw and predates this session;
// perpAdapter replicated it instead of following the correct pattern already
// sitting in the same file. Fixed: priceOf() now uses perpRawCtx() (no
// liquidity filter) while discover() applies the floor via perpUniverse().
const ANN = 24 * 365 * 100;
function perpScore(fundingApr, dayVol) {
  let s = Math.min(45, Math.abs(fundingApr) / 3);
  s += Math.min(15, Math.log10(Math.max(1, dayVol / 1e6)) * 8);
  return Math.round(s);
}
async function perpRawCtx() {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
  if (!r.ok) return [];
  const j = await r.json();
  const meta = j[0]?.universe || [], ctx = j[1] || [];
  const out = [];
  for (let i = 0; i < meta.length; i++) {
    const c = ctx[i]; if (!c) continue;
    const price = N(c.markPx), funding = N(c.funding), oi = N(c.openInterest), dayVol = N(c.dayNtlVlm);
    if (!(price > 0) || funding == null) continue;
    const oiUsd = oi != null ? oi * price : null;
    const fundingApr = funding * ANN;
    out.push({ symbol: meta[i].name, price, dayVol, oiUsd, score: perpScore(fundingApr, dayVol), direction: funding < 0 ? 'long' : 'short' }); // fade the funding
  }
  return out;
}
async function perpUniverse() {
  const all = await perpRawCtx();
  return all.filter((c) => (c.dayVol >= 2e6) && (c.oiUsd != null && c.oiUsd >= 1e6));   // same VOL_FLOOR/OI_FLOOR as perp_scout.mjs — DISCOVERY only, never pricing
}
const perpAdapter = {
  async discover() { const all = await perpUniverse(); return all.filter((c) => c.score >= 40); },
  async priceOf() { const all = await perpRawCtx(); return new Map(all.map((c) => [c.symbol, c.price])); },   // UNFILTERED — a position that fell below the liquidity floor must still be priceable to close
};

// ======================================================================== fx
// Score + direction identical to fx_scout.mjs (trend-alignment). Discovery
// bar 40 = fx_grader's real flagged ("40+ strong") band. Universe is the
// SAME shared, live-derived, ISO-4217-filtered pair list fx_scout.mjs uses
// (scripts/lib/fx_universe.mjs) — imported, not duplicated, specifically so
// this adapter and the scout can never silently drift onto different
// universes. Cheap enough to fully rescan for discover(); priceOf() does a
// TARGETED per-pair lookup for open positions only, consistent with every
// other adapter's discover-wide/price-targeted split.
function fxScore(r5, r20, r60) {
  const aligned = Math.sign(r5) === Math.sign(r20) && r20 !== 0;
  let s = 0;
  if (aligned) { s += Math.min(30, Math.abs(r20) * 10); s += Math.min(15, Math.abs(r5) * 8); s += 10; }
  if (Math.abs(r60) > 15) s -= 10;
  return Math.round(Math.max(0, s));
}
async function fxChart(sym, range) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}=X?range=${range}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  const q = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  return Array.isArray(q) ? q.filter((x) => x != null) : null;
}
async function fxUniverse() {
  const pairs = await fxUniverseSymbols();
  const out = [];
  for (const sym of pairs) {
    const c = await fxChart(sym, '4mo');
    await sleep(600);
    if (!c || c.length < 65) continue;
    const px = c[c.length - 1];
    const r5 = (px / c[c.length - 6] - 1) * 100, r20 = (px / c[c.length - 21] - 1) * 100, r60 = (px / c[c.length - 61] - 1) * 100;
    out.push({ symbol: sym, price: px, score: fxScore(r5, r20, r60), direction: r20 >= 0 ? 'long' : 'short' });
  }
  return out;
}
const fxAdapter = {
  async discover() { const all = await fxUniverse(); return all.filter((c) => c.score >= 40); },
  async priceOf(symbols) {
    const out = new Map();
    for (const sym of symbols) {
      const c = await fxChart(sym, '5d');
      await sleep(600);
      if (c && c.length) out.set(sym, c[c.length - 1]);
    }
    return out;
  },
};

const ADAPTERS = {
  'Crypto momentum': cryptoMomentumAdapter,
  'Memecoin pops': memecoinAdapter,
  'Stocks momentum': stocksAdapter,
  'Perps (funding)': perpAdapter,
  'FX trend': fxAdapter,
};

// Per-symbol cooldown / performance-based deprioritization (Cluster 1d, per
// EXTERNAL_REPO_ADOPTION_CHECKLIST.md — Freqtrade's StoplossGuard/
// CooldownPeriod/LowProfitPairs protections). Risk OS here was portfolio-wide
// only (hard stop + time-stop per position) with NO per-symbol memory — a
// coin that just stopped us out twice got no cooldown, no deprioritization,
// and could re-enter on the very next spinUp(). Reuses state.closed (already
// persisted, per lane) rather than a new data structure — every close ever
// recorded for a symbol is already sitting right there.
const COOLDOWN_HOURS = 6;          // don't re-enter a symbol this soon after ANY close, regardless of reason
const LOW_PROFIT_LOOKBACK = 2;     // if the last N closes were all losers, skip re-entry until performance improves

function cooldownBlock(state, symbol) {
  const hist = (state.closed || []).filter((c) => c.symbol === symbol).sort((a, b) => b.closedAt - a.closedAt);
  if (!hist.length) return null;
  const hoursSince = (Date.now() - hist[0].closedAt) / 3600000;
  if (hoursSince < COOLDOWN_HOURS) return `cooldown: closed ${hoursSince.toFixed(1)}h ago (< ${COOLDOWN_HOURS}h)`;
  const recent = hist.slice(0, LOW_PROFIT_LOOKBACK);
  if (recent.length === LOW_PROFIT_LOOKBACK && recent.every((c) => c.retPct < 0)) return `low-profit guard: last ${LOW_PROFIT_LOOKBACK} closes all losers`;
  return null;
}

export async function spinUp(laneName) {
  const adapter = ADAPTERS[laneName];
  if (!adapter) return { opened: 0, note: `no live adapter built yet for "${laneName}" — needs one written + tested before auto-harness can act` };
  const state = loadLedgerState(laneName);
  const cands = await adapter.discover();
  let opened = 0;
  const blocked = [];
  for (const c of cands) {
    if (state.positions[c.symbol]) continue;               // already holding, don't pyramid
    const block = cooldownBlock(state, c.symbol);
    if (block) { blocked.push({ symbol: c.symbol, reason: block }); continue; }
    const direction = c.direction === 'short' ? 'short' : 'long';   // defaults to 'long' — preserves prior long-only adapters' exact behavior
    const stopPx = direction === 'long' ? c.price * (1 - STOP_PCT) : c.price * (1 + STOP_PCT);
    state.positions[c.symbol] = { entry: c.price, stopPx, direction, openedAt: Date.now(), score: c.score, extremePx: c.price, scaledFired: SCALE_LEVELS.map(() => false), weightedRetSum: 0, soldFraction: 0 };
    opened++;
  }
  saveLedgerState(laneName, state);
  return { opened, candidatesSeen: cands.length, blocked };
}

// Marks every open position across every lane with a built adapter: hard stop,
// time-stop, records the close. Call regularly (independent of new flips).
export async function tick() {
  for (const [lane, adapter] of Object.entries(ADAPTERS)) {
    const state = loadLedgerState(lane);
    const symbols = Object.keys(state.positions);
    if (!symbols.length) continue;
    const priceOf = await adapter.priceOf(symbols).catch(() => new Map());
    for (const sym of symbols) {
      const pos = state.positions[sym];
      const px = priceOf.get(sym);
      if (px == null) continue;                              // no price this tick (delisted/rugged/API miss) — leave open, retry next tick
      // trail the stop using the best price observed ACROSS TICKS since entry
      // (coarser than practice_book.mjs's intrabar-OHLC version — this only
      // ever sees one price per tick, not a high/low — but the same ratchet
      // guarantee holds: extremePx and stopPx are both monotonic).
      if (pos.extremePx == null) pos.extremePx = pos.entry;   // positions opened before this field existed — backfill once, doesn't reset progress
      if (pos.direction === 'short') {
        pos.extremePx = Math.min(pos.extremePx, px);
        pos.stopPx = nextShortStop(pos.entry, pos.extremePx, pos.stopPx);
      } else {
        pos.extremePx = Math.max(pos.extremePx, px);
        pos.stopPx = nextLongStop(pos.entry, pos.extremePx, pos.stopPx);
      }
      const dirSign = pos.direction === 'short' ? -1 : 1;

      // scaled exits: direction-aware favorable-move triggers, checked
      // against the same per-tick price used for everything else here (no
      // intrabar high/low available at this granularity, unlike
      // practice_book.mjs — a level crossed BETWEEN ticks and reversed
      // before the next tick will be missed, an honest limitation of
      // tick-granularity tracking, not hidden).
      if (pos.scaledFired == null) { pos.scaledFired = SCALE_LEVELS.map(() => false); pos.weightedRetSum = 0; pos.soldFraction = 0; }  // backfill for positions opened before this field existed
      for (let lvl = 0; lvl < SCALE_LEVELS.length; lvl++) {
        if (pos.scaledFired[lvl]) continue;
        const { trigger, fraction } = SCALE_LEVELS[lvl];
        const gainPct = dirSign * (px / pos.entry - 1);
        if (gainPct < trigger) continue;
        pos.scaledFired[lvl] = true;
        const scalePx = pos.entry * (1 + dirSign * trigger);          // fill at the trigger level, not the (better) current price — pessimistic
        const scaleRawRetPct = dirSign * (scalePx / pos.entry - 1) * 100;
        pos.weightedRetSum += fraction * (scaleRawRetPct - COST_RT * 100);   // this tranche pays its own exit cost
        pos.soldFraction += fraction;
        // Explicit audit-trail entry — previously a partial close here was
        // only inferable from the final closed record's scaledOutFraction,
        // unlike practice_book.mjs's separate scaleOuts[] log. Fixed for
        // consistency: every partial close is now independently queryable.
        if (!state.scaleOuts) state.scaleOuts = [];
        state.scaleOuts.push({ symbol: sym, direction: pos.direction, trigger, fraction, retPct: +(scaleRawRetPct - COST_RT * 100).toFixed(2), t: Date.now() });
      }

      const stopHit = pos.direction === 'short' ? px >= pos.stopPx : px <= pos.stopPx;
      const ageH = (Date.now() - pos.openedAt) / 3600000;
      let closeReason = null;
      const origStop = pos.direction === 'short' ? pos.entry * (1 + STOP_PCT) : pos.entry * (1 - STOP_PCT);
      const trailed = pos.direction === 'short' ? pos.stopPx < origStop - 1e-9 : pos.stopPx > origStop + 1e-9;
      // Exit-reason taxonomy (Cluster 1c): distinguish a hard stop (bad entry,
      // never ran favorably) from a trailed stop (ran favorably, gave some
      // back) — a bare 'stop' couldn't answer "why do most exits happen this
      // way," per EXTERNAL_REPO_ADOPTION_CHECKLIST.md's taxonomy item.
      if (stopHit) closeReason = trailed ? 'stop_trailed' : 'stop_hard';
      else if (ageH >= TIME_STOP_HOURS) closeReason = 'time';
      if (closeReason) {
        const rawRetPct = dirSign * (px / pos.entry - 1) * 100;   // sign-flipped for shorts: profit when price falls
        const finalTrancheNetRetPct = rawRetPct - COST_RT * 100;
        const remainingFraction = 1 - pos.soldFraction;
        const netRetPct = pos.weightedRetSum + remainingFraction * finalTrancheNetRetPct;   // whole-position blended return across every tranche
        state.closed.push({ symbol: sym, reason: closeReason, direction: pos.direction, entry: pos.entry, exit: px, rawRetPct: +rawRetPct.toFixed(2), retPct: +netRetPct.toFixed(2), scaledOutFraction: pos.soldFraction, heldHours: +ageH.toFixed(1), closedAt: Date.now() });
        delete state.positions[sym];
      }
    }
    saveLedgerState(lane, state);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  tick().then(() => console.log('[directional-harness] tick complete')).catch((e) => console.error('[directional-harness] tick failed:', e.message));
}
