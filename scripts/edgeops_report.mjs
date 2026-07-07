#!/usr/bin/env node
/**
 * EdgeOps weekly edge report — turns thesis-tagged paper trades into kill/keep
 * decisions. Implements Loop 6 of docs/edgeops/EDGEOPS_OPERATING_LOOP.md.
 *
 * Honesty rules (from the operating loop):
 *   - Only realized (closed, pnl != null) trades count toward expectancy.
 *   - Trades without a complete thesis are counted but excluded from edge stats.
 *   - Weak sample sizes are labeled weak (n < 30). No profitability or
 *     live-readiness claims, ever — this is paper evidence, not alpha.
 *
 * Usage:  node scripts/edgeops_report.mjs [--db data/db.json] [--days 7]
 * Output: console summary + data/edgeops/report-<date>.md
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DB_PATH = flag('db', 'data/db.json');
const DAYS = Number(flag('days', 7));
const WEAK_N = 30;

if (!fs.existsSync(DB_PATH)) { console.error(`No db at ${DB_PATH}`); process.exit(1); }
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const since = Date.now() - DAYS * 86_400_000;
const all = (db.trades || []).filter((t) => t.timestamp >= since);

const complete = all.filter((t) => t.edgeops === 'complete');
const missing = all.filter((t) => t.edgeops !== 'complete');
const realized = complete.filter((t) => typeof t.pnl === 'number');

// Per signal family: expectancy = mean realized pnl per closed trade.
const families = {};
for (const t of realized) {
  const fam = t.thesis?.signalFamily || 'unknown';
  (families[fam] ||= { n: 0, wins: 0, losses: 0, flats: 0, pnl: 0, winSum: 0, lossSum: 0, cards: new Set() }).n++;
  const f = families[fam];
  f.pnl += t.pnl;
  if (t.thesis?.cardId) f.cards.add(t.thesis.cardId);
  if (t.pnl > 0) { f.wins++; f.winSum += t.pnl; }
  else if (t.pnl < 0) { f.losses++; f.lossSum += t.pnl; }
  else f.flats++;
}

const regimes = {};
for (const t of complete) { const r = t.thesis?.regime || 'unknown'; regimes[r] = (regimes[r] || 0) + 1; }

const lines = [];
const p = (s = '') => lines.push(s);
const dstr = new Date().toISOString().slice(0, 10);
const windowStr = `${new Date(since).toISOString().slice(0, 10)} → ${dstr}`;

p(`# EdgeOps Edge Report — ${dstr}`);
p();
p(`Data window: **${windowStr}** (${DAYS}d) · Source: \`${DB_PATH}\` (paper trades only)`);
p();
p(`## Coverage`);
p(`- Paper trades in window: **${all.length}**`);
p(`- With complete thesis (edgeops_complete): **${complete.length}**`);
p(`- Missing thesis (excluded from edge stats): **${missing.length}**`);
p(`- Realized (closed) thesis-complete trades: **${realized.length}**`);
p();
p(`## Expectancy by signal family (realized, thesis-complete only)`);
p();
p(`| Family | n | Win rate | Avg win | Avg loss | Expectancy/trade | Total P&L | Sample |`);
p(`|---|---|---|---|---|---|---|---|`);
const famRows = Object.entries(families).sort((a, b) => b[1].n - a[1].n);
for (const [fam, f] of famRows) {
  const wr = f.n ? (f.wins / f.n * 100).toFixed(0) + '%' : '—';
  const aw = f.wins ? '$' + (f.winSum / f.wins).toFixed(2) : '—';
  const al = f.losses ? '$' + (f.lossSum / f.losses).toFixed(2) : '—';
  const ex = '$' + (f.pnl / f.n).toFixed(2);
  p(`| ${fam} | ${f.n} | ${wr} | ${aw} | ${al} | ${ex} | $${f.pnl.toFixed(2)} | ${f.n < WEAK_N ? '⚠ weak (<30)' : 'ok'} |`);
}
if (!famRows.length) p(`| _no realized thesis-complete trades yet_ | | | | | | | |`);
p();
p(`## Declined opportunities (restraint)`);
const declined = {}; // "source|family|reason" -> count, within window
try {
  const daily = JSON.parse(fs.readFileSync('data/edgeops/declined-daily.json', 'utf8'));
  const cutoff = new Date(since).toISOString().slice(0, 10);
  for (const [k, n] of Object.entries(daily)) {
    const [date, ...rest] = k.split('|');
    if (date >= cutoff) declined[rest.join('|')] = (declined[rest.join('|')] || 0) + n;
  }
} catch { /* no server-side counters yet */ }
try {
  for (const line of fs.readFileSync('data/edgeops/declined-local.jsonl', 'utf8').trim().split('\n')) {
    const e = JSON.parse(line);
    if (new Date(e.t).getTime() >= since) { const k = `${e.source}|${e.family}|${e.reason}`; declined[k] = (declined[k] || 0) + 1; }
  }
} catch { /* no local decline log */ }
const declinedTotal = Object.values(declined).reduce((s, n) => s + n, 0);
if (declinedTotal) {
  p(`| Source | Family | Reason | Count |`);
  p(`|---|---|---|---|`);
  for (const [k, n] of Object.entries(declined).sort((a, b) => b[1] - a[1])) { const [s2, f2, r2] = k.split('|'); p(`| ${s2} | ${f2} | ${r2} | ${n} |`); }
  p();
  p(`- **Restraint ratio:** ${declinedTotal} declined : ${complete.length} executed (thesis-complete)`);
} else {
  p(`- No declined-opportunity counters in window yet.`);
}
p(`- Declines are evidence of process discipline — the system refusing when conditions aren't met. They are NOT evidence of edge.`);
p();
p(`## Post-trade reviews (Loop 5)`);
const reviewed = realized.filter((t) => t.review);
p(`- Realized trades reviewed: **${reviewed.length}/${realized.length}**`);
const decisions = {};
for (const t of reviewed) decisions[t.review.nextDecision] = (decisions[t.review.nextDecision] || 0) + 1;
for (const [d, n] of Object.entries(decisions)) p(`- ${d}: ${n}`);
const drivers = {};
for (const t of reviewed) drivers[t.review.outcomeDriver] = (drivers[t.review.outcomeDriver] || 0) + 1;
if (Object.keys(drivers).length) p(`- outcome drivers: ${Object.entries(drivers).map(([k, v]) => `${k}(${v})`).join(', ')}`);
p();
p(`## Regime distribution (thesis-complete trades)`);
for (const [r, n] of Object.entries(regimes)) p(`- ${r}: ${n}`);
if (!Object.keys(regimes).length) p(`- none yet`);
p();
p(`## Cards with live data`);
const cardsSeen = new Set(complete.map((t) => t.thesis?.cardId).filter(Boolean));
for (const c of cardsSeen) p(`- ${c}`);
if (!cardsSeen.size) p(`- none yet — no card has produced a tagged trade`);
p();
p(`## Honest limits`);
p(`- Paper evidence only. Nothing here is a profitability or live-readiness claim.`);
p(`- Families with n < ${WEAK_N} are statistically weak — do not act on them.`);
p(`- Fills include a conservative cost adjustment (PAPER_COST_BPS/side, default 10bps — stricter than our measured real-venue costs), so expectancy is cost-pessimistic, not flattered.`);
p();
p(`## Recommended next step (exactly one)`);
if (!complete.length) {
  p(`- Engage an autopilot agent so the sample factory starts producing thesis-complete trades.`);
} else if (!realized.length) {
  p(`- Positions are open but unrealized — wait for closes, then re-run. No decisions on unrealized data.`);
} else {
  const weakest = famRows.filter(([, f]) => f.n < WEAK_N).map(([f]) => f);
  const worst = famRows.filter(([, f]) => f.n >= WEAK_N && f.pnl / f.n < 0).sort((a, b) => a[1].pnl / a[1].n - b[1].pnl / b[1].n)[0];
  if (worst) p(`- Kill or narrow card \`${[...families[worst[0]].cards][0] || worst[0]}\` — negative expectancy ($${(worst[1].pnl / worst[1].n).toFixed(2)}/trade) on an adequate sample (n=${worst[1].n}).`);
  else if (weakest.length) p(`- Keep building sample size for: ${weakest.join(', ')} (all below n=${WEAK_N}).`);
  else p(`- All families have adequate samples — review the top family's card for a promotion decision.`);
}
p();

const out = lines.join('\n');
fs.mkdirSync('data/edgeops', { recursive: true });
const outPath = `data/edgeops/report-${dstr}.md`;
fs.writeFileSync(outPath, out);
console.log(out);
console.log(`\nWritten to ${outPath}`);
