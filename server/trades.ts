import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';
import type { PaperTrade } from '../src/types';
import { createOrderIntent, executeOrderIntent } from '../src/secure-core/trading/intents.js';
import { evaluateOrderRisk } from '../src/secure-core/trading/risk-engine.js';
import { transitionTradeState } from '../src/secure-core/trading/lifecycle.js';
import { assertPermission } from '../src/secure-core/auth/rbac.js';
import { assertCapability } from '../src/secure-core/auth/capabilities.js';

export const tradesRouter = Router();

// Post simulated fill
tradesRouter.post('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const { agentId, assetSymbol, side, size, price, leverage, roomId, nonce } = req.body;

  try {
    assertCapability(req.identityBinding, 'CREATE_TRADE');
  } catch (err: any) {
    res.status(403).json({ error: err.message });
    return;
  }

  if (!agentId || !assetSymbol || !side || !size || !price || !nonce) {
    res.status(400).json({ error: 'Incomplete fill telemetry or missing idempotency nonce' });
    return;
  }

  const db = readDatabase();
  const agent = db.agents[agentId];
  const user = db.users[userId];

  try {
    assertPermission({ userId, roles: user.roles || ['TRADER'] }, 'TRADER', 'CREATE_TRADE');
  } catch (err: any) {
    res.status(403).json({ error: err.message });
    return;
  }

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

  const requiredMargin = agent.tradeType === 'perp' ? (tradeSize * executionPrice) / tradeLeverage : (tradeSize * executionPrice);

  // Strictly debit required margin for opening new positions. 
  // (We don't process closing of existing positions in this route, that is done in /api/trades/:id/close)
  user.paperBalance -= requiredMargin;

  db.trades.push(trade);
  agent.lastTradeAt = Date.now();

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PAPER_TRADE_OPEN',
    details: `Executed simulated ${side} of ${tradeSize} ${assetSymbol} at $${executionPrice}. Status: OPEN.`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: trade.id,
    targetType: 'Agent',
    metadata: { side, size: tradeSize, assetSymbol, status: trade.status },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, trade, balance: user.paperBalance });
});

// Close a trade
tradesRouter.post('/api/trades/:id/close', (req: any, res) => {
  const userId = req.userId;
  const tradeId = req.params.id;
  const { currentPrice } = req.body; // In a real system, the server asserts price

  if (typeof currentPrice !== 'number') {
    res.status(400).json({ error: 'Missing current price for reconciliation.' });
    return;
  }

  const db = readDatabase();
  const trade = db.trades.find(t => t.id === tradeId);
  const user = db.users[userId];

  if (!trade || trade.userId !== userId) {
    res.status(404).json({ error: 'Trade not found or unauthorized.' });
    return;
  }

  try {
    // Transition to CLOSED, calculating PnL
    transitionTradeState(trade, 'CLOSED', userId, currentPrice);
    
    // Settle balance
    const marginRecovered = trade.tradeType === 'perp' ? (trade.size * trade.price) / trade.leverage : (trade.size * trade.price);
    const finalBalance = user.paperBalance + marginRecovered + (trade.pnl || 0);
    
    if (finalBalance < 0) {
      // In a real system, this would be a liquidation event, but we'll cap at zero
      user.paperBalance = 0;
    } else {
      user.paperBalance = finalBalance;
    }

    // Transition to SETTLED
    transitionTradeState(trade, 'SETTLED', userId);

    db.auditEvents.push({
      id: 'aud_' + generateId(),
      userId,
      username: user.username,
      action: 'PAPER_TRADE_CLOSE',
      details: `Closed simulated trade ${tradeId} at $${currentPrice}. PnL: $${trade.pnl?.toFixed(2)}. Status: SETTLED.`,
      timestamp: Date.now()
    });

    writeDatabase(db);
    res.json({ success: true, trade, balance: user.paperBalance });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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
