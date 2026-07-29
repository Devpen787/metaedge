#!/usr/bin/env node
/**
 * OPEN-INTEREST / PRICE DIVERGENCE TEST — a genuinely new positioning angle, not
 * price. Hypothesis space (tested empirically, not assumed):
 *   OI up + price down   = fresh SHORTS building into weakness -> squeeze fuel?
 *   OI down + price down = longs CAPITULATING (deleveraging) -> exhaustion?
 *   OI up + price up     = fresh conviction, OR over-leveraged blow-off?
 *   OI down + price up   = short covering -> rally may lack fresh fuel?
 *
 * HONEST LIMITS (stated up front, not buried):
 *  - Free OI history is SHORT (OKX open-interest-volume: ~180 days, not our usual
 *    2 years). Train/test split and sample sizes are correspondingly smaller —
 *    treat any result here as a preliminary probe, not the same weight as the
 *    37-coin/2-year sweeps.
 *  - Daily granularity only (no free source gives 2y of intraday OI).
 *  - Same rails as everything else: walk-forward (60/40 time split), realistic
 *    cost, chance-baseline framing, cross-coin check across whatever majors OKX
 *    covers with long history.
 *
 * Source: OKX rubik open-interest-volume (free, no key, confirmed VM-reachable).
 */
const gj = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0' } }); return r.ok ? r.json() : null; };
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const COST_RT = 0.3; // % round trip, liquid crypto
const HOLD = 3;      // days
const COINS = ['BTC', 'ETH', 'SOL', 'DOGE']; // OKX ccy= majors with deep-enough history

async function oiSeries(ccy) {
  const j = await gj(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-volume?ccy=${ccy}&period=1D`);
  const rows = (j?.data || []).map(([t, oi]) => ({ t: +t, oi: +oi })).filter((r) => r.oi > 0).sort((a, b) => a.t - b.t);
  return rows;
}
async function priceSeries(ccy) {
  // reuse CoinGecko for a matching daily price series (OI history is short enough that live pull is fine)
  const id = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', DOGE: 'dogecoin' }[ccy];
  const j = await gj(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=200&interval=daily`);
  const byDay = new Map();
  for (const [t, p] of j?.prices || []) byDay.set(dstr(t), p);
  return byDay;
}

(async () => {
  const rows = [];
  for (const c of COINS) {
    const [oi, px] = await Promise.all([oiSeries(c), priceSeries(c)]);
    if (oi.length < 60) { console.log(`  ${c}: insufficient OI history (${oi.length}d), skipped`); continue; }
    for (let i = 7; i < oi.length - HOLD; i++) {
      const d = dstr(oi[i].t), dFwd = dstr(oi[i + HOLD].t), d7ago = dstr(oi[i - 7].t);
      const p0 = px.get(d), pFwd = px.get(dFwd), p7 = px.get(d7ago);
      if (!(p0 > 0 && pFwd > 0 && p7 > 0)) continue;
      const oiChg = (oi[i].oi / oi[i - 7].oi - 1) * 100;
      const pxChg = (p0 / p7 - 1) * 100;
      const fwd = (pFwd / p0 - 1) * 100;
      rows.push({ coin: c, t: oi[i].t, oiChg, pxChg, fwd });
    }
  }
  console.log(`\n=== OI/price divergence — ${rows.length} coin-days across ${COINS.length} coins (short-history probe, ~180d) ===`);
  const splitT = rows.slice().sort((a, b) => a.t - b.t)[Math.floor(rows.length * 0.6)].t;
  const stat = (arr) => { if (!arr.length) return { n: 0, mean: 0, win: 0 }; const m = arr.reduce((s, r) => s + r.fwd, 0) / arr.length; return { n: arr.length, mean: m, win: 100 * arr.filter((r) => r.fwd > 0).length / arr.length }; };
  const quadrants = {
    'OI up + price DOWN (short buildup into weakness)': (r) => r.oiChg > 5 && r.pxChg < -3,
    'OI down + price DOWN (long capitulation)': (r) => r.oiChg < -5 && r.pxChg < -3,
    'OI up + price UP (fresh conviction / blow-off)': (r) => r.oiChg > 5 && r.pxChg > 3,
    'OI down + price UP (short covering)': (r) => r.oiChg < -5 && r.pxChg > 3,
  };
  const base = stat(rows).mean;
  console.log(`  baseline (all coin-days): fwd${HOLD}d ${(base >= 0 ? '+' : '') + base.toFixed(2)}%  win ${stat(rows).win.toFixed(0)}%\n`);
  console.log(`  ${'quadrant'.padEnd(48)} ${'train'.padStart(14)} ${'test'.padStart(14)} ${'testNet'.padStart(9)}`);
  for (const [label, fn] of Object.entries(quadrants)) {
    const fired = rows.filter(fn);
    const tr = stat(fired.filter((r) => r.t < splitT)), te = stat(fired.filter((r) => r.t >= splitT));
    const dir = Math.sign(tr.mean);
    const net = te.n ? (dir * te.mean - COST_RT) : null;
    const flag = tr.n >= 10 && te.n >= 8 && Math.sign(te.mean) === dir && net > 0;
    console.log(`  ${label.padEnd(48)} ${(tr.n ? tr.mean.toFixed(2) + '% n' + tr.n : 'n=0').padStart(14)} ${(te.n ? te.mean.toFixed(2) + '% n' + te.n : 'n=0').padStart(14)} ${(net != null ? net.toFixed(2) + '%' : '—').padStart(9)}${flag ? '  <== candidate' : ''}`);
  }
  console.log(`\n  Short-history probe (~180d OI vs our usual 2y). A quadrant clearing train+test+cost with n>=10/8 is a`);
  console.log(`  CANDIDATE worth watching as more OI history accrues on our own scouts -- not a proven edge at this n.\n`);
})();
