# MetaEdge Relaunch Agent Instructions

This branch is in **Product & UX Foundation mode**.

## Start here

Read, in order:

1. `docs/START_HERE.md`
2. `docs/CURRENT_STATE.md`
3. `docs/01-product/PRODUCT_UX_FOUNDATION.md`
4. `docs/10-ops/WORKBOARD.md`

Then read only the artifacts relevant to the active gate.

## Current active gate

**P1 — V1 Wedge + Primary User**

Do not advance later phases merely because supporting drafts already exist.

## Authority order

1. Product Constitution for non-negotiable product laws.
2. Human-approved V1 wedge, primary user, jobs and master experience loop.
3. Golden user journeys.
4. Approved UX laws, design principles and information architecture.
5. Approved product capability contracts.
6. Domain/state/security contracts derived from Golden journeys.
7. Architecture/migration decisions.
8. Research, archaeology, external systems and historical code as evidence only.

Historical implementation, old handoffs, screenshots, V3/V5 research and prior UI structure are not automatically product authority.

## Hard boundaries

Until explicit human approval changes `docs/CURRENT_STATE.md`:

- DO NOT implement or refactor product features.
- DO NOT enable real trading.
- DO NOT sign transactions, move funds, add secrets or deploy.
- DO NOT delete legacy code or historical evidence.
- DO NOT preserve old UI/tabs merely because they exist.
- DO NOT freeze architecture while P1–P9 are incomplete.
- DO NOT let a technical object become a screen merely because it exists in a draft domain model.
- DO NOT let strategy-specific trading logic become a platform UX law.

## Product/UX workflow

Follow:

**Research/Evidence → Product/UX Spec → UX Breaker → Human Approval → Golden → Technical Derivation → Build → QA/Breaker**

The operating method is in `docs/10-ops/PRODUCT_UX_WORKFLOW.md`.

## Journey rules

- Existing J01–J14 material is `INVENTORY`, not Golden product truth.
- Use `docs/02-journeys/JOURNEY_TEMPLATE.md` for future rewrites.
- Journey status lives in `docs/02-journeys/JOURNEY_REGISTRY.md`.
- A journey cannot self-promote to Golden.
- Golden journeys require explicit human approval after breaker review.
- Implementation cannot invent new user-visible transitions outside Golden journeys.

## Treatment of current technical drafts

Preserve domain/state/security/aggregation/replay/migration documents, but treat them as **technical hypotheses / constraints** until the relevant Golden journey reaches P10 Technical Derivation.

Useful prior principles may inform UX work, including:

- hard safety/integrity blockers are distinct from thesis uncertainty;
- paper and real must remain unmistakably separate;
- copying is transformation, not blind cloning;
- no universal scalar confidence gate;
- many components may propose while one account-level authority coordinates exposure;
- unknown external execution must reconcile before equivalent retry.

These principles do not authorize implementation.

## Anti-drift rule

Before starting substantial work, identify its phase/gate in `WORKBOARD.md`.

If it belongs to a later phase, park it as evidence/hypothesis and return to the active gate.

## Durable memory

Git/repo-owned approved artifacts are project memory. Conversational memory is not product authority.
