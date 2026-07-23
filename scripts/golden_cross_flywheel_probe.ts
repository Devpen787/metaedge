/**
 * GOLDEN-CROSS FLYWHEEL PROBE — the whole loop end to end, in an isolated DB. NO PRODUCT CHANGE.
 *
 *  1) ENTRY LOGIC is exactly the researched edge: a fresh 50/200 cross + >=3x volume + >=$1M
 *     turnover enters; dropping any one gate does not.
 *  2) ENTRY ACTION opens a paper long and tags it with a 15% trailing stop in db.trailingState.
 *  3) EXIT: the Risk-OS trails the peak and flattens on a 15% give-back (multi-symbol path).
 *
 * FACT_OPEN unless all three hold. Run: npx tsx scripts/golden_cross_flywheel_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');
const ind = (o: Partial<any>) => ({ sma50: 110, sma200: 100, sma50Prev: 99, sma200Prev: 100, vol50dAvg: 1e6, vol24hUsd: 5e6, days: 300, lastClose: 110, ...o }) as any;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcflywheel-'));
  process.env.DATABASE_URL = path.join(dir, 'db.json');
  (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });
  const origRandom = Math.random; Math.random = () => 0.5;

  const gc = await import('../server/decision/golden_cross_scanner.js');
  const prices = await import('../server/prices.js');
  const trades = await import('../server/trades.js');
  const storage = await import('../server/storage.js');
  const risk = await import('../server/decision/risk_loop.js');

  // 1) ENTRY LOGIC — the gate truth table (fresh cross + 3x vol + $1M)
  const passAll = gc.evaluateGoldenCrossEntry(ind({})).enter;
  const noCross = gc.evaluateGoldenCrossEntry(ind({ sma50Prev: 101 })).enter;    // already above yesterday → not fresh
  const noVol = gc.evaluateGoldenCrossEntry(ind({ vol24hUsd: 2e6 })).enter;      // 2x < 3x surge
  const illiquid = gc.evaluateGoldenCrossEntry(ind({ vol50dAvg: 1e5, vol24hUsd: 4e5 })).enter; // 4x surge but < $1M
  const gatesCorrect = passAll && !noCross && !noVol && !illiquid;

  // 2) ENTRY ACTION — open + tag trailing stop (use BTC so the exit price is controllable)
  const { ownerId, agentId } = gc.ensureGoldenCrossBook();
  prices.serverPrices['BTC'].price = 100;
  const opened = gc.openGoldenCrossPosition(ownerId, agentId, 'BTC', 100);
  const posOpen = trades.agentPosition(ownerId, agentId, 'BTC');
  const trail = storage.readDatabase().trailingState?.[`${agentId}:BTC`];
  const entryWorks = opened && posOpen.size > 0 && !!trail && trail.trailPct === 15 && trail.highWaterMark === 100;

  // 3) EXIT — rally then give back 15% from the peak; the Risk-OS must flatten
  prices.serverPrices['BTC'].price = 120; risk.checkStopsOnce();               // ratchet peak → 120
  const hwm = JSON.parse(fs.readFileSync(process.env.DATABASE_URL!, 'utf8')).trailingState?.[`${agentId}:BTC`]?.highWaterMark;
  prices.serverPrices['BTC'].price = 101; risk.checkStopsOnce();               // 101 <= 120*0.85=102 → flatten
  const posAfter = trades.agentPosition(ownerId, agentId, 'BTC');
  const exitWorks = hwm === 120 && posAfter.size < 1e-6;
  Math.random = origRandom;

  const cls = gatesCorrect && entryWorks && exitWorks ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== GOLDEN-CROSS FLYWHEEL PROBE ===');
  console.log(JSON.stringify({
    id: 'GOLDEN_CROSS_PAPER_FLYWHEEL',
    class: cls,
    title: 'scan → volume-confirmed entry → 15% trailing-stop exit, end to end in paper',
    checks: {
      entryGatesMatchResearch: gatesCorrect,             // fresh cross + 3x vol + $1M only
      entryOpensAndTagsTrailingStop: entryWorks,
      riskOsTrailsAndFlattens: exitWorks,
    },
    evidence: {
      gates: { passAll, noCross, noVol, illiquid },
      entry: { opened, posSize: posOpen.size, trail },
      exit: { peakPersisted: hwm, posSizeAfterGiveBack: posAfter.size },
    },
    codePath: 'server/decision/golden_cross_scanner.ts + risk_loop.ts + daily_features.ts + broad_feed.ts',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? '\nCLOSED: the golden-cross paper flywheel runs end to end — gated entry, tagged trailing stop, event-driven exit.\n'
    : '\nOPEN: one of entry-logic / entry-action / exit did not hold.\n');

  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message, e?.stack); process.exit(EXPECT_CLOSED ? 1 : 0); });
