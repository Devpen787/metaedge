# Opportunity Scanner Architecture

Implements `docs/edgeops/cards/opportunity-screener-v1.md`. Read-only, no
execution. Converts MetaEdge from fixed-watchlist/agent-pinned to criteria-driven
candidate selection. Scope this version: the **minimal five** components are
ACTIVE; four are DEFERRED (named so the design is whole, but NOT built until a
scored candidate actually needs routing — building them now would be the
"infrastructure outruns research" anti-pattern).

## Component contracts

| # | Component | State | Input | Output | Storage | Cadence | Failure mode | Safety rule |
|---|---|---|---|---|---|---|---|---|
| 1 | **UniverseProvider** | ACTIVE | universe_policy tiers | eligible symbols + tier tag | universe_membership_snapshot | daily | includes an illiquid/unsupported asset | only Tier 0 populated; wider tiers return [] until capture lands |
| 2 | **MarketSnapshotStore** | ACTIVE | serverPrices + recorder | per-symbol market+energy snapshot | data/edgeops/scanner/*.jsonl | per scan | stale/missing datum treated as fresh | omit + decline (STALE_DATA), never fabricate |
| 3 | **FundingSnapshotStore** | ACTIVE | recorder funding files | funding/basis snapshot | funding_scanner_snapshot | hourly | fraction/percent unit mix | annualize before any % compare; ETH/BTC/SOL live only |
| 4 | **OpportunityScorer** | ACTIVE | snapshots | per-pool scores (normalized) | in scanner snapshot | per scan | summing mixed units | every term percentile/z-normalized before sum; per pool, never one blended score |
| 5 | **TriggerEngine** | ACTIVE | scores + gates | candidate/decline records | opportunity_scanner_snapshot | per scan | routes into stale/illiquid tape | hard gates (fresh/liquid/supported); nothing becomes a trade |
| 6 | **DeclineLogger** | ACTIVE | trigger declines | decline counters | declined.ts (reused) | per scan + daily | mislabels missing-data as no-trade | reason must reflect true cause |
| 7 | CandidateQueue | DEFERRED | candidates | ordered queue | — | — | — | not built until an edge consumes candidates |
| 8 | AgentAllocator | DEFERRED | queue + risk budget | agent→asset assignment | — | — | pins capital to noise | not built until forward-paper survivor needs routing |
| 9 | Report/API integration | PARTIAL | snapshots | daily-report section / JSON | — | daily | dashboard outruns research | read-only view; no controls |

## The scorer's hard rule (from the units-bug lesson)
A pool score is `sum(normalized_term_i)` where each term is a percentile [0,1] or
z-score computed ACROSS THE CURRENT SCAN BATCH. Raw terms (funding_apr in %, ATR
in %, volume in USD) are recorded alongside but NEVER summed directly. This is
enforced structurally in `scorer.ts` (it accepts only normalized terms).

## What this architecture is NOT
Not an execution path. No candidate auto-becomes a trade. No live wallet. No
strategy mutation. The scanner's only job is to make "which assets qualify, and
why every other one declined" auditable and machine-readable, so a carded edge
can later be routed by eligibility instead of being welded to a symbol.

## Falsification (inherits the card)
The scanner earns its place only if routing a carded edge (funding-basis B first)
by scanned eligibility beats the fixed-universe always-on baseline AND a
random-mask control on post-cost forward expectancy. Until then it is an
observation tool, not a trading component.
