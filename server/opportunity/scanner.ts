import fs from 'fs';
import path from 'path';
import { resolveUniverse, writeMembershipSnapshot, SCANNER_DIR } from './universe.js';
import { buildMarketSnapshot, readLatestFunding } from './snapshot.js';
import { scoreEnergyLiquidity, scoreFundingBasis } from './scorer.js';
import { recordDeclined, type DeclineReason } from '../declined.js';
import type { ScanRecord, ScanSummary, MarketSnapshot, Tier } from './types.js';

// TriggerEngine + DeclineLogger.
//
// READ-ONLY BY DESIGN. This module never places an order, touches a wallet, or
// mutates a strategy. A candidate is a *record*, not a trade. Promoting scanner
// output into an execution path requires re-signing opportunity-screener-v1 with
// forward-paper evidence (see the card's sign-off scope).
//
// An asset that fails a gate DECLINES with a reason — it never silently drops.
// That is what makes "we did not trade, and here is why" auditable.

const LIQUIDITY_FLOOR_USD = 50_000_000; // 24h volume floor for candidacy
const STALE_BUDGET_S = 300;             // snapshot freshness budget

const SCANNER_REASONS: DeclineReason[] = [
  'STALE_DATA', 'LIQUIDITY_FLOOR', 'NOT_IN_UNIVERSE', 'NO_FUNDING_DATA',
  'VENUE_UNSUPPORTED', 'INSUFFICIENT_HISTORY',
];

function isScannerReason(x: string): x is DeclineReason {
  return (SCANNER_REASONS as string[]).includes(x);
}

function applyGates(rec: ScanRecord, snap: MarketSnapshot | undefined): ScanRecord {
  if (rec.decision === 'decline') return rec; // already declined upstream

  const blocked: string[] = [];
  if (!snap) blocked.push('STALE_DATA');
  else {
    if (snap.dataAgeS > STALE_BUDGET_S) blocked.push('STALE_DATA');
    if (snap.volume24h < LIQUIDITY_FLOOR_USD) blocked.push('LIQUIDITY_FLOOR');
  }

  if (blocked.length) {
    rec.decision = 'decline';
    rec.reason = blocked[0];
    rec.blockedBy = blocked;
  }
  return rec;
}

function writeScanRecords(records: ScanRecord[]) {
  try {
    fs.mkdirSync(SCANNER_DIR, { recursive: true });
    const file = path.join(SCANNER_DIR, `scan-${new Date().toISOString().slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  } catch { /* recording never breaks anything */ }
}

export async function runScan(tier: Tier = 1): Promise<ScanSummary> {
  const t = Date.now();

  const { members, rows } = await resolveUniverse(tier);
  writeMembershipSnapshot(members);

  const snaps = new Map<string, MarketSnapshot>();
  for (const row of rows) {
    const s = buildMarketSnapshot(row);
    if (s) snaps.set(s.symbol, s);
  }

  const marketList = [...snaps.values()];
  const funds = rows.map((r) => readLatestFunding(r.symbol));

  const records = [
    ...scoreEnergyLiquidity(marketList),
    ...scoreFundingBasis(funds),
  ].map((r) => applyGates(r, snaps.get(r.symbol)));

  writeScanRecords(records);

  const candidatesByPool: Record<string, number> = {};
  const declinesByReason: Record<string, number> = {};
  for (const r of records) {
    if (r.decision === 'candidate') {
      candidatesByPool[r.pool] = (candidatesByPool[r.pool] || 0) + 1;
    } else {
      declinesByReason[r.reason] = (declinesByReason[r.reason] || 0) + 1;
      // Reuse the existing discipline-counter stream rather than a parallel store.
      if (isScannerReason(r.reason)) recordDeclined('scanner', r.pool, r.reason);
    }
  }

  return { t, scanned: rows.length, candidatesByPool, declinesByReason };
}
