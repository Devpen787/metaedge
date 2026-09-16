# Decision Capture Protocol

Status: **ACTIVE OPERATING RULE**

Updated: 2026-09-16

## Purpose

MetaEdge must not depend on conversational memory to remember what was decided.

Every meaningful product, UX, architecture, authority, scope, or workflow decision that receives human approval must be written into the repository before work proceeds as though that decision were settled.

## Canonical decision record

The primary ledger is:

`docs/09-decisions/DECISION_LOG.md`

Every durable decision must include, at minimum:

- decision ID;
- title;
- status: `PROPOSED`, `RESEARCHING`, `DECIDED`, `SUPERSEDED`, or `REJECTED`;
- date when useful;
- decision statement;
- consequence / what changes because of it;
- links or names of the product artifacts it governs;
- explicit open questions that remain unresolved when relevant.

## Three-layer synchronization rule

When a decision changes the active product direction or phase, update all three layers:

1. **Decision ledger** — what was decided and why.
2. **Authoritative product artifact** — the actual wedge, jobs, journey, UX law, etc. that now embodies the decision.
3. **Control state** — `docs/CURRENT_STATE.md` and/or `docs/10-ops/WORKBOARD.md` so the next permitted work is unambiguous.

A decision is not operationally complete if one of these layers still points to the old direction.

## Approval discipline

Use these rules:

- A suggestion from an assistant/agent is `PROPOSED`, not decided.
- Research findings are evidence until promoted into a decision.
- Explicit human approval can promote an in-scope proposal to `DECIDED`.
- If the human revises a prior decision, do not erase history; mark the old decision `SUPERSEDED` and create/identify the replacement.
- If an idea is considered and intentionally declined, record it as `REJECTED` when forgetting that rejection would risk re-opening the same debate.
- Open questions stay open. Do not silently invent answers to complete a document.

## Phase-gate decisions

At every Product/UX gate, record:

- what has been approved;
- what remains open;
- what artifact becomes authority;
- what phase becomes active next;
- what later-phase work remains blocked.

Examples:

```text
P1 approved
→ V1_PRODUCT_WEDGE.md becomes product authority
→ DECISION_LOG records the wedge
→ CURRENT_STATE / WORKBOARD move to P2
→ P3+ remain blocked
```

## Decision checkpoint before substantial work

Before starting substantial work, an agent must be able to answer:

1. What phase are we in?
2. Which decisions are already settled?
3. Which questions are still open?
4. What artifact currently has authority?
5. Does this task require a new decision, or is it execution of an existing one?

If the answer is unclear, reconcile the repo state before proceeding.

## No hidden decisions

Agents must not bury product decisions inside:

- implementation code;
- comments;
- diagrams;
- research notes;
- temporary handoffs;
- chat summaries;
- technical defaults.

If a choice materially affects user behavior, authority, risk, product scope, or the Product/UX phase, it belongs in the decision system.

## Decision review

When a new decision is recorded, quickly check for conflicts with:

- `V1_PRODUCT_WEDGE.md`;
- current `USER_JOBS.md` / later approved P2–P9 artifacts;
- `WORKBOARD.md`;
- `CURRENT_STATE.md`;
- prior decisions marked `DECIDED`.

Conflicts must be resolved explicitly, not left as competing sources of truth.

## Current project rule

For the MetaEdge relaunch, **repo-owned approved artifacts are durable project memory**. Chat context is useful working context, but it is not the final source of truth.
