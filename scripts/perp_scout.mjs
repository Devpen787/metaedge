#!/usr/bin/env node
/**
 * PERP STRUCTURAL SCOUT — next asset class, and a genuinely DIFFERENT angle than
 * our crypto/stock momentum radars. It does NOT predict price direction (the
 * crowded game). It records the perp market's STRUCTURE — funding, open interest,
 * premium, volume — to test a mechanical hypothesis:
 *
 *   EXTREME FUNDING = CROWDED POSITIONING that unwinds. When funding is very
 *   negative (shorts paying longs heavily), positioning is crowded short -> squeeze
 *   UP; very positive -> crowded long -> flush DOWN. The signal is CONTRARIAN:
 *   fade the funding. This is reading forced flow, not forecasting sentiment.
 *
 * We already MEASURED funding CARRY (delta-neutral collect) as marginal. This is a
 * different bet: DIRECTIONAL mean-reversion of crowded funding, on liquid perps.
 *
 * HONEST RAILS:
 *  - Liquid perps only (OI + volume floors) — extreme funding on a $0.3M coin is
 *    untradeable noise.
 *  - Records blind + tags a contrarian direction; the pessimistic grader (forward,
 *    net of costs) is the arbiter. RADAR not buy-signal.
 *  - Read-only Hyperliquid; no auth, no order path. Live locked.
 *
 * Records data/market/perps/scan-<date>.jsonl. VM cron ~ every 30m.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'market', 'perps');
const VOL_FLOOR = Number(process.env.PERP_VOL_FLOOR || 2e6);    // $2M day volume: tradeable mid-tier
const OI_FLOOR = Number(process.env.PERP_OI_FLOOR || 1e6);      // $1M open interest
const ANN = 24 * 365 * 100;
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const t = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
  if (!r.ok) { console.error(`[perps] HTTP ${r.status}`); return; }
  const j = await r.json();
  const meta = j[0]?.universe || [], ctx = j[1] || [];
  const rows = [];
  for (let i = 0; i < meta.length; i++) {
    const c = ctx[i]; if (!c) continue;
    const price = N(c.markPx), funding = N(c.funding), oi = N(c.openInterest), dayVol = N(c.dayNtlVlm), prevDay = N(c.prevDayPx), oracle = N(c.oraclePx);
    if (!(price > 0) || funding == null) continue;
    const oiUsd = oi != null ? oi * price : null;
    if (!(dayVol >= VOL_FLOOR) || !(oiUsd >= OI_FLOOR)) continue;                  // liquid, tradeable only
    const fundingApr = funding * ANN;
    const chg24h = prevDay > 0 ? (price / prevDay - 1) * 100 : null;
    const premium = oracle > 0 ? (price / oracle - 1) * 100 : null;
    // contrarian-funding score: extreme |funding| = crowded; direction fades it
    let score = Math.min(45, Math.abs(fundingApr) / 3);                            // 135% APR -> 45
    score += Math.min(15, Math.log10(Math.max(1, dayVol / 1e6)) * 8);             // participation
    rows.push({ t, coin: meta[i].name, price, fundingApr: +fundingApr.toFixed(0),
      oiUsd: Math.round(oiUsd), dayVol: Math.round(dayVol), chg24h: chg24h == null ? null : +chg24h.toFixed(2),
      premium: premium == null ? null : +premium.toFixed(3),
      score: Math.round(score), direction: funding < 0 ? 'long' : 'short' });      // fade the funding
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `scan-${day}.jsonl`), rows.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const top = rows.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  console.log(`[perps] ${new Date().toISOString()} universe=${rows.length} liquid perps`);
  console.log(`  top by funding-extreme: ${top.map((r) => `${r.coin}(${r.score}|${r.fundingApr}%APR ${r.direction})`).join('  ')}`);
}
run().catch((e) => console.error('[perps] scout failed:', e.message));
