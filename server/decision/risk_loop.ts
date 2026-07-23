import { readDatabase, generateId } from '../storage.js';
import { placePaperTrade, agentPosition } from '../trades.js';
import { getSpotPrice, arenaSymbol } from '../prices.js';
import { AGENT_STRATEGY_PLUGIN } from './runtime.js';

// RISK-OS — the event-driven exit defense that runs BETWEEN the decision runtime's
// slow (default 300s) cycles. The decision cycle owns entries and nuanced exits (RSI,
// profit target); this owns the one exit that cannot wait for a poll: the HARD STOP.
//
// It is deliberately zero-feature-compute — a mechanical `price <= entry*(1-stopPct)`
// check, no RSI/SMA/universe work — so it is safe to run on every tick without the
// vCPU thrash that killed the e2-micro before. This is also the socket where the
// Volume-Confirmed Golden Cross's 15% TRAILING stop will plug in at integration time.
//
// Paper only — routes through placePaperTrade, no live order path (same as the runtime).
const RISK_TICK_MS = Math.max(2_000, Number(process.env.RISK_LOOP_TICK_MS) || 10_000);

// One pass: flatten every open autopilot position whose hard stop is breached at the
// current price. Pure + synchronous; exported so the latency probe can drive it directly.
export function checkStopsOnce(): { checked: number; flattened: string[] } {
  const db = readDatabase();
  const flattened: string[] = [];
  let checked = 0;
  for (const agent of Object.values(db.agents)) {
    if (!agent.autopilot || agent.status !== 'active') continue;
    const stopPct = Number(AGENT_STRATEGY_PLUGIN[agent.strategyType]?.parameters?.stopLossPct);
    if (!(stopPct > 0)) continue;                       // strategy defines no hard stop → nothing to enforce here
    const symbol = arenaSymbol(agent.assetSymbol);
    const pos = agentPosition(agent.ownerId, agent.id, symbol);
    if (!(pos.size > 1e-6) || !(pos.avgEntry > 0)) continue;   // flat → nothing to protect
    checked++;
    const price = getSpotPrice(symbol);
    if (!(price != null && price > 0)) continue;
    const stopLevel = pos.avgEntry * (1 - stopPct / 100);
    if (price > stopLevel) continue;                    // stop not breached
    const result = placePaperTrade(
      agent.ownerId,
      {
        agentId: agent.id, assetSymbol: symbol, side: 'sell',
        size: Number(pos.size.toFixed(6)), price,
        leverage: agent.tradeType === 'perp' ? (agent.leverage || 1) : 1,
        nonce: `riskos_${agent.id.slice(0, 8)}_${Date.now()}_${generateId().slice(0, 6)}`,
        thesis: { riskOs: true, trigger: 'hard_stop', stopPct, stopLevel: Number(stopLevel.toFixed(6)), price, avgEntry: pos.avgEntry },
      },
      { action: 'RISK_OS_FLATTEN', detailsPrefix: 'Risk-OS hard-stop flatten' }
    );
    if (result.ok) { flattened.push(agent.id); console.log(`[risk-os] hard-stop flatten ${agent.name || agent.id} ${symbol} @ ${price} (stop ${stopLevel.toFixed(4)})`); }
  }
  return { checked, flattened };
}

export function startRiskLoop() {
  if (process.env.RISK_LOOP_DISABLED === 'true') { console.log('[risk-os] disabled via RISK_LOOP_DISABLED'); return; }
  setInterval(() => {
    try { checkStopsOnce(); } catch (e: any) { console.warn('[risk-os] tick failed:', e?.message); }
  }, RISK_TICK_MS).unref();
  console.log(`[risk-os] armed — event-driven hard-stop check every ${Math.round(RISK_TICK_MS / 1000)}s (between decision-runtime cycles)`);
}
