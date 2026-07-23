import { readDatabase, writeDatabase, generateId } from '../storage.js';
import { placePaperTrade, agentPosition } from '../trades.js';
import { getSpotPrice, arenaSymbol } from '../prices.js';
import { AGENT_STRATEGY_PLUGIN } from './runtime.js';

// RISK-OS — the event-driven exit defense that runs BETWEEN the decision runtime's
// slow (default 300s) cycles. The decision cycle owns entries and nuanced exits (RSI,
// profit target); this owns the price-critical exits that cannot wait for a poll:
//   - HARD STOP: static `price <= avgEntry*(1-stopLossPct)` for strategies that declare one.
//   - TRAILING STOP: for a position with a persisted db.trailingState entry, ratchet the
//     high-water mark and flatten on a `trailPct` give-back from the peak. This is what the
//     Volume-Confirmed Golden Cross uses; the peak persists across restarts (db.trailingState).
//
// Deliberately zero-feature-compute — mechanical arithmetic, no RSI/SMA/universe work — so it
// is safe to run on every tick without the vCPU thrash that killed the e2-micro before.
//
// Paper only — routes through placePaperTrade, no live order path (same as the runtime).
const RISK_TICK_MS = Math.max(2_000, Number(process.env.RISK_LOOP_TICK_MS) || 10_000);

// One pass over every open autopilot position: enforce its protective stop at the current
// price. A position with a persisted db.trailingState entry uses a TRAILING stop (ratchet the
// high-water mark, flatten on a `trailPct` give-back from peak); otherwise the strategy's
// static hard stop (`stopLossPct`). Exported so the probes can drive it directly.
//
// Ordered to be race-safe against placePaperTrade's own read-modify-write: (A) update the
// trailing peaks + collect breaches in ONE db write, no trades; (B) flatten (each trade does
// its own write); (C) clear the trailing state of anything now flat, on a fresh read.
export function checkStopsOnce(): { checked: number; flattened: string[]; trailing: number } {
  const db = readDatabase();
  db.trailingState = db.trailingState || {};
  const breaches: Array<{ ownerId: string; agentId: string; agentName: string; symbol: string; size: number; price: number; leverage: number; trigger: 'hard_stop' | 'trailing_stop'; level: number; extra: Record<string, unknown> }> = [];
  const staleKeys: string[] = [];
  let checked = 0, trailing = 0, dirty = false;

  for (const agent of Object.values(db.agents)) {
    if (!agent.autopilot || agent.status !== 'active') continue;
    const symbol = arenaSymbol(agent.assetSymbol);
    const key = `${agent.id}:${symbol}`;
    const trail = db.trailingState[key];
    const pos = agentPosition(agent.ownerId, agent.id, symbol);
    if (!(pos.size > 1e-6) || !(pos.avgEntry > 0)) { if (trail) { staleKeys.push(key); dirty = true; } continue; } // flat → drop stale peak
    const price = getSpotPrice(symbol);
    if (!(price != null && price > 0)) continue;
    checked++;
    const lev = agent.tradeType === 'perp' ? (agent.leverage || 1) : 1;

    if (trail && trail.trailPct > 0) {
      // TRAILING: ratchet the peak (persisted), flatten on a trailPct give-back from it
      trailing++;
      if (price > trail.highWaterMark) { trail.highWaterMark = price; trail.updatedAt = Date.now(); dirty = true; }
      const level = trail.highWaterMark * (1 - trail.trailPct / 100);
      if (price <= level) breaches.push({ ownerId: agent.ownerId, agentId: agent.id, agentName: agent.name || agent.id, symbol, size: Number(pos.size.toFixed(6)), price, leverage: lev, trigger: 'trailing_stop', level, extra: { trailPct: trail.trailPct, highWaterMark: trail.highWaterMark } });
      continue;
    }

    const stopPct = Number(AGENT_STRATEGY_PLUGIN[agent.strategyType]?.parameters?.stopLossPct);
    if (!(stopPct > 0)) continue;                       // no static stop defined → nothing to enforce
    const level = pos.avgEntry * (1 - stopPct / 100);
    if (price <= level) breaches.push({ ownerId: agent.ownerId, agentId: agent.id, agentName: agent.name || agent.id, symbol, size: pos.size, price, leverage: lev, trigger: 'hard_stop', level, extra: { stopPct, avgEntry: pos.avgEntry } });
  }

  for (const k of staleKeys) delete db.trailingState[k];
  if (dirty) writeDatabase(db);                          // (A) persist peak ratchets + cleanup BEFORE any trades

  const flattened: string[] = [];
  for (const b of breaches) {                            // (B) flatten — placePaperTrade owns its own write
    const result = placePaperTrade(
      b.ownerId,
      { agentId: b.agentId, assetSymbol: b.symbol, side: 'sell', size: b.size, price: b.price, leverage: b.leverage,
        nonce: `riskos_${b.agentId.slice(0, 8)}_${Date.now()}_${generateId().slice(0, 6)}`,
        thesis: { riskOs: true, trigger: b.trigger, level: Number(b.level.toFixed(6)), price: b.price, ...b.extra } },
      { action: 'RISK_OS_FLATTEN', detailsPrefix: `Risk-OS ${b.trigger === 'trailing_stop' ? 'trailing-stop' : 'hard-stop'} flatten` }
    );
    if (result.ok) { flattened.push(b.agentId); console.log(`[risk-os] ${b.trigger} flatten ${b.agentName} ${b.symbol} @ ${b.price} (stop ${b.level.toFixed(4)})`); }
  }

  if (flattened.length) {                                // (C) clear trailing state of the now-flat positions, fresh read
    const fresh = readDatabase();
    fresh.trailingState = fresh.trailingState || {};
    let changed = false;
    for (const b of breaches) if (flattened.includes(b.agentId) && fresh.trailingState[`${b.agentId}:${b.symbol}`]) { delete fresh.trailingState[`${b.agentId}:${b.symbol}`]; changed = true; }
    if (changed) writeDatabase(fresh);
  }
  return { checked, flattened, trailing };
}

export function startRiskLoop() {
  if (process.env.RISK_LOOP_DISABLED === 'true') { console.log('[risk-os] disabled via RISK_LOOP_DISABLED'); return; }
  setInterval(() => {
    try { checkStopsOnce(); } catch (e: any) { console.warn('[risk-os] tick failed:', e?.message); }
  }, RISK_TICK_MS).unref();
  console.log(`[risk-os] armed — event-driven hard-stop check every ${Math.round(RISK_TICK_MS / 1000)}s (between decision-runtime cycles)`);
}
