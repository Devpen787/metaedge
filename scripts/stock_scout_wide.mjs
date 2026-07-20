#!/usr/bin/env node
/**
 * WIDE STOCK SCOUT — the real "hundreds/thousands flash through the scanner"
 * version. stock_scout.mjs (the original) only ever looked at Yahoo's own
 * pre-filtered "movers" screeners (~300 names, already curated by YAHOO'S
 * criteria, not ours). This scans the FULL SEC-registered US ticker universe
 * (~10,000 names) in rotating chunks, applying OUR OWN filter and score to
 * every name as it cycles through — nothing is pre-shortlisted before it hits
 * our criteria.
 *
 * Rotation, not one giant sweep: polling all ~10k names every run would hammer
 * Yahoo's unofficial API and risk a block. Instead each run advances through a
 * persisted index by CHUNK names; a full pass over the whole market completes
 * over ~40 runs (~20h at 30-min cadence) — the same trade-off any real screener
 * makes on a huge universe (not everything refreshed every tick).
 *
 * SCORE FUNCTION IS IDENTICAL to stock_scout.mjs's score() (copied verbatim,
 * not reimplemented) so this scanner's candidates are directly comparable to —
 * and gradeable by — the existing stock_grader.mjs with zero changes.
 *
 * Source: SEC EDGAR company_tickers.json (free, no key, ~10,414 registered
 * tickers) for the universe; Yahoo chart (free, no key, already proven) for
 * price/volume. Records into the SAME data/market/stocks/scan-<date>.jsonl the
 * original scout writes, tagged screener:'wide_rotation'.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'data', 'market', 'stocks');
const CHUNK = Number(process.env.WIDE_CHUNK || 250);
const DOLLAR_VOL_FLOOR = Number(process.env.STOCK_DVOL_FLOOR || 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// identical to stock_scout.mjs's score() — same criteria, same units, so
// candidates from either source are directly comparable and gradeable together.
function score({ chg1d, surge, chg52w }) {
  let s = 0;
  s += Math.min(25, Math.max(0, chg1d) * 3);
  s += Math.min(25, Math.max(0, surge - 1) * 12);
  s += (chg52w > -30 && chg52w < 150) ? 15 : 0;
  if (chg52w > 300) s -= 15;
  if (chg1d < -2) s -= 10;
  return Math.round(Math.max(0, s));
}

async function universe() {
  const cacheFp = path.join(DIR, 'universe-cache.json');
  if (fs.existsSync(cacheFp) && Date.now() - fs.statSync(cacheFp).mtimeMs < 7 * 86400000) {
    return JSON.parse(fs.readFileSync(cacheFp, 'utf8'));
  }
  const r = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': 'MetaEdge research@example.com' } });
  const j = await r.json();
  const tickers = [...new Set(Object.values(j).map((x) => String(x.ticker).toUpperCase())
    .filter((t) => /^[A-Z]{1,5}$/.test(t)))]; // sane common-stock symbols only (drops class-share dots, warrants, etc.)
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(cacheFp, JSON.stringify(tickers));
  return tickers;
}

async function chart(sym) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1y&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
    if (r.status === 429) { await sleep(2000); continue; }
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const cl = res?.indicators?.quote?.[0]?.close, vo = res?.indicators?.quote?.[0]?.volume;
    if (!Array.isArray(cl) || cl.length < 25) return null;
    return { cl, vo };
  }
  return null;
}

async function run() {
  fs.mkdirSync(DIR, { recursive: true });
  const uni = await universe();
  const stateFp = path.join(DIR, 'rotation_state.json');
  let idx = 0;
  if (fs.existsSync(stateFp)) { try { idx = JSON.parse(fs.readFileSync(stateFp, 'utf8')).idx || 0; } catch { /**/ } }
  const chunk = [];
  for (let k = 0; k < CHUNK; k++) chunk.push(uni[(idx + k) % uni.length]);
  fs.writeFileSync(stateFp, JSON.stringify({ idx: (idx + CHUNK) % uni.length, updatedAt: Date.now() }));

  const t = Date.now(), day = new Date().toISOString().slice(0, 10);
  const rows = [];
  let checked = 0;
  for (const sym of chunk) {
    const c = await chart(sym); await sleep(150);
    checked++;
    if (!c) continue;
    const n = c.cl.length;
    const price = c.cl[n - 1], prevPrice = c.cl[n - 2], vol = c.vo?.[n - 1];
    if (!(price > 0) || !(prevPrice > 0) || !(vol > 0)) continue;
    let volSum = 0, volN = 0; for (let i = Math.max(0, n - 21); i < n - 1; i++) if (c.vo[i] > 0) { volSum += c.vo[i]; volN++; }
    const avgVol = volN ? volSum / volN : 0;
    const chg1d = (price / prevPrice - 1) * 100;
    const surge = avgVol > 0 ? vol / avgVol : 0;
    const chg52w = (price / c.cl[0] - 1) * 100;
    const dollarVol = price * vol;
    if (!(dollarVol >= DOLLAR_VOL_FLOOR)) continue;   // tradeable only
    const sc = score({ chg1d, surge, chg52w });
    rows.push({ t, sym, screener: 'wide_rotation', price, mcap: null, vol: Math.round(vol), dollarVol: Math.round(dollarVol),
      score: sc, chg1d: +chg1d.toFixed(2), surge: +surge.toFixed(2), chg52w: +chg52w.toFixed(1) });
  }
  if (rows.length) fs.appendFileSync(path.join(DIR, `scan-${day}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const top = rows.slice().sort((a, b) => b.score - a.score).slice(0, 5);
  console.log(`[stocks-wide] ${new Date().toISOString()} chunk=${chunk.length} checked=${checked} candidates=${rows.length} universe=${uni.length} rotationIdx=${idx}->${(idx + CHUNK) % uni.length}`);
  console.log(`  top: ${top.map((r) => `${r.sym}(${r.score}|${r.chg1d}%)`).join('  ')}`);
}
run().catch((e) => console.error('[stocks-wide] failed:', e.message));
