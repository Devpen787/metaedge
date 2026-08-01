/**
 * Risk Engine Hooks for Pre-Trade Verification
 */
import type { OrderIntent } from './intents';

export interface RiskCheckContext {
  userId: string;
  availableBalance: number;
  currentPrice: number;
  positionEffect: 'increase' | 'reduce';
  availablePositionSize: number;
}

export function evaluateOrderRisk(intent: OrderIntent, context: RiskCheckContext): boolean {
  // 1. Basic Size & Price bounds
  if (intent.size <= 0) {
    throw new Error('RISK_REJECT: Order size must be greater than zero.');
  }

  // 2. Position-effect-aware balance constraints. A valid reduce-only action
  // must never be blocked for lacking the entry margin it is releasing.
  const notionalValue = intent.size * context.currentPrice;
  const requiredMargin = intent.tradeType === 'perp' ? notionalValue / intent.leverage : notionalValue;

  if (context.positionEffect === 'reduce') {
    if (!(context.availablePositionSize > 0) || intent.size > context.availablePositionSize + 1e-9) {
      throw new Error(
        `RISK_REJECT: Reduce-only size exceeds position. Requested: ${intent.size}, Available: ${context.availablePositionSize}`,
      );
    }
  } else if (requiredMargin > context.availableBalance) {
    throw new Error(`RISK_REJECT: Insufficient balance. Required: $${requiredMargin.toFixed(2)}, Available: $${context.availableBalance.toFixed(2)}`);
  }

  // 3. Leverage limits
  if (intent.tradeType === 'perp' && (intent.leverage < 1 || intent.leverage > 100)) {
    throw new Error(`RISK_REJECT: Invalid leverage: ${intent.leverage}x`);
  }

  return true;
}
