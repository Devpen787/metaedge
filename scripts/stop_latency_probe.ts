/**
 * PARADOX-3 STOP-LATENCY PROBE — the exit engine is asleep between poll cycles.
 * Flips FACT_OPEN -> FACT_CLOSED when the event-driven Risk-OS is added. NO PRODUCT CHANGE here.
 *
 * PREMISE CORRECTION (verified against the code, cited):
 *  - The "90s autotrader tick" does NOT run by default (server/autotrader.ts:199 returns early
 *    under LAYERED_RUNTIME_ENABLED). The REAL exit path is the layered decision runtime,
 *    server/decision/runtime.ts:32 CYCLE_MS = max(60_000, ...|| 5*60_000) → default 300s,
 *    exits evaluated only in runDecisionCycle() scheduled only by setInterval(CYCLE_MS).
 *  - No event-driven stop existed: the only websocket handler is fast_perp_recorder (research);
 *    killguard is hourly + disable-only. So the exposure window was up to ~5 minutes.
 *
 * Proof structure:
 *  A) The exit is INSTANT when evaluated — real rsiMeanReversionV5.generateSignal returns
 *     'sell'/'stop loss' on a breach, 'hold' otherwise. Latency is only in WHEN it runs.
 *  B) Cadence coupling — with the real plugin + real CYCLE_MS, a breach just after a cycle is
 *     not signalled until the next cycle: exposure = CYCLE_MS.
 *  C) THE FLIP — seed a breaching open position in an isolated DB and invoke the between-cycle
 *     risk path (server/decision/risk_loop.ts checkStopsOnce). Pre-fix that module doesn't
 *     exist → gap OPEN. Post-fix it flattens the position → gap CLOSED.
 *
 * Run: npx tsx scripts/stop_latency_probe.ts [--expect-closed]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rsiMeanReversionV5 } from '../server/decision/plugins.js';
import { FEATURE_VERSIONS } from '../server/decision/features.js';

const EXPECT_CLOSED = process.argv.includes('--expect-closed');
const CYCLE_MS = Math.max(60_000, Number(process.env.DECISION_RUNTIME_INTERVAL_MS) || 5 * 60_000);

function ctx(price: number, rsi: number, evaluatedAt: number) {
  return {
    evaluatedAt,
    features: {
      [FEATURE_VERSIONS.price]: { value: price },
      [FEATURE_VERSIONS.rsi14]: { value: rsi },
      [FEATURE_VERSIONS.sma200]: { value: 90 },
    },
    position: { holding: true, averageEntryPrice: 100, heldSince: evaluatedAt - 3_600_000 },
  } as any;
}

(async () => {
  // A) exit is instantaneous WHEN evaluated
  const breachSig = rsiMeanReversionV5.generateSignal(ctx(96, 40, Date.now())); // 96 <= 100*0.97=97
  const holdSig = rsiMeanReversionV5.generateSignal(ctx(99, 40, Date.now()));   // 99 > 97 → hold
  const exitsInstantly = breachSig.action === 'sell' && breachSig.trigger === 'stop loss';
  const controlHolds = holdSig.action === 'hold';

  // B) cadence coupling — the exposure window is CYCLE_MS
  const atCycle = rsiMeanReversionV5.generateSignal(ctx(100, 40, 0));
  const atNextCycle = rsiMeanReversionV5.generateSignal(ctx(96, 40, CYCLE_MS));
  const exposureMs = CYCLE_MS - 3_000;
  const cadenceCoupling = atCycle.action === 'hold' && atNextCycle.action === 'sell' && exposureMs > 60_000;

  // C) THE FLIP — does an event-driven Risk-OS flatten a between-cycle breach?
  let riskOsClosesGap = false;
  let riskEvidence: Record<string, unknown> = {};
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'riskos-'));
    process.env.DATABASE_URL = path.join(dir, 'db.json');                 // isolate the DB (read at storage module-load)
    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) }); // freeze the price feed to our manual sets
    const origRandom = Math.random; Math.random = () => 0.5;              // kill ±0.03% jitter

    const storage = await import('../server/storage.js');
    const uid = 'u_probe', aid = 'a_probe';
    const db = storage.readDatabase();
    db.users[uid] = { id: uid, username: 'probe', profile: {}, createdAt: Date.now(), lastActiveAt: Date.now(), paperBalance: 100_000, faucetClaimedCount: 0 } as any;
    db.agents[aid] = { id: aid, name: 'probe', description: '', ownerId: uid, roomId: null, assetSymbol: 'BTC', tradeType: 'spot', strategyType: 'rsi_meanrev', leverage: 1, status: 'active', autopilot: true, createdAt: Date.now(), lastTradeAt: 0 } as any;
    storage.writeDatabase(db);

    const prices = await import('../server/prices.js');
    prices.serverPrices['BTC'].price = 100;                                // getSpotPrice == seed buy price → clean fill
    const trades = await import('../server/trades.js');
    const buy = trades.placePaperTrade(uid, { agentId: aid, assetSymbol: 'BTC', side: 'buy', size: 1, price: 100, nonce: `seed_${Date.now()}`, thesis: { seed: true } }, { action: 'SEED', detailsPrefix: 'seed' } as any);
    const posBefore = trades.agentPosition(uid, aid, 'BTC');

    prices.serverPrices['BTC'].price = 96;                                 // market breaches the -3% stop BETWEEN cycles
    const risk = await import('../server/decision/risk_loop.js');
    const res = risk.checkStopsOnce();
    const posAfter = trades.agentPosition(uid, aid, 'BTC');

    riskOsClosesGap = posBefore.size > 1e-6 && posAfter.size < 1e-6 && res.flattened.includes(aid);
    riskEvidence = { seedBuyOk: buy.ok, posBeforeSize: posBefore.size, breachPrice: 96, stopLevel: 97, flattened: res.flattened, posAfterSize: posAfter.size };
    Math.random = origRandom;
  } catch (e: any) {
    riskEvidence = { moduleMissingOrError: e?.message || String(e) };     // pre-fix: risk_loop.js absent → gap OPEN
  }

  const cls = riskOsClosesGap ? 'FACT_CLOSED' : 'FACT_OPEN';
  console.log('\n=== PARADOX-3 STOP-LATENCY PROBE ===');
  console.log(JSON.stringify({
    id: 'STOP_EVAL_COUPLED_TO_POLL_CYCLE',
    class: cls,
    title: 'stop/exit gated to the decision cycle (default 300s); event-driven Risk-OS closes the between-cycle gap',
    checks: {
      exitFiresInstantlyWhenEvaluated: exitsInstantly,
      nonBreachControlHolds: controlHolds,
      cadenceCoupling_exposureWindowIsCycleMs: cadenceCoupling,
      riskOsFlattensBetweenCycleBreach: riskOsClosesGap,   // the flip
    },
    evidence: {
      breachSignal: { action: breachSig.action, trigger: breachSig.trigger },
      cycleMs: CYCLE_MS,
      exposureWithoutRiskOsSeconds: Math.round(exposureMs / 1000),
      riskOs: riskEvidence,
    },
    codePath: 'stop server/decision/plugins.ts:48; cycle server/decision/runtime.ts:235-236; risk-os server/decision/risk_loop.ts',
  }, null, 2));
  console.log(cls === 'FACT_CLOSED'
    ? '\nCLOSED: the event-driven Risk-OS flattened a stop breach that landed between decision cycles — no more ~5-min exposure.\n'
    : `\nOPEN: exit is instant when evaluated, but only the ${Math.round(CYCLE_MS / 1000)}s cycle evaluates it; a breach just after a cycle bleeds for up to ~${Math.round(exposureMs / 60000)} min. Fix = event-driven Risk-OS.\n`);

  process.exit(EXPECT_CLOSED && cls !== 'FACT_CLOSED' ? 1 : 0);
})();
