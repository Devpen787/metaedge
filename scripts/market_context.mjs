#!/usr/bin/env node
/**
 * MARKET CONTEXT RECORDER — the multi-angle regime snapshot. Not a price scanner:
 * it records, every run, the INDEPENDENT information axes that describe the backdrop
 * any trade happens in — flow, positioning, sentiment, attention, macro. Recorded
 * over time this lets us (a) DECOMPOSE any move (was it flow? positioning? fear?
 * macro?) and (b) build scanners that require REAL confluence across independent
 * axes, not five views of price.
 *
 * All sources verified free + no-key. Each fetch is isolated: one dead API records
 * null, never kills the snapshot. Honest rail: context EXPLAINS moves; it is the raw
 * material for edge, not edge itself — a combined signal still faces the grader.
 *
 * Records data/market/context/context-<date>.jsonl (one row per run). VM cron ~30m.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'market', 'context');
const ANN = 24 * 365 * 100;
const UA = { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json' };
const safe = async (fn) => { try { return await fn(); } catch { return null; } };
const gj = async (url, opts = {}) => { const r = await fetch(url, { headers: { ...UA, ...(opts.headers || {}) }, ...opts }); return r.ok ? r.json() : null; };

// ---- one fetcher per angle (verified shapes) ----
const fearGreed = () => gj('https://api.alternative.me/fng/').then((j) => Number(j.data[0].value));                                  // sentiment 0-100
const dexVol24h = () => gj('https://api.llama.fi/overview/dexs').then((j) => j.total24h);                                            // on-chain demand
const feesRev24h = () => gj('https://api.llama.fi/overview/fees').then((j) => j.total24h);                                           // real usage
const stablecoinSupply = () => gj('https://stablecoins.llama.fi/stablecoins?includePrices=false').then((j) => j.peggedAssets.reduce((s, x) => s + (x.circulating?.peggedUSD || 0), 0)); // dry powder
const totalTvl = () => gj('https://api.llama.fi/v2/chains').then((a) => a.reduce((s, x) => s + (x.tvl || 0), 0));
const dvol = (cur) => { const now = Date.now(); return gj(`https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${cur}&start_timestamp=${now - 6 * 3600000}&end_timestamp=${now}&resolution=3600`).then((j) => { const d = j.result.data; return +d[d.length - 1][4].toFixed(1); }); }; // options implied vol
const hlFunding = () => gj('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) }).then((j) => { const m = j[0].universe, c = j[1], o = {}; for (let i = 0; i < m.length; i++) if (m[i].name === 'BTC' || m[i].name === 'ETH') o[m[i].name] = +(Number(c[i].funding) * ANN).toFixed(1); return o; });
const okxFunding = (inst) => gj(`https://www.okx.com/api/v5/public/funding-rate?instId=${inst}`).then((j) => +(Number(j.data[0].fundingRate) * ANN).toFixed(1)); // positioning (2nd venue -> divergence)
const wiki = (article) => { const d = (x) => x.toISOString().slice(0, 10).replace(/-/g, ''); const now = new Date(); return gj(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${article}/daily/${d(new Date(Date.now() - 9 * 86400000))}/${d(now)}`).then((j) => { const v = j.items; return v[v.length - 1].views; }); }; // attention
const fred = (id) => fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`).then((r) => r.text()).then((t) => { const rows = t.trim().split('\n').slice(1).filter((l) => { const v = l.split(',')[1]; return v && v !== '.' && !isNaN(Number(v)); }); return Number(rows[rows.length - 1].split(',')[1]); }); // macro
const btcpx = () => gj('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then((j) => ({ p: Math.round(j.bitcoin.usd), c: +j.bitcoin.usd_24h_change.toFixed(2) }));
// OKX rubik — all NO-KEY: positioning, order flow, forced flow
const okxLongShort = (ccy) => gj(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1H`).then((j) => j.data?.length ? +Number(j.data[0][1]).toFixed(2) : null); // >1 = crowd long
const okxTakerBuyRatio = (ccy) => gj(`https://www.okx.com/api/v5/rubik/stat/taker-volume?ccy=${ccy}&instType=SPOT&period=1H`).then((j) => { const d = j.data?.[0]; if (!d) return null; const sell = Number(d[1]), buy = Number(d[2]); return sell > 0 ? +(buy / sell).toFixed(2) : null; }); // >1 = aggressive buying
const okxLiq = (uly) => gj(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&state=filled&uly=${uly}`).then((j) => { const det = j.data?.[0]?.details || []; let L = 0, S = 0; for (const d of det) { const n = Number(d.sz) * Number(d.bkPx); if (d.posSide === 'long') L += n; else if (d.posSide === 'short') S += n; } return { long: Math.round(L), short: Math.round(S) }; }); // which side got flushed

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const [fng, dexV, fees, stables, tvl, btcDvol, ethDvol, hl, okxBtc, okxEth, wBtc, wEth, y10, dxy, px,
    lsBtc, lsEth, takerBtc, liqBtc] = await Promise.all([
    safe(fearGreed), safe(dexVol24h), safe(feesRev24h), safe(stablecoinSupply), safe(totalTvl),
    safe(() => dvol('BTC')), safe(() => dvol('ETH')), safe(hlFunding),
    safe(() => okxFunding('BTC-USD-SWAP')), safe(() => okxFunding('ETH-USD-SWAP')),
    safe(() => wiki('Bitcoin')), safe(() => wiki('Ethereum')),
    safe(() => fred('DGS10')), safe(() => fred('DTWEXBGS')), safe(btcpx),
    safe(() => okxLongShort('BTC')), safe(() => okxLongShort('ETH')), safe(() => okxTakerBuyRatio('BTC')), safe(() => okxLiq('BTC-USDT')),
  ]);
  const btcFundHL = hl?.BTC ?? null;
  const row = {
    t: Date.now(),
    sentiment: { fearGreed: fng },
    flow: { dexVol24h: dexV, feesRev24h: fees, stablecoinSupply: stables, totalTvl: tvl, btcTakerBuyRatio: takerBtc },
    positioning: { btcDvol, ethDvol, btcFundingHL: btcFundHL, ethFundingHL: hl?.ETH ?? null, btcFundingOKX: okxBtc, ethFundingOKX: okxEth,
      btcFundingDivergence: (okxBtc != null && btcFundHL != null) ? +(okxBtc - btcFundHL).toFixed(1) : null,
      btcLongShortRatio: lsBtc, ethLongShortRatio: lsEth },
    forcedFlow: { btcLiqLong: liqBtc?.long ?? null, btcLiqShort: liqBtc?.short ?? null },
    attention: { btcWiki: wBtc, ethWiki: wEth },
    macro: { us10y: y10, dollarIndex: dxy },
    anchor: { btcPrice: px?.p ?? null, btc24h: px?.c ?? null },
  };
  fs.appendFileSync(path.join(DIR, `context-${new Date().toISOString().slice(0, 10)}.jsonl`), JSON.stringify(row) + '\n');
  const ok = Object.values({ fng, dexV, stables, btcDvol, btcFundHL, okxBtc, wBtc, y10, px, lsBtc, takerBtc, liqBtc }).filter((x) => x != null).length;
  console.log(`[context] ${new Date().toISOString()} signals=${ok}/12 recorded`);
  console.log(`  sentiment F&G ${fng} | flow: DEX $${(dexV / 1e9).toFixed(1)}B stables $${(stables / 1e9).toFixed(0)}B taker buy/sell ${takerBtc} | vol BTC-DVOL ${btcDvol}`);
  console.log(`  positioning: funding HL ${btcFundHL}% vs OKX ${okxBtc}% (div ${row.positioning.btcFundingDivergence}) | L/S ratio ${lsBtc} | forced: liq long $${((liqBtc?.long || 0) / 1e6).toFixed(1)}M vs short $${((liqBtc?.short || 0) / 1e6).toFixed(1)}M`);
  console.log(`  attention BTC-wiki ${wBtc} | macro 10Y ${y10}% DXY ${dxy} | BTC $${px?.p} (${px?.c}%)`);
}
run().catch((e) => console.error('[context] failed:', e.message));
