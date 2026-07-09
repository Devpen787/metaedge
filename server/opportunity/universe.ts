import fs from 'fs';
import path from 'path';
import { serverPrices } from '../prices.js';
import { fetchResearchUniverse, SCANNER_DIR, type FeedRow } from './feed.js';
import type { Tier, UniverseMember } from './types.js';

export { SCANNER_DIR };

// UniverseProvider. Membership is a DATA DECISION recorded over time, never a
// convenience edit (docs/universe_policy.md).
//
//   Tier 0 = the PRODUCT CATALOG (server/prices.ts). Kept only as the BASELINE
//            the scanner must beat. It is not a trading decision — it is the
//            list of coins the website happens to display.
//   Tier 1 = criterion-selected research universe, decoupled from the catalog.
//
// Resolving a universe yields both the membership record AND the price rows, so
// downstream snapshots never reach back into the product catalog.

export interface ResolvedUniverse {
  members: UniverseMember[];
  rows: FeedRow[];
}

function catalogRow(symbol: string): FeedRow {
  const p = serverPrices[symbol];
  return {
    symbol,
    price: p.price,
    change24h: p.change24h,
    volume24h: p.volume24h,
    high24h: p.high24h,
    low24h: p.low24h,
    marketCap: p.marketCap,
  };
}

export async function resolveUniverse(tier: Tier): Promise<ResolvedUniverse> {
  if (tier === 0) {
    const rows = Object.keys(serverPrices).map(catalogRow);
    return {
      rows,
      members: rows.map((r) => ({
        symbol: r.symbol, tier: 0 as Tier, included: true,
        reason: 'product catalog (baseline, not criterion-selected)',
      })),
    };
  }

  if (tier === 1) {
    const feed = await fetchResearchUniverse();
    // Feed unavailable → EMPTY, never a silent fallback to the product catalog.
    if (!feed) return { members: [], rows: [] };

    const members: UniverseMember[] = [
      ...feed.included.map((r) => ({
        symbol: r.symbol, tier: 1 as Tier, included: true,
        reason: 'passed criterion (volume rank, feed complete, non-stable, non-wash)',
      })),
      // Exclusions are EVIDENCE — recorded with reasons, never silently dropped.
      ...feed.excluded.map((e) => ({
        symbol: e.symbol, tier: 1 as Tier, included: false, reason: e.reason,
      })),
    ];
    return { members, rows: feed.included };
  }

  // Tiers 2-3 are DEFINED in universe_policy.md but UNPOPULATED: Tier 2 needs
  // per-coin funding capture that does not exist yet. Returning [] is honest;
  // a stub list would recreate the convenience-universe failure.
  return { members: [], rows: [] };
}

export function writeMembershipSnapshot(members: UniverseMember[]) {
  try {
    fs.mkdirSync(SCANNER_DIR, { recursive: true });
    const t = Date.now();
    const file = path.join(SCANNER_DIR, `universe-${new Date().toISOString().slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, members.map((m) => JSON.stringify({ t, ...m })).join('\n') + '\n');
  } catch { /* recording never breaks anything */ }
}
