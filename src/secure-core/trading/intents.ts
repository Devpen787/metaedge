/**
 * Order Intent Lifecycle and Execution (Canonical State Transition)
 */
import { PaperTrade } from '../../types';
import { logAuditEvent } from '../audit/logger';

export interface OrderIntent {
  intentId: string;
  userId: string;
  agentId: string;
  assetSymbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  size: number;
  tradeType: 'token' | 'perp';
  leverage: number;
  status: 'PENDING' | 'EXECUTED' | 'REJECTED';
  createdAt: number;
  nonce: string; // Anti-replay
}

const seenNonces = new Set<string>();
const orderIntents = new Map<string, OrderIntent>();

export function createOrderIntent(
  userId: string, 
  intentData: Omit<OrderIntent, 'intentId' | 'status' | 'createdAt' | 'userId'>
): OrderIntent {
  
  if (seenNonces.has(intentData.nonce)) {
    throw new Error('REPLAY_DETECTED: Duplicate intent nonce.');
  }

  seenNonces.add(intentData.nonce);

  const intent: OrderIntent = {
    ...intentData,
    userId,
    intentId: `ord_intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    status: 'PENDING',
    createdAt: Date.now()
  };

  orderIntents.set(intent.intentId, intent);

  logAuditEvent({
    actor: userId,
    action: 'CREATE_ORDER_INTENT',
    target: intent.intentId,
    requestId: intent.nonce,
    payloadHash: String(intent.size + intent.leverage), 
    timestamp: Date.now()
  });

  return intent;
}

export function executeOrderIntent(intentId: string, executedPrice: number): PaperTrade {
  const intent = orderIntents.get(intentId);
  if (!intent) {
    throw new Error('INTENT_NOT_FOUND: Intent does not exist');
  }

  if (intent.status !== 'PENDING') {
    throw new Error(`INVALID_STATE: Cannot execute intent in status: ${intent.status}`);
  }

  intent.status = 'EXECUTED';
  
  const trade: PaperTrade = {
    id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
    status: 'open'
  };

  logAuditEvent({
    actor: intent.userId,
    action: 'EXECUTE_ORDER_INTENT',
    target: intent.intentId,
    requestId: intent.nonce + '_exec',
    payloadHash: String(trade.price),
    timestamp: Date.now()
  });

  return trade;
}
