import { PaperTrade, TradeLifecycleStatus } from '../../types';
import { logAuditEvent } from '../audit/logger';

export function transitionTradeState(
  trade: PaperTrade, 
  newState: TradeLifecycleStatus, 
  userId: string,
  currentPrice?: number
): PaperTrade {
  // Validate transitions
  const validTransitions: Record<TradeLifecycleStatus, TradeLifecycleStatus[]> = {
    'OPEN': ['CLOSED', 'LIQUIDATED'],
    'CLOSED': ['SETTLED'],
    'LIQUIDATED': ['SETTLED'],
    'SETTLED': []
  };

  if (!validTransitions[trade.status].includes(newState)) {
    throw new Error(`INVALID_TRANSITION: Cannot transition trade from ${trade.status} to ${newState}`);
  }

  // Calculate PnL if closing
  if ((newState === 'CLOSED' || newState === 'LIQUIDATED') && currentPrice !== undefined) {
    const isLong = trade.side === 'buy' || trade.side === 'long';
    const priceDiff = isLong ? currentPrice - trade.price : trade.price - currentPrice;
    
    // For spot, leverage is 1. For perp, PnL is scaled by leverage and size
    const pnl = priceDiff * trade.size * trade.leverage;
    trade.pnl = pnl;
    trade.closedAt = Date.now();
  }

  trade.status = newState;
  
  logAuditEvent({
    actor: userId,
    action: `TRADE_TRANSITION_${newState}`,
    target: trade.id,
    requestId: `trans_${trade.id}_${Date.now()}`,
    payloadHash: String(trade.pnl || 0),
    timestamp: Date.now()
  });

  return trade;
}
