import fs from 'fs';
import path from 'path';
import { registerResearchObservation, serverPrices } from '../prices.js';
import { fetchResearchUniverse, readCachedResearchUniverse, SCANNER_DIR, type FeedRow } from './feed.js';
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
  observedAt: number;
  stale: boolean;
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

export async function resolveUniverse(tier: Tier, options: { allowStaleForDeclines?: boolean } = {}): Promise<ResolvedUniverse> {
  if (tier === 0) {
    const rows = Object.keys(serverPrices).map(catalogRow);
    return {
      rows,
      observedAt: Date.now(),
      stale: false,
      members: rows.map((r) => ({
        symbol: r.symbol, tier: 0 as Tier, included: true,
        reason: 'product catalog (baseline, not criterion-selected)',
      })),
    };
  }

  if (tier === 1) {
    const feed = await fetchResearchUniverse() || (options.allowStaleForDeclines ? readCachedResearchUniverse() : null);
    // Feed unavailable → EMPTY, never a silent fallback to the product catalog.
    if (!feed) return { members: [], rows: [], observedAt: 0, stale: false };

    // The exact values used to select Tier 1 are also registered as immutable
    // provenance-bearing observations. Decision features can therefore cite
    // the same source row that admitted the symbol, rather than a product
    // catalog value or uncited long-tail fallback.
    for (const row of feed.included) registerResearchObservation(row, feed.t);

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
    return { members, rows: feed.included, observedAt: feed.t, stale: feed.stale === true };
  }

  // Tiers 2-3 remain separate policy surfaces. Wide funding capture now exists,
  // but membership still needs its own criterion evaluator; capture breadth is
  // evidence availability, not automatic universe membership.
  return { members: [], rows: [], observedAt: 0, stale: false };
}

export function writeMembershipSnapshot(members: UniverseMember[]) {
  try {
    fs.mkdirSync(SCANNER_DIR, { recursive: true });
    const t = Date.now();
    const file = path.join(SCANNER_DIR, `universe-${new Date().toISOString().slice(0, 10)}.jsonl`);
    fs.appendFileSync(file, members.map((m) => JSON.stringify({ t, ...m })).join('\n') + '\n');
  } catch { /* recording never breaks anything */ }
}
