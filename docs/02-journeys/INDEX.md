# Journey Index

Status: **Detailed journey tranche 1 drafted — not yet frozen for implementation**

Updated: 2026-09-15

## Journey law

Product behavior must be defined through user journeys before UI/component implementation.

Every journey specifies:

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

## Core flow

**Discover → Investigate → Follow / Shadow / Create → Paper Trade / Paper Copy → Manage Position → Review & Learn → Improve / Scale**

Agent operation can participate across discovery, investigation, paper trading and position management under its explicit Paper session envelope.

## Candidate V1 journeys

### J01 — Enter / onboarding

Understand what MetaEdge is, obtain an app identity, and enter paper-first mode without requiring a wallet.

Status: inventory only.

### J02 — Discover

Find interesting markets, wallets, traders, strategies, agents, portfolios, cohorts, or signals.

Status: **detailed draft** — `02-discover.md`.

### J03 — Investigate source

Understand what a source is doing, why it may matter, what evidence supports it, contradictions and unknowns.

Status: **detailed draft** — `03-investigate-source.md`.

### J04 — Follow source

Persist a source and receive meaningful updates without creating exposure.

Status: **detailed draft** — `04-follow-source.md`.

### J05 — Create or copy strategy

Turn a user's own idea or an observed source into explicit, versioned strategy logic.

Status: inventory only.

### J06 — Backtest

Evaluate a strategy against historical data with explicit assumptions, costs, data lineage and invalid-result states.

Status: inventory only.

### J07 — Shadow

Track the counterfactual result of following a source/strategy under follower-specific policy without changing the paper portfolio.

Status: **detailed draft** — `07-shadow.md`.

### J08 — Create paper portfolio

Define paper capital, risk policy, exploration budget and allowed markets.

Status: inventory only.

### J09 — Paper trade

Generate/process bounded paper intents from manual/strategy/agent views via portfolio targets.

Status: **detailed draft** — `09-paper-trade.md`.

### J10 — Paper copy

Transform qualifying source observations into follower-specific paper targets/intents.

Status: **detailed draft** — `10-paper-copy.md`.

### J11 — Manage position

Scale in/out, hold, reduce, exit, hedge or reverse as evidence and aggregate portfolio target evolve.

Status: **detailed draft** — `11-manage-position.md`.

### J12 — Review and learn

Explain outcome drivers, execution, risk, regime, behavior, source attribution and missed opportunities.

Status: **detailed draft** — `12-review-and-learn.md`.

### J13 — Improve / pause / retire

Create a new strategy version, alter a copy policy, pause an agent/source or retire an experiment without rewriting history.

Status: inventory only.

### J14 — Agent operation

Allow a Level-2 Paper Agent to autonomously manage bounded paper exposure under an already-approved session envelope, without per-tick human confirmation.

Status: **detailed draft** — `14-agent-operation.md`.

## Candidate Phase-2 journeys

### Arena participation

Enter a defined competition with fair scoring and explicit paper-only rules.

### Strategy/source comparison

Compare wallets, traders, strategies, agents and cohorts on risk-adjusted evidence rather than raw PnL alone.

### Cohort intelligence

Observe aggregate behavior across source groups and translate it into evidence/views.

## Future real-money journeys — design now, do not implement yet

### Real readiness

Assess wallet, account, strategy, risk, execution and policy readiness.

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

Pause strategy authority, revoke delegation, kill execution and safely reconcile operations already in flight.

## Next journey tranche

Before implementation begins, draft and review:

- J01 onboarding;
- J05 create/copy strategy;
- J06 backtest;
- J08 paper portfolio + risk/exploration policy;
- J13 improve/pause/retire;
- future Real readiness/preview/authorization/reconciliation at domain-contract level.

Then derive the canonical domain model and state machines from the complete journey set.