import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';
import type { PaperTrade, TradingAgent } from '../src/types';
import { createOrderIntent, executeOrderIntent } from '../src/secure-core/trading/intents.js';
import { evaluateOrderRisk } from '../src/secure-core/trading/risk-engine.js';
import { getSpotPrice, arenaSymbol } from './prices.js';

export const tradesRouter = Router();

// Find-or-create the user's "Swarm Copilot" execution vehicle — a real agent so
// AI-suggested trades flow through the normal ledger and score in the Arena.
function copilotAgent(db: ReturnType<typeof readDatabase>, userId: string): TradingAgent {
  let agent = Object.values(db.agents).find((a) => a.ownerId === userId && a.name === 'Swarm Copilot' && a.status !== 'revoked');
  if (!agent) {
    const id = 'agt_' + generateId();
    agent = {
      id, name: 'Swarm Copilot', description: 'Executes your natural-language trades.',
      ownerId: userId, assetSymbol: 'ETH', tradeType: 'token', strategyType: 'custom_ai',
      leverage: 1, status: 'active', createdAt: Date.now(),
    };
    db.agents[id] = agent;
  }
  return agent;
}

// Execute an AI-suggested (Copilot / Intent Solver) trade as a real paper fill
// at the live price. This is what makes those tabs actually DO something.
tradesRouter.post('/api/copilot/execute', (req: any, res) => {
  const userId = req.userId;
  const rawSide = String(req.body?.side || '').toLowerCase();
  const side = rawSide === 'buy' || rawSide === 'long' ? 'buy' : rawSide === 'sell' || rawSide === 'short' ? 'sell' : null;
  const sym = arenaSymbol(String(req.body?.assetSymbol || ''));
  if (!side) { res.status(400).json({ error: 'Side must be buy or sell.' }); return; }
  const price = getSpotPrice(sym);
  if (!price) { res.status(400).json({ error: `No live price for ${sym}. Try BTC, ETH, SOL, LINK, DOGE, etc.` }); return; }

  // Size can be given directly, or as a USD amount we convert at the live price.
  let size = Number(req.body?.size);
  const usd = Number(req.body?.usd);
  if ((!Number.isFinite(size) || size <= 0) && Number.isFinite(usd) && usd > 0) {
    size = Number((usd / price).toFixed(6));
  }
  if (!Number.isFinite(size) || size <= 0) { res.status(400).json({ error: 'Size must be a positive number.' }); return; }

  // Ensure the vehicle exists before the (fresh-read) trade executes.
  const db = readDatabase();
  copilotAgent(db, userId);
  writeDatabase(db);
  const agent = copilotAgent(readDatabase(), userId);

  const result = placePaperTrade(
    userId,
    { agentId: agent.id, assetSymbol: sym, side, size, price, nonce: `copilot_${Date.now()}_${generateId().slice(0, 6)}`, thesis: req.body?.thesis },
    { action: 'COPILOT_TRADE', detailsPrefix: 'Copilot executed' }
  );
  if (!result.ok) { res.status(result.status || 400).json({ error: result.error }); return; }
  res.json({ success: true, trade: result.trade, balance: result.balance, symbol: sym, price });
});

// Real cost-basis position from the user's prior fills for this asset+agent.
// Used to compute honest realized P&L on a close — never a random number.
function positionBefore(trades: any[], userId: string, agentId: string, asset: string) {
  let size = 0;
  let cost = 0;
  for (const t of trades) {
    if (t.userId !== userId || t.agentId !== agentId || t.assetSymbol !== asset) continue;
    if (t.side === 'buy' || t.side === 'long') {
      cost += t.size * t.price;
      size += t.size;
    } else {
      const avg = size > 0 ? cost / size : 0;
      const close = Math.min(t.size, size);
      cost -= avg * close;
      size -= close;
    }
  }
  return { size, avgEntry: size > 0 ? cost / size : 0 };
}

// Core paper-trade execution: validation -> intent -> risk -> fill -> honest
// cost-basis ledger -> audit. Shared by the HTTP route and the autotrader so
// there is exactly ONE way a trade can happen.
// EdgeOps: sanitize an optional client/agent-supplied thesis into a bounded,
// known-fields-only object, and decide whether the trade counts as complete.
// Core rule from the operating loop: no invalidation → no confidence.
const THESIS_STR_FIELDS = ['cardId', 'signalFamily', 'setup', 'trigger', 'invalidation', 'holdingWindow', 'regime', 'benchmark'] as const;
function sanitizeThesis(raw: unknown): { thesis?: PaperTrade['thesis']; tag: 'complete' | 'thesis_missing' } {
  if (!raw || typeof raw !== 'object') return { tag: 'thesis_missing' };
  const t: any = {};
  for (const f of THESIS_STR_FIELDS) {
    const v = (raw as any)[f];
    if (typeof v === 'string' && v.trim()) t[f] = v.trim().slice(0, 400);
  }
  const r = Number((raw as any).plannedR);
  if (Number.isFinite(r) && r > 0 && r <= 100) t.plannedR = r;
  const complete = !!(t.signalFamily && t.setup && t.trigger && t.invalidation);
  if (Object.keys(t).length === 0) return { tag: 'thesis_missing' };
  return { thesis: t, tag: complete ? 'complete' : 'thesis_missing' };
}

export function placePaperTrade(
  userId: string,
  input: { agentId: string; assetSymbol: string; side: 'buy' | 'sell' | 'long' | 'short'; size: number; price: number; leverage?: number; roomId?: string; nonce: string; thesis?: unknown },
  audit: { action: string; detailsPrefix: string } = { action: 'PAPER_TRADE', detailsPrefix: 'Executed simulated' }
): { ok: boolean; status?: number; error?: string; trade?: PaperTrade; balance?: number } {
  const { agentId, assetSymbol, side, size, price, leverage, roomId, nonce } = input;

  if (!agentId || !assetSymbol || !side || !size || !price || !nonce) {
    return { ok: false, status: 400, error: 'Incomplete fill telemetry or missing idempotency nonce' };
  }
  // Non-finite numbers (NaN/Infinity) slip past `<= 0` checks and would corrupt
  // the ledger — reject them and enforce sane bounds up front.
  const nSize = Number(size), nPrice = Number(price);
  if (!Number.isFinite(nSize) || nSize <= 0 || nSize > 1e9) {
    return { ok: false, status: 400, error: 'Size must be a positive, finite number.' };
  }
  if (!Number.isFinite(nPrice) || nPrice <= 0 || nPrice > 1e12) {
    return { ok: false, status: 400, error: 'Price must be a positive, finite number.' };
  }

  const db = readDatabase();
  const agent = db.agents[agentId];

  if (!agent || agent.ownerId !== userId) {
    return { ok: false, status: 403, error: 'Forbidden or agent missing' };
  }

  if (agent.status !== 'active') {
    return { ok: false, status: 400, error: 'Agent is not running and cannot trade.' };
  }

  // Stamp the fill from the SERVER's live price whenever we price this symbol —
  // never trust the client-sent price for a scored trade (it can be stale or
  // hand-crafted to game the Arena). Unpriced symbols fall back to the client
  // value, which was already validated above. This keeps the entry consistent
  // with how the Arena marks the position (also getSpotPrice).
  //
  // COST REALISM (EdgeOps contrarian review): real venues charge spread + fees
  // (~5-15bps/side; our measured Hyperliquid round trips ran 5-13bps). Free
  // paper fills systematically flatter expectancy and train false confidence,
  // so paper fills execute WORSE than spot by PAPER_COST_BPS per side (buys
  // higher, sells lower) — deliberately conservative vs. the real venue.
  const PAPER_COST_BPS = Number(process.env.PAPER_COST_BPS) || 10;
  const buySide = side === 'buy' || side === 'long';
  const serverPx = getSpotPrice(assetSymbol);
  const executionPrice = serverPx != null
    ? Number((serverPx * (1 + (buySide ? 1 : -1) * PAPER_COST_BPS / 10_000)).toPrecision(8))
    : Number(price);
  const tradeSize = Number(size);
  const tradeLeverage = Number(leverage) || 1;

  const user = db.users[userId];

  let intent;
  try {
    intent = createOrderIntent(userId, {
      agentId,
      assetSymbol: assetSymbol.toUpperCase(),
      side,
      size: tradeSize,
      tradeType: agent.tradeType,
      leverage: tradeLeverage,
      nonce
    });
  } catch (err: any) {
    return { ok: false, status: 400, error: err.message };
  }

  try {
    evaluateOrderRisk(intent, {
      userId,
      availableBalance: user.paperBalance,
      currentPrice: executionPrice
    });
  } catch (err: any) {
    return { ok: false, status: 400, error: err.message };
  }

  let trade;
  try {
    trade = executeOrderIntent(intent.intentId, executionPrice);
    trade.roomId = roomId || agent.roomId;
  } catch (err: any) {
    return { ok: false, status: 400, error: err.message };
  }

  // EdgeOps: attach the (sanitized) thesis and tag the trade. Trades without a
  // complete thesis still execute — they're just excluded from edge reports.
  const { thesis, tag } = sanitizeThesis(input.thesis);
  if (thesis) trade.thesis = thesis;
  trade.edgeops = tag;

  // Honest cost-basis accounting. Opening posts margin; closing returns the
  // posted margin plus the REAL realized P&L (exit vs. average entry).
  const isClose = side === 'sell' || side === 'short';
  const pos = isClose ? positionBefore(db.trades, userId, agentId, assetSymbol.toUpperCase()) : { size: 0, avgEntry: 0 };

  if (!isClose || pos.size <= 0) {
    const margin = agent.tradeType === 'perp' ? (tradeSize * executionPrice) / tradeLeverage : (tradeSize * executionPrice);
    user.paperBalance -= margin;
    trade.pnl = undefined;
  } else {
    const closeSize = Math.min(tradeSize, pos.size);
    const realizedPnl = (executionPrice - pos.avgEntry) * closeSize;
    const marginReturned = agent.tradeType === 'perp' ? (closeSize * pos.avgEntry) / tradeLeverage : (closeSize * pos.avgEntry);
    user.paperBalance += marginReturned + realizedPnl;
    trade.pnl = Number(realizedPnl.toFixed(2));
  }

  db.trades.push(trade);
  agent.lastTradeAt = Date.now();

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: audit.action,
    details: `${audit.detailsPrefix} ${side} of ${tradeSize} ${assetSymbol} at $${executionPrice}`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: trade.id,
    targetType: 'Agent',
    metadata: { side, size: tradeSize, assetSymbol },
    timestamp: Date.now()
  });

  writeDatabase(db);
  return { ok: true, trade, balance: user.paperBalance };
}

// Expose the cost-basis position for strategy decisions (autotrader).
export function agentPosition(userId: string, agentId: string, asset: string) {
  const db = readDatabase();
  return positionBefore(db.trades, userId, agentId, asset);
}

// Post simulated fill
tradesRouter.post('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const result = placePaperTrade(userId, req.body);
  if (!result.ok) {
    res.status(result.status || 400).json({ error: result.error });
    return;
  }
  res.json({ success: true, trade: result.trade, balance: result.balance });
});

// List trades
tradesRouter.get('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const myTrades = db.trades.filter(t => t.userId === userId);
  res.json({ trades: myTrades });
});

// Delete a specific trade
tradesRouter.delete('/api/trades/:id', (req: any, res) => {
  const userId = req.userId;
  const tradeId = req.params.id;

  const db = readDatabase();
  const index = db.trades.findIndex(t => t.id === tradeId);

  if (index === -1) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }

  const trade = db.trades[index];
  if (trade.userId !== userId) {
    res.status(403).json({ error: 'Unauthorized to delete this trade' });
    return;
  }

  db.trades.splice(index, 1);

  writeDatabase(db);
  res.json({ success: true });
});

// Clear all trades for current user
tradesRouter.delete('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();

  db.trades = db.trades.filter(t => t.userId !== userId);

  writeDatabase(db);
  res.json({ success: true });
});
