import { Router } from 'express';
import {
  DatabaseWriteError,
  generateId,
  readDatabase,
  runDatabaseWriteBatch,
  writeDatabase,
} from './storage.js';
import type {
  MarketObservationV5,
  OrderIntentV5,
  PaperBrokerPolicyV5,
  PaperFillV5,
  PaperTrade,
  TradingAgent,
  TradeReview,
} from '../src/types';
import {
  createOrderIntent,
  expireBrokerOrderIntent,
  markOrderIntentRiskAccepted,
  markOrderIntentUnresolved,
  recordPaperBrokerFill,
  rejectBrokerOrderIntent,
  rejectOrderIntent,
  submitOrderIntentToBroker,
} from '../src/secure-core/trading/intents.js';
import { evaluateOrderRisk } from '../src/secure-core/trading/risk-engine.js';
import { getPriceObservation, getSpotPrice, arenaSymbol } from './prices.js';
import {
  DEFAULT_PAPER_BROKER_POLICY_V5,
  evaluatePaperBrokerV5,
} from './v5/paper_broker.js';

export const tradesRouter = Router();

// Find-or-create the user's "Swarm Copilot" execution vehicle — a real agent so
// AI-suggested trades flow through the normal ledger and score in the Arena.
function copilotAgent(db: ReturnType<typeof readDatabase>, userId: string): TradingAgent {
  let agent = Object.values(db.agents).find((a) => a.ownerId === userId && a.name === 'Swarm Copilot' && a.status !== 'revoked');
  if (!agent) {
    const id = 'agt_' + generateId();
    agent = {
      authorityVersion: 5, schema: 'trading-agent.v5',
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
  writeDatabase(db, ['agents']);
  const agent = copilotAgent(readDatabase(), userId);

  const result = placePaperTrade(
    userId,
    { agentId: agent.id, assetSymbol: sym, side, size, price, nonce: `copilot_${Date.now()}_${generateId().slice(0, 6)}`, thesis: req.body?.thesis },
    { action: 'COPILOT_TRADE', detailsPrefix: 'Copilot executed' }
  );
  if (!result.ok) { res.status(result.status || 400).json({ error: result.error }); return; }
  res.status(result.status || 200).json({
    success: true,
    pending: result.pending,
    intent: result.intent,
    trade: result.trade,
    balance: result.balance,
    symbol: sym,
  });
});

// Real cost-basis position from the user's prior fills for this asset+agent.
// Used to compute honest realized P&L on a close — never a random number.
function positionBefore(trades: any[], userId: string, agentId: string, asset: string) {
  let signedSize = 0;
  let avgEntry = 0;
  let openedAt = 0;
  for (const t of trades) {
    if (t.userId !== userId || t.agentId !== agentId || t.assetSymbol !== asset) continue;
    const signedFill = (t.side === 'buy' || t.side === 'long' ? 1 : -1) * t.size;
    if (!signedSize || Math.sign(signedSize) === Math.sign(signedFill)) {
      const nextSize = signedSize + signedFill;
      const currentAbs = Math.abs(signedSize);
      const fillAbs = Math.abs(signedFill);
      avgEntry = (currentAbs * avgEntry + fillAbs * t.price) / Math.max(Number.EPSILON, currentAbs + fillAbs);
      openedAt = currentAbs
        ? (openedAt * currentAbs + Number(t.timestamp) * fillAbs) / (currentAbs + fillAbs)
        : Number(t.timestamp);
      signedSize = nextSize;
    } else {
      const nextSize = signedSize + signedFill;
      if (!nextSize) {
        signedSize = 0;
        avgEntry = 0;
        openedAt = 0;
      } else if (Math.sign(nextSize) !== Math.sign(signedSize)) {
        signedSize = nextSize;
        avgEntry = t.price;
        openedAt = Number(t.timestamp);
      } else {
        signedSize = nextSize;
      }
    }
  }
  return { size: Math.abs(signedSize), signedSize, avgEntry: signedSize ? avgEntry : 0, openedAt };
}

// Core paper-trade execution: validation -> intent -> risk -> fill -> honest
// cost-basis ledger -> audit. Shared by the HTTP route and the autotrader so
// there is exactly ONE way a trade can happen.
// EdgeOps: sanitize an optional client/agent-supplied thesis into a bounded,
// known-fields-only object, and decide whether the trade counts as complete.
// Core rule from the operating loop: no invalidation → no confidence.
const THESIS_STR_FIELDS = ['cardId', 'decisionId', 'strategyHash', 'signalFamily', 'setup', 'trigger', 'invalidation', 'holdingWindow', 'regime', 'benchmark'] as const;
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
  input: {
    agentId: string;
    assetSymbol: string;
    side: 'buy' | 'sell' | 'long' | 'short';
    size: number;
    price?: number;
    leverage?: number;
    roomId?: string;
    nonce: string;
    thesis?: unknown;
    orderType?: OrderIntentV5['orderType'];
    limitPrice?: number;
    stopPrice?: number;
    timeInForceMs?: number;
    experimentId?: string;
    experimentLabel?: string;
    opportunityObservationId?: string;
    paperPermission?: OrderIntentV5['paperPermission'];
    portfolioReservationId?: string;
  },
  audit: { action: string; detailsPrefix: string } = { action: 'PAPER_TRADE', detailsPrefix: 'Executed simulated' }
): {
  ok: boolean;
  status?: number;
  error?: string;
  pending?: boolean;
  intent?: OrderIntentV5;
  trade?: PaperTrade;
  balance?: number;
} {
  const { agentId, assetSymbol, side, size, leverage, roomId, nonce } = input;
  if (!agentId || !assetSymbol || !side || !size || !nonce) {
    return { ok: false, status: 400, error: 'Incomplete paper order or missing idempotency nonce' };
  }
  const nSize = Number(size);
  if (!Number.isFinite(nSize) || nSize <= 0 || nSize > 1e9) {
    return { ok: false, status: 400, error: 'Size must be a positive, finite number.' };
  }

  const db = readDatabase();
  const agent = db.agents[agentId];
  if (!agent || agent.ownerId !== userId) {
    return { ok: false, status: 403, error: 'Forbidden or agent missing' };
  }
  if (agent.status !== 'active') {
    return { ok: false, status: 400, error: 'Agent is not running and cannot trade.' };
  }
  if (agent.authorityVersion !== 5 || agent.schema !== 'trading-agent.v5') {
    return { ok: false, status: 409, error: 'Legacy pre-v5 agent is read-only and cannot route an active order.' };
  }
  const symbol = assetSymbol.toUpperCase();
  const existing = Object.values(db.orderIntentsV5 || {}).find((intent) =>
    intent.userId === userId
    && intent.agentId === agentId
    && intent.assetSymbol === symbol
    && intent.side === side
    && (intent.status === 'PENDING'
      || intent.status === 'RISK_ACCEPTED'
      || intent.status === 'BROKER_PENDING'
      || intent.status === 'PARTIALLY_FILLED'));
  if (existing) {
    return { ok: true, status: 202, pending: true, intent: existing, balance: db.users[userId]?.paperBalance };
  }

  const user = db.users[userId];
  if (!user) return { ok: false, status: 403, error: 'Forbidden or user missing' };
  const submissionObservation = getPriceObservation(symbol);
  const tradeSize = nSize;
  const tradeLeverage = Number(leverage) || 1;
  const priorPosition = positionBefore(db.trades, userId, agentId, symbol);
  const signedOrder = side === 'buy' || side === 'long' ? 1 : -1;
  const positionEffect: 'increase' | 'reduce' = agent.tradeType === 'token'
    ? side === 'sell' ? 'reduce' : 'increase'
    : priorPosition.signedSize !== 0 && Math.sign(priorPosition.signedSize) !== signedOrder
      ? 'reduce'
      : 'increase';
  const { thesis, tag } = sanitizeThesis(input.thesis);
  let intent: OrderIntentV5;
  try {
    intent = createOrderIntent(userId, {
      agentId,
      assetSymbol: symbol,
      side,
      size: tradeSize,
      tradeType: agent.tradeType,
      leverage: tradeLeverage,
      nonce,
      orderType: input.orderType,
      limitPrice: input.limitPrice,
      stopPrice: input.stopPrice,
      timeInForceMs: input.timeInForceMs,
      submissionObservationHash: submissionObservation?.observationHash,
      roomId: roomId || agent.roomId,
      thesis,
      edgeops: tag,
      auditAction: audit.action,
      auditDetailsPrefix: audit.detailsPrefix,
      experimentId: input.experimentId,
      experimentLabel: input.experimentLabel,
      opportunityObservationId: input.opportunityObservationId,
      paperPermission: input.paperPermission,
      portfolioReservationId: input.portfolioReservationId,
    });
  } catch (err: any) {
    return {
      ok: false,
      status: err instanceof DatabaseWriteError ? 503 : 400,
      error: err instanceof DatabaseWriteError
        ? `Paper order intent was not durably accepted (${err.commitState}).`
        : err.message,
    };
  }

  if (!submissionObservation
    || submissionObservation.provenance !== 'observed'
    || Date.now() - submissionObservation.receivedAt > DEFAULT_PAPER_BROKER_POLICY_V5.maximumQuoteAgeMs) {
    const reason = !submissionObservation
      ? 'MARKET_OBSERVATION_UNAVAILABLE'
      : submissionObservation.provenance !== 'observed'
        ? 'OBSERVED_MARKET_QUOTE_REQUIRED'
        : 'STALE_MARKET_OBSERVATION';
    try { rejectOrderIntent(intent.intentId, reason); }
    catch (err: any) {
      return { ok: false, status: 503, error: `Paper order rejection could not be durably recorded (${err?.commitState || 'unknown'}).` };
    }
    return { ok: false, status: 409, error: reason };
  }

  // Reserve enough for adverse execution and the fee. For leveraged entries,
  // multiplying the fee component by leverage keeps the later cash fee outside
  // margin from exceeding the pre-trade balance check.
  const worstPrice = submissionObservation.price * (1
    + (DEFAULT_PAPER_BROKER_POLICY_V5.halfSpreadBps
      + DEFAULT_PAPER_BROKER_POLICY_V5.maximumSlippageBps
      + DEFAULT_PAPER_BROKER_POLICY_V5.feeBps * (agent.tradeType === 'perp' ? tradeLeverage : 1)) / 10_000);
  try {
    evaluateOrderRisk(intent, {
      userId,
      availableBalance: user.paperBalance,
      currentPrice: worstPrice,
      positionEffect,
      availablePositionSize: priorPosition.size,
    });
  } catch (err: any) {
    try {
      rejectOrderIntent(intent.intentId, err.message);
    } catch (persistError: any) {
      return {
        ok: false,
        status: 503,
        error: `Paper order rejection could not be durably recorded (${persistError?.commitState || 'unknown'}).`,
      };
    }
    return { ok: false, status: 400, error: err.message };
  }

  try {
    markOrderIntentRiskAccepted(intent.intentId, positionEffect);
    intent = submitOrderIntentToBroker(intent.intentId);
  } catch (err: any) {
    try { markOrderIntentUnresolved(intent.intentId, `BROKER_SUBMISSION_FAILED:${err.message}`); } catch { /* surfaced by status */ }
    return {
      ok: false,
      status: err instanceof DatabaseWriteError ? 503 : 400,
      error: err instanceof DatabaseWriteError
        ? `Paper broker submission was not durably recorded (${err.commitState}).`
        : err.message,
    };
  }
  return { ok: true, status: 202, pending: true, intent, balance: user.paperBalance };
}

function commitPaperBrokerFill(intentId: string, fill: PaperFillV5, stopTriggered: boolean): PaperTrade {
  const db = readDatabase();
  const intent = db.orderIntentsV5?.[intentId];
  if (!intent || (intent.status !== 'BROKER_PENDING' && intent.status !== 'PARTIALLY_FILLED')) {
    throw new Error(`BROKER_INTENT_NOT_COMMITTABLE:${intentId}`);
  }
  if (intent.lastBrokerObservationHash === fill.observationHash) {
    throw new Error('BROKER_OBSERVATION_ALREADY_CONSUMED');
  }
  const agent = db.agents[intent.agentId];
  const user = db.users[intent.userId];
  if (!agent || agent.ownerId !== intent.userId || !user) throw new Error('OWNER_OR_AGENT_CHANGED_BEFORE_COMMIT');
  const isClose = intent.positionEffect === 'reduce';
  const pos = isClose
    ? positionBefore(db.trades, intent.userId, intent.agentId, intent.assetSymbol)
    : { size: 0, signedSize: 0, avgEntry: 0, openedAt: 0 };
  const quantity = isClose ? Math.min(fill.quantity, pos.size) : fill.quantity;
  if (!(quantity > 0)) throw new Error('BROKER_RISK_REJECT:REDUCE_ONLY_POSITION_UNAVAILABLE_AT_FILL');
  const committedFill = quantity === fill.quantity ? fill : {
    ...fill,
    quantity,
    notionalUsd: quantity * fill.fillPrice,
    feeUsd: quantity * fill.fillPrice * DEFAULT_PAPER_BROKER_POLICY_V5.feeBps / 10_000,
    spreadCostUsd: fill.spreadCostUsd * quantity / fill.quantity,
    slippageUsd: fill.slippageUsd * quantity / fill.quantity,
    partial: true,
  };
  const trade: PaperTrade = {
    id: `trd_v5_${committedFill.fillId.slice(-24)}`,
    orderIntentId: intent.intentId,
    paperFillId: committedFill.fillId,
    brokerPolicyId: committedFill.brokerPolicyId,
    agentId: intent.agentId,
    userId: intent.userId,
    roomId: intent.roomId || agent.roomId,
    assetSymbol: intent.assetSymbol,
    tradeType: intent.tradeType,
    side: intent.side,
    size: quantity,
    price: committedFill.fillPrice,
    leverage: intent.leverage,
    timestamp: committedFill.filledAt,
    status: 'open',
    referencePrice: committedFill.referencePrice,
    referenceObservationHash: committedFill.observationHash,
    feeUsd: committedFill.feeUsd,
    spreadCostUsd: committedFill.spreadCostUsd,
    slippageUsd: committedFill.slippageUsd,
    experimentId: intent.experimentId,
    experimentLabel: intent.experimentLabel,
    opportunityObservationId: intent.opportunityObservationId,
    paperPermission: intent.paperPermission,
    thesis: intent.thesis,
    edgeops: intent.edgeops,
  };
  if (!isClose || pos.size <= 0) {
    const margin = agent.tradeType === 'perp'
      ? (quantity * committedFill.fillPrice) / intent.leverage
      : quantity * committedFill.fillPrice;
    if (margin + committedFill.feeUsd > user.paperBalance + 1e-9) {
      throw new Error('BROKER_RISK_REJECT:INSUFFICIENT_BALANCE_AT_FILL');
    }
    user.paperBalance -= margin + committedFill.feeUsd;
    trade.pnl = undefined;
  } else {
    const realizedPnl = (committedFill.fillPrice - pos.avgEntry) * quantity * Math.sign(pos.signedSize);
    const marginReturned = agent.tradeType === 'perp'
      ? (quantity * pos.avgEntry) / intent.leverage
      : quantity * pos.avgEntry;
    const holdingMs = Math.max(0, committedFill.filledAt - pos.openedAt);
    const holdingDays = holdingMs / 86_400_000;
    const fundingUsd = agent.tradeType === 'perp'
      ? quantity * pos.avgEntry * DEFAULT_PAPER_BROKER_POLICY_V5.perpFundingBpsPerDay / 10_000 * holdingDays
      : 0;
    const borrowUsd = agent.tradeType === 'perp' && pos.signedSize < 0
      ? quantity * pos.avgEntry * DEFAULT_PAPER_BROKER_POLICY_V5.shortBorrowBpsPerDay / 10_000 * holdingDays
      : 0;
    user.paperBalance += marginReturned + realizedPnl - committedFill.feeUsd - fundingUsd - borrowUsd;
    trade.fundingUsd = Number(fundingUsd.toPrecision(12));
    trade.borrowUsd = Number(borrowUsd.toPrecision(12));
    trade.holdingMs = holdingMs;
    trade.pnl = Number((realizedPnl - committedFill.feeUsd - fundingUsd - borrowUsd).toFixed(2));
  }
  intent.stopTriggered = stopTriggered;
  db.trades.push(trade);
  agent.lastTradeAt = committedFill.filledAt;
  db.auditEvents.push({
    id: 'aud_' + generateId(),
    userId: intent.userId,
    username: user.username,
    action: intent.auditAction || 'PAPER_BROKER_FILL',
    details: `${intent.auditDetailsPrefix || 'Paper broker filled'} ${intent.side} of ${quantity} ${intent.assetSymbol} at $${committedFill.fillPrice}`,
    timestamp: committedFill.filledAt,
  });
  db.graphEvents.push({
    id: 'gph_' + generateId(),
    type: 'paper_action',
    userId: intent.userId,
    targetId: trade.id,
    targetType: 'Agent',
    metadata: {
      side: intent.side,
      size: quantity,
      assetSymbol: intent.assetSymbol,
      orderIntentId: intent.intentId,
      paperFillId: committedFill.fillId,
    },
    timestamp: committedFill.filledAt,
  });
  recordPaperBrokerFill(db, intent.intentId, trade, committedFill);
  try {
    writeDatabase(db, [
      'users', 'agents', 'trades', 'auditEvents', 'graphEvents', 'orderIntentsV5',
      'orderEventsV5', 'paperFillsV5', 'portfolioAllocatorV5',
    ]);
  } catch (err: any) {
    try {
      markOrderIntentUnresolved(
        intent.intentId,
        `FINAL_TRADE_COMMIT_FAILED:${err?.commitState || 'unknown'}`,
      );
    } catch (statusError: any) {
      console.error('[paper-order] failed to persist unresolved intent state:', statusError?.message);
    }
    throw err;
  }
  return trade;
}

let paperBrokerLastCycleAt: number | null = null;

function processPaperBrokerOnceUnbatched(
  now = Date.now(),
  resolveObservation: (symbol: string) => MarketObservationV5 | null = getPriceObservation,
  policy: PaperBrokerPolicyV5 = DEFAULT_PAPER_BROKER_POLICY_V5,
): { inspected: number; filled: number; partial: number; rejected: number; expired: number; waiting: number } {
  const result = { inspected: 0, filled: 0, partial: 0, rejected: 0, expired: 0, waiting: 0 };
  const intents = Object.values(readDatabase().orderIntentsV5 || {})
    .filter((intent) => intent.status === 'BROKER_PENDING' || intent.status === 'PARTIALLY_FILLED');
  for (const intent of intents) {
    result.inspected += 1;
    const evaluation = evaluatePaperBrokerV5({
      intent,
      observation: resolveObservation(intent.assetSymbol),
      now,
      policy,
    });
    try {
      if (evaluation.action === 'wait') {
        if (evaluation.stopTriggered && !intent.stopTriggered) {
          const db = readDatabase();
          const current = db.orderIntentsV5?.[intent.intentId];
          if (current && (current.status === 'BROKER_PENDING' || current.status === 'PARTIALLY_FILLED')) {
            current.stopTriggered = true;
            current.updatedAt = now;
            writeDatabase(db, ['orderIntentsV5']);
          }
        }
        result.waiting += 1;
      } else if (evaluation.action === 'reject') {
        rejectBrokerOrderIntent(intent.intentId, evaluation.reason);
        result.rejected += 1;
      } else if (evaluation.action === 'expire') {
        expireBrokerOrderIntent(intent.intentId, evaluation.reason);
        result.expired += 1;
      } else {
        commitPaperBrokerFill(intent.intentId, evaluation.fill, evaluation.stopTriggered);
        if (evaluation.fill.partial) result.partial += 1;
        else result.filled += 1;
      }
    } catch (err: any) {
      if (String(err?.message || '').startsWith('BROKER_RISK_REJECT:')) {
        try {
          rejectBrokerOrderIntent(intent.intentId, err.message);
          result.rejected += 1;
        } catch { /* reconciliation retains the nonterminal evidence */ }
      } else {
        try { markOrderIntentUnresolved(intent.intentId, `PAPER_BROKER_COMMIT_FAILED:${err?.commitState || err.message}`); }
        catch { /* status and reconciliation retain the nonterminal evidence */ }
      }
    }
  }
  paperBrokerLastCycleAt = now;
  return result;
}

export function processPaperBrokerOnce(
  now = Date.now(),
  resolveObservation: (symbol: string) => MarketObservationV5 | null = getPriceObservation,
  policy: PaperBrokerPolicyV5 = DEFAULT_PAPER_BROKER_POLICY_V5,
): { inspected: number; filled: number; partial: number; rejected: number; expired: number; waiting: number } {
  // A broker tick may resolve several intents. Their user balances, fills,
  // trades, audits, order events, and portfolio conversions are one canonical
  // state transition, so persist them together instead of blocking the request
  // loop for a commit per intent.
  return runDatabaseWriteBatch(() => processPaperBrokerOnceUnbatched(now, resolveObservation, policy));
}

let paperBrokerStarted = false;
let paperBrokerIntervalMs = 1_000;
export function paperBrokerClockV5() {
  return {
    id: 'paper_broker_clock_v5',
    enabled: paperBrokerStarted,
    cadenceMs: paperBrokerIntervalMs,
    lastCompletedAt: paperBrokerLastCycleAt,
  };
}

export function startPaperBroker(): void {
  if (paperBrokerStarted) return;
  paperBrokerStarted = true;
  const intervalMs = Math.max(250, Number(process.env.PAPER_BROKER_TICK_MS) || 1_000);
  paperBrokerIntervalMs = intervalMs;
  setInterval(() => {
    try { processPaperBrokerOnce(); }
    catch (error: any) { console.warn('[paper-broker-v5] cycle failed:', error?.message); }
  }, intervalMs).unref();
  console.log(`[paper-broker-v5] armed every ${intervalMs}ms; live execution locked`);
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
  res.status(result.status || 200).json({
    success: true,
    pending: result.pending,
    intent: result.intent,
    trade: result.trade,
    balance: result.balance,
  });
});

// List trades
// EdgeOps Loop 5: post-trade review. Separates signal failure from execution
// failure / regime / behavior. Owner-only, closed (realized) trades only.
tradesRouter.post('/api/trades/:id/review', (req: any, res) => {
  const db = readDatabase();
  const trade: PaperTrade | undefined = db.trades.find((t: PaperTrade) => t.id === req.params.id);
  if (!trade || trade.userId !== req.userId) { res.status(404).json({ error: 'Trade not found.' }); return; }
  if (typeof trade.pnl !== 'number') { res.status(400).json({ error: 'Only closed trades (realized P&L) can be reviewed.' }); return; }
  const b = req.body || {};
  // Derived from the type, not retyped alongside it. `review` is declared on
  // PaperTrade, so the `as any` these lines used to carry bought nothing and
  // silently exempted the payload from the very union it was validating against.
  // Widen TradeReview and tsc now fails here until the validator agrees.
  const DRIVERS: TradeReview['outcomeDriver'][] = ['signal', 'execution', 'regime', 'liquidity', 'behavior'];
  const DECISIONS: TradeReview['nextDecision'][] = ['keep_testing', 'modify', 'kill', 'promote_paper_only'];
  if (!DRIVERS.includes(b.outcomeDriver) || !DECISIONS.includes(b.nextDecision)) {
    res.status(400).json({ error: `outcomeDriver must be one of ${DRIVERS.join('/')}; nextDecision one of ${DECISIONS.join('/')}.` });
    return;
  }
  const review: TradeReview = {
    thesisFollowed: !!b.thesisFollowed,
    invalidationHit: !!b.invalidationHit,
    outcomeDriver: b.outcomeDriver,
    lesson: String(b.lesson || '').slice(0, 500),
    nextDecision: b.nextDecision,
    reviewedAt: Date.now()
  };
  trade.review = review;
  writeDatabase(db, ['trades']);
  res.json({ success: true, review });
});

tradesRouter.get('/api/trades', (req: any, res) => {
  const userId = req.userId;
  const db = readDatabase();
  const myTrades = db.trades.filter(t => t.userId === userId);
  const orders = Object.values(db.orderIntentsV5 || {})
    .filter((intent) => intent.userId === userId)
    .sort((left, right) => right.createdAt - left.createdAt);
  const orderIds = new Set(orders.map((intent) => intent.intentId));
  const fills = (db.paperFillsV5 || []).filter((fill) => orderIds.has(fill.intentId));
  res.json({
    mode: 'Paper money',
    brokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id,
    trades: myTrades,
    orders,
    fills,
    liveExecution: 'locked',
  });
});

// Delete a specific trade
tradesRouter.delete('/api/trades/:id', (req: any, res) => {
  res.status(409).json({
    error: 'Paper trade history is an immutable competition ledger. Pause or revoke the agent to stop future activity.',
  });
});

// Clear all trades for current user
tradesRouter.delete('/api/trades', (req: any, res) => {
  res.status(409).json({
    error: 'Paper trade history is an immutable competition ledger. Start a new season or league for a fresh score.',
  });
});
