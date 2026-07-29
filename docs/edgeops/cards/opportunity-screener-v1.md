# Research Card: opportunity-screener-v1

Status: DRAFT (architecture card — no code until MR/DE sign-off + contracts exist)
Created: 2026-07-09 · Pool: cross-cutting selection layer · Instrument: spot + perp (per taxonomy)
Relationship: this is the PLUMBING (universe → snapshot → rank → route). The
per-asset scoring brain is `regime-selector-v1` (step-6 WHERE/WHEN gate). The
screener CONSUMES the selector across a universe; it must NOT contain a second,
competing scorer.

## Why this card exists / what failure mode it fixes
MetaEdge is fixed-watchlist and agent-pinned: the autotrader loops over agents
(each welded to one of 11 hand-typed tokens) and asks "should THIS agent trade
ITS token?" It never asks "across the eligible universe, which assets currently
meet a card's condition?" That is the "convenience universe + HOW-before-WHERE/WHEN"
failure at the system level. This card builds the missing scan-and-select layer.

## Participant map (Market Researcher)
Claims NO edge of its own — like the selector, it is a gate, and saying so is the
point. It lets an already-carded edge (whose who-pays-us is established) fire only
where that counterparty is actually present and tradable, and stay OFF elsewhere.
Its value is realized only through the edges it routes; it is never traded directly.

## Source of edge
None intrinsic. The screener's justification is instrumental: does routing a
carded edge by scanned eligibility produce higher post-cost forward expectancy
than running that same edge on the fixed 11-token universe? If not, it dies.

## Eligible opportunity pools (scored independently, never blended into one number)
- funding/basis (first use case — funding-basis-v2 variant B)
- liquidity/energy WHERE/WHEN (regime-selector-v1)
- mean-reversion candidates (only if a carded mean-rev edge exists — DOT)
- breakout candidates (BLOCKED — no surviving breakout edge; pool listed, not active)
- options/expiry SIGNAL candidates (signal-only; needs expiry-calendar wiring)
- dislocation candidates (BLOCKED — needs liquidation data per contract)

## What it is explicitly NOT allowed to do
- No trading by a generic/blended score. Each pool scores separately.
- No live execution, no wallet action, no strategy mutation — read-only.
- No ranking by raw momentum/PnL alone.
- No unsupported/illiquid tokens (excluded-universe per universe_policy.md).
- No faked spread, book depth, liquidation, or options history — decline instead.
- No composite score that sums terms of different units (percent + percentile +
  penalty) without per-term normalization declared in its contract.

## Data (Data Engineer)
- Required: universe membership over time, per-symbol market snapshot, funding
  snapshot, energy/liquidity snapshot. Contracts: universe_membership_snapshot,
  opportunity_scanner_snapshot, funding_scanner_snapshot, energy_liquidity_snapshot
  (all in data_requirements_and_contracts.md).
- Available NOW: spot 11 tokens (recorder), funding live ETH/BTC/SOL + historical
  7 coins. So the first scanner runs on ~Tier-0 reality; wider tiers unlock only
  as capture plumbing lands.
- Missing: wider live funding capture, liquidation feed, options history.
- Dangerous to fake: spread, depth, liquidation prices, pre-recorder history.

## WHERE/WHEN selector
Delegated to regime-selector-v1 (this card does not re-implement it).

## Entry / exit concept (HOW)
N/A by design. The screener emits CANDIDATES and DECLINES; a downstream carded
edge owns entry/exit. Filling HOW here would be the failure mode this card fixes.

## Cost model / Risk model
Cost = compute + API calls (CoinGecko markets = 1 call all symbols; HL LIVE funding
`metaAndAssetCtxs` = 1 call all 231 perps; only HISTORICAL `fundingHistory` is
per-coin). Risk = the scanner
overfits eligibility to noise and routes into worse tape; guard = it must beat the
fixed-universe baseline AND a random-eligibility control at equal trade frequency.

## Benchmark & null/control
Null = the carded edge on the fixed 11-token universe, always-on. Control =
random eligibility mask at equal frequency. Screener must beat both, OOS/forward.

## Falsifier (pre-committed)
On its first routed edge (funding-basis B, then DOT): if scanned selection's
post-cost forward expectancy ≤ fixed-universe baseline, OR ≤ random-mask control
at equal frequency, over the observation window — KILL or revise. "More candidates"
at equal/worse expectancy is a FAIL, not a win.

## Expected trade frequency & failure mode
Emits a ranked candidate list + declines every scan interval; most intervals may
emit zero candidates (no-trade is a valid output). Dies by curve-fitting
eligibility to noise — visible as underperformance vs the always-on null.

## Safety classification (Product Safety Officer)
paper-only, read-only. It changes WHICH trades are considered, so it inherits the
strictest gate of any edge it routes; never competition-eligible on its own; no
candidate auto-becomes a trade.

## Sign-offs (scope: READ-ONLY SKELETON ONLY — routing a live edge requires re-sign with forward-paper evidence)
- MR ✅ — no edge claimed; it is a selection gate whose value is realized only
  through carded edges it routes. Participant map is intentionally "gate, not edge."
- DE ✅ (scoped) — contracts exist for every field the skeleton emits; it runs on
  Tier-0 data we actually capture. Wider tiers BLOCKED on capture (marked, not faked).
- QR ✅ (scoped) — the skeleton only emits snapshots/records; the falsification
  test (beat fixed-universe + random-mask on post-cost forward expectancy) runs
  later when it routes an edge. No overfitting risk in a read-only emitter.
- XR ✅ — read-only, no order path, no wallet, no strategy mutation → no execution
  risk. Its only cost is compute + API calls (bounded; CoinGecko 1 call all symbols).
- PS ✅ — paper-only, read-only, no candidate auto-becomes a trade; inherits the
  strictest gate of any edge it would route; never competition-eligible alone.

These five sign-offs authorize the READ-ONLY SKELETON ONLY. Any change that lets
scanner output influence a live or paper TRADE requires re-sign with the
forward-paper comparison evidence in hand.

## Decision log
2026-07-09: DRAFT created from the advisor review, scope trimmed to the minimal
five components (UniverseProvider · SnapshotStore · Scorer · TriggerEngine ·
DeclineLogger); AgentAllocator/CandidateQueue deferred until a scored candidate
needs routing. Reconciled with regime-selector-v1 (this = plumbing, that = brain).
Next: MR+DE sign-off → universe_policy + scanner contracts (this turn) →
architecture doc + read-only skeleton (next increment) → fixed-vs-scanner report.
