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
const PRED_RESOLUTION_TRACK_LIMIT = Number(process.env.PREDICTION_RESOLUTION_TRACK_LIMIT || 2_000);
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

function trackedPredictionIds(): string[] {
  try {
    const files = fs.readdirSync(PRED_DIR).filter((file) => file.startsWith('odds-') && file.endsWith('.jsonl')).sort().reverse();
    const ids = new Set<string>();
    for (const file of files) {
      const lines = fs.readFileSync(path.join(PRED_DIR, file), 'utf8').split('\n').filter(Boolean).reverse();
      for (const line of lines) {
        try { const id = String(JSON.parse(line).id || ''); if (id) ids.add(id); } catch { /* malformed evidence is skipped */ }
        if (ids.size >= PRED_RESOLUTION_TRACK_LIMIT) return [...ids];
      }
    }
    return [...ids];
  } catch { return []; }
}

export async function snapshotPredictionResolutions(): Promise<number> {
  const ids = trackedPredictionIds();
  if (!ids.length) return 0;
  const known = new Set<string>();
  try {
    for (const file of fs.readdirSync(PRED_DIR).filter((name) => name.startsWith('resolutions-') && name.endsWith('.jsonl'))) {
      for (const line of fs.readFileSync(path.join(PRED_DIR, file), 'utf8').split('\n').filter(Boolean)) {
        try { known.add(String(JSON.parse(line).id)); } catch { /* retain readable rows only */ }
      }
    }
  } catch { /* first resolution run */ }
  const freshIds = ids.filter((id) => !known.has(id));
  const resolved: any[] = [];
  for (let i = 0; i < freshIds.length; i += 50) {
    const url = new URL('https://gamma-api.polymarket.com/markets');
    for (const id of freshIds.slice(i, i + 50)) url.searchParams.append('id', id);
    const res = await fetch(url, { headers: { 'User-Agent': 'MetaEdge/1.0' } });
    if (!res.ok) throw new Error(`gamma resolution HTTP ${res.status}`);
    const markets = await res.json();
    if (!Array.isArray(markets)) throw new Error('unexpected gamma resolution shape');
    for (const market of markets) {
      if (!market.closed || market.umaResolutionStatus !== 'resolved') continue;
      const prices = parseMaybeJson(market.outcomePrices);
      if (!Array.isArray(prices)) continue;
      resolved.push({ t: Date.now(), id: String(market.id), prices: prices.map(Number),
        resolvedAt: Date.parse(market.closedTime || market.updatedAt || '') || Date.now(),
        resolutionStatus: market.umaResolutionStatus, source: 'gamma-api.polymarket.com' });
    }
  }
  if (!resolved.length) return 0;
  fs.mkdirSync(PRED_DIR, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(path.join(PRED_DIR, `resolutions-${day}.jsonl`), `${resolved.map((row) => JSON.stringify(row)).join('\n')}\n`);
  return resolved.length;
}

export function startPredictionScout() {
  if (process.env.PREDICTION_SCOUT_DISABLED === 'true') {
    console.log('[scout:predictions] disabled via PREDICTION_SCOUT_DISABLED');
    return;
  }
  const run = () => snapshotPredictions()
    .then((n) => console.log(`[scout:predictions] recorded ${n} markets`))
    .catch((err) => console.warn('[scout:predictions] snapshot failed:', err.message)); // a gap is honest; never fabricated
  const resolve = () => snapshotPredictionResolutions()
    .then((n) => console.log(`[scout:predictions] recorded ${n} newly resolved tracked markets`))
    .catch((err) => console.warn('[scout:predictions] resolution check failed:', err.message));
  setTimeout(run, 20_000).unref();
  setTimeout(resolve, 30_000).unref();
  setInterval(run, PRED_INTERVAL_MS).unref();
  setInterval(resolve, PRED_INTERVAL_MS).unref();
  console.log(`[scout:predictions] recording Polymarket odds every ${Math.round(PRED_INTERVAL_MS / 60000)}min → data/market/predictions/`);
}
