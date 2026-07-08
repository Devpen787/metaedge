#!/usr/bin/env node
/**
 * Funding carry study (charter pool #1: structural carry).
 *
 * Trade being modeled: delta-neutral carry — long spot + short perp (1x).
 * The short perp RECEIVES funding when funding > 0. This is payment for risk
 * transfer (balancing euphoric longs), not prediction.
 *
 * Modeled per the charter's hard ban ("funding is not yield unless..."):
 *   - hedge: delta-neutral by construction (spot long vs perp short)
 *   - costs: 40bps per episode (4 legs × 10bps, conservative vs measured 4.5-13bps)
 *   - basis: entry premium − exit premium from the RECORDED premium series
 *   - liquidation: max adverse (upward) price excursion per episode from klines;
 *     episodes with >50% up-move flagged as margin-stress (1x short perp)
 *   - exchange risk: NOT modelable in a backtest — carried as a stated limit
 *
 * Selector-first (charter step 4): the regime IS the trade — enter when
 * trailing-24h funding annualizes above T_in, exit below T_out.
 * Timeframe: hourly BY CONSTRUCTION (funding pays hourly) — not a default.
 *
 * Testing: train = first year (param pick), test = last year (verdict).
 * All evaluations appended to the hypothesis registry.
 */
import fs from 'node:fs';

const cflag = process.argv.indexOf('--coins');
const COINS = cflag >= 0 ? process.argv[cflag + 1].split(',') : ['ETH', 'BTC', 'SOL'];
const COST_EPISODE = 0.004;             // 40bps round trip, 4 legs
const HOURS_YEAR = 24 * 365;
const registry = fs.createWriteStream('data/edgeops/hypothesis-registry.jsonl', { flags: 'a' });
const dstr = new Date().toISOString().slice(0, 10);
const out = []; const p = (s = '') => out.push(s);

function loadCoin(coin) {
  const f = fs.readFileSync(`data/market/funding-hist-${coin}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const px = new Map(
    fs.existsSync(`data/market/backfill-${coin}-1h.jsonl`)
      ? fs.readFileSync(`data/market/backfill-${coin}-1h.jsonl`, 'utf8').trim().split('\n').map((l) => { const b = JSON.parse(l); return [Math.floor(b.t / 3_600_000), b.c]; })
      : []
  );
  return f.map((r) => ({ hour: Math.floor(r.t / 3_600_000), funding: r.funding, premium: r.premium, px: px.get(Math.floor(r.t / 3_600_000)) ?? null }));
}

function simulate(rows, Tin, Tout, from, to, trailN = 24) {
  const episodes = [];
  let pos = null;
  for (let i = from + trailN; i < to; i++) {
    const trail = rows.slice(i - trailN, i).reduce((s, r) => s + r.funding, 0) / trailN * HOURS_YEAR * 100; // annualized PERCENT (units must match Tin/Tout)
    if (!pos && trail >= Tin) {
      pos = { entryI: i, acc: 0, pIn: rows[i].premium, entryPx: rows[i].px, maxPx: rows[i].px ?? 0 };
    } else if (pos) {
      pos.acc += rows[i].funding;
      if (rows[i].px != null) pos.maxPx = Math.max(pos.maxPx, rows[i].px);
      if (trail < Tout || i === to - 1) {
        const basisPnl = (pos.pIn ?? 0) - (rows[i].premium ?? 0);   // short perp: sell at pIn, buy back at pOut
        const hours = i - pos.entryI;
        const net = pos.acc + basisPnl - COST_EPISODE;
        const marginStress = pos.entryPx != null && pos.maxPx / pos.entryPx - 1 > 0.5;
        episodes.push({ hours, funding: pos.acc, basisPnl, net, marginStress });
        pos = null;
      }
    }
  }
  const totalNet = episodes.reduce((s, e) => s + e.net, 0);
  const hoursIn = episodes.reduce((s, e) => s + e.hours, 0);
  return {
    episodes: episodes.length, totalNetPct: totalNet * 100, hoursIn,
    aprDeployed: hoursIn ? (totalNet / (hoursIn / HOURS_YEAR)) * 100 : 0,
    basisDragPct: episodes.reduce((s, e) => s + e.basisPnl, 0) * 100,
    worstEpisodePct: episodes.length ? Math.min(...episodes.map((e) => e.net)) * 100 : 0,
    marginStress: episodes.filter((e) => e.marginStress).length,
    posEpisodes: episodes.filter((e) => e.net > 0).length
  };
}

p(`# Funding Carry Study — ${dstr}`);
p();
p(`Delta-neutral carry (long spot + short 1x perp) on Hyperliquid funding, 2y hourly. Costs 40bps/episode; basis modeled from recorded premium; margin stress = >50% adverse excursion.`);
p();
p(`## Funding climate (the raw material)`);
p(`| Coin | Mean APR | % hrs > 11% (baseline) | % hrs > 30% | % hrs > 60% | % hrs NEGATIVE |`);
p(`|---|---|---|---|---|---|`);
const data = {};
for (const coin of COINS) {
  const rows = loadCoin(coin); data[coin] = rows;
  const aprs = rows.map((r) => r.funding * HOURS_YEAR * 100);
  const mean = aprs.reduce((s, a) => s + a, 0) / aprs.length;
  const pct = (t) => (aprs.filter((a) => a > t).length / aprs.length * 100).toFixed(1);
  const neg = (aprs.filter((a) => a < 0).length / aprs.length * 100).toFixed(1);
  p(`| ${coin} | ${mean.toFixed(1)}% | ${pct(11)}% | ${pct(30)}% | ${pct(60)}% | ${neg}% |`);
}
p();
p(`## Carry episodes — train (yr 1) picks thresholds, test (yr 2) judges`);
p(`| Coin | T_in/T_out (APR) | Test episodes | Net (test) | APR while deployed | Basis drag | Worst episode | Margin-stress | Benchmark: always-in (test) |`);
p(`|---|---|---|---|---|---|---|---|---|`);

let totalHypotheses = 0;
const verdicts = [];
for (const coin of COINS) {
  const rows = data[coin];
  const mid = Math.floor(rows.length / 2);
  let best = null;
  for (const trailN of [8, 24]) for (const Tin of [20, 40, 60]) for (const Tout of [5, 11]) {
    totalHypotheses++;
    const m = simulate(rows, Tin, Tout, 0, mid, trailN);
    registry.write(JSON.stringify({ t: Date.now(), sym: coin, family: 'funding_carry', params: { trailN, Tin, Tout }, phase: 'train', ...m }) + '\n');
    if (m.episodes >= 3 && (best == null || m.totalNetPct > best.m.totalNetPct)) best = { trailN, Tin, Tout, m };
  }
  if (!best) { p(`| ${coin} | — | insufficient train episodes | | | | | | |`); verdicts.push({ coin, pass: false, why: 'regime too rare in train year' }); continue; }
  const t = simulate(rows, best.Tin, best.Tout, mid, rows.length, best.trailN);
  registry.write(JSON.stringify({ t: Date.now(), sym: coin, family: 'funding_carry', params: { trailN: best.trailN, Tin: best.Tin, Tout: best.Tout }, phase: 'test', ...t }) + '\n');
  // benchmark: always-in carry across the whole test half (one episode, one cost)
  const bench = rows.slice(mid).reduce((s, r) => s + r.funding, 0) - COST_EPISODE + ((rows[mid].premium ?? 0) - (rows[rows.length - 1].premium ?? 0));
  const pass = t.episodes >= 4 && t.totalNetPct > 0 && t.totalNetPct * 1 > bench * 100 && t.marginStress === 0;
  verdicts.push({ coin, pass, t, best, bench: bench * 100 });
  p(`| ${coin} | ${best.trailN}h ${best.Tin}/${best.Tout} | ${t.episodes} (${t.posEpisodes}+) | ${t.totalNetPct.toFixed(2)}% | ${t.aprDeployed.toFixed(1)}% | ${t.basisDragPct.toFixed(2)}% | ${t.worstEpisodePct.toFixed(2)}% | ${t.marginStress} | ${(bench * 100).toFixed(2)}% |`);
}
p();
p(`## Multiple-testing accounting`);
p(`- funding_carry evaluations this run: ${totalHypotheses + COINS.length} (train grid + test), appended to the registry.`);
p();
p(`## Unmodeled risks (stated, not hidden)`);
p(`- Exchange/custody risk on both legs (Hyperliquid + spot venue) — not backtestable.`);
p(`- Funding can flip negative INSIDE an episode faster than the trailing-24h exit reacts (partially captured: episodes accrue the actual negative hours).`);
p(`- Spot leg borrows/transfers not modeled beyond the 40bps envelope.`);
p();
p(`## Verdicts`);
for (const v of verdicts) {
  if (!v.t) { p(`- **${v.coin}: KILL for now** — ${v.why}.`); continue; }
  p(`- **${v.coin}: ${v.pass ? 'FORWARD-TEST CANDIDATE' : 'KILL'}** — test net ${v.t.totalNetPct.toFixed(2)}% vs always-in benchmark ${v.bench.toFixed(2)}%${v.pass ? '' : ' (fails episodes/positivity/benchmark/margin bar)'}.`);
}
registry.end();
const outPath = `data/edgeops/funding-study-${dstr}.md`;
fs.writeFileSync(outPath, out.join('\n'));
console.log(out.join('\n'));
console.log(`\nWritten to ${outPath}`);
