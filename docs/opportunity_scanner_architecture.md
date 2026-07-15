# Opportunity Scanner Architecture

Implements `docs/edgeops/cards/opportunity-screener-v1.md`. Read-only, no
execution. Converts MetaEdge from fixed-watchlist/agent-pinned to criteria-driven
candidate selection. Since 2026-07-14 its output feeds a separate layered
decision runtime. The scanner remains read-only; validated paper routing occurs
only after the downstream data, universe, liquidity, regime, cost, risk, and
portfolio gates pass.

## Component contracts

| # | Component | State | Input | Output | Storage | Cadence | Failure mode | Safety rule |
|---|---|---|---|---|---|---|---|---|
| 1 | **UniverseProvider** | ACTIVE | universe_policy tiers | eligible symbols + tier tag | universe_membership_snapshot | daily | includes an illiquid/unsupported asset | Tier 1 comes only from recorded criterion membership; stale membership declines |
| 2 | **MarketSnapshotStore** | ACTIVE | serverPrices + recorder | per-symbol market+energy snapshot | data/edgeops/scanner/*.jsonl | per scan | stale/missing datum treated as fresh | omit + decline (STALE_DATA), never fabricate |
| 3 | **FundingSnapshotStore** | ACTIVE | recorder funding files | funding/basis snapshot | funding_scanner_snapshot | hourly | fraction/percent unit mix | annualize before any % compare; capture all well-formed venue rows |
| 4 | **OpportunityScorer** | ACTIVE | snapshots | per-pool scores (normalized) | in scanner snapshot | per scan | summing mixed units | every term percentile/z-normalized before sum; per pool, never one blended score |
| 5 | **TriggerEngine** | ACTIVE | scores + gates | candidate/decline records | opportunity_scanner_snapshot | per scan | routes into stale/illiquid tape | hard gates (fresh/liquid/supported); nothing becomes a trade |
| 6 | **DeclineLogger** | ACTIVE | trigger declines | decline counters | declined.ts (reused) | per scan + daily | mislabels missing-data as no-trade | reason must reflect true cause |
| 7 | **CandidateQueue** | ACTIVE | validated layered decisions | queued/routed/expired outcome | canonical JSON DB | every decision cycle | unvalidated signal enters queue | exact frozen strategy hash must have `forward_paper_candidate` status |
| 8 | **PaperRouter** | ACTIVE | queue + opted-in active agent | canonical paper ledger fill | canonical JSON DB | every decision cycle | duplicate or ownerless fill | server-session ownership, risk engine, and decision-id idempotency |
| 9 | **Report/API integration** | ACTIVE | runtime state | read-only JSON | canonical JSON DB | live | dashboard outruns evidence | exposes declines, validation, queue and cycle state; no promotion control |

## The scorer's hard rule (from the units-bug lesson)
A pool score is `sum(normalized_term_i)` where each term is a percentile [0,1] or
z-score computed ACROSS THE CURRENT SCAN BATCH. Raw terms (funding_apr in %, ATR
in %, volume in USD) are recorded alongside but NEVER summed directly. This is
enforced structurally in `scorer.ts` (it accepts only normalized terms).

## What this architecture is NOT
The scanner itself is not an execution path. Its evidence may be consumed by the
layered runtime, where an immutable, separately validated strategy can route to
the paper ledger only. No live wallet, real-money order, or strategy mutation is
authorized by a scanner score.

## Falsification (inherits the card)
The scanner earns its place only if routing a carded edge (funding-basis B first)
by scanned eligibility beats the fixed-universe always-on baseline AND a
random-mask control on post-cost forward expectancy. Until then it is an
observation tool, not a trading component.
