import fs from 'fs';
import path from 'path';

// Declined-opportunity accounting: makes NO-trades a first-class evidence
// stream so the edge report can show restraint, not just activity. The factory
// makes ~4,000 decisions/day and most are (correctly) no-trades — per-event
// rows would bloat the flat-file db, so we keep AGGREGATE DAILY COUNTERS in a
// small side file: { "<date>|<source>|<family>|<reason>": count }.
//
// Honest semantics: these counts are evidence of PROCESS DISCIPLINE (the
// system declining when conditions aren't met), never evidence of edge.

const FILE = path.join(process.cwd(), 'data', 'edgeops', 'declined-daily.json');
const KEEP_DAYS = 90;

// Closed vocabulary — extend the enum, never free-text.
export type DeclineReason =
  | 'NO_SIGNAL'          // strategy evaluated conditions and chose not to trade
  | 'BALANCE_FLOOR'      // paper balance below the autotrader floor
  | 'NO_PRICE'           // no live price for the symbol
  | 'EXECUTION_REJECTED' // placePaperTrade refused (validation/risk)
  | 'CANONICAL_MISMATCH' // live-action guard blocked a wrong-wallet action
  | 'TRIGGER_NOT_MET'    // a card's trigger check returned NO-GO
  | 'INSUFFICIENT_HISTORY' // strategy needs more recorded history than exists (never fake a lookback)
  | 'POSITION_CAP'         // open position already at max notional — no pyramiding past the cap
  // Scanner declines (opportunity-screener-v1) — why an asset did NOT become a candidate:
  | 'STALE_DATA'           // snapshot older than freshness budget
  | 'LIQUIDITY_FLOOR'      // 24h volume below the pool's liquidity floor
  | 'NOT_IN_UNIVERSE'      // asset not in the tier the card operates on
  | 'NO_FUNDING_DATA'      // funding/basis pool but no funding captured for this symbol
  | 'VENUE_UNSUPPORTED';   // no supported execution venue for this instrument

export function recordDeclined(source: string, family: string, reason: DeclineReason) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    let data: Record<string, number> = {};
    try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* fresh file */ }

    const date = new Date().toISOString().slice(0, 10);
    const key = `${date}|${source}|${family}|${reason}`;
    data[key] = (data[key] || 0) + 1;

    // Bound the file: drop entries older than KEEP_DAYS.
    const cutoff = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const k of Object.keys(data)) if (k.slice(0, 10) < cutoff) delete data[k];

    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {
    // Accounting must never break trading — a lost counter is acceptable.
  }
}
