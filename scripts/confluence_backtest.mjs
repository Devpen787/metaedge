#!/usr/bin/env node
/**
 * CONFLUENCE BACKTEST (expanded) — the combination-testing engine. Pools MANY coins
 * (2y local backfill) against market-wide orthogonal angles and measures forward
 * returns conditioned on each angle AND their confluence. Pooling coin-days gives
 * real statistical power; the angles are independent of price.
 *
 * ANGLES: sentiment (Fear&Greed, deep), FLOW (stablecoin supply growth = dry-powder
 * expansion, deep), vol (Deribit DVOL, ~1y), macro (FRED 10Y, deep). Price = local
 * 2y backfill for a liquid coin basket.
 *
 * HONEST CAVEATS: market-wide regime overlay (angles are the same for every coin on
 * a day, so pooled n is correlated — treat n as optimistic); ~2y; in-sample; costs
 * not applied (a real strategy must clear them). This says whether confluence carries
 * INFORMATION and generalizes across coins — the necessary first test, not proof.
 */
import fs from 'node:fs';
import path from 'node:path';
const gj = async (u, o = {}) => { const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json', ...(o.headers || {}) }, ...o }); return r.ok ? r.json() : null; };
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const DIR = path.join(process.cwd(), 'data', 'market');
// auto-discovered from the local backfill, not a hand-picked 12-coin list —
// scales with whatever universe is backfilled (see confluence_search.mjs, the
// walk-forward successor to this script, for the full rationale).
const COINS = fs.readdirSync(DIR).filter((f) => /^backfill-.*-1h\.jsonl$/.test(f)).map((f) => f.slice('backfill-'.length, -'-1h.jsonl'.length)).sort();

// local 2y backfill -> daily closes {dateStr: close}
function dailyCloses(coin) {
  const fp = path.join(DIR, `backfill-${coin}-1h.jsonl`);
  if (!fs.existsSync(fp)) return null;
  const byDay = new Map();
  for (const l of fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { let b; try { b = JSON.parse(l); } catch { continue; } byDay.set(dstr(b.t), b.c); }
  return byDay;
}

(async () => {
  // ---- market-wide angle histories ----
  const [fng, dvol, stables, fredTxt] = await Promise.all([
    gj('https://api.alternative.me/fng/?limit=0'),
    gj(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=${Date.now() - 400 * 864e5}&end_timestamp=${Date.now()}&resolution=1D`),
    gj('https://stablecoins.llama.fi/stablecoincharts/all'),
    fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10').then((r) => r.text()).catch(() => ''),
  ]);
  const A = new Map();  // dateStr -> {fng, dvol, stable, ten}
  const set = (d, k, v) => { if (v == null || Number.isNaN(v)) return; const o = A.get(d) || {}; o[k] = v; A.set(d, o); };
  for (const x of fng?.data || []) set(dstr(x.timestamp * 1000), 'fng', +x.value);
  for (const c of dvol?.result?.data || []) set(dstr(c[0]), 'dvol', +c[4]);
  for (const s of stables || []) set(dstr(s.date * 1000), 'stable', Number(s.totalCirculatingUSD?.peggedUSD || 0));
  for (const line of (fredTxt || '').trim().split('\n').slice(1)) { const [d, v] = line.split(','); if (v && v !== '.' && !isNaN(+v)) set(d, 'ten', +v); }
  // stablecoin 30d growth % (flow) — computed on the sorted angle dates
  const adays = [...A.keys()].sort();
  const stableAt = (d) => A.get(d)?.stable;
  for (let i = 0; i < adays.length; i++) { const cur = stableAt(adays[i]); const prevD = adays[i - 30]; const prev = prevD ? stableAt(prevD) : null; if (cur > 0 && prev > 0) set(adays[i], 'stableGrow', +((cur / prev - 1) * 100).toFixed(2)); }

  // ---- pool coin-days ----
  const obs = [];
  let coinsUsed = 0;
  for (const coin of COINS) {
    const cl = dailyCloses(coin); if (!cl) continue; coinsUsed++;
    const days = [...cl.keys()].sort();
    for (let i = 0; i < days.length; i++) {
      const d = days[i], ang = A.get(d); if (!ang || ang.fng == null) continue;
      const p = cl.get(d); const fwd = {};
      for (const h of [1, 3, 7]) { const fd = days[i + h]; fwd[`f${h}`] = fd ? (cl.get(fd) / p - 1) * 100 : null; }
      if (fwd.f3 == null) continue;
      obs.push({ coin, d, ...ang, ...fwd });
    }
  }
  console.log(`\n=== CONFLUENCE BACKTEST (expanded) — ${coinsUsed} coins, ${obs.length} pooled coin-days ===`);
  const stat = (arr, h = 3) => { const v = arr.map((r) => r[`f${h}`]).filter((x) => x != null); if (!v.length) return { n: 0, mean: 0, win: 0 }; const m = v.reduce((a, b) => a + b, 0) / v.length; return { n: v.length, mean: m, win: 100 * v.filter((x) => x > 0).length / v.length }; };
  const base = stat(obs).mean, baseWin = stat(obs).win;
  const L = (label, arr) => { const s = stat(arr); if (!s.n) return console.log(`  ${label.padEnd(34)} n=0`); console.log(`  ${label.padEnd(34)} n=${String(s.n).padStart(4)}  fwd3d ${(s.mean >= 0 ? '+' : '') + s.mean.toFixed(2)}%  win ${s.win.toFixed(0)}%  vsBase ${(s.mean - base >= 0 ? '+' : '') + (s.mean - base).toFixed(2)}%`); };

  console.log(`  BASELINE (all coin-days): fwd3d ${(base >= 0 ? '+' : '') + base.toFixed(2)}%  win ${baseWin.toFixed(0)}%\n  --- single angles ---`);
  L('Extreme Fear (F&G<25)', obs.filter((r) => r.fng < 25));
  L('Greed (F&G>60)', obs.filter((r) => r.fng > 60));
  L('Stablecoin supply EXPANDING (>+1%/30d)', obs.filter((r) => r.stableGrow > 1));
  L('Stablecoin supply SHRINKING (<-1%/30d)', obs.filter((r) => r.stableGrow < -1));
  const withV = obs.filter((r) => r.dvol != null);
  if (withV.length) { const dv = withV.map((r) => r.dvol).sort((a, b) => a - b); const hi = dv[Math.floor(dv.length * 0.7)]; L(`High vol (DVOL>${hi?.toFixed(0)}, ~1y)`, withV.filter((r) => r.dvol > hi)); }
  L('Rates low (10Y<4.2%)', obs.filter((r) => r.ten != null && r.ten < 4.2));

  console.log(`  --- CONFLUENCE (independent angles aligned) ---`);
  L('Fear + stablecoins EXPANDING', obs.filter((r) => r.fng < 35 && r.stableGrow > 1));
  L('Fear + stablecoins SHRINKING', obs.filter((r) => r.fng < 35 && r.stableGrow < 0));
  L('Greed + stablecoins SHRINKING', obs.filter((r) => r.fng > 55 && r.stableGrow < 0));
  L('Fear + expanding + rates low', obs.filter((r) => r.fng < 40 && r.stableGrow > 0.5 && r.ten != null && r.ten < 4.3));

  // per-coin sanity on the best single angle
  console.log(`  --- does "stablecoins expanding" hold PER COIN? (generalization check) ---`);
  for (const coin of ['BTC', 'ETH', 'SOL']) { const c = obs.filter((r) => r.coin === coin && r.stableGrow > 1); const s = stat(c); if (s.n) console.log(`  ${coin.padEnd(6)} expanding: n=${s.n} fwd3d ${(s.mean >= 0 ? '+' : '') + s.mean.toFixed(2)}% win ${s.win.toFixed(0)}%`); }
  console.log(`\n  Read: an angle or confluence that beats baseline by a lot AND holds across coins = real information.`);
  console.log(`  Pooled n is correlated (same market angles per day) so treat n optimistically. In-sample -> confirm forward.\n`);
})();
