#!/usr/bin/env node
// Prediction-market scout. Snapshots live Polymarket odds so a calibration /
// mispricing study becomes possible LATER — the whole point is that this must
// run continuously for weeks before any edge can be judged. Every hour not
// recorded is calibration data lost forever, which is why it starts now even
// though the strategy comes later.
//
//   node scripts/record_predictions.mjs            # one snapshot (cron hourly)
//
// Output: data/market/predictions/odds-<date>.jsonl — one row per market per run.
// A prediction edge is NOT a candle pattern: you compare the recorded probability
// at time T against what actually resolved, across many markets, to see if the
// crowd is systematically wrong somewhere. That needs history, not a backtest.
import fs from 'node:fs';
import path from 'node:path';

const LIMIT = Number(process.env.PREDICTIONS_LIMIT || 200);
const DIR = path.join(process.cwd(), 'data', 'market', 'predictions');
fs.mkdirSync(DIR, { recursive: true });

const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=${LIMIT}`;
const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
if (!res.ok) { console.error(`[predictions] HTTP ${res.status}`); process.exit(1); }
const markets = await res.json();
if (!Array.isArray(markets)) { console.error('[predictions] unexpected shape'); process.exit(1); }

const t = Date.now();
const day = new Date().toISOString().slice(0, 10);
const file = path.join(DIR, `odds-${day}.jsonl`);
const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; } };

let written = 0;
const lines = [];
for (const m of markets) {
  const prices = parse(m.outcomePrices);
  const outcomes = parse(m.outcomes);
  // Only record markets with real, readable probabilities and liquidity — a
  // missing price is skipped, never coerced to 0.5.
  if (!Array.isArray(prices) || !prices.length) continue;
  lines.push(JSON.stringify({
    t,
    id: m.id ?? m.conditionId ?? m.slug,
    slug: m.slug,
    question: m.question,
    outcomes,
    prices: prices.map(Number),          // the crowd's probabilities right now
    volumeUsd: Number(m.volume) || 0,
    liquidityUsd: Number(m.liquidity) || 0,
    endDate: m.endDate || null,
  }));
  written++;
}
fs.appendFileSync(file, lines.join('\n') + (lines.length ? '\n' : ''));
console.log(`[predictions] ${written} markets snapshotted → ${file}`);
