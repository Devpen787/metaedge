// THE KILL RULE — single source of truth.
//
// docs/backtest_validation_rules.md asserted "n >= 30, PF >= 1.1, or kill" from the
// day it was written and enforced nothing. `grid` ran to 542 trades at -$0.48 each
// and `custom_ai` to 268 at -$0.76 (~$464 of paper losses) past a rule we had
// already written down. A human caught it in a screenshot.
//
// This module is the rule. Two consumers import it and neither re-implements it:
//   scripts/kill_check.mjs  -- read-only CLI report, exits 1 on violation
//   server/killguard.ts     -- in-process guard that can DISABLE a bleeding agent
//
// Plain .mjs so the TS server (allowJs) and the .mjs scripts share one implementation.
// Duplicating this rule would repeat the exact failure it exists to prevent.

// The survivor bar. Changing these is a research decision that belongs on a card.
export const MIN_N = 30;              // below this: observe, never believe
export const MIN_PROFIT_FACTOR = 1.1;

/**
 * The entire kill rule, as one pure function.
 * @param {{family:string, n:number, grossWin:number, grossLoss:number, netPnl:number}} s
 * @returns {{family:string, n:number, grossWin:number, grossLoss:number, netPnl:number,
 *           verdict:'KILL'|'HOLD'|'INSUFFICIENT_SAMPLE', reason:string,
 *           profitFactor:number|null, avgPnl:number}}
 */
export function evaluateKill(s) {
  const profitFactor = s.grossLoss > 0 ? s.grossWin / s.grossLoss : (s.grossWin > 0 ? null : 0);
  const avgPnl = s.n > 0 ? s.netPnl / s.n : 0;

  if (s.n < MIN_N) {
    return { ...s, verdict: 'INSUFFICIENT_SAMPLE', reason: `n=${s.n} < ${MIN_N}: observation only, no verdict`, profitFactor, avgPnl };
  }
  if (avgPnl < 0) {
    return { ...s, verdict: 'KILL', reason: `n=${s.n} >= ${MIN_N} and average PnL is negative ($${avgPnl.toFixed(2)}/trade)`, profitFactor, avgPnl };
  }
  if (profitFactor !== null && profitFactor < MIN_PROFIT_FACTOR) {
    return { ...s, verdict: 'KILL', reason: `n=${s.n} >= ${MIN_N} and PF ${profitFactor.toFixed(2)} < ${MIN_PROFIT_FACTOR}`, profitFactor, avgPnl };
  }
  return { ...s, verdict: 'HOLD', reason: 'clears the survivor bar (NOT proof of edge)', profitFactor, avgPnl };
}

/**
 * Aggregate CLOSED paper trades (those carrying a realized pnl) by strategy family.
 * Open positions carry no verdict and are excluded.
 * @param {{trades?: any[], agents?: Record<string, any>}} db
 */
export function aggregateClosedTradesByFamily(db) {
  const byFamily = new Map();
  for (const t of db.trades ?? []) {
    if (typeof t.pnl !== 'number') continue;
    const family = db.agents?.[t.agentId]?.strategyType ?? 'unknown';
    const s = byFamily.get(family) ?? { family, n: 0, grossWin: 0, grossLoss: 0, netPnl: 0 };
    s.n += 1;
    s.netPnl += t.pnl;
    if (t.pnl >= 0) s.grossWin += t.pnl; else s.grossLoss += Math.abs(t.pnl);
    byFamily.set(family, s);
  }
  return [...byFamily.values()];
}
