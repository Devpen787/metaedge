/**
 * Durable V5 order intent and event lifecycle.
 *
 * Order creation, anti-replay, risk disposition, and execution lineage live in
 * the canonical database. There is no process-memory authority to lose on
 * restart. The final EXECUTED event is appended to the same DatabaseState
 * transaction as the paper trade, balance, position accounting, and audit.
 */
import crypto from 'node:crypto';
import { readDatabase, writeDatabase } from '../../../server/storage.js';
import type {
  DatabaseState,
  OrderEventTypeV5,
  OrderEventV5,
  OrderIntentV5,
  PaperFillV5,
  PaperTrade,
} from '../../types';
import { v5AuthorityFlags } from '../../../server/v5/authority.js';
import { DEFAULT_PAPER_BROKER_POLICY_V5 } from '../../../server/v5/paper_broker.js';

export type OrderIntent = OrderIntentV5;

export interface OrderIntentInput {
  agentId: string;
  assetSymbol: string;
  side: OrderIntentV5['side'];
  size: number;
  tradeType: OrderIntentV5['tradeType'];
  leverage: number;
  nonce: string;
  orderType?: OrderIntentV5['orderType'];
  limitPrice?: number;
  stopPrice?: number;
  timeInForceMs?: number;
  submissionObservationHash?: string;
  roomId?: string;
  thesis?: OrderIntentV5['thesis'];
  edgeops?: OrderIntentV5['edgeops'];
  auditAction?: string;
  auditDetailsPrefix?: string;
  experimentId?: string;
  experimentLabel?: string;
  opportunityObservationId?: string;
  paperPermission?: OrderIntentV5['paperPermission'];
  portfolioReservationId?: string;
}

function digest(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function state(db: DatabaseState) {
  return {
    intents: (db.orderIntentsV5 ||= {}),
    nonceIndex: (db.orderNonceIndexV5 ||= {}),
    events: (db.orderEventsV5 ||= []),
  };
}

function appendAudit(
  db: DatabaseState,
  intent: OrderIntentV5,
  action: string,
  details: string,
  at: number,
): void {
  db.auditEvents.push({
    id: `aud_order_v5_${digest({ intentId: intent.intentId, action, at }).slice(0, 24)}`,
    userId: intent.userId,
    username: db.users[intent.userId]?.username || 'system',
    action,
    details,
    timestamp: at,
  });
}

function transitionPortfolioReservation(
  db: DatabaseState,
  intent: OrderIntentV5,
  status: 'bound' | 'converted' | 'released',
  at: number,
  reason?: string,
): void {
  if (!intent.portfolioReservationId) return;
  const reservation = db.portfolioAllocatorV5?.reservations[intent.portfolioReservationId];
  if (!reservation
    || reservation.intentId !== intent.intentId
    || reservation.experimentId !== intent.experimentId
    || reservation.agentId !== intent.agentId) {
    throw new Error('PORTFOLIO_RESERVATION_TERMINAL_LINEAGE_MISMATCH');
  }
  reservation.status = status;
  reservation.updatedAt = at;
  if (status === 'released') reservation.releasedReason = reason || 'ORDER_TERMINAL_WITHOUT_EXECUTION';
}

function appendEvent(
  db: DatabaseState,
  intent: OrderIntentV5,
  type: OrderEventTypeV5,
  details: {
    reason?: string;
    tradeId?: string;
    executedPrice?: number;
    fillId?: string;
    filledSize?: number;
    remainingSize?: number;
    observationHash?: string;
  } = {},
  at = Date.now(),
): OrderEventV5 {
  const events = state(db).events;
  const sequence = events.reduce(
    (maximum, event) => event.intentId === intent.intentId ? Math.max(maximum, event.sequence) : maximum,
    0,
  ) + 1;
  const payloadHash = digest({
    intentId: intent.intentId,
    sequence,
    type,
    reason: details.reason,
    tradeId: details.tradeId,
    executedPrice: details.executedPrice,
    fillId: details.fillId,
    filledSize: details.filledSize,
    remainingSize: details.remainingSize,
    observationHash: details.observationHash,
  });
  const event: OrderEventV5 = {
    authorityVersion: 5,
    schema: 'order-event.v5',
    eventId: `ord_event_v5_${payloadHash.slice(0, 24)}`,
    intentId: intent.intentId,
    sequence,
    type,
    at,
    payloadHash,
    ...details,
  };
  events.push(event);
  return event;
}

export function createOrderIntent(userId: string, input: OrderIntentInput): OrderIntentV5 {
  if (!v5AuthorityFlags().paperIntentsEnabled) {
    throw new Error('V5_PAPER_INTENTS_DISABLED');
  }
  const orderType = input.orderType ?? 'market';
  if (!['market', 'limit', 'stop', 'stop_limit'].includes(orderType)) {
    throw new Error(`PAPER_ORDER_TYPE_INVALID:${orderType}`);
  }
  if ((orderType === 'limit' || orderType === 'stop_limit') && !(Number(input.limitPrice) > 0)) {
    throw new Error('PAPER_ORDER_LIMIT_PRICE_REQUIRED');
  }
  if ((orderType === 'stop' || orderType === 'stop_limit') && !(Number(input.stopPrice) > 0)) {
    throw new Error('PAPER_ORDER_STOP_PRICE_REQUIRED');
  }
  if (input.timeInForceMs != null
    && (!Number.isFinite(input.timeInForceMs) || input.timeInForceMs < 1 || input.timeInForceMs > 86_400_000)) {
    throw new Error('PAPER_ORDER_TIME_IN_FORCE_INVALID');
  }
  const db = readDatabase();
  const orderState = state(db);
  const idempotencyKey = `${userId}:${input.nonce}`;
  const existingId = orderState.nonceIndex[idempotencyKey];
  if (existingId) {
    throw new Error(`REPLAY_DETECTED: Duplicate intent nonce (${existingId}).`);
  }
  const now = Date.now();

  const managedExperiment = Object.values(db.experimentsV5?.specs || {}).find((spec) =>
    `agt_exp_v5_${spec.strategyHash.slice(0, 20)}` === input.agentId);
  if (managedExperiment && input.experimentId !== managedExperiment.experimentId) {
    throw new Error('EXPERIMENT_PORTFOLIO_LINEAGE_REQUIRED');
  }
  if (input.experimentId && !db.experimentsV5?.specs[input.experimentId]) {
    throw new Error('EXPERIMENT_REGISTRY_ENTRY_MISSING');
  }

  const portfolioReservation = input.experimentId
    ? db.portfolioAllocatorV5?.reservations[input.portfolioReservationId || '']
    : undefined;
  if (input.experimentId) {
    if (!input.portfolioReservationId || !portfolioReservation) {
      throw new Error('PORTFOLIO_RESERVATION_REQUIRED');
    }
    const portfolioPolicy = db.portfolioAllocatorV5?.policy;
    if (!portfolioPolicy
      || portfolioPolicy.liveExecution !== 'locked'
      || portfolioReservation.policyId !== portfolioPolicy.id
      || portfolioReservation.policyHash !== portfolioPolicy.policyHash) {
      throw new Error('PORTFOLIO_RESERVATION_POLICY_MISMATCH');
    }
    if (now - portfolioReservation.createdAt > portfolioPolicy.unboundReservationLeaseMs) {
      throw new Error('PORTFOLIO_RESERVATION_EXPIRED');
    }
    if (portfolioReservation.status !== 'reserved'
      || portfolioReservation.userId !== userId
      || portfolioReservation.agentId !== input.agentId
      || portfolioReservation.experimentId !== input.experimentId
      || portfolioReservation.opportunityObservationId !== input.opportunityObservationId
      || portfolioReservation.symbol !== input.assetSymbol.toUpperCase()
      || portfolioReservation.side !== input.side
      || Math.abs(portfolioReservation.requestedSize - input.size) > 1e-9) {
      throw new Error('PORTFOLIO_RESERVATION_LINEAGE_MISMATCH');
    }
  }

  const identityHash = digest({ authorityVersion: 5, idempotencyKey });
  const intent: OrderIntentV5 = {
    authorityVersion: 5,
    schema: 'order-intent.v5',
    intentId: `ord_intent_v5_${identityHash.slice(0, 24)}`,
    idempotencyKey,
    userId,
    agentId: input.agentId,
    assetSymbol: input.assetSymbol.toUpperCase(),
    side: input.side,
    size: input.size,
    tradeType: input.tradeType,
    leverage: input.leverage,
    orderType,
    limitPrice: input.limitPrice,
    stopPrice: input.stopPrice,
    expiresAt: now + Math.max(1, input.timeInForceMs ?? DEFAULT_PAPER_BROKER_POLICY_V5.defaultTimeInForceMs),
    brokerPolicyId: DEFAULT_PAPER_BROKER_POLICY_V5.id,
    submissionObservationHash: input.submissionObservationHash,
    stopTriggered: false,
    filledSize: 0,
    remainingSize: input.size,
    fillIds: [],
    tradeIds: [],
    positionEffect: null,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    nonce: input.nonce,
    roomId: input.roomId,
    thesis: input.thesis,
    edgeops: input.edgeops,
    auditAction: input.auditAction,
    auditDetailsPrefix: input.auditDetailsPrefix,
    experimentId: input.experimentId,
    experimentLabel: input.experimentLabel,
    opportunityObservationId: input.opportunityObservationId,
    paperPermission: input.paperPermission,
    portfolioReservationId: input.portfolioReservationId,
  };

  if (portfolioReservation) {
    portfolioReservation.status = 'bound';
    portfolioReservation.intentId = intent.intentId;
    portfolioReservation.updatedAt = now;
  }

  orderState.intents[intent.intentId] = intent;
  orderState.nonceIndex[idempotencyKey] = intent.intentId;
  appendEvent(db, intent, 'CREATED', {}, now);
  appendAudit(db, intent, 'CREATE_ORDER_INTENT_V5', `Created durable paper order intent ${intent.intentId}`, now);
  writeDatabase(db, ['orderIntentsV5', 'orderNonceIndexV5', 'orderEventsV5', 'auditEvents', 'portfolioAllocatorV5']);
  return intent;
}

export function getOrderIntent(intentId: string): OrderIntentV5 | undefined {
  return state(readDatabase()).intents[intentId];
}

export function getOrderEvents(intentId: string): OrderEventV5[] {
  return state(readDatabase()).events
    .filter((event) => event.intentId === intentId)
    .sort((left, right) => left.sequence - right.sequence);
}

export function markOrderIntentRiskAccepted(
  intentId: string,
  positionEffect: NonNullable<OrderIntentV5['positionEffect']>,
): OrderIntentV5 {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status !== 'PENDING') {
    throw new Error(`INVALID_STATE: Cannot accept risk in status: ${intent.status}`);
  }
  const now = Date.now();
  intent.status = 'RISK_ACCEPTED';
  intent.positionEffect = positionEffect;
  intent.updatedAt = now;
  appendEvent(db, intent, 'RISK_ACCEPTED', {}, now);
  appendAudit(db, intent, 'ORDER_RISK_ACCEPTED_V5', `Risk accepted as ${positionEffect}`, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents']);
  return intent;
}

export function submitOrderIntentToBroker(intentId: string): OrderIntentV5 {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status !== 'RISK_ACCEPTED') {
    throw new Error(`INVALID_STATE: Cannot submit to broker in status: ${intent.status}`);
  }
  const now = Date.now();
  intent.status = 'BROKER_PENDING';
  intent.updatedAt = now;
  appendEvent(db, intent, 'SUBMITTED_TO_BROKER', {
    remainingSize: intent.remainingSize ?? intent.size,
    observationHash: intent.submissionObservationHash,
  }, now);
  appendAudit(db, intent, 'SUBMIT_PAPER_BROKER_V5', `Submitted to ${intent.brokerPolicyId}`, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents']);
  return intent;
}

export function rejectOrderIntent(intentId: string, reason: string): OrderIntentV5 {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status === 'REJECTED') return intent;
  if (intent.status !== 'PENDING') {
    throw new Error(`INVALID_STATE: Cannot reject intent in status: ${intent.status}`);
  }
  const now = Date.now();
  intent.status = 'REJECTED';
  intent.failureReason = reason.slice(0, 500);
  intent.updatedAt = now;
  transitionPortfolioReservation(db, intent, 'released', now, intent.failureReason);
  appendEvent(db, intent, 'RISK_REJECTED', { reason: intent.failureReason }, now);
  appendAudit(db, intent, 'ORDER_RISK_REJECTED_V5', intent.failureReason, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents', 'portfolioAllocatorV5']);
  return intent;
}

export function rejectBrokerOrderIntent(intentId: string, reason: string): OrderIntentV5 {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status === 'REJECTED') return intent;
  if (intent.status !== 'BROKER_PENDING' && intent.status !== 'PARTIALLY_FILLED') {
    throw new Error(`INVALID_STATE: Cannot broker-reject intent in status: ${intent.status}`);
  }
  const now = Date.now();
  intent.status = 'REJECTED';
  intent.noTradeReason = reason.slice(0, 500);
  intent.failureReason = intent.noTradeReason;
  intent.updatedAt = now;
  transitionPortfolioReservation(db, intent, 'released', now, intent.failureReason);
  appendEvent(db, intent, 'BROKER_REJECTED', { reason: intent.noTradeReason }, now);
  appendAudit(db, intent, 'PAPER_BROKER_REJECTED_V5', intent.noTradeReason, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents', 'portfolioAllocatorV5']);
  return intent;
}

export function expireBrokerOrderIntent(intentId: string, reason: string): OrderIntentV5 {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status === 'EXPIRED') return intent;
  if (intent.status !== 'BROKER_PENDING' && intent.status !== 'PARTIALLY_FILLED') {
    throw new Error(`INVALID_STATE: Cannot expire intent in status: ${intent.status}`);
  }
  const now = Date.now();
  intent.status = 'EXPIRED';
  intent.noTradeReason = reason.slice(0, 500);
  intent.updatedAt = now;
  transitionPortfolioReservation(db, intent, 'released', now, intent.noTradeReason);
  appendEvent(db, intent, 'EXPIRED', {
    reason: intent.noTradeReason,
    filledSize: intent.filledSize ?? 0,
    remainingSize: intent.remainingSize ?? intent.size,
  }, now);
  appendAudit(db, intent, 'PAPER_BROKER_EXPIRED_V5', intent.noTradeReason, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents', 'portfolioAllocatorV5']);
  return intent;
}

export function prepareOrderExecution(intentId: string, executedPrice: number): PaperTrade {
  const intent = state(readDatabase()).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status !== 'RISK_ACCEPTED') {
    throw new Error(`INVALID_STATE: Cannot execute intent in status: ${intent.status}`);
  }
  if (!(Number.isFinite(executedPrice) && executedPrice > 0)) {
    throw new Error('EXECUTION_PRICE_INVALID');
  }
  return {
    id: `trd_v5_${digest({ intentId }).slice(0, 24)}`,
    orderIntentId: intent.intentId,
    agentId: intent.agentId,
    userId: intent.userId,
    assetSymbol: intent.assetSymbol,
    tradeType: intent.tradeType,
    side: intent.side,
    size: intent.size,
    price: executedPrice,
    leverage: intent.leverage,
    timestamp: Date.now(),
    pnl: 0,
    status: 'open',
  };
}

/**
 * Records one broker fill in the caller's final accounting transaction.
 * Partial fills remain broker-pending and require a different later market
 * observation before another fill can be committed.
 */
export function recordPaperBrokerFill(
  db: DatabaseState,
  intentId: string,
  trade: PaperTrade,
  fill: PaperFillV5,
): OrderIntentV5 {
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status !== 'BROKER_PENDING' && intent.status !== 'PARTIALLY_FILLED') {
    throw new Error(`INVALID_STATE: Cannot fill intent in status: ${intent.status}`);
  }
  if (fill.intentId !== intent.intentId
    || trade.orderIntentId !== intent.intentId
    || trade.userId !== intent.userId
    || trade.agentId !== intent.agentId
    || trade.paperFillId !== fill.fillId) {
    throw new Error('EXECUTION_LINEAGE_MISMATCH');
  }
  const fills = (db.paperFillsV5 ||= []);
  if (fills.some((row) => row.fillId === fill.fillId) || intent.fillIds?.includes(fill.fillId)) {
    throw new Error(`DUPLICATE_PAPER_FILL:${fill.fillId}`);
  }
  const priorFilled = intent.filledSize ?? 0;
  const filledSize = priorFilled + fill.quantity;
  if (filledSize > intent.size + 1e-9) throw new Error('PAPER_FILL_EXCEEDS_INTENT_SIZE');
  const remainingSize = Math.max(0, intent.size - filledSize);
  const terminal = remainingSize <= 1e-9;
  const now = fill.filledAt;
  fills.push(fill);
  intent.fillIds = [...(intent.fillIds ?? []), fill.fillId];
  intent.tradeIds = [...(intent.tradeIds ?? []), trade.id];
  intent.filledSize = filledSize;
  intent.remainingSize = remainingSize;
  intent.lastBrokerObservationHash = fill.observationHash;
  intent.tradeId = terminal ? trade.id : intent.tradeId;
  intent.status = terminal ? 'EXECUTED' : 'PARTIALLY_FILLED';
  intent.updatedAt = now;
  transitionPortfolioReservation(db, intent, terminal ? 'converted' : 'bound', now);
  appendEvent(db, intent, terminal ? 'EXECUTED' : 'PARTIALLY_FILLED', {
    tradeId: trade.id,
    executedPrice: trade.price,
    fillId: fill.fillId,
    filledSize,
    remainingSize,
    observationHash: fill.observationHash,
  }, now);
  appendAudit(
    db,
    intent,
    terminal ? 'EXECUTE_ORDER_INTENT_V5' : 'PARTIAL_FILL_ORDER_INTENT_V5',
    `${terminal ? 'Completed' : 'Partially filled'} paper order with ${fill.fillId}`,
    now,
  );
  return intent;
}

/**
 * Mutates the caller's transaction but does not write it. The caller must add
 * the trade/accounting mutations and persist the complete DatabaseState once.
 */
export function finalizeOrderIntentExecution(
  db: DatabaseState,
  intentId: string,
  trade: PaperTrade,
): OrderIntentV5 {
  const intent = state(db).intents[intentId];
  if (!intent) throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  if (intent.status !== 'RISK_ACCEPTED') {
    throw new Error(`INVALID_STATE: Cannot finalize intent in status: ${intent.status}`);
  }
  if (trade.orderIntentId !== intent.intentId || trade.userId !== intent.userId || trade.agentId !== intent.agentId) {
    throw new Error('EXECUTION_LINEAGE_MISMATCH');
  }
  const now = Date.now();
  intent.status = 'EXECUTED';
  intent.tradeId = trade.id;
  intent.updatedAt = now;
  transitionPortfolioReservation(db, intent, 'converted', now);
  appendEvent(db, intent, 'EXECUTED', { tradeId: trade.id, executedPrice: trade.price }, now);
  appendAudit(db, intent, 'EXECUTE_ORDER_INTENT_V5', `Committed paper trade ${trade.id}`, now);
  return intent;
}

export function markOrderIntentUnresolved(intentId: string, reason: string): OrderIntentV5 | undefined {
  const db = readDatabase();
  const intent = state(db).intents[intentId];
  if (!intent) return undefined;
  if (intent.status === 'UNRESOLVED') return intent;
  // A possibly-committed write may already contain the trade and EXECUTED
  // event. Preserve that durable fact for reconciliation rather than rewriting
  // it as unresolved.
  if (intent.status === 'EXECUTED' && intent.tradeId && db.trades.some((trade) => trade.id === intent.tradeId)) {
    return intent;
  }
  const now = Date.now();
  intent.status = 'UNRESOLVED';
  intent.failureReason = reason.slice(0, 500);
  intent.updatedAt = now;
  appendEvent(db, intent, 'UNRESOLVED', { reason: intent.failureReason }, now);
  appendAudit(db, intent, 'ORDER_UNRESOLVED_V5', intent.failureReason, now);
  writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents']);
  return intent;
}

export interface OrderReconciliationResultV5 {
  inspected: number;
  recoveredExecuted: number;
  markedUnresolved: number;
}

/**
 * Resolves every durable non-terminal intent before background trading starts.
 *
 * A matching durable trade is authoritative evidence that execution committed,
 * even if the intent status update was interrupted. Without that trade, an
 * intent left PENDING/RISK_ACCEPTED across process startup is not retried
 * automatically: it becomes UNRESOLVED for explicit operator review.
 */
export function reconcileOrderIntents(): OrderReconciliationResultV5 {
  const db = readDatabase();
  const orderState = state(db);
  const result: OrderReconciliationResultV5 = {
    inspected: 0,
    recoveredExecuted: 0,
    markedUnresolved: 0,
  };
  let changed = false;

  for (const intent of Object.values(orderState.intents)) {
    result.inspected += 1;
    const relatedTrades = db.trades.filter((trade) => trade.orderIntentId === intent.intentId);
    const relatedFills = (db.paperFillsV5 || []).filter((fill) => fill.intentId === intent.intentId);
    const matchingTrade = relatedTrades[0];
    const tradeMatchesLineage = matchingTrade
      && matchingTrade.userId === intent.userId
      && matchingTrade.agentId === intent.agentId;
    const brokerState = intent.status === 'BROKER_PENDING' || intent.status === 'PARTIALLY_FILLED';

    if (brokerState) {
      const brokerLineageValid = relatedFills.every((fill) => relatedTrades.some((trade) =>
        trade.paperFillId === fill.fillId
        && trade.userId === intent.userId
        && trade.agentId === intent.agentId));
      const filledSize = relatedFills.reduce((sum, fill) => sum + fill.quantity, 0);
      if (!brokerLineageValid || filledSize > intent.size + 1e-9) {
        const now = Date.now();
        intent.status = 'UNRESOLVED';
        intent.failureReason = 'RECONCILIATION_BROKER_FILL_LINEAGE_MISMATCH';
        intent.updatedAt = now;
        appendEvent(db, intent, 'UNRESOLVED', { reason: intent.failureReason }, now);
        appendAudit(db, intent, 'RECONCILE_ORDER_UNRESOLVED_V5', intent.failureReason, now);
        result.markedUnresolved += 1;
        changed = true;
        continue;
      }
      intent.fillIds = relatedFills.map((fill) => fill.fillId);
      intent.tradeIds = relatedTrades.map((trade) => trade.id);
      intent.filledSize = filledSize;
      intent.remainingSize = Math.max(0, intent.size - filledSize);
      if (intent.remainingSize <= 1e-9 && relatedTrades.length > 0) {
        const now = Date.now();
        intent.status = 'EXECUTED';
        intent.tradeId = relatedTrades.at(-1)?.id;
        intent.updatedAt = now;
        appendEvent(db, intent, 'EXECUTED', {
          tradeId: intent.tradeId,
          executedPrice: relatedTrades.at(-1)?.price,
          filledSize,
          remainingSize: 0,
        }, now);
        appendAudit(db, intent, 'RECONCILE_ORDER_EXECUTED_V5', 'Recovered completed broker fills', now);
        result.recoveredExecuted += 1;
        changed = true;
      } else if (filledSize > 0) {
        if (intent.status !== 'PARTIALLY_FILLED') changed = true;
        intent.status = 'PARTIALLY_FILLED';
      } else if (Number(intent.expiresAt) <= Date.now()) {
        const now = Date.now();
        intent.status = 'EXPIRED';
        intent.noTradeReason = 'RECONCILIATION_TIME_IN_FORCE_EXPIRED';
        intent.updatedAt = now;
        appendEvent(db, intent, 'EXPIRED', { reason: intent.noTradeReason, filledSize: 0, remainingSize: intent.size }, now);
        appendAudit(db, intent, 'RECONCILE_ORDER_EXPIRED_V5', intent.noTradeReason, now);
        changed = true;
      }
      continue;
    }

    if ((intent.status === 'PENDING' || intent.status === 'RISK_ACCEPTED') && tradeMatchesLineage) {
      const now = Date.now();
      intent.status = 'EXECUTED';
      intent.tradeId = matchingTrade.id;
      intent.updatedAt = now;
      appendEvent(
        db,
        intent,
        'EXECUTED',
        { tradeId: matchingTrade.id, executedPrice: matchingTrade.price },
        now,
      );
      appendAudit(
        db,
        intent,
        'RECONCILE_ORDER_EXECUTED_V5',
        `Recovered durable paper trade ${matchingTrade.id}`,
        now,
      );
      result.recoveredExecuted += 1;
      changed = true;
      continue;
    }

    // Recover intents previously mis-marked UNRESOLVED by the first-vs-last tradeId
    // comparison below: a multi-fill order records several trades, intent.tradeId is
    // the LAST, but the check compared it to relatedTrades[0] (the FIRST). If the
    // intent is fully filled and its tradeId is a durable trade in its own lineage,
    // it genuinely EXECUTED — restore it so the outcome reconciler can close it.
    const wronglyUnresolved = intent.status === 'UNRESOLVED'
      && intent.failureReason === 'RECONCILIATION_EXECUTED_TRADE_MISSING_OR_MISMATCHED'
      && tradeMatchesLineage
      && relatedTrades.some((trade) => trade.id === intent.tradeId)
      && (intent.remainingSize ?? 0) <= 1e-9;
    if (wronglyUnresolved) {
      const now = Date.now();
      intent.status = 'EXECUTED';
      intent.failureReason = undefined;
      intent.updatedAt = now;
      appendEvent(db, intent, 'EXECUTED', { tradeId: intent.tradeId }, now);
      appendAudit(db, intent, 'RECONCILE_ORDER_EXECUTED_V5', 'Recovered order mis-marked unresolved (multi-fill lineage)', now);
      result.recoveredExecuted += 1;
      changed = true;
      continue;
    }

    // A multi-fill order records several trades; intent.tradeId is the LAST one, so
    // match against ALL related trades, not just relatedTrades[0] (which was the bug).
    const executedWithoutMatchingTrade = intent.status === 'EXECUTED'
      && (!tradeMatchesLineage || !relatedTrades.some((trade) => trade.id === intent.tradeId));
    const strandedNonTerminal = intent.status === 'PENDING' || intent.status === 'RISK_ACCEPTED';
    if (executedWithoutMatchingTrade || strandedNonTerminal) {
      const now = Date.now();
      intent.status = 'UNRESOLVED';
      intent.failureReason = (
        executedWithoutMatchingTrade
          ? 'RECONCILIATION_EXECUTED_TRADE_MISSING_OR_MISMATCHED'
          : 'RECONCILIATION_NONTERMINAL_INTENT_WITHOUT_DURABLE_TRADE'
      );
      intent.updatedAt = now;
      appendEvent(db, intent, 'UNRESOLVED', { reason: intent.failureReason }, now);
      appendAudit(db, intent, 'RECONCILE_ORDER_UNRESOLVED_V5', intent.failureReason, now);
      result.markedUnresolved += 1;
      changed = true;
    }
  }

  if (changed) writeDatabase(db, ['orderIntentsV5', 'orderEventsV5', 'auditEvents', 'portfolioAllocatorV5']);
  return result;
}
