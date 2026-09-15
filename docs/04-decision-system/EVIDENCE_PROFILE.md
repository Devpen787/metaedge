# Evidence Profile Contract

Status: **Draft for human approval**

## Why this exists

MetaEdge previously over-relied on quantified confidence and gating. Evidence could fail to become "good enough" while the market moved materially and the system remained flat.

The replacement is an `EvidenceProfile`: a structured description of what is known, conflicting, missing and changing. It informs participation and sizing without becoming a single permission score.

## Non-goal

Do not recreate:

```text
confidence = 0.73
trade if confidence >= 0.75
```

under another name.

## Candidate shape

```text
EvidenceProfile
  profile_id
  subject
  as_of
  horizon
  regime
  directional_state   # bullish | bearish | mixed | neutral | unknown
  urgency             # immediate | developing | normal | slow
  families[]
  contradictions[]
  unknowns[]
  invalidators[]
  freshness_state
  coverage_state
  provenance_refs[]
```

The profile describes evidence. It does not authorize an order and does not own position sizing.

## Canonical evidence families

1. **Price / market structure** — velocity, acceleration, trend, breakout/breakdown, volatility, relative strength.
2. **Volume / liquidity / order flow** — volume acceleration, spread/depth, aggressive flow, liquidity withdrawal, capacity and venue divergence.
3. **Derivatives / positioning** — open interest, funding, basis, liquidations, leverage/crowding.
4. **Wallet / on-chain flows** — accumulation/distribution, exchange flows, source-wallet actions, cohort behavior, concentration.
5. **Behavioral / attention** — panic, capitulation, FOMO, euphoria, attention velocity, narrative saturation, retail-vs-sophisticated divergence.
6. **Catalyst / fundamental / event** — protocol/company/news/macro/regulatory/listing/unlock/governance events.
7. **Cross-market / macro** — beta, sector/peer movement, rates/USD/liquidity relationships, correlated confirmation.
8. **Source behavior** — wallet/trader/strategy actions and prior behavior in comparable regimes.
9. **Execution conditions** — spread, liquidity, expected slippage, latency, fees and venue health.

Execution conditions can make a thesis temporarily non-actionable even when the thesis itself remains valid.

## EvidenceItem

```text
EvidenceItem
  item_id
  family
  observation_refs[]
  claim
  direction        # supports_long | supports_short | neutral | conflicting
  strength         # weak | moderate | strong
  reliability      # low | medium | high | unknown
  freshness        # fresh | aging | stale
  coverage         # complete | partial | sparse | unknown
  observed_vs_inferred
  limitations[]
```

Strength, reliability, freshness and coverage remain separate dimensions. Do not multiply them into a hidden master score by default.

## Contradictions are first-class

Example:

```text
Supports continuation:
- price acceleration: strong
- spot volume: strong
- wallet accumulation: moderate

Contradicts continuation:
- funding crowding: strong
- order-book depth: deteriorating

Unknown:
- catalyst durability
- source may hedge elsewhere
```

The correct response is not automatically "no trade." A strategy may map this to shadow, scout, reduced target, hold, or exit depending on its rules and portfolio context.

## Observed / inferred / unknown

**OBSERVED** — directly supported by provider/source data.

**INFERRED** — interpretation of observed facts.

**UNKNOWN** — relevant information MetaEdge cannot establish.

Example:

```text
OBSERVED: Wallet A increased visible ETH perp exposure.
INFERRED: Wallet A is expressing a bullish directional thesis.
UNKNOWN: Wallet A may hold offsetting exposure elsewhere.
```

This distinction is mandatory for wallet/trader intelligence.

## Evidence evolves

Profiles are time series, not static reports.

```text
10:00 developing breakout
10:05 price acceleration + volume expansion
10:12 wallet inflows appear
10:20 funding begins crowding
10:35 source distribution appears
```

A View may revise desired exposure after any material profile change.

## Participation is downstream

EvidenceProfile does not output `trade=true/false`.

A producer/strategy consumes it and emits a View such as:

```text
ETH
horizon: intraday
thesis: continuation
requested target: +0.25R scout
invalidator: breakout failure + buyer absorption loss
expiry: 30m
```

Portfolio and risk determine the permitted aggregate exposure.

## Fast path

A fast-moving opportunity may use an intentionally incomplete profile when critical observations are fresh, no hard integrity/safety blocker exists, the strategy explicitly supports exploratory participation, and exposure stays inside exploration policy.

The system records what evidence was missing at entry and whether it arrived later.

## Hard blocker separation

Hard blockers live outside evidence quality, for example stale/invalid critical market data, unavailable instrument/venue, exhausted portfolio risk, invalid quantity/price, unresolved equivalent execution, or explicit user-policy prohibition.

Weak, mixed or incomplete thesis evidence is not automatically a hard blocker.

## Review metrics

Later outcome review should ask which evidence families were useful in the regime, which contradictions mattered, whether the scout arrived too early/late, what evidence appeared only after the move, whether missing evidence was actually necessary, and how often one evidence requirement caused profitable opportunities to be missed.

That is how MetaEdge learns whether a condition is useful instead of simply accumulating more conditions forever.