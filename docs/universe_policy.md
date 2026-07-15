# Universe Policy

Rule: universe membership is a DATA DECISION, not a convenience edit. Assets enter
by explicit criteria (below), and membership is recorded over time
(`universe_membership_snapshot` contract) so we never manufacture survivorship
bias again. A card names which tier it operates on.

Honest state (2026-07-14): Tier 1 is populated from a recorded criterion feed,
and live Hyperliquid funding capture is wide rather than coin-filtered. Tier 2
still needs a criterion evaluator before it is populated; broader capture alone
does not confer membership. Tier 3 remains policy-defined and unpopulated.

## Tier 0 — legacy/convenience (POPULATED)
- Members: BTC, ETH, SOL, LINK, DOGE, BNB, XRP, ADA, AVAX, DOT, MATIC (`server/prices.ts`).
- Inclusion: inherited seed list — NOT criterion-selected. Marked legacy.
- Data: recorder ticks plus wide funding capture. This tier remains the legacy
  catalog baseline, not the research universe authority.
- Allowed strategies: existing carded candidates (DOT mean-rev; ETH/BTC carry).
- Eligibility: paper + operator-live (existing gate stack). It is the BASELINE
  the scanner must beat, not the target.

## Tier 1 — liquid research universe (POPULATED)
- Inclusion: top-N crypto by 24h volume + tradeable/paper-tradeable on our venue.
- Exclusion: illiquid, broken feed, insufficient history, excessive spread.
- Required data: reliable price + volume feed per member (contract before use).
- Cadence: membership re-evaluated daily; snapshot recorded.
- Allowed strategies: any carded edge whose data needs are met for the member.
- Eligibility: research and continuous paper decisions only; real-money live is locked.

## Tier 2 — perp/funding universe (DEFINED, capture available)
- Inclusion: Hyperliquid perp with funding + premium/basis + OI + sufficient
  liquidity. Live `metaAndAssetCtxs` capture now records every well-formed row
  returned by the venue; the remaining blocker is explicit membership criteria.
- Required data: hyperliquid-funding-history + live funding capture per member.
- Allowed strategies: funding/basis (funding-basis-v2 B), funding overlays.
- Eligibility: paper-forward; operator-live-only (two-venue legs exceed user rails).

## Tier 3 — paper-only exploratory (DEFINED, unpopulated)
- Inclusion: wider universe for paper research only.
- Eligibility: PAPER-ONLY, never live, never competition. Explicitly labeled.
- Required data: at minimum a trustworthy price feed; no faked microstructure.

## Excluded universe (always)
Illiquid / low-volume, manipulated or manipulation-adjacent, broken/stale feeds,
insufficient recorded history, excessive spread, unsupported execution, no
reliable data source. Exclusion reasons are logged in declines, not silent.

## Membership recording
Every tier evaluation appends to `universe_membership_snapshot` (symbol, tier,
included bool, reason, timestamp). This is what makes later survivorship claims
auditable instead of assumed.
