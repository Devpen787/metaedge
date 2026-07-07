#!/usr/bin/env node
/**
 * Competition volume batch — Hyperliquid round trips through the MetaMask Agent
 * Wallet, guardrails welded on. One invocation = ONE small batch (hard cap 5
 * round trips) so every batch is human-approved and reviewable.
 *
 * GUARDRAILS (all hard, all fail-closed):
 *   - HARD BATCH CAP: max 5 round trips per invocation, no override.
 *   - EQUITY FLOOR: halts if perps spendable < $4.00 (checked before every trip).
 *   - CALM-TAPE GATE: skips/halts when the long/short quote spread > 10bps.
 *   - ANOMALY HALT: any command failure, non-fill, or trip costing >3x expected
 *     halts the batch. No blind retries.
 *   - NEVER LEAVES A POSITION OPEN: every open is immediately closed and
 *     verified flat; a stuck close = retry once → loud halt + manual command in
 *     the log + exit 2.
 *   - Runs standalone: if the operator/Claude session disappears mid-batch, the
 *     process finishes on its own; decision-log.jsonl + volume-state.json hold
 *     the full truth for whoever picks it up.
 *
 * Usage:
 *   node scripts/competition_loop.mjs --dry-run     # pipeline test, no orders
 *   node scripts/competition_loop.mjs               # one 5-trip batch
 *   node scripts/competition_loop.mjs --trades 3    # smaller batch
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const MM = 'node_modules/.bin/mm';
const LOG = 'data/competition/decision-log.jsonl';
const STATE = 'data/competition/volume-state.json';
const REGISTERED_WALLET = /^0x09b7815143de8d7ecc093dd6eb70e94e041ba40d$/i;

const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const DRY = args.includes('--dry-run');
const TRADES = Math.min(Math.max(Number(flag('trades', 5)) || 5, 1), 5); // HARD cap 5
const SIZE = String(flag('size', '0.006'));                               // ETH
const LEV = String(flag('leverage', '3'));
const EQUITY_FLOOR = 4.0;
const SPREAD_HALT_BPS = 10;
const EXPECTED_TRIP_COST_RATE = 0.0013; // 13bps of one-side notional; halt at 3x

fs.mkdirSync('data/competition', { recursive: true });
const log = (event, extra = {}) => {
  fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), event, ...extra }) + '\n');
  console.log(`  ${event}`, JSON.stringify(extra));
};

function mm(cmdArgs, timeoutMs = 60_000) {
  const out = execFileSync(MM, [...cmdArgs, '--json'], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 1024 * 1024 });
  const parsed = JSON.parse(out);
  if (parsed.ok === false) throw new Error(`${cmdArgs.slice(0, 3).join(' ')}: ${JSON.stringify(parsed.error || parsed).slice(0, 200)}`);
  return parsed.data;
}
const spendable = () => Number(mm(['perps', 'balance', '--venue', 'hyperliquid']).spendableBalance ?? 0);
const flat = () => { const p = mm(['perps', 'positions', '--venue', 'hyperliquid']); return Array.isArray(p) ? p.length === 0 : true; };
const quote = (side) => mm(['perps', 'quote', '--venue', 'hyperliquid', '--symbol', 'ETH', '--side', side, '--size', SIZE, '--leverage', LEV, '--type', 'market']);

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { volumeUsd: 0, trips: 0, spentUsd: 0 };

(async () => {
  console.log(`\n  Volume batch — ${DRY ? 'DRY-RUN (no orders)' : `${TRADES} round trips`}, ${SIZE} ETH @ ${LEV}x\n`);

  // Pre-flight: registered wallet, flat book, equity above floor.
  const addr = mm(['wallet', 'address']).address;
  if (!REGISTERED_WALLET.test(addr)) { log('HALT_WRONG_WALLET', { active: addr }); process.exit(1); }
  if (!flat()) { log('HALT_POSITION_ALREADY_OPEN', {}); process.exit(1); }
  const startEq = spendable();
  if (startEq < EQUITY_FLOOR) { log('HALT_EQUITY_FLOOR', { spendable: startEq, floor: EQUITY_FLOOR }); process.exit(1); }
  log('BATCH_START', { dry: DRY, trades: TRADES, size: SIZE, leverage: LEV, spendable: startEq });

  let tripsDone = 0;
  for (let i = 1; i <= TRADES; i++) {
    const eq = spendable();
    if (eq < EQUITY_FLOOR) { log('HALT_EQUITY_FLOOR', { spendable: eq }); break; }

    // Calm-tape gate via long/short quote spread.
    const qL = quote('long'), qS = quote('short');
    const mid = (Number(qL.entryPrice) + Number(qS.entryPrice)) / 2;
    const spreadBps = Math.abs(Number(qL.entryPrice) - Number(qS.entryPrice)) / mid * 10_000;
    if (spreadBps > SPREAD_HALT_BPS) {
      log('SKIP_WIDE_SPREAD', { trip: i, spreadBps: spreadBps.toFixed(1) });
      await new Promise(r => setTimeout(r, 20_000));
      const qL2 = quote('long'), qS2 = quote('short');
      const sb2 = Math.abs(Number(qL2.entryPrice) - Number(qS2.entryPrice)) / mid * 10_000;
      if (sb2 > SPREAD_HALT_BPS) { log('HALT_PERSISTENT_WIDE_SPREAD', { spreadBps: sb2.toFixed(1) }); break; }
    }
    const notional = Number(qL.notional);

    if (DRY) { log('DRY_TRIP_OK', { trip: i, entry: qL.entryPrice, notional }); tripsDone++; continue; }

    // OPEN → immediately CLOSE. Alternate sides (direction-neutral overall).
    const side = i % 2 === 1 ? 'long' : 'short';
    let open;
    try {
      open = mm(['perps', 'open', '--venue', 'hyperliquid', '--symbol', 'ETH', '--side', side, '--size', SIZE, '--leverage', LEV, '--type', 'market', '--max-slippage-bps', '20', '--yes'], 120_000);
    } catch (e) { log('HALT_OPEN_FAILED', { trip: i, error: String(e.message).slice(0, 200) }); break; }
    if (open.status !== 'filled') { log('HALT_OPEN_NOT_FILLED', { trip: i, open }); break; }

    let closed = false, close;
    for (let attempt = 1; attempt <= 2 && !closed; attempt++) {
      try {
        close = mm(['perps', 'close', '--venue', 'hyperliquid', '--symbol', 'ETH', '--max-slippage-bps', '20', '--yes'], 120_000);
        closed = true;
      } catch (e) {
        log('CLOSE_ATTEMPT_FAILED', { trip: i, attempt, error: String(e.message).slice(0, 200) });
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!closed || !flat()) {
      log('HALT_POSITION_STUCK_OPEN', { trip: i, orderId: open.orderId, action: 'HUMAN ATTENTION REQUIRED — run: mm perps close --venue hyperliquid --symbol ETH --yes' });
      process.exit(2);
    }

    const openPx = Number(open.averagePrice);
    const closePx = Number((Array.isArray(close) ? close[0] : close).averagePrice);
    const tripVolume = Number(SIZE) * (openPx + closePx);
    const eqAfter = spendable();
    const tripCost = Number((eq - eqAfter).toFixed(6));
    state.volumeUsd += tripVolume; state.trips += 1; state.spentUsd += tripCost;
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
    log('TRIP_DONE', { trip: i, side, openPx, closePx, volumeUsd: tripVolume.toFixed(2), costUsd: tripCost, cumVolumeUsd: state.volumeUsd.toFixed(2) });
    tripsDone++;

    if (tripCost > notional * EXPECTED_TRIP_COST_RATE * 3) {
      log('HALT_COST_ANOMALY', { trip: i, costUsd: tripCost, expectedMaxUsd: (notional * EXPECTED_TRIP_COST_RATE * 3).toFixed(4) });
      break;
    }

    // Pace the burst: MetaMask's server-keyring rejected typed-data signing
    // under rapid-fire order flow (batch 3, trip 3) — give it breathing room.
    if (i < TRADES) await new Promise(r => setTimeout(r, 5000));
  }

  const endEq = DRY ? startEq : spendable();
  log('BATCH_END', { tripsDone, batchCostUsd: (startEq - endEq).toFixed(4), spendable: endEq, lifetimeVolumeUsd: state.volumeUsd.toFixed(2), lifetimeSpentUsd: state.spentUsd.toFixed(4), lifetimeTrips: state.trips });
  console.log(`\n  Batch done: ${tripsDone} trips · lifetime volume $${state.volumeUsd.toFixed(2)} · lifetime spend $${state.spentUsd.toFixed(4)} · equity $${endEq}\n`);
})();
