/**
 * TRAILING-STOP RISK-OS PROBE — the Risk-OS only enforces a STATIC hard stop, so a position
 * that runs up and then gives back 15% from its peak (while still above entry) is never
 * flattened. Flips FACT_OPEN -> FACT_CLOSED when a persisted trailing high-water mark is added.
 * NO PRODUCT CHANGE in this file.
 *
 * Scenario (the gap the golden cross's 15% trailing stop must cover):
 *   entry 100 → rallies to 120 → falls back to 101.
 *   - Static hard stop (avgEntry*0.97 = 97): 101 > 97 → NOT triggered. The whole +20% run is
 *     handed back and the position stays open. FACT_OPEN.
 *   - Trailing stop (peak 120 * 0.85 = 102): 101 <= 102 → FLATTEN, and the peak (120) must be
 *     PERSISTED to disk so a process restart can't reset it to the current price. FACT_CLOSED.
 *
 * Seam: isolated temp DB (DATABASE_URL), frozen price feed (mock fetch + pinned Math.random),
 * seed an open position + a db.trailingState entry (what the golden-cross entry will write),
 * then drive the REAL server/decision/risk_loop.ts checkStopsOnce() and read db.json off disk.
 *
 * Run: npx tsx scripts/trailing_stop_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trailstop-'));
  const dbPath = path.join(dir, 'db.json');
  process.env.DATABASE_URL = dbPath;
  (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) }); // freeze price feed to our manual sets
  const origRandom = Math.random; Math.random = () => 0.5;                           // kill ±0.03% jitter
  const readDisk = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));                // bypass the in-memory cache = a "restart" read

  const storage = await import('../server/storage.js');
  const uid = 'u_probe', aid = 'a_probe', KEY = `${aid}:BTC`;
  const db = storage.readDatabase();
  db.users[uid] = { id: uid, username: 'probe', profile: {}, createdAt: Date.now(), lastActiveAt: Date.now(), paperBalance: 100_000, faucetClaimedCount: 0 } as any;
  db.agents[aid] = { id: aid, name: 'probe', description: '', ownerId: uid, roomId: null, assetSymbol: 'BTC', tradeType: 'spot', strategyType: 'rsi_meanrev', leverage: 1, status: 'active', autopilot: true, createdAt: Date.now(), lastTradeAt: 0 } as any;
  storage.writeDatabase(db);

  const prices = await import('../server/prices.js');
  prices.serverPrices['BTC'].price = 100;
  const trades = await import('../server/trades.js');
  trades.placePaperTrade(uid, { agentId: aid, assetSymbol: 'BTC', side: 'buy', size: 1, price: 100, nonce: `seed_${Date.now()}`, thesis: { seed: true } }, { action: 'SEED', detailsPrefix: 'seed' } as any);

  // Mark the position as trailing (what the golden-cross entry will persist on its BUY fill).
  const seeded = storage.readDatabase();
  seeded.trailingState = seeded.trailingState || {};
  seeded.trailingState[KEY] = { highWaterMark: 100, trailPct: 15, updatedAt: Date.now() };
  storage.writeDatabase(seeded);

  const risk = await import('../server/decision/risk_loop.js');

  // TICK 1 — rally to 120: peak must ratchet up and PERSIST.
  prices.serverPrices['BTC'].price = 120;
  risk.checkStopsOnce();
  const hwmAfterRise = readDisk().trailingState?.[KEY]?.highWaterMark ?? null;

  // TICK 2 — fall to 101: below the trailing stop (120*0.85=102) but ABOVE the hard stop (97).
  prices.serverPrices['BTC'].price = 101;
  risk.checkStopsOnce();
  const posAfter = trades.agentPosition(uid, aid, 'BTC');
  const stateAfter = readDisk().trailingState?.[KEY] ?? null;

  const peakRatchetedAndPersisted = hwmAfterRise === 120;                 // survived a "restart" (disk read)
  const flattenedByTrail = posAfter.size < 1e-6;                          // trailing stop fired where the hard stop would not
  const stateCleared = stateAfter == null;                               // no stale peak left behind
  const trailingWorks = peakRatchetedAndPersisted && flattenedByTrail && stateCleared;
  Math.random = origRandom;

  const cls = trailingWorks ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== TRAILING-STOP RISK-OS PROBE ===');
  console.log(JSON.stringify({
    id: 'RISKOS_NO_TRAILING_STOP',
    class: cls,
    title: 'Risk-OS enforces only a static hard stop; a give-back from peak (above entry) is not flattened',
    checks: {
      peakRatchetsAndPersistsAcrossRestart: peakRatchetedAndPersisted,
      trailingStopFlattensWhereHardStopWouldNot: flattenedByTrail,
      trailingStateClearedAfterExit: stateCleared,
    },
    evidence: {
      entry: 100, rallyPeak: 120, giveBackTo: 101,
      hardStopLevel: 97, trailingStopLevel: 102,
      hwmOnDiskAfterRise: hwmAfterRise, positionSizeAfterGiveBack: posAfter.size, trailingStateAfter: stateAfter,
    },
    codePath: 'server/decision/risk_loop.ts checkStopsOnce; state db.trailingState (server/storage.ts)',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? '\nCLOSED: the trailing stop flattened a 15%-from-peak give-back the hard stop ignored, and the peak persisted to disk (restart-safe).\n'
    : '\nOPEN: the position rallied +20% then gave it all back to +1% and stayed OPEN — the static hard stop never fired; no trailing peak is tracked/persisted.\n');

  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})().catch((e) => { console.log('PROBE_ERROR', e?.message); process.exit(EXPECT_CLOSED ? 1 : 0); });
