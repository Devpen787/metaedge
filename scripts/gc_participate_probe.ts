/**
 * GC-PARTICIPATE PROBE — the paper book now PARTICIPATES on any bull-regime + volume-confirmed
 * coin (wider reach), still TAGS the strict frozen-forward-test subset, and applies a per-symbol
 * COOLDOWN after an exit so it can't churn back into a fresh loser. NO PRODUCTION DATA CHANGE.
 *
 * Run: npx tsx scripts/gc_participate_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');
const ind = (o: Partial<any>) => ({ sma50: 110, sma200: 100, sma50Prev: 99, sma200Prev: 100, vol50dAvg: 1e6, vol24hUsd: 5e6, days: 300, lastClose: 110, return30dPct: 5, realizedVolPctDaily: 4, ...o }) as any;

(async () => {
  process.env.GC_COOLDOWN_HOURS = '72';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcpart-'));
  process.env.DATABASE_URL = path.join(dir, 'db.json');
  (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });
  const origRandom = Math.random; Math.random = () => 0.5;

  const gc = await import('../server/decision/golden_cross_scanner.js');
  const prices = await import('../server/prices.js');
  const trades = await import('../server/trades.js');
  const storage = await import('../server/storage.js');
  const risk = await import('../server/decision/risk_loop.js');

  // A) reach + strict tag
  const fresh = gc.evaluateGoldenCrossEntry(ind({}));                                   // fresh cross
  const bullNotFreshP = gc.evaluateGoldenCrossEntry(ind({ sma50Prev: 105 }), { mode: 'participate' }); // bull, not fresh
  const bullNotFreshS = gc.evaluateGoldenCrossEntry(ind({ sma50Prev: 105 }), { mode: 'strict' });
  const notBull = gc.evaluateGoldenCrossEntry(ind({ sma50: 90 }), { mode: 'participate' });            // 50<200
  const lowVol = gc.evaluateGoldenCrossEntry(ind({ sma50Prev: 105, vol24hUsd: 2e6 }), { mode: 'participate' });
  const reachOk = fresh.enter && fresh.strictCross === true
    && bullNotFreshP.enter && bullNotFreshP.strictCross === false      // participate takes bull-not-fresh, tagged non-strict
    && bullNotFreshS.enter === false                                   // strict rejects non-fresh
    && notBull.enter === false && lowVol.enter === false;

  // B) cooldown written on exit
  const { ownerId, agentId } = gc.ensureGoldenCrossBook();
  prices.serverPrices['BTC'].price = 100;
  gc.openGoldenCrossPosition(ownerId, agentId, 'BTC', 100, undefined);
  prices.serverPrices['BTC'].price = 120; risk.checkStopsOnce();       // ratchet
  prices.serverPrices['BTC'].price = 101; risk.checkStopsOnce();       // flatten (15% give-back)
  const posAfter = trades.agentPosition(ownerId, agentId, 'BTC');
  const cd = storage.readDatabase().cooldowns?.[`${agentId}:BTC`] ?? 0;
  const cooldownOk = posAfter.size < 1e-6 && cd > Date.now() && cd <= Date.now() + 73 * 3_600_000;
  Math.random = origRandom;

  const ok = reachOk && cooldownOk;
  const cls = ok ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== GC-PARTICIPATE PROBE ===');
  console.log(JSON.stringify({
    id: 'GC_PARTICIPATION_AND_COOLDOWN', class: cls,
    checks: {
      participateTakesBullNotFresh: bullNotFreshP.enter && bullNotFreshP.strictCross === false,
      strictStillRequiresFreshCross: bullNotFreshS.enter === false && fresh.strictCross === true,
      rejectsNotBullAndLowVolume: notBull.enter === false && lowVol.enter === false,
      cooldownWrittenOnExit: cooldownOk,
    },
    evidence: { fresh: { enter: fresh.enter, strict: fresh.strictCross }, bullNotFresh: { enter: bullNotFreshP.enter, strict: bullNotFreshP.strictCross }, cooldownHoursFromNow: cd ? +((cd - Date.now()) / 3_600_000).toFixed(1) : 0 },
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? '\nCLOSED: participates on bull-regime + volume (tagged non-strict), strict subset preserved, cooldown set on exit.\n'
    : '\nOPEN: reach/tag/cooldown not correct.\n');
  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
