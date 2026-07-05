// Deterministically pull a tradeable paper action out of plain English, so the
// Copilot and Intent Solver can actually place trades — with or without an AI key.

export interface TradeAction {
  assetSymbol: string;
  side: 'buy' | 'sell';
  size?: number;
  usd?: number;
}

export const KNOWN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'LINK', 'DOGE', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'WETH', 'WBTC'];

export function parseTrade(text: string): TradeAction | null {
  const t = text.toLowerCase();
  const side: 'buy' | 'sell' | null =
    /\b(buy|long|go long|ape|acquire|stake|deposit)\b/.test(t) ? 'buy' :
    /\b(sell|short|close|dump|exit|withdraw)\b/.test(t) ? 'sell' : null;
  if (!side) return null;
  const sym = KNOWN_SYMBOLS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(text));
  if (!sym) return null;
  const usdMatch = text.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  if (usdMatch) return { assetSymbol: sym, side, usd: Number(usdMatch[1].replace(/,/g, '')) };
  const sizeMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (sizeMatch) return { assetSymbol: sym, side, size: Number(sizeMatch[1]) };
  return { assetSymbol: sym, side, usd: 500 };
}

// Execute a parsed trade as a real paper fill (scores in the Arena).
export async function executeTrade(action: TradeAction): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/copilot/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || 'Trade failed.' };
    const pnl = typeof data.trade?.pnl === 'number' ? ` · realized ${data.trade.pnl >= 0 ? '+' : ''}$${data.trade.pnl.toFixed(2)}` : '';
    return { ok: true, message: `Filled: ${action.side.toUpperCase()} ${data.trade.size} ${data.symbol} @ $${Number(data.price).toLocaleString()}${pnl}. Counts toward your Agent Arena standing.` };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Network error.' };
  }
}
