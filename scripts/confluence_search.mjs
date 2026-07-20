#!/usr/bin/env node
/**
 * CONFLUENCE SEARCH ENGINE — systematic sweep of angle-threshold COMBINATIONS
 * against the pooled coin basket, with the anti-overfit rails wired in as code:
 *
 *  1. STATISTICAL UNIT = the MARKET DAY. The angles (sentiment/flow/vol/macro) are
 *     market-wide, so all coins firing on one day is ONE observation — the forward
 *     return of an equal-weight basket — never 12 correlated "coin-days".
 *  2. NON-OVERLAPPING: fires within the hold window are strided out (a 3d hold
 *     can't be counted three times on consecutive days).
 *  3. WALK-FORWARD: combos are screened on the first 60% of history (train) and
 *     judged ONLY on the held-out last 40% (test). Sign must agree.
 *  4. COSTS: 0.3% round-trip (liquid-crypto taker+slippage) charged per trade.
 *  5. CROSS-COIN: the signal's direction must hold on >=60% of coins individually.
 *  6. MULTIPLE-TESTING HONESTY: reports combos tested, train-passers, and how many
 *     survivors CHANCE alone would be expected to produce. Survivors are labeled
 *     CANDIDATES — the live context recorder + practice book confirm forward.
 *
 * Angles (all non-price, all free): Fear&Greed (2018+), stablecoin 30d supply
 * growth (2017+), Deribit DVOL (~1y — combos using it mostly fail the train bar
 * honestly, noted), FRED 10Y (deep). Prices: local 2y backfill, 12 liquid majors.
 *
 * Output: ranked survivor board + full results saved to
 * data/edgeops/confluence-search-<date>.json (the knowledge base).
 */
import fs from 'node:fs';
import path from 'node:path';

const gj = async (u, o = {}) => { const r = await fetch(u, { headers: { 'User-Agent': 'MetaEdge/1.0', Accept: 'application/json', ...(o.headers || {}) }, ...o }); return r.ok ? r.json() : null; };
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const DIR = path.join(process.cwd(), 'data', 'market');
const COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'LTC', 'BCH'];
const HOLD = 3;                 // days held per trade
const COST_RT = 0.3;            // % round trip, liquid crypto
const SPLIT = 0.6;              // train fraction (by time)
const BAR = { trainN: 15, trainAbsMean: 0.4, testN: 8, coinAgree: 0.6 };

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
  const ANG = new Map();
  const set = (d, k, v) => { if (v == null || Number.isNaN(v)) return; const o = ANG.get(d) || {}; o[k] = v; ANG.set(d, o); };
  for (const x of fng?.data || []) set(dstr(x.timestamp * 1000), 'fng', +x.value);
  for (const c of dvol?.result?.data || []) set(dstr(c[0]), 'dvol', +c[4]);
  for (const s of stables || []) set(dstr(s.date * 1000), 'stable', Number(s.totalCirculatingUSD?.peggedUSD || 0));
  for (const line of (fredTxt || '').trim().split('\n').slice(1)) { const [d, v] = line.split(','); if (v && v !== '.' && !isNaN(+v)) set(d, 'ten', +v); }
  // stablecoin 30d growth on its own timeline
  const sdays = [...ANG.keys()].filter((d) => ANG.get(d).stable > 0).sort();
  for (let i = 30; i < sdays.length; i++) { const cur = ANG.get(sdays[i]).stable, prev = ANG.get(sdays[i - 30]).stable; if (cur > 0 && prev > 0) set(sdays[i], 'grow', +((cur / prev - 1) * 100).toFixed(2)); }

  // ---- per-coin closes + basket day rows (forward-fill slow angles) ----
  const closes = {}; let used = 0;
  for (const c of COINS) { const m = dailyCloses(c); if (m) { closes[c] = m; used++; } }
  const allDates = [...new Set(Object.values(closes).flatMap((m) => [...m.keys()]))].sort();
  const rows = []; let lastTen = null, lastGrow = null, lastFng = null, lastDvol = null;
  for (let i = 0; i < allDates.length; i++) {
    const d = allDates[i]; const a = ANG.get(d) || {};
    if (a.ten != null) lastTen = a.ten;
    if (a.grow != null) lastGrow = a.grow;
    if (a.fng != null) lastFng = a.fng;
    if (a.dvol != null) lastDvol = a.dvol; else if (i > 0 && allDates[i - 1] && (Date.parse(d) - Date.parse(allDates[i - 1])) > 3 * 864e5) lastDvol = null;
    const fwdDate = allDates[i + HOLD];
    if (!fwdDate) continue;
    const perCoin = {}; const rets = [];
    for (const c of COINS) { const p0 = closes[c]?.get(d), p1 = closes[c]?.get(fwdDate); if (p0 > 0 && p1 > 0) { const r = (p1 / p0 - 1) * 100; perCoin[c] = r; rets.push(r); } }
    if (rets.length < 6) continue;
    rows.push({ d, t: Date.parse(d), fng: lastFng, grow: lastGrow, dvol: lastDvol, ten: lastTen, f3: rets.reduce((s, x) => s + x, 0) / rets.length, perCoin });
  }
  const splitT = rows[Math.floor(rows.length * SPLIT)].t;

  // ---- condition grid (independent axes only) ----
  const dv = rows.map((r) => r.dvol).filter((x) => x != null).sort((a, b) => a - b);
  const dHi = dv[Math.floor(dv.length * 0.7)], dLo = dv[Math.floor(dv.length * 0.3)];
  const AXES = {
    sentiment: [['F&G<20', (r) => r.fng != null && r.fng < 20], ['F&G<30', (r) => r.fng != null && r.fng < 30], ['F&G<40', (r) => r.fng != null && r.fng < 40], ['F&G>55', (r) => r.fng != null && r.fng > 55], ['F&G>70', (r) => r.fng != null && r.fng > 70]],
    flow: [['stables>+1.5%', (r) => r.grow != null && r.grow > 1.5], ['stables>+0.5%', (r) => r.grow != null && r.grow > 0.5], ['stables<0%', (r) => r.grow != null && r.grow < 0], ['stables<-1%', (r) => r.grow != null && r.grow < -1]],
    vol: [[`DVOL>${dHi?.toFixed(0)}`, (r) => r.dvol != null && r.dvol > dHi], [`DVOL<${dLo?.toFixed(0)}`, (r) => r.dvol != null && r.dvol < dLo]],
    macro: [['10Y<4.2', (r) => r.ten != null && r.ten < 4.2], ['10Y<4.4', (r) => r.ten != null && r.ten < 4.4], ['10Y>4.6', (r) => r.ten != null && r.ten > 4.6]],
  };
  const axisNames = Object.keys(AXES);
  const combos = [];
  for (let i = 0; i < axisNames.length; i++) {
    for (const c1 of AXES[axisNames[i]]) {
      combos.push({ label: c1[0], fns: [c1[1]] });
      for (let j = i + 1; j < axisNames.length; j++) for (const c2 of AXES[axisNames[j]]) {
        combos.push({ label: `${c1[0]} + ${c2[0]}`, fns: [c1[1], c2[1]] });
        for (let k = j + 1; k < axisNames.length; k++) for (const c3 of AXES[axisNames[k]]) combos.push({ label: `${c1[0]} + ${c2[0]} + ${c3[0]}`, fns: [c1[1], c2[1], c3[1]] });
      }
    }
  }

  // ---- evaluate every combo under the rails ----
  const strided = (arr) => { let last = -Infinity; const out = []; for (const r of arr) { if (r.t - last >= HOLD * 864e5) { out.push(r); last = r.t; } } return out; };
  const mstat = (arr) => { if (!arr.length) return { n: 0, mean: 0 }; const m = arr.reduce((s, r) => s + r.f3, 0) / arr.length; return { n: arr.length, mean: m }; };
  const results = []; let trainPassers = 0;
  for (const combo of combos) {
    const fired = rows.filter((r) => combo.fns.every((f) => f(r)));
    const tr = strided(fired.filter((r) => r.t < splitT));
    const te = strided(fired.filter((r) => r.t >= splitT));
    const trS = mstat(tr), teS = mstat(te);
    const rec = { label: combo.label, k: combo.fns.length, trainN: trS.n, trainMean: +trS.mean.toFixed(2), testN: teS.n, testMean: +teS.mean.toFixed(2) };
    const passTrain = trS.n >= BAR.trainN && Math.abs(trS.mean) >= BAR.trainAbsMean;
    if (passTrain) {
      trainPassers++;
      const dir = Math.sign(trS.mean);
      rec.dir = dir > 0 ? 'LONG' : 'SHORT';
      const net = dir * teS.mean - COST_RT;
      rec.testNet = +net.toFixed(2);
      // cross-coin agreement over ALL fires (train+test, unstrided — sign check only)
      let agree = 0, tot = 0;
      for (const c of COINS) { const v = fired.map((r) => r.perCoin[c]).filter((x) => x != null); if (v.length >= 10) { tot++; if (Math.sign(v.reduce((s, x) => s + x, 0) / v.length) === dir) agree++; } }
      rec.coinAgree = tot ? +(agree / tot).toFixed(2) : 0;
      rec.survivor = teS.n >= BAR.testN && Math.sign(teS.mean) === dir && net > 0 && rec.coinAgree >= BAR.coinAgree;
    }
    results.push(rec);
  }
  const survivors = results.filter((r) => r.survivor).sort((a, b) => b.testNet - a.testNet);
  // chance expectation: given a train-passer with NO real signal, P(test sign agrees) ~0.5,
  // P(also clears cost) <~0.5, P(coin agreement) <~0.7 -> ~0.15 per passer. Report it.
  const chance = (trainPassers * 0.15).toFixed(1);

  console.log(`\n=== CONFLUENCE SEARCH — ${combos.length} combos | ${used} coins | ${rows.length} market days (train ${Math.floor(rows.length * SPLIT)} / test ${rows.length - Math.floor(rows.length * SPLIT)}) ===`);
  console.log(`  rails: day-level stats, ${HOLD}d non-overlapping, walk-forward, ${COST_RT}% RT cost, cross-coin >=${BAR.coinAgree * 100}%\n`);
  console.log(`  train-passers: ${trainPassers}/${combos.length} | SURVIVORS: ${survivors.length} | expected by CHANCE alone: ~${chance}`);
  if (survivors.length) {
    console.log(`\n  ${'#'.padStart(2)} ${'combo'.padEnd(46)} ${'dir'.padEnd(6)} ${'train'.padStart(12)} ${'test'.padStart(12)} ${'testNET'.padStart(8)} ${'coins'.padStart(6)}`);
    survivors.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} ${s.label.padEnd(46)} ${s.dir.padEnd(6)} ${(s.trainMean + '% n' + s.trainN).padStart(12)} ${(s.testMean + '% n' + s.testN).padStart(12)} ${(s.testNet + '%').padStart(8)} ${(s.coinAgree * 100).toFixed(0).padStart(5)}%`));
  } else {
    console.log('  (none cleared all rails — an honest null: the hand-found signals did not survive walk-forward)');
  }
  console.log(`\n  Survivors are CANDIDATES: if count <= chance expectation, treat as noise. Next stage = forward`);
  console.log(`  confirmation on the live context recorder + paper practice book. In-sample knowledge saved.\n`);
  fs.mkdirSync(path.join(process.cwd(), 'data', 'edgeops'), { recursive: true });
  const out = path.join(process.cwd(), 'data', 'edgeops', `confluence-search-${dstr(Date.now())}.json`);
  fs.writeFileSync(out, JSON.stringify({ generatedAt: Date.now(), combos: combos.length, marketDays: rows.length, bar: BAR, costRt: COST_RT, hold: HOLD, trainPassers, chanceExpectation: +chance, survivors, results }, null, 1));
  console.log(`  knowledge base written: ${out}\n`);
})();
