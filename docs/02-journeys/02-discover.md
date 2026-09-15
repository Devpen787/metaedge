# J02 — Discover

Status: **Detailed draft for human review**

## USER JOB

> Show me what deserves attention now — markets, wallets, traders, strategies, agents, portfolios, cohorts, or signals — and tell me why it is interesting without pretending that interesting means safe or profitable.

## PURPOSE

Discovery is the front door to opportunity. It is intentionally broader and faster than full research.

Its job is to surface **candidates for attention**, not to authorize trades.

Discovery must support both:

- **fast-moving opportunities** where price/flow/attention is changing now; and
- **slower sources** whose historical behavior or strategy quality deserves study.

## PRECONDITIONS

- User has an application identity/session.
- At least one discovery data source is available.
- A wallet connection is **not** required.

## AUTHORITATIVE STATE

Candidate domain concepts:

- `DiscoveryCandidate`
- `CopySource`
- `MarketObservation`
- `SourceObservation`
- `EvidenceProfile`
- `DiscoveryReason`
- `DataHealth`

The exact schema is derived later from approved journeys.

## USER-VISIBLE STATES

### Healthy discovery

Candidates are available with:

- source type;
- asset/instrument where relevant;
- what changed;
- observed-at / freshness;
- primary evidence/reason;
- notable contradictions;
- observation limitations;
- next available actions.

### Fast-moving

The system can mark a candidate as requiring timely investigation because of events such as:

- price/volume acceleration;
- abnormal order flow;
- wallet accumulation/distribution;
- liquidation/funding/open-interest change;
- catalyst/news;
- social/attention acceleration;
- cross-market divergence.

`Fast-moving` is an urgency property, **not confidence or permission to trade**.

### Slow-burn / research candidate

Examples:

- wallet with persistent risk-adjusted performance;
- strategy with interesting historical behavior;
- trader/source whose behavior is worth following;
- new mechanism hypothesis.

### Degraded

Some evidence families are unavailable or stale. Candidates remain visible only if the remaining evidence is honestly labeled sufficient for discovery.

### Empty

No candidate currently meets the user's discovery filters or minimum data-quality rules.

## HAPPY PATH

1. User enters Discover.
2. MetaEdge shows candidate categories and a mixed or filtered feed.
3. Each candidate answers **“Why am I seeing this?”** using concrete evidence.
4. User filters/sorts by source type, market, horizon, risk characteristics, freshness, activity, or other approved dimensions.
5. User opens a candidate.
6. MetaEdge creates no exposure and grants no authority.
7. User continues to **J03 Investigate Source**.

## DISCOVERY RANKING LAW

Do not create a hidden universal `confidence > threshold` ranking that becomes trade permission later.

Ranking may use separate dimensions such as:

- urgency;
- freshness;
- data coverage;
- magnitude of change;
- source track-record quality;
- novelty;
- liquidity/executability;
- relevance to user filters.

The UI may summarize those dimensions, but the underlying evidence remains inspectable.

## FAST-PATH LAW

A fast detector is allowed to say:

> “Something meaningful may be happening; investigate now.”

It is not required to prove a complete strategy first.

A candidate can later justify a bounded scout position through J09/J10 if:

- no hard blocker exists;
- portfolio/risk permits it;
- the opportunity/strategy layer proposes non-zero exposure.

## EMPTY STATE

Tell the user whether the emptiness is because:

- no candidates met filters;
- data is unavailable;
- all candidate evidence is stale;
- discovery is intentionally constrained to a smaller universe.

Never manufacture candidates to make the product look busy.

## FAILURE

Examples:

- provider unavailable;
- malformed evidence;
- source identity cannot be resolved;
- clock/freshness ambiguity;
- duplicate candidate generation.

Failure in one discovery adapter should not corrupt unrelated adapters.

## UNKNOWN

Discovery must preserve unknowns such as:

- why a wallet acted;
- whether a wallet represents a whole trader portfolio;
- whether a catalyst is causal;
- whether a move will persist;
- whether a source is hedged elsewhere.

Unknown is displayed, not filled with narrative certainty.

## RETRY

Read retries may refresh failed adapters. Retry must not duplicate candidates or rewrite historical observations.

## PARTIAL

A candidate may have partial evidence. Example:

> price/volume evidence fresh; wallet-flow source unavailable.

Partial evidence changes the evidence profile and visible caveat. It does not silently become complete evidence.

## CANCEL

No financial operation exists to cancel in this journey. The user can clear filters or leave Discover.

## BACK / REFRESH / RESTART

- Back returns to the previous product surface without changing state.
- Refresh gets new observations while preserving the earlier observation lineage.
- Restart reconstructs the feed from durable observations/current providers; it does not depend on browser memory.

## OWNER / AUTHORITY

- Discovery adapters own observation retrieval.
- Discovery service owns candidate creation/ranking.
- No discovery component owns portfolio or execution authority.

## PRIVACY

- Public wallet/source discovery uses public/source-permitted data.
- User watch/follow behavior is private application state unless explicitly shared.
- Do not expose one user's followed sources to another by default.

## RECOVERY

If discovery restarts mid-refresh, previous valid candidates remain attributable to their observation time. Stale state is labeled stale until refreshed.

## NEXT JOURNEY

Primary: **J03 Investigate Source**.

Alternative: user may Follow an already understood source via J04, but the product should make evidence/limitations readily accessible before any exposure journey.