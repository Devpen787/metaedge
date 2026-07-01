import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';
import type { PaperTrade } from '../src/types';
import { createOrderIntent, executeOrderIntent } from '../src/secure-core/trading/intents.js';
import { evaluateOrderRisk } from '../src/secure-core/trading/risk-engine.js';

export const tradesRouter = Router();

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

// Post simulated fill
tradesRouter.post('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const { agentId, assetSymbol, side, size, price, leverage, roomId, nonce } = req.body;

  if (!agentId || !assetSymbol || !side || !size || !price || !nonce) {
    res.status(400).json({ error: 'Incomplete fill telemetry or missing idempotency nonce' });
    return;
  }

  const db = readDatabase();
  const agent = db.agents[agentId];

  if (!agent || agent.ownerId !== userId) {
    res.status(403).json({ error: 'Forbidden or agent missing' });
    return;
  }

  if (agent.status !== 'active') {
    res.status(400).json({ error: 'Agent is not running and cannot trade.' });
    return;
  }

  const executionPrice = Number(price);
  const tradeSize = Number(size);
  const tradeLeverage = Number(leverage) || 1;

  const user = db.users[userId];

  // 1. Create order intent
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
    res.status(400).json({ error: err.message });
    return;
  }

  // 2. Risk Evaluation
  try {
    evaluateOrderRisk(intent, {
      userId,
      availableBalance: user.paperBalance,
      currentPrice: executionPrice
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 3. Execution & Ledger Updates
  let trade;
  try {
    trade = executeOrderIntent(intent.intentId, executionPrice);
    trade.roomId = roomId || agent.roomId;
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Honest cost-basis accounting. Opening posts margin; closing returns the
  // posted margin plus the REAL realized P&L (exit vs. average entry).
  const isClose = side === 'sell' || side === 'short';
  const pos = isClose ? positionBefore(db.trades, userId, agentId, assetSymbol.toUpperCase()) : { size: 0, avgEntry: 0 };

  if (!isClose || pos.size <= 0) {
    // Opening a long/spot, or opening a short with nothing to close against.
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
    action: 'PAPER_TRADE',
    details: `Executed simulated ${side} of ${tradeSize} ${assetSymbol} at $${executionPrice}`,
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
  res.json({ success: true, trade, balance: user.paperBalance });
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
