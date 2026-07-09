import { Router } from 'express';
import { readDatabase, writeDatabase, generateId } from './storage.js';
import { isOperator } from './operator.js';

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

  if (!side || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 1_000_000) {
    res.status(400).json({ error: 'Bet amount must be a positive number up to 1,000,000.' });
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
      invested: 0,
      firstBetAt: Date.now()
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

// Resolve a prediction market. Dev-only: letting any player mint outcomes
// would corrupt the game, so this is gated behind an operator env flag.
predictionsRouter.post('/api/predictions/:id/resolve', (req: any, res) => {
  // Manual resolution is a DEV TOOL — in production markets settle at their end
  // date, so this stays shut. Behaviour unchanged.
  if (process.env.METAEDGE_DEV_TOOLS !== 'true') {
    res.status(403).json({ error: 'Market resolution is operator-only. Markets settle at their end date.' });
    return;
  }
  const userId = req.userId;

  // `userId` was read here and never used: with dev tools enabled, ANY
  // authenticated user could resolve ANY market and trigger its payouts. A market
  // has no owner field, so ownership cannot be checked — the correct control is
  // operator identity. An unconfigured allowlist authorises nobody, by design.
  if (!isOperator(userId)) {
    res.status(403).json({ error: 'Market resolution requires an operator. Set OPERATOR_ALLOWLIST to the operator wallet address.' });
    return;
  }

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

  // Pay out winning bets.
  //
  // UNITS BUG (fixed 2026-07-09): the payout proportion was
  //   winningShares / totalWinningPool
  // which divides a SHARE COUNT by a DOLLAR POOL. Shares are bought at
  // `betAmount / price`, so they are not denominated in dollars. Concretely: on a
  // 50k/35k market a $100 YES bet buys 170 shares and should pay $170 — the old
  // formula paid $288.76, minting $118.76 out of nothing on every winning bet.
  //
  // The correct denominator is the TOTAL WINNING SHARES, which must be summed —
  // the market stores no running total of them.
  const totalPool = market.yesPool + market.noPool;
  const totalWinningShares = Object.values(market.bets).reduce(
    (sum, b) => sum + (outcome === 'yes' ? b.yesShares : b.noShares),
    0,
  );

  Object.entries(market.bets).forEach(([betUserId, betInfo]) => {
    const winningShares = outcome === 'yes' ? betInfo.yesShares : betInfo.noShares;
    const targetUser = db.users[betUserId];

    if (winningShares > 0 && targetUser) {
      // Each winner takes their share of the whole pool, pro rata by shares held.
      const userProportion = winningShares / (totalWinningShares || 1);
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
