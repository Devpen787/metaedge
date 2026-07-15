import fs from 'fs';
import path from 'path';

// Always-on data scouts for lanes that need lead time. A scout only RECORDS — it
// never trades and never decides. The point is that recording must run for weeks
// before its lane can be researched, so the clock starts the moment the server
// boots, in parallel with every other lane.
//
// Crypto spot/perp recording already lives in server/recorder.ts. This adds the
// prediction-market scout; cross-chain and options are NOT here on purpose (see
// docs/EDGE_PORTFOLIO_OS.md — cross-chain quotes need wallet/venue access, and
// options have no cheap quality feed, so neither can honestly scout yet).

const PRED_DIR = path.join(process.cwd(), 'data', 'market', 'predictions');
const PRED_LIMIT = Number(process.env.PREDICTIONS_LIMIT || 200);
const PRED_INTERVAL_MS = 60 * 60 * 1000; // hourly is plenty for slow-moving odds

function parseMaybeJson(value: unknown) {
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return value; }
}

async function snapshotPredictions(): Promise<number> {
  const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=${PRED_LIMIT}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
  if (!res.ok) throw new Error(`gamma HTTP ${res.status}`);
  const markets = await res.json();
  if (!Array.isArray(markets)) throw new Error('unexpected gamma shape');

  fs.mkdirSync(PRED_DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(PRED_DIR, `odds-${day}.jsonl`);
  const lines: string[] = [];
  for (const m of markets) {
    const prices = parseMaybeJson(m.outcomePrices);
    if (!Array.isArray(prices) || !prices.length) continue; // missing odds are skipped, never coerced
    lines.push(JSON.stringify({
      t,
      id: m.id ?? m.conditionId ?? m.slug,
      slug: m.slug,
      question: m.question,
      outcomes: parseMaybeJson(m.outcomes),
      prices: prices.map(Number),
      volumeUsd: Number(m.volume) || 0,
      liquidityUsd: Number(m.liquidity) || 0,
      endDate: m.endDate || null,
    }));
  }
  if (lines.length) fs.appendFileSync(file, lines.join('\n') + '\n');
  return lines.length;
}

export function startPredictionScout() {
  if (process.env.PREDICTION_SCOUT_DISABLED === 'true') {
    console.log('[scout:predictions] disabled via PREDICTION_SCOUT_DISABLED');
    return;
  }
  const run = () => snapshotPredictions()
    .then((n) => console.log(`[scout:predictions] recorded ${n} markets`))
    .catch((err) => console.warn('[scout:predictions] snapshot failed:', err.message)); // a gap is honest; never fabricated
  setTimeout(run, 20_000).unref();
  setInterval(run, PRED_INTERVAL_MS).unref();
  console.log(`[scout:predictions] recording Polymarket odds every ${Math.round(PRED_INTERVAL_MS / 60000)}min → data/market/predictions/`);
}
