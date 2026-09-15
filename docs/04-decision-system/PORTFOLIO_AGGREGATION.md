# Portfolio Aggregation Contract

Status: **Draft for human approval**

## Purpose

MetaEdge can have many simultaneous proposers: strategies, copied wallets/traders, agent sessions, behavioral loops, market/catalyst loops and manual user views. They may disagree or express the same idea multiple times.

The portfolio layer converts those Views into one canonical account-level target without giving any producer direct order authority.

## V1 recommendation

Start with a **deterministic budgeted-sleeve aggregator**.

Do not begin with majority voting, an opaque optimizer, one LLM deciding the whole portfolio, or raw summation of every requested position.

The initial model should be explainable, testable and easy to replay.

## Inputs

Each active `View` includes producer/version, instrument/basket, signed desired exposure, horizon, expiry, lineage, EvidenceProfile reference, invalidators and allocation sleeve.

Each `AllocationSleeve` defines portfolio, budget, allowed instruments, gross/net contribution caps and producer/source constraints.

## Aggregation stages

### 1. Validate active Views

Remove or mark non-contributing Views that are expired, superseded, based on invalid/stale critical state, outside producer scope, or incompatible with portfolio mode/policy.

This is state validity, not thesis scoring.

### 2. Normalize to sleeve budget

A producer requests exposure relative to its own sleeve, not the whole account.

No strategy/source/agent may assume the entire account is available.

### 3. Detect duplicate lineage

Views that arise from the same underlying event/source should not automatically count as independent confirmation.

Examples include a direct Wallet A copy plus a cohort signal containing Wallet A, two strategies using the same breakout detector, or narrative/social loops using the same event feed.

V1 should use deterministic lineage/evidence-cluster caps before sophisticated dependence modeling.

### 4. Combine signed contributions

For each instrument:

```text
requested_target = Σ normalized signed ViewContribution
```

Long/short contributions net naturally. Preserve all contributions for attribution even when net exposure is small.

Example:

```text
Momentum       +0.30R
Wallet copy    +0.20R
Macro          -0.10R
Crowding       -0.15R
---------------------
Requested      +0.25R
```

### 5. Apply account-level portfolio constraints

Apply deterministic limits such as max instrument exposure, max gross/net exposure, leverage, concentration, correlated exposure, source concentration, exploration budget, drawdown/loss budget and liquidity/capacity.

This stage may **clip** the target and must record why.

### 6. Produce PortfolioTarget

```text
PortfolioTarget
  portfolio_id
  instrument
  requested_target
  permitted_target
  current_position
  required_delta
  contributing_views[]
  clipping_reasons[]
  generated_at
  supersedes_target_id
```

Execution acts only on the required delta from reconciled current exposure.

## Example

Current ETH exposure: `+0.15R`

After sleeve normalization and duplicate handling:

```text
requested aggregate target = +0.45R
account max ETH target      = +0.40R
permitted target            = +0.40R
required delta              = +0.25R
```

The execution layer receives one target delta, not five independent buy/sell instructions.

## Zero target is meaningful

A zero target can mean opposing Views cancel, all producers are neutral, portfolio constraints force flat, or the strategy explicitly wants no position. These cases must remain distinguishable.

If an opportunity was eligible for exposure but final target stayed zero without a hard block, it may enter missed-opportunity tracking.

## Continuous revision

Targets can evolve:

```text
+0.25R → +0.50R → +0.30R → 0R → -0.20R
```

without treating every transition as a new unrelated thesis.

## Attribution

Every position/fill should remain attributable to the active contributions that created the target. Outcome analysis should separate account PnL, producer contributions, timing, clipping and execution deviation.

Do not pretend a netted portfolio has one single reason for its position.

## Why not majority voting

Voting discards sizing, dependency and portfolio context. Five correlated weak signals should not automatically defeat one independent risk signal.

## Why not an opaque optimizer first

An optimizer may become useful later, but initially it makes it harder to explain why exposure changed and whether underperformance came from signals, constraints or optimization.

V1 should optimize for traceability.

## Simulation plan

Before formulas are frozen, replay the same event set through:

1. raw summation;
2. deterministic sleeve/netting;
3. capped weighted aggregation;
4. later optimizer baseline.

Compare return/drawdown, gross/net utilization, concentration, turnover, missed opportunity, conflict resolution, attribution stability and sensitivity to one noisy producer.

The deterministic sleeve model is the default architecture candidate, not a permanently frozen mathematical formula.