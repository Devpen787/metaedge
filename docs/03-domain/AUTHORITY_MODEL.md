# Authority Model

Status: **Draft for human approval**

## Purpose

Define who may decide, constrain, mutate and override each part of MetaEdge so agents are neither paralyzed by vague overlapping authority nor accidentally granted more authority than intended.

## Authority domains

### Human / product owner

Owns constitutional product changes, portfolio/risk policy, strategy activation/retirement, Paper Agent session start/pause/stop, and future real authority creation/revocation.

### Observation providers

Own raw external observations they deliver. They do not own interpretation, target exposure, portfolio mutation or execution authority.

### Strategy / CopySource / Agent reasoning

Owns thesis/view generation, requested target exposure within declared scope, evidence interpretation, invalidators and horizon.

Does not own account-level exposure, risk-policy changes, direct execution state mutation, or expansion of its own universe/budget.

### Portfolio authority

Owns aggregate desired exposure across active Views, netting/conflict resolution, sleeve/budget accounting and the canonical `PortfolioTarget`.

It does not invent market evidence.

### Risk authority

Owns deterministic account/portfolio constraints, allow/clip/block/reduce decisions, and integrity/feasibility blockers.

It does not decide whether the thesis is intellectually convincing.

### Execution authority

Owns translating permitted target deltas into paper or future real execution state, idempotency, lifecycle and reconciliation.

It does not change strategy intent or risk limits.

### Wallet / venue adapter

Owns adapter-specific protocol interaction and external identifiers.

It may enforce stricter platform rules but may not expand MetaEdge authority.

### Review / learning

Owns outcome attribution, missed-opportunity evaluation, evidence usefulness analysis and proposed lessons.

It cannot silently rewrite historical facts or live risk policy.

## Canonical decision chain

```text
Evidence
  ↓
Producer View
  ↓
PortfolioTarget
  ↓
RiskDecision
  ↓
Execution Intent / Operation
  ↓
Reconciled Position
  ↓
Outcome Attribution
```

Each arrow is an explicit contract boundary.

## Monotonic authority law

Authority only narrows as it moves toward execution.

```text
Human-approved scope
    ≥ portfolio scope
    ≥ risk-permitted scope
    ≥ execution-adapter scope
    ≥ wallet/venue accepted scope
```

No downstream component can create authority the upstream component did not grant.

## Agent anti-paralysis law

A launched Paper Agent does not need fresh human approval every cycle for paper actions already inside its `AgentEnvelope`.

The runtime makes the boundary explicit:

- inside envelope + permitted by portfolio/risk → may proceed;
- outside envelope → deterministic refusal;
- refusal reason is returned as state, not interpreted as "wait for human forever."

## Human override law

Human intervention can pause/stop proposal generation, change future policy through a new version, revoke future real authority, or request risk reduction.

Human intervention does not rewrite the history of already-submitted/executed operations.

## Separation from LLM context

No authority exists merely because a prompt says it does.

Durable authority is represented by canonical domain state such as `RiskPolicy`, `AgentEnvelope`, `CopyPolicy`, `AllocationSleeve`, and future `ExecutionGrant`.

LLM context can describe those objects but is not their source of truth.