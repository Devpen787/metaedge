#!/usr/bin/env node
/**
 * FUNDING-CARRY ANALYZER (Lane #7) — is the current high-funding regime a real,
 * hedgeable, cost-surviving carry, or a snapshot mirage?
 *
 * Carry was CLOSED earlier at ~3% APR on 2y data (below a 5% floor). It re-opens
 * only when funding is unusually high (>=20% APR). It currently is on many coins —
 * but a SNAPSHOT overstates it: funding spikes and reverts. This measures the
 * REALIZED average funding over a window (what you'd actually collect, including
 * the periods it flips against you), keeps only HEDGEABLE coins (a liquid Coinbase
 * spot leg — no hedge = it's a directional bet, not carry), subtracts round-trip
 * costs amortized over the holding period, and compares to the 5% floor.
 *
 * HONESTY RAILS:
 *  - REALIZED funding (mean over history), never the snapshot. Flips are averaged
 *    in, because a held position pays during them.
 *  - HEDGEABLE only. Perp-only / DEX-only coins are excluded — you cannot run
 *    delta-neutral carry without a spot leg.
 *  - COST AMORTIZATION. Entry+exit cost is one-time; its APR drag depends entirely
 *    on how long you hold. Reported at a stated HOLD, with the break-even hold.
 *  - No trade. This measures; it never sizes or executes.
 *
 * Usage: node scripts/carry_analyzer.mjs [--min-apr 20] [--window-days 14]
 *        [--hold-days 14] [--cost-rt-pct 1.2] [--floor-apr 5]
 */
// SYSTEM LEGIBILITY — see docs/trading_research_operating_model.md.
export const LEGIBILITY = {
  doing: 'Measures REALIZED (window-averaged, not snapshot) funding APR on every Hyperliquid perp with a live Coinbase spot pair (hedgeable) currently showing |APR|>=MIN_APR (default 20%), net of amortized round-trip cost, against a 5% floor.',
  notYet: [
    'Hyperliquid perp + Coinbase spot only — a coin with high funding on another perp venue, or hedgeable only via a different spot exchange, is invisible to this specific pairing.',
    'This measures a snapshot-in-time candidate set (current |APR|>=20%) — it is not itself a forward-paper harness; no position is opened or tracked here (see the master plan\'s Stage 2 for the forward-paper gate this is meant to feed).',
    'No orders, no sizing — purely a measurement of whether the regime is real, never an execution decision.',
  ],
  why: [
    'Uses REALIZED (mean-over-window) funding, never the current snapshot, because funding spikes and reverts — a position held through the full window pays during the reversions too, so averaging is the honest number, not the flattering one.',
    'HEDGEABLE-only filter (excludes perp-only/DEX-only coins) because delta-neutral carry structurally requires a spot leg — without one this would be a directional bet mislabeled as carry.',
    'Cost is amortized over the stated HOLD period (not charged once and ignored) because entry+exit cost is one-time but its APR drag depends entirely on how long the position is actually held — reported alongside the break-even hold length so the floor comparison is honest at the stated horizon.',
  ],
};

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const MIN_APR = Number(flag('min-apr', '20'));
const WINDOW = Number(flag('window-days', '14'));
const HOLD = Number(flag('hold-days', String(WINDOW)));
const COST_RT = Number(flag('cost-rt-pct', '1.2'));   // round-trip perp+spot taker + slippage, %
const FLOOR = Number(flag('floor-apr', '5'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ANN = 24 * 365 * 100;   // hourly rate -> APR %

async function hl(body) {
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? r.json() : null;
}

async function main() {
  const meta = await hl({ type: 'metaAndAssetCtxs' });
  if (!meta) { console.log('Hyperliquid unreachable'); process.exit(1); }
  const universe = meta[0]?.universe || [], ctx = meta[1] || [];

  // hedgeable = has an online Coinbase USD spot pair
  const cb = await fetch('https://api.exchange.coinbase.com/products', { headers: { 'User-Agent': 'MetaEdge/1.0' } }).then((r) => r.ok ? r.json() : []).catch(() => []);
  const hedgeable = new Set(cb.filter((p) => p.quote_currency === 'USD' && p.status === 'online' && !p.trading_disabled).map((p) => p.base_currency));

  // candidates: current |APR| >= MIN_APR AND hedgeable
  const cands = [];
  for (let i = 0; i < universe.length; i++) {
    const name = universe[i].name, f = Number(ctx[i]?.funding);
    if (!Number.isFinite(f)) continue;
    const apr = f * ANN;
    if (Math.abs(apr) >= MIN_APR && hedgeable.has(name)) cands.push({ name, currentApr: apr });
  }
  console.log(`\n=== Funding-carry analyzer — realized carry vs ${FLOOR}% floor, HEDGEABLE coins only ===`);
  console.log(`  candidates: current |APR|>=${MIN_APR}% AND Coinbase-spot-hedgeable = ${cands.length}`);
  console.log(`  window ${WINDOW}d realized funding | round-trip cost ${COST_RT}% amortized over ${HOLD}d hold\n`);
  if (!cands.length) { console.log('  none — carry stays closed at these conditions.\n'); return; }

  const start = Date.now() - WINDOW * 86400 * 1000;
  const out = [];
  for (const c of cands) {
    const hist = await hl({ type: 'fundingHistory', coin: c.name, startTime: start });
    await sleep(150);
    if (!Array.isArray(hist) || hist.length < 12) continue;
    const rates = hist.map((x) => Number(x.fundingRate)).filter(Number.isFinite);
    const meanF = rates.reduce((s, v) => s + v, 0) / rates.length;
    const realizedApr = Math.abs(meanF * ANN);                  // collectable gross, direction = sign(meanF), flips averaged in
    const costApr = COST_RT / (HOLD / 365);                     // one-time cost as an APR drag over the hold
    const netApr = realizedApr - costApr;
    // fraction of the window funding stayed the collectable sign (persistence quality)
    const sameSign = rates.filter((r) => Math.sign(r) === Math.sign(meanF)).length / rates.length;
    out.push({ ...c, realizedApr, netApr, sameSignPct: sameSign * 100, n: rates.length });
  }
  out.sort((a, b) => b.netApr - a.netApr);
  console.log(`  ${'coin'.padEnd(8)} ${'nowAPR'.padStart(9)} ${'realizedAPR'.padStart(12)} ${'netAPR'.padStart(9)} ${'persist'.padStart(8)}  verdict`);
  let flags = 0;
  for (const r of out) {
    const pass = r.netApr >= FLOOR && r.sameSignPct >= 65;      // clears floor AND funding mostly held its sign
    if (pass) flags++;
    console.log(`  ${r.name.padEnd(8)} ${(r.currentApr >= 0 ? '+' : '') + r.currentApr.toFixed(0) + '%'} ${(r.realizedApr).toFixed(1).padStart(11) + '%'} ${(r.netApr >= 0 ? '+' : '') + r.netApr.toFixed(1) + '%'} ${r.sameSignPct.toFixed(0).padStart(7) + '%'}  ${pass ? 'CLEARS FLOOR' : (r.netApr < FLOOR ? 'below floor' : 'too flippy')}`);
  }
  const breakeven = COST_RT / (Math.max(...out.map((r) => r.realizedApr), 1) / 100 - FLOOR / 100) * 365;
  console.log(`\n  realizedAPR = |mean funding| over ${WINDOW}d (flips averaged in). netAPR subtracts ${COST_RT}% round-trip over a ${HOLD}d hold.`);
  console.log(`  persist = % of window funding kept its collectable sign; <65% means you'd fight reversals.`);
  console.log(`  Sensitivity: cost drag is ${(COST_RT / (HOLD / 365)).toFixed(1)}% APR at a ${HOLD}d hold — a shorter hold kills it, a longer hold needs the funding to persist.`);
  console.log(`  CARRY VERDICT ${new Date().toISOString()} candidates=${out.length} FLAGS=${flags}${flags ? '' : ' (no hedgeable coin clears the floor net of costs)'}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => console.error('[carry-analyzer] failed:', e.message));
