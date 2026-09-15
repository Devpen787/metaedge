# Journey Index

Status: **Draft inventory — journey details not yet frozen**

## Journey law

Product behavior must be defined through user journeys before UI/component implementation.

Every journey must specify:

- USER JOB
- PRECONDITIONS
- AUTHORITATIVE STATE
- USER-VISIBLE STATES
- HAPPY PATH
- EMPTY STATE
- FAILURE
- UNKNOWN
- RETRY
- PARTIAL
- CANCEL
- BACK / REFRESH / RESTART
- OWNER / AUTHORITY
- PRIVACY
- RECOVERY
- NEXT JOURNEY

## Candidate V1 journeys

### J01 — Enter / onboarding

Understand what MetaEdge is, obtain an app identity, and enter paper-first mode without requiring a wallet.

### J02 — Discover

Find interesting markets, wallets, traders, strategies, agents, portfolios, cohorts, or signals.

### J03 — Investigate source

Understand what a source is doing, why it may matter, what evidence supports it, and what remains unknown.

### J04 — Follow source

Persist a source and receive meaningful updates without creating exposure.

### J05 — Create or copy strategy

Turn a user's own idea or an observed source into explicit, versioned strategy logic.

### J06 — Backtest

Evaluate a strategy against historical data with explicit assumptions, costs, and invalid-result states.

### J07 — Shadow

Track the counterfactual result of following a source/strategy without changing the paper portfolio.

### J08 — Create paper portfolio

Define paper capital, risk policy, exploration budget, and allowed markets.

### J09 — Paper trade

Generate and process a bounded paper intent from a manual/strategy/agent view.

### J10 — Paper copy

Transform a qualifying source observation into a follower-specific paper proposal and intent.

### J11 — Manage position

Scale in/out, hold, reduce, exit, or reverse as evidence and portfolio state evolve.

### J12 — Review and learn

Explain outcome drivers, costs, risk, regime, behavior, missed opportunities, and strategy/source attribution.

### J13 — Improve / pause / retire

Create a new strategy version, alter a copy policy, pause an agent/source, or retire an experiment without rewriting historical evidence.

### J14 — Agent operation

Allow a Level-2 Paper Agent to autonomously manage bounded paper exposure under explicit policy.

## Candidate Phase-2 journeys

### Arena participation

Enter a defined competition with fair scoring and explicit paper-only rules.

### Strategy/source comparison

Compare wallets, traders, strategies, agents, and cohorts on risk-adjusted evidence rather than raw PnL alone.

### Cohort intelligence

Observe aggregate behavior across source groups and translate it into evidence/views.

## Future real-money journeys — design now, do not implement yet

### Real readiness

Assess wallet, account, strategy, risk, execution, and policy readiness.

### Exact real preview

Generate a fresh `RealTradeIntent` and exact execution preview without moving funds.

### Real authorization

Approve an exact action or narrowly bounded delegated capability.

### Wallet/signing boundary

Cross from MetaEdge domain authority into the wallet's own authorization mechanism.

### Submission

Submit one idempotent operation and persist its operation identifier before ambiguous outcomes can cause retries.

### Reconciliation

Resolve submitted/pending/partial/unknown/final outcomes into canonical real positions and PnL.

### Revoke / stop

Pause strategy authority, revoke delegation, kill execution, and safely reconcile any operation already in flight.

## Journey design priority

Before implementation begins, V1 journeys J01–J14 should be reduced, merged, or expanded based on actual product needs and then individually frozen.
