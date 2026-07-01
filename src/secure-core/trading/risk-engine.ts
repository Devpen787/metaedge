/**
 * Risk Engine Hooks for Pre-Trade Verification
 */
import { OrderIntent } from './intents';
import { logAuditEvent } from '../audit/logger';

export interface RiskCheckContext {
  userId: string;
  availableBalance: number;
  currentPrice: number;
}

export function evaluateOrderRisk(intent: OrderIntent, context: RiskCheckContext): boolean {
  // 1. Basic Size & Price bounds
  if (intent.size <= 0) {
    logAuditEvent({ actor: context.userId, action: 'RISK_REJECT_SIZE', target: intent.intentId, requestId: intent.nonce, payloadHash: '', timestamp: Date.now() });
    throw new Error('RISK_REJECT: Order size must be greater than zero.');
  }

  // 2. Margin & Balance Constraints
  const notionalValue = intent.size * context.currentPrice;
  const requiredMargin = intent.tradeType === 'perp' ? notionalValue / intent.leverage : notionalValue;

  if (requiredMargin > context.availableBalance) {
    logAuditEvent({ actor: context.userId, action: 'RISK_REJECT_INSUFFICIENT_FUNDS', target: intent.intentId, requestId: intent.nonce, payloadHash: '', timestamp: Date.now() });
    throw new Error(`RISK_REJECT: Insufficient balance. Required: $${requiredMargin.toFixed(2)}, Available: $${context.availableBalance.toFixed(2)}`);
  }

  // 3. Leverage limits
  if (intent.tradeType === 'perp' && (intent.leverage < 1 || intent.leverage > 100)) {
     logAuditEvent({ actor: context.userId, action: 'RISK_REJECT_LEVERAGE', target: intent.intentId, requestId: intent.nonce, payloadHash: '', timestamp: Date.now() });
     throw new Error(`RISK_REJECT: Invalid leverage: ${intent.leverage}x`);
  }

  return true;
}
