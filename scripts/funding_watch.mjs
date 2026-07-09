#!/usr/bin/env node
/**
 * Funding harvest tripwire (Track 3) — checks Hyperliquid's live hourly funding
 * for ETH/BTC/SOL via the public API (no wallet needed) and flags harvestable
 * regimes. Read-only; the harvest trade itself always needs operator approval.
 *
 * The trade when it fires: funding-positive → SHORT perp + hold spot (delta-
 * neutral) collects funding from euphoric longs. Baseline (~11% APR) is not
 * worth our size; the tripwire is a SUSTAINED spike.
 *
 * Usage: node scripts/funding_watch.mjs
 */
import { fundingAprPercent } from '../server/units.mjs';

const THRESHOLD_HOURLY = 0.0001; // 0.01%/hr ≈ 87% APR — harvest territory

const res = await fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'metaAndAssetCtxs' })
});
const [meta, ctxs] = await res.json();
const idx = Object.fromEntries(meta.universe.map((u, i) => [u.name, i]));

console.log(`\n  Funding watch — ${new Date().toISOString()}  (tripwire: ${(THRESHOLD_HOURLY * 100).toFixed(3)}%/hr ≈ 87% APR)\n`);
let fired = false;
for (const sym of ['ETH', 'BTC', 'SOL']) {
  const ctx = ctxs[idx[sym]];
  if (!ctx) continue;
  const hourly = Number(ctx.funding);
  const apr = fundingAprPercent(hourly) ?? 0;
  const flag = Math.abs(hourly) >= THRESHOLD_HOURLY;
  if (flag) fired = true;
  console.log(`  ${sym.padEnd(4)} funding ${(hourly * 100).toFixed(5)}%/hr  ≈ ${apr.toFixed(1)}% APR  ${flag ? (hourly > 0 ? '🔥 HARVEST: short perp + hold spot' : '🔥 HARVEST (inverse): long perp + short spot') : '· baseline, no trade'}`);
}
console.log(fired
  ? `\n  Tripwire FIRED — verify it's sustained (re-check in 1h) before proposing the delta-neutral harvest to the operator.\n`
  : `\n  No harvest regime. Do nothing. Re-run anytime (free, read-only).\n`);
if (!fired) {
  // Declined-opportunity evidence: restraint counts, same as executed trades do.
  const fs = await import('node:fs');
  fs.mkdirSync('data/edgeops', { recursive: true });
  fs.appendFileSync('data/edgeops/declined-local.jsonl',
    JSON.stringify({ t: new Date().toISOString(), source: 'funding_watch', family: 'funding_harvest', reason: 'TRIGGER_NOT_MET' }) + '\n');
}
process.exit(fired ? 10 : 0);
