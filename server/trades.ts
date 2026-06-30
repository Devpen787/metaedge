import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';
import type { PaperTrade } from '../src/types';

export const tradesRouter = Router();

// Post simulated fill
tradesRouter.post('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const { agentId, assetSymbol, side, size, price, leverage, roomId } = req.body;

  if (!agentId || !assetSymbol || !side || !size || !price) {
    res.status(400).json({ error: 'Incomplete fill telemetry' });
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
  const notional = tradeSize * executionPrice;

  // Authoritative check on balances
  const user = db.users[userId];
  const requiredMargin = agent.tradeType === 'perp' ? notional / tradeLeverage : notional;

  if (side === 'buy' || side === 'long') {
    if (user.paperBalance < requiredMargin) {
      res.status(400).json({ error: 'Insufficient simulated paper balance to execute this trade.' });
      return;
    }
    user.paperBalance -= requiredMargin;
  } else {
    // Sell / Close / Short credit back
    user.paperBalance += requiredMargin * 1.02; // Arbitrary modest mock gain
  }

  const trade: PaperTrade = {
    id: 'trd_' + generateId(),
    agentId,
    userId,
    roomId: roomId || agent.roomId,
    assetSymbol: assetSymbol.toUpperCase(),
    tradeType: agent.tradeType,
    side: side,
    size: tradeSize,
    price: executionPrice,
    leverage: tradeLeverage,
    pnl: side === 'sell' || side === 'short' ? Math.random() * 200 - 50 : undefined,
    timestamp: Date.now()
  };

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
