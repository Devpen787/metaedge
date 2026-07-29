#!/usr/bin/env node
/**
 * Funding-history backfill (charter step 3: DATA FIRST) — hourly funding rate
 * AND premium (perp-vs-oracle basis) from Hyperliquid's public API. The premium
 * series is what lets a carry study model basis risk instead of hand-waving it.
 *
 * Usage: node scripts/backfill_funding.mjs (--coins A,B | --universe-file PATH) [--days 730]
 * Output: data/market/funding-hist-<COIN>.jsonl
 */
import fs from 'node:fs';
import { explicitUniverse, flag } from './lib/universe.mjs';

const args = process.argv.slice(2);
const COINS = explicitUniverse(args, 'coins');
const DAYS = Number(flag(args, 'days', 730));

fs.mkdirSync('data/market', { recursive: true });

for (const coin of COINS) {
  const out = `data/market/funding-hist-${coin}.jsonl`;
  const lines = [];
  let from = Date.now() - DAYS * 86_400_000;
  for (let page = 0; page < 60; page++) {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'fundingHistory', coin, startTime: from })
    });
    if (!res.ok) { console.log(`  ${coin}: HTTP ${res.status}, stopping (have ${lines.length})`); break; }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const r of rows) lines.push(JSON.stringify({ t: r.time, funding: Number(r.fundingRate), premium: Number(r.premium) }));
    from = rows[rows.length - 1].time + 1;
    if (rows.length < 500) break;
    await new Promise((r) => setTimeout(r, 200)); // polite pagination
  }
  fs.writeFileSync(out, lines.join('\n') + '\n');
  const first = lines.length ? new Date(JSON.parse(lines[0]).t).toISOString().slice(0, 10) : '—';
  console.log(`  ${coin.padEnd(5)} ${lines.length} hourly rows (${first} → now) → ${out}`);
}
