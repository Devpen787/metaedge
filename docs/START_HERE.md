# MetaEdge Relaunch — Start Here

Status: **Product & UX Foundation — P1 active**  
Branch: `relaunch/product-foundation`  
Base checkpoint: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`

## What changed

The relaunch is now explicitly **product/UX-first**.

We have enough archaeology and technical evidence to inform the product, but the next source of truth is not another state machine or contract replay. It is the user experience.

The active progression is:

```text
V1 Wedge + Primary User
→ User Jobs / JTBD
→ Master Experience Loop
→ Journey Registry
→ UX Laws / Design Principles
→ Information Architecture
→ Detailed Journeys
→ UX Breaker
→ Golden Journeys
→ Technical Derivation
→ Legacy Migration
→ Build / QA
```

## Current active task

**P1 — review and approve `docs/01-product/V1_PRODUCT_WEDGE.md`.**

Do not jump ahead because later-stage drafts already exist.

## Working product thesis

MetaEdge should help an active crypto participant turn possible edges from markets, wallets, traders, strategies, agents or other sources into a disciplined loop of understanding, safe testing, bounded participation, management and learning.

Working user loop:

**Notice → Understand → Choose → Test/Participate → Manage → Review → Evolve**

The older product cycle remains useful:

**Discover → Understand → Test → Act → Manage → Learn → Scale**

## Current implementation rule

This branch remains **documentation/product-definition only** until a human explicitly approves implementation.

Do not refactor product code, change execution behavior, enable real trading, deploy, sign transactions, move funds or delete legacy implementation.

## Product authority order

1. `docs/00-constitution/PRODUCT_CONSTITUTION.md`
2. approved P1–P3 product foundation artifacts;
3. Golden user journeys;
4. approved UX laws/design principles/information architecture;
5. approved product capability contracts;
6. technical/domain/security contracts derived from Golden journeys;
7. architecture/migration decisions;
8. research and archaeology as evidence only.

## Read now

For the current phase:

- `docs/CURRENT_STATE.md`
- `docs/01-product/PRODUCT_UX_FOUNDATION.md`
- `docs/01-product/V1_PRODUCT_WEDGE.md`
- `docs/10-ops/WORKBOARD.md`
- `docs/10-ops/PRODUCT_UX_WORKFLOW.md`

Useful working drafts for the next gates:

- `docs/01-product/USER_JOBS.md`
- `docs/01-product/MASTER_EXPERIENCE_LOOP.md`
- `docs/01-product/UX_LAWS_AND_DESIGN_PRINCIPLES.md`
- `docs/02-journeys/JOURNEY_REGISTRY.md`

## What to do with existing J01–J14

Treat them as **journey inventory and requirements research**.

They contain valuable thinking, but they were drafted too close to domain/engineering concerns to count as approved UX journeys. They must be rewritten/reviewed using `docs/02-journeys/JOURNEY_TEMPLATE.md` before promotion.

## What to do with technical work already produced

Preserve it.

Domain models, state machines, EvidenceProfile, portfolio aggregation, security matrices, contract replays and migration maps are now **technical hypotheses / constraints parked for P10+**.

They may inform feasibility and prevent us repeating known failures, but they do not dictate the user experience.

## Legacy status

The pre-relaunch codebase remains a quarry: useful tested mechanics, historical evidence and failure lessons. Nothing is deleted yet.

Later, after Golden journeys and technical derivation, every substantial capability earns `REUSE`, `ADAPT`, `REPLACE`, `REMOVE`, `DEFER`, or `NEEDS PROOF` status.

## Anti-drift check

If you cannot answer “what phase does this task belong to?” before doing the work, read `docs/10-ops/WORKBOARD.md` and stop until the phase is clear.
