# Canonical Domain Model

Status: **Draft for human approval — product/domain authority candidate**

## Purpose

Translate the approved MetaEdge journeys into durable domain concepts before implementation begins.

The model preserves these laws: observation is not authority; signal is not order; multiple components may propose while one portfolio authority resolves exposure; risk constrains rather than invents the thesis; paper and real share strategy/evidence logic but not mutable execution authority; external unknowns reconcile before equivalent retry; important outcomes preserve source, evidence, strategy, policy and mode lineage.

## Domain boundaries

### Identity

`User` is the application identity. `WalletConnection` is a separately linked external account identity; app login or email never proves wallet identity.

### Observation and sources

`MarketObservation` is an immutable market fact with provider, venue, instrument, observed/received time, provenance and freshness.

`CopySource` represents a wallet, trader, strategy, agent, portfolio, cohort or signal provider.

`SourceObservation` records what MetaEdge actually observed a source do. `SourceIdentityLink` optionally connects identities/wallets with verification metadata. `SourceCompletenessAssessment` records hidden-exposure and coverage limitations.

### Evidence and interpretation

`EvidenceItem` points to observations and states a supported claim, family, direction, strength, freshness, reliability and limitations.

`EvidenceProfile` is a structured collection of EvidenceItems plus contradictions, unknowns, regime and invalidators. It has no universal scalar confidence field.

`Opportunity` is a time-bounded reason to investigate or consider exposure; it may end without a trade.

### Strategy and copy logic

`StrategyDefinition` is stable identity/purpose. `StrategyVersion` is immutable rules, horizon, allowed evidence and desired-exposure logic.

`CopyPolicy` is follower-specific transformation policy for a source. `CopyRelationship` binds user, source and mode: watch, follow, shadow, paper_copy, and future real-copy authority as a separate transition.

### Decision layer

`View` is one producer's desired directional exposure plus evidence, horizon, expiry and invalidators. It never places an order.

`ViewContribution` is the normalized contribution of a View to one portfolio target.

`PortfolioTarget` is canonical desired aggregate exposure for a portfolio/instrument and preserves all contributing lineage.

`RiskDecision` evaluates the target/delta as allow, clip, block or reduce and records the resulting permitted target.

`OpportunityDecision` records act, shadow, hold or zero-target choices and counterfactual eligibility.

### Portfolio and positions

`PaperPortfolio` owns paper capital and account-level policy. `AllocationSleeve` bounds a producer/family budget. `RiskPolicy` owns account-level exposure, leverage, concentration, loss, liquidity and allowed-market constraints.

`Position` is derived canonical exposure from reconciled fills/events. `PositionSnapshot` is an immutable point-in-time exposure/PnL/attribution view.

### Paper execution

`PaperOrderIntent` is paper-only, idempotent, lineage-preserving intent generated from permitted target delta. It can never be converted into a real intent.

`PaperOrderEvent` is append-only lifecycle history. `PaperFill` is simulated execution evidence with fees/spread/slippage/latency/liquidity assumptions. `PaperReconciliation` establishes canonical paper execution truth after restart/ambiguity.

### Agent operation

`AgentDefinition` defines role. `AgentSession` is one durable run. `AgentEnvelope` is the human-approved paper authority for that session. `AgentDecisionRecord` stores evidence/view/action summaries without requiring private chain-of-thought. `AgentLesson` is versioned learning and cannot silently change authority.

### Review and reputation

`OutcomeAttribution` decomposes outcomes across thesis, source, sizing, regime, execution, cost and timing.

`MissedOpportunityRecord` tracks eligible zero-exposure decisions counterfactually.

`SourcePerformanceWindow` and `SourceReputationProfile` provide multidimensional source quality/copyability evidence rather than a universal score.

### Future real boundary

`ExecutionGrant` represents explicit, bounded, revocable authority. `RealTradeIntent` is fresh real-only intent. `RealExecutionPlan` describes ordered external steps. `ExecutionOperation` tracks one submitted external step. `ReconciliationRecord` resolves pending/partial/unknown external outcomes.

## Authority graph

```text
Observations / Sources
        ↓
   EvidenceProfile
        ↓
       View(s)
        ↓
 Portfolio Aggregation
        ↓
  PortfolioTarget
        ↓
   RiskDecision
        ↓
 permitted target delta
        ↓
 Paper intent OR future real-only intent
        ↓
 execution + reconciliation
        ↓
 Position / Outcome Attribution
```

## Global invariants

1. Every mutable financial state transition has one canonical owner.
2. Every important result has immutable lineage back to target, View, producer/version and evidence.
3. No agent, strategy, source or plugin writes portfolio/execution state directly.
4. Paper identifiers never grant real authority.
5. A wallet/provider adapter may further restrict MetaEdge authority but never expand it.
6. External uncertainty remains explicit until reconciled.
7. Historical observations are append-only; later interpretation can supersede conclusions but not rewrite observed facts.