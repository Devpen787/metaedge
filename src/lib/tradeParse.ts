import { safeJson } from './api';
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
// `source`/`rawText` build an EdgeOps thesis carrying the user's own words.
// Honesty note: we do NOT fabricate an invalidation — user-directed trades
// without a stated exit condition are correctly tagged thesis_missing and
// excluded from edge stats. Context is preserved; confidence is not invented.
export async function executeTrade(
  action: TradeAction,
  source: 'copilot' | 'intent' = 'copilot',
  rawText?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/copilot/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...action,
        thesis: {
          signalFamily: source,
          setup: rawText ? `user request: ${rawText.slice(0, 300)}` : `user-directed ${source} trade`,
          trigger: `parsed intent: ${action.side} ${action.usd ? `$${action.usd}` : action.size} ${action.assetSymbol}`,
        },
      }),
    });
    const data = await safeJson(res);
    if (!res.ok) return { ok: false, message: data.error || 'Trade failed.' };
    if (data.pending && data.intent?.intentId) {
      return {
        ok: true,
        message: `Paper order accepted: ${action.side.toUpperCase()} ${action.assetSymbol}. Waiting for the next fresh market observation; no fill or balance change has been claimed yet.`,
      };
    }
    // Display the LEDGER fill price (cost-adjusted), never pre-cost spot.
    // If the server sends neither field, Number(undefined) is NaN and the user is
    // told they filled at "$NaN". Report the gap rather than render nonsense.
    const rawFillPx = data.trade?.price ?? data.price;
    if (rawFillPx == null || !Number.isFinite(Number(rawFillPx))) {
      return { ok: false, message: 'Trade executed, but the server returned no fill price. Check your positions before retrying.' };
    }
    const fillPx = Number(rawFillPx);
    const pnl = typeof data.trade?.pnl === 'number' ? ` · realized ${data.trade.pnl >= 0 ? '+' : ''}$${data.trade.pnl.toFixed(2)}` : '';
    return { ok: true, message: `Filled: ${action.side.toUpperCase()} ${data.trade.size} ${data.symbol} @ $${fillPx.toLocaleString()}${pnl} (incl. paper costs). Counts toward your Agent Arena standing.` };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Network error.' };
  }
}
