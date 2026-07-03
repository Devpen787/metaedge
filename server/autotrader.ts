import { readDatabase, writeDatabase, generateId } from './storage.js';
import { placePaperTrade, agentPosition } from './trades.js';
import { getSpotPrice, serverPrices, arenaSymbol } from './prices.js';

// The REAL Autopilot: agents with autopilot enabled trade BY THEMSELVES on a
// server-side tick, using their actual strategy against live prices, through
// the exact same ledger as manual trades (placePaperTrade). Paper-only by
// nature — it moves paper balances and Arena standings, never funds.
//
// Guardrails: one decision per agent per tick, ~$250 notional clips, a paper
// balance floor, and per-agent opt-in (autopilot defaults OFF).

const TICK_MS = Number(process.env.AUTOTRADER_TICK_MS) || 90_000;
const CLIP_NOTIONAL_USD = 250;
const MIN_BALANCE_FLOOR = 100;
const DISABLED = process.env.AUTOTRADER_DISABLED === 'true';

type Decision = 'buy' | 'sell' | null;

// Strategy brains — deliberately simple, deliberately honest. They react to
// the live 24h move; "custom_ai" mixes momentum with an exploration coin-flip.
function decide(strategy: string, change24h: number, holding: boolean, tickParity: number): Decision {
  switch (strategy) {
    case 'momentum':
      if (change24h >= 0.75) return 'buy';
      if (change24h <= -0.75 && holding) return 'sell';
      return null;
    case 'mean_reversion':
      if (change24h <= -0.75) return 'buy';
      if (change24h >= 0.75 && holding) return 'sell';
      return null;
    case 'grid':
      return tickParity === 0 ? 'buy' : holding ? 'sell' : null;
    case 'custom_ai': {
      const explore = Math.random() < 0.3;
      const base: Decision = change24h >= 0 ? 'buy' : holding ? 'sell' : null;
      return explore ? (holding ? 'sell' : 'buy') : base;
    }
    default:
      return null;
  }
}

let tickCount = 0;

async function tick() {
  tickCount += 1;
  const db = readDatabase();

  const autoAgents = Object.values(db.agents).filter(
    (a) => a.autopilot && a.status === 'active'
  );
  if (autoAgents.length === 0) return;

  for (const agent of autoAgents) {
    try {
      const owner = db.users[agent.ownerId];
      if (!owner) continue;

      const symbol = arenaSymbol(agent.assetSymbol);
      const price = getSpotPrice(symbol);
      if (!price) continue;

      const change24h = serverPrices[symbol]?.change24h ?? 0;
      const pos = agentPosition(agent.ownerId, agent.id, symbol);
      const holding = pos.size > 0.000001;

      const decision = decide(agent.strategyType, change24h, holding, tickCount % 2);
      if (!decision) continue;
      if (decision === 'buy' && owner.paperBalance < MIN_BALANCE_FLOOR + CLIP_NOTIONAL_USD) continue;

      const size = decision === 'sell'
        ? Number(pos.size.toFixed(6))
        : Math.max(0.000001, Number((CLIP_NOTIONAL_USD / price).toFixed(6)));
      if (size <= 0) continue;

      const result = placePaperTrade(
        agent.ownerId,
        {
          agentId: agent.id,
          assetSymbol: symbol,
          side: decision,
          size,
          price,
          leverage: agent.tradeType === 'perp' ? agent.leverage || 1 : 1,
          nonce: `auto_${agent.id.slice(0, 8)}_${Date.now()}_${generateId().slice(0, 6)}`,
        },
        { action: 'AUTOPILOT_TRADE', detailsPrefix: 'Autopilot executed' }
      );

      if (result.ok) {
        // Stamp the agent so the UI can show "last auto-trade".
        const fresh = readDatabase();
        const a = fresh.agents[agent.id];
        if (a) {
          a.lastAutoTradeAt = Date.now();
          writeDatabase(fresh);
        }
        console.log(`[autotrader] ${agent.name}: ${decision} ${size} ${symbol} @ $${price}${result.trade?.pnl != null ? ` (pnl ${result.trade.pnl})` : ''}`);
      }
    } catch (err: any) {
      console.warn(`[autotrader] ${agent.name} skipped: ${err.message}`);
    }
  }
}

export function startAutotrader() {
  if (DISABLED) {
    console.log('[autotrader] disabled via AUTOTRADER_DISABLED');
    return;
  }
  setInterval(() => { tick().catch((e) => console.warn('[autotrader] tick failed:', e.message)); }, TICK_MS);
  console.log(`[autotrader] running — agents with autopilot trade every ${Math.round(TICK_MS / 1000)}s`);
}
