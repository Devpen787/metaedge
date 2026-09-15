# Canonical State Machines

Status: **Draft for human approval**

## Purpose

Define explicit lifecycle states before implementation so UI, agents, persistence, restart recovery and tests reason about the same truth.

## Opportunity

```text
DETECTED → INVESTIGATING → VIEW_CREATED | WATCHING | DISMISSED | EXPIRED
```

`DETECTED` means something is worth examining, not that a trade is justified. An opportunity may generate multiple versioned Views over time.

## View

```text
ACTIVE → SUPERSEDED | WITHDRAWN | EXPIRED
```

Views are immutable after publication. New evidence creates a new View that supersedes the old one.

## StrategyVersion

```text
DRAFT → ACTIVE → PAUSED → ACTIVE
              ↘ RETIRED | SUPERSEDED
```

Historical runs always reference the exact version. Editing creates a new version. Pausing stops new proposal generation but does not erase open-position responsibility.

## CopyRelationship

```text
WATCH → FOLLOW → SHADOW → PAPER_COPY → PAUSED → STOPPED
```

Future live-copy authority is a separate transition and cannot be reached by silently mutating a paper relationship.

## PortfolioTarget

```text
PROPOSED → VALIDATED → PERMITTED | CLIPPED | BLOCKED
                       ↓
                  SUPERSEDED | EXPIRED
```

A target is not an order. `CLIPPED` means some exposure remains permitted. `BLOCKED` means no new requested exposure is allowed for that target/delta.

## PaperOrderIntent

```text
CREATED
  → RISK_ACCEPTED
      → BROKER_PENDING
          → PARTIALLY_FILLED → EXECUTED
          → EXECUTED
          → EXPIRED
          → REJECTED
          → UNRESOLVED
  → REJECTED
```

Rules:
- anti-replay/idempotency is mandatory;
- fills are append-only;
- `UNRESOLVED` requires reconciliation before equivalent intent creation;
- the paper model may require next-observation execution rather than same-observation fills.

## Paper Position

Position is derived from reconciled fills. Product-level lifecycle can be exposed as:

```text
FLAT → OPEN → INCREASING | DECREASING → OPEN → FLAT
```

A reversal must preserve the actual sequence of exposure changes rather than pretend every venue/broker can guarantee an atomic flip.

## AgentSession

```text
CONFIGURED → DRY_RUN | RUNNING
RUNNING → PAUSED → RUNNING
RUNNING → DEGRADED → RUNNING | RECOVERY_REQUIRED
RUNNING → STOPPING → STOPPED
RECOVERY_REQUIRED → RUNNING | STOPPED
```

Session launch contains the human-approved Paper Agent envelope. `RUNNING` does not require per-cycle human confirmation for paper actions already inside that envelope.

## No-trade / missed opportunity

When an eligible opportunity receives zero exposure without a hard block:

```text
ELIGIBLE_ZERO_TARGET
  → COUNTERFACTUAL_TRACKING
      → GOOD_ABSTENTION | MISSED_OPPORTUNITY | INCONCLUSIVE | EXPIRED
```

This state machine is analytical only and never creates financial mutation.

## SourceObservation

```text
OBSERVED → NORMALIZED → ACTIVE → SUPERSEDED | STALE | INVALIDATED
```

Raw evidence remains immutable even if later normalization or identity links are corrected.

## SourceReputationProfile

Profiles are versioned snapshots:

```text
COMPUTED(v1) → SUPERSEDED(v2)
```

Never rewrite the reputation state that existed when a historical follow/copy decision was made.

## Restart law

After crash/restart:

1. load durable definitions/policies;
2. load append-only intent/event/fill history;
3. reconcile canonical portfolio/position truth;
4. refresh external observations;
5. restore running agent/copy relationships only after state is coherent;
6. never reconstruct financial truth from LLM conversation context.

## Test law

Every state machine requires tests for valid/invalid transitions, idempotent replay, restart in non-terminal states, stale/expired state, concurrent/superseding updates, partial outcomes, unknown/reconciliation where applicable, and **liveness**: at least one valid path from evidence to bounded paper action when no hard blocker exists.