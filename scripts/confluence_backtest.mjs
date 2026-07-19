#!/usr/bin/env node
/**
 * CONFLUENCE BACKTEST — the fast answer to "does combining orthogonal angles
 * predict forward moves?" No waiting for accrual: reconstruct ~1y of daily
 * multi-angle history (sentiment, implied vol, macro, attention) vs BTC price and
 * measure forward returns conditioned on each angle AND on their confluence.
 *
 * HONEST CAVEATS: market-level (BTC) directional timing; ~1y = one regime; in-sample
 * (a real edge must hold forward on the live context recorder); no costs applied
 * (BTC timing cost is small, but a real strategy must clear it). This says whether
 * confluence carries INFORMATION — the necessary first test, not proof.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gj = async (url, opts = {}) => { const r = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json', ...(opts.headers || {}) }, ...opts }); return r.ok ? r.json() : null; };
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);

(async () => {
  // ---- pull deep-history angles (daily) ----
  const [fngRaw, dvolRaw, priceRaw, fredTxt, wikiRaw] = await Promise.all([
    gj('https://api.alternative.me/fng/?limit=0'),
    gj(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp=${Date.now() - 400 * 864e5}&end_timestamp=${Date.now()}&resolution=1D`),
    gj('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily'),
    fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10').then((r) => r.text()).catch(() => ''),
    gj(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/Bitcoin/daily/${dstr(Date.now() - 365 * 864e5).replace(/-/g, '')}/${dstr(Date.now()).replace(/-/g, '')}`),
  ]);

  const day = new Map();   // dateStr -> {fng, dvol, price, ten, wiki}
  const set = (d, k, v) => { if (v == null || Number.isNaN(v)) return; const o = day.get(d) || {}; o[k] = v; day.set(d, o); };
  for (const x of fngRaw?.data || []) set(dstr(x.timestamp * 1000), 'fng', Number(x.value));
  for (const c of dvolRaw?.result?.data || []) set(dstr(c[0]), 'dvol', +c[4]);
  for (const p of priceRaw?.prices || []) set(dstr(p[0]), 'price', p[1]);
  for (const it of wikiRaw?.items || []) set(dstr(Date.parse(it.timestamp.slice(0, 4) + '-' + it.timestamp.slice(4, 6) + '-' + it.timestamp.slice(6, 8))), 'wiki', it.views);
  for (const line of (fredTxt || '').trim().split('\n').slice(1)) { const [d, v] = line.split(','); if (v && v !== '.' && !isNaN(+v)) set(d, 'ten', +v); }

  // ---- align: days with price + fng + dvol, sorted ----
  const rows = [...day.entries()].filter(([, o]) => o.price > 0 && o.fng != null && o.dvol != null).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, o]) => ({ d, ...o }));
  // forward returns
  for (let i = 0; i < rows.length; i++) for (const h of [1, 3, 7]) { const j = i + h; rows[i][`f${h}`] = (j < rows.length && rows[j].price > 0) ? (rows[j].price / rows[i].price - 1) * 100 : null; }
  const usable = rows.filter((r) => r.f7 != null);
  console.log(`\n=== CONFLUENCE BACKTEST — ${usable.length} aligned days (sentiment+vol+price${usable[0]?.ten != null ? '+macro' : ''}${usable[0]?.wiki != null ? '+attention' : ''}) ===`);

  const stat = (arr, h) => { const v = arr.map((r) => r[`f${h}`]).filter((x) => x != null); if (!v.length) return { n: 0 }; const m = v.reduce((a, b) => a + b, 0) / v.length; return { n: v.length, mean: m, win: 100 * v.filter((x) => x > 0).length / v.length }; };
  const line = (label, arr, base) => { const s = stat(arr, 3); if (!s.n) return console.log(`  ${label.padEnd(30)} n=0`); const edge = s.mean - base; console.log(`  ${label.padEnd(30)} n=${String(s.n).padStart(3)}  fwd3d ${(s.mean >= 0 ? '+' : '') + s.mean.toFixed(2)}%  win ${s.win.toFixed(0)}%  vs base ${(edge >= 0 ? '+' : '') + edge.toFixed(2)}%`); };
  const base3 = stat(usable, 3).mean;

  console.log(`\n  BASELINE (all days): fwd3d ${base3.toFixed(2)}%  win ${stat(usable, 3).win.toFixed(0)}%\n  --- single angles (does each carry info?) ---`);
  line('Extreme Fear (F&G<25)', usable.filter((r) => r.fng < 25), base3);
  line('Fear (25-45)', usable.filter((r) => r.fng >= 25 && r.fng < 45), base3);
  line('Greed (55-75)', usable.filter((r) => r.fng >= 55 && r.fng < 75), base3);
  line('Extreme Greed (F&G>75)', usable.filter((r) => r.fng > 75), base3);
  const dvols = usable.map((r) => r.dvol).sort((a, b) => a - b); const dHi = dvols[Math.floor(dvols.length * 0.75)], dLo = dvols[Math.floor(dvols.length * 0.25)];
  line(`High vol (DVOL>${dHi?.toFixed(0)})`, usable.filter((r) => r.dvol > dHi), base3);
  line(`Low vol (DVOL<${dLo?.toFixed(0)})`, usable.filter((r) => r.dvol < dLo), base3);

  console.log(`\n  --- CONFLUENCE (independent angles aligned) ---`);
  line('Fear + High vol (capitulation)', usable.filter((r) => r.fng < 35 && r.dvol > dHi), base3);
  line('Fear + Low vol (quiet fear)', usable.filter((r) => r.fng < 35 && r.dvol < dLo), base3);
  line('Greed + High vol (euphoria top)', usable.filter((r) => r.fng > 65 && r.dvol > dHi), base3);
  if (usable[0]?.ten != null) line('Fear + rates falling proxy', usable.filter((r) => r.fng < 35 && r.ten < 4.4), base3);

  console.log(`\n  Read: 'vs base' = does the condition beat the all-days forward return? A single angle beating base by a lot,`);
  console.log(`  OR confluence beating either angle alone, = real information. In-sample/BTC-only — must confirm forward on the live context recorder.\n`);
})();
