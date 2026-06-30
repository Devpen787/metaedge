import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';

export const predictionsRouter = Router();

// List prediction markets
predictionsRouter.get('/api/predictions', (req, res) => {
  const db = readDatabase();
  res.json({ predictionMarkets: Object.values(db.predictionMarkets || {}) });
});

// Place prediction market bet
predictionsRouter.post('/api/predictions/:id/bet', (req: any, res) => {
  const userId = req.userId;
  const marketId = req.params.id;
  const { side, amount } = req.body;

  if (!side || !amount || isNaN(amount) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Valid side (yes/no) and amount are required' });
    return;
  }

  if (side !== 'yes' && side !== 'no') {
    res.status(400).json({ error: 'Side must be either "yes" or "no"' });
    return;
  }

  const db = readDatabase();
  const markets = db.predictionMarkets || {};
  const market = markets[marketId];

  if (!market) {
    res.status(404).json({ error: 'Prediction market not found' });
    return;
  }

  if (market.resolved) {
    res.status(400).json({ error: 'Market is already resolved' });
    return;
  }

  const betAmount = Number(amount);
  const user = db.users[userId];

  if (user.paperBalance < betAmount) {
    res.status(400).json({ error: 'Insufficient simulated paper balance to place this bet' });
    return;
  }

  // Deduct balance
  user.paperBalance -= betAmount;

  // Add pool size
  if (side === 'yes') {
    market.yesPool += betAmount;
  } else {
    market.noPool += betAmount;
  }
  market.volume += betAmount;

  // Update user bets
  if (!market.bets[userId]) {
    market.bets[userId] = {
      yesShares: 0,
      noShares: 0,
      invested: 0
    };
  }

  const userBet = market.bets[userId];
  userBet.invested += betAmount;
  
  // Calculate shares purchased (using simple constant-product-like or current odds price)
  const totalPool = market.yesPool + market.noPool;
  const currentPrice = side === 'yes' ? (market.yesPool / totalPool) : (market.noPool / totalPool);
  const sharesPurchased = betAmount / (currentPrice || 0.5);

  if (side === 'yes') {
    userBet.yesShares += sharesPurchased;
  } else {
    userBet.noShares += sharesPurchased;
  }

  // Create audit and graph events
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: user.username,
    action: 'PREDICTION_BET',
    details: `Placed a $${betAmount} simulated ${side.toUpperCase()} bet on prediction market: "${market.question}"`,
    timestamp: Date.now()
  });

  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId,
    targetId: marketId,
    targetType: 'User', // general
    metadata: { marketId, side, amount: betAmount },
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, market, balance: user.paperBalance });
});

// Resolve a prediction market (for simulated/interactive resolution)
predictionsRouter.post('/api/predictions/:id/resolve', (req: any, res) => {
  const userId = req.userId;
  const marketId = req.params.id;
  const { outcome } = req.body;

  if (outcome !== 'yes' && outcome !== 'no') {
    res.status(400).json({ error: 'Outcome must be either "yes" or "no"' });
    return;
  }

  const db = readDatabase();
  const markets = db.predictionMarkets || {};
  const market = markets[marketId];

  if (!market) {
    res.status(404).json({ error: 'Prediction market not found' });
    return;
  }

  if (market.resolved) {
    res.status(400).json({ error: 'Market is already resolved' });
    return;
  }

  market.resolved = true;
  market.outcome = outcome;

  // Pay out winning bets
  const totalPool = market.yesPool + market.noPool;
  const totalWinningPool = outcome === 'yes' ? market.yesPool : market.noPool;

  Object.entries(market.bets).forEach(([betUserId, betInfo]) => {
    const winningShares = outcome === 'yes' ? betInfo.yesShares : betInfo.noShares;
    const targetUser = db.users[betUserId];

    if (winningShares > 0 && targetUser) {
      // Calculate payout based on proportion of winning pool
      // As a fallback to avoid infinite multiplier, limit payout or do simple proportion
      const userProportion = winningShares / (totalWinningPool || 1);
      const payout = userProportion * totalPool;
      targetUser.paperBalance += payout;

      db.auditEvents.push({
        id: 'aud_' + generateId(),
        userId: betUserId,
        username: targetUser.username,
        action: 'PREDICTION_PAYOUT',
        details: `Received $${payout.toFixed(2)} simulated payout from prediction market resolution: "${market.question}"`,
        timestamp: Date.now()
      });
    }
  });

  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId,
    username: db.users[userId]?.username || 'System',
    action: 'PREDICTION_RESOLVED',
    details: `Resolved prediction market "${market.question}" with outcome: ${outcome.toUpperCase()}`,
    timestamp: Date.now()
  });

  writeDatabase(db);
  res.json({ success: true, market });
});
