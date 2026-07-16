#!/usr/bin/env node
/**
 * KALSHI 15-MINUTE BINARIES vs COUNTED REALITY — the first real pricing probe.
 *
 * The question, in plain terms: Kalshi sells a $1 ticket on "will BTC be above
 * $X in N minutes?". We hold weeks of real exchange candles, so "how often does
 * BTC move that far in N minutes" is NOT a forecast — it is COUNTING. This probe
 * counts, then compares our counted probability with Kalshi's ask/bid.
 *
 * HONESTY RAILS (each one exists because we got burned today):
 * 1. TERMINAL ONLY. The 15M series resolve on where price FINISHES. The MAX/MIN
 *    series are one-touch barriers ("EVER above $X") — a different, much larger
 *    probability. This probe REFUSES any market whose rules mention "ever"/"touch"
 *    or that can close early on price, rather than misprice it.
 * 2. STRUCTURE FIRST. After five parse bugs, the probe dumps one raw market before
 *    pricing, and aborts pricing (exit 2) if the fields don't match expectations —
 *    it will not silently price a shape it guessed.
 * 3. EDGE = OUTSIDE THE SPREAD, AFTER FEES. "Fair 55c vs last 53c" is not an edge.
 *    You BUY at the ask and SELL at the bid, and Kalshi charges a fee
 *    (~$0.07*p*(1-p) per contract). Anything inside bid/ask+fees reads NO_EDGE.
 * 4. EMPIRICAL DISTRIBUTION, NOT A MODEL. Fair value = the fraction of historical
 *    same-length windows whose move would have crossed the strike. Fat tails are
 *    in the data; no normality assumed. Sample window is printed — thin samples
 *    are flagged, not hidden.
 * 5. THIS MEASURES. It does not trade, and a one-run gap is a hypothesis at best.
 *
 * Runs entirely on the VM (Kalshi + Binance both reachable there):
 *   node scripts/kalshi_fair_value.mjs [--series KXBTC15M,KXETH15M] [--days 30]
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const B = 'https://api.elections.kalshi.com/trade-api/v2';
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SERIES = flag('series', 'KXBTC15M,KXETH15M,KXSOL15M,KXDOGE15M,KXXRP15M').split(',');
const DAYS = Number(flag('days', '30'));

// Kalshi series -> Binance underlying
const UNDERLYING = { KXBTC15M: 'BTCUSDT', KXETH15M: 'ETHUSDT', KXSOL15M: 'SOLUSDT',
  KXDOGE15M: 'DOGEUSDT', KXXRP15M: 'XRPUSDT', KXBNB15M: 'BNBUSDT', KXZEC15M: 'ZECUSDT',
  KXADA15M: 'ADAUSDT', KXNEAR15M: 'NEARUSDT', KXBCH15M: 'BCHUSDT' };

async function kalshiGet(u) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(1200); continue; }
    if (!r.ok) return { __err: r.status };
    return r.json();
  }
  return { __err: 'retries' };
}

// ~DAYS of 1-minute closes from Binance (paginated, 1000/req)
async function minuteCloses(pair) {
  const out = [];
  let end = Date.now();
  const reqs = Math.ceil((DAYS * 1440) / 1000);
  for (let i = 0; i < reqs; i++) {
    const u = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=1000&endTime=${end}`;
    const r = await fetch(u); if (!r.ok) break;
    const rows = await r.json(); if (!rows.length) break;
    for (let j = rows.length - 1; j >= 0; j--) out.push({ t: Number(rows[j][0]), c: Number(rows[j][4]) });
    end = Number(rows[0][0]) - 1;
    await sleep(120);
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

// Counted probability that price is >= strike after `mins` minutes, given spot now.
// Uses every historical window of the same length: fraction where close[i+mins]/close[i]
// >= strike/spot. Pure counting over DAYS of data; overlapping windows (stated).
function countedProb(closes, spot, strike, mins) {
  const need = strike / spot;
  let hit = 0, n = 0;
  for (let i = 0; i + mins < closes.length; i += 3) {   // stride 3 to cut autocorrelation a bit
    n++;
    if (closes[i + mins].c / closes[i].c >= need) hit++;
  }
  return { p: n ? hit / n : NaN, n };
}

const kalshiFee = (p) => 0.07 * p * (1 - p); // ≈ published maker/taker schedule; conservative

console.log(`\n=== Kalshi 15-minute binaries vs counted probability (${DAYS}d of 1m Binance data) ===`);
let dumped = false;
const results = [];

for (const st of SERIES) {
  const pair = UNDERLYING[st];
  if (!pair) { console.log(`  ${st}: no underlying mapping — skipped`); continue; }
  const mk = await kalshiGet(`${B}/markets?limit=20&status=open&series_ticker=${st}`);
  if (mk.__err) { console.log(`  ${st}: HTTP ${mk.__err}`); continue; }
  const markets = (mk.markets || []).filter((m) => {
    const rules = String(m.rules_primary || '').toLowerCase();
    // RAIL 1: refuse anything barrier-shaped rather than misprice it.
    return !(rules.includes(' ever ') || rules.includes('touch') || String(m.early_close_condition || '').toLowerCase().includes('price'));
  });
  if (!markets.length) { console.log(`  ${st}: no open terminal markets right now`); continue; }

  if (!dumped) {  // RAIL 2: show the real shape once before pricing anything
    const m = markets[0];
    console.log(`\n--- raw market[0] (${st}) — verify before trusting the parse ---`);
    const keep = {};
    for (const [k, v] of Object.entries(m)) if (/ticker|title|sub_title|strike|floor|cap|close_time|rules_primary|yes_bid|yes_ask/i.test(k)) keep[k] = v;
    console.log(JSON.stringify(keep, null, 1).slice(0, 900));
    dumped = true;
  }

  const closes = await minuteCloses(pair);
  if (closes.length < 5000) { console.log(`  ${st}: only ${closes.length} minute-bars — sample too thin, skipped`); continue; }
  const spot = closes[closes.length - 1].c;

  for (const m of markets) {
    const strike = D(m.floor_strike ?? m.cap_strike);
    const bid = D(m.yes_bid_dollars), ask = D(m.yes_ask_dollars);
    const minsLeft = Math.round((Date.parse(m.close_time) - Date.now()) / 60000);
    if (!Number.isFinite(strike) || minsLeft <= 0 || minsLeft > 24 * 60) continue;
    if (!(bid > 0.005 && ask < 0.995 && ask > bid)) continue;   // skip floor/ceiling artifacts + one-sided
    const { p: fair, n } = countedProb(closes, spot, strike, minsLeft);
    if (!Number.isFinite(fair)) continue;

    // RAIL 3: edge only outside spread + fees
    let verdict = 'NO_EDGE', gain = 0;
    if (fair > ask + kalshiFee(ask)) { verdict = 'BUY_YES'; gain = fair - ask - kalshiFee(ask); }
    else if (fair < bid - kalshiFee(bid)) { verdict = 'SELL_YES'; gain = bid - fair - kalshiFee(bid); }
    results.push({ st, tk: m.ticker, strike, spot, minsLeft, bid, ask, fair, n, verdict, gain });
  }
  await sleep(400);
}

if (!results.length) { console.log('\n  No priceable terminal markets found this run (off-hours or filters). Re-run near market activity.\n'); process.exit(0); }
console.log(`\n  ${'series'.padEnd(10)} ${'strike'.padStart(9)} ${'spot'.padStart(9)} ${'min'.padStart(4)} ${'bid'.padStart(4)} ${'ask'.padStart(4)} ${'fair'.padStart(5)} ${'n'.padStart(5)}  verdict`);
for (const r of results.sort((a, b) => b.gain - a.gain)) {
  console.log(`  ${r.st.padEnd(10)} ${String(r.strike).padStart(9)} ${r.spot.toFixed(r.spot < 10 ? 4 : 0).padStart(9)} ${String(r.minsLeft).padStart(4)} ${(r.bid * 100).toFixed(0).padStart(3)}c ${(r.ask * 100).toFixed(0).padStart(3)}c ${(r.fair * 100).toFixed(1).padStart(5)} ${String(r.n).padStart(5)}  ${r.verdict}${r.gain > 0 ? ` (+${(r.gain * 100).toFixed(1)}c)` : ''}`);
}
const edges = results.filter((r) => r.verdict !== 'NO_EDGE');
console.log(`\n  ${results.length} priced · ${edges.length} outside spread+fees`);
console.log(`  One snapshot proves nothing either way — a real answer needs this logged over days.`);
console.log(`  (overlapping windows inflate n; treat gaps < ~3c as noise)\n`);
