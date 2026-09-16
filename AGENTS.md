# MetaEdge Relaunch Agent Instructions

This branch is in **Product & UX Foundation mode**.

## Start here

Read, in order:

1. `docs/START_HERE.md`
2. `docs/CURRENT_STATE.md`
3. `docs/01-product/PRODUCT_UX_FOUNDATION.md`
4. `docs/10-ops/WORKBOARD.md`
5. `docs/10-ops/DECISION_CAPTURE.md`

Then read only the artifacts relevant to the active gate.

## Current active gate

**P3 — Master Experience Loop**

P1 and P2 are approved. Do not reopen them casually and do not advance later phases merely because supporting drafts already exist.

Current product authority includes:

- `docs/01-product/V1_PRODUCT_WEDGE.md`
- `docs/01-product/USER_JOBS.md`
- `docs/09-decisions/DECISION_LOG.md`

Current review artifact:

- `docs/01-product/MASTER_EXPERIENCE_LOOP.md`

## Approved wedge

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

The human is an active crypto trader / agent operator. The human remains in the loop through mandate, wallet/capital, adjustable guardrails, supervision and intervention — but is not the per-action approval loop.

The agent does the heavy lifting and may execute when its granted authority permits it.

## Approved P2 laws

- **Human-in-the-loop does not mean human-in-every-click.**
- Operator supervision emphasizes **state + material decisions + exceptions**.
- Ordinary in-envelope action may proceed autonomously.
- Material/unusual/degraded conditions should be surfaced.
- Authority boundary crossings require explicit human action under the authority model then in force.
- Agent trust is multidimensional: reasoning, opportunity capture, risk/reward, capital preservation, management, exits, discipline, speed, execution and outcomes.
- A losing trade may be good process; a winning trade may be reckless.
- Discipline does not mean conservatism; justified bounded risk-taking is part of competence.

## Authority order

1. Product Constitution.
2. Human-approved P1–P3 foundation artifacts.
3. Golden journeys.
4. Approved UX laws, design principles and information architecture.
5. Approved product capability contracts.
6. Domain/state/security contracts derived from Golden journeys.
7. Architecture/migration decisions.
8. Research, archaeology, external systems and historical code as evidence only.

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
- DO NOT silently convert open questions into decisions.

## Product/UX workflow

Follow:

**Research/Evidence → Product/UX Spec → UX Breaker → Human Approval → Golden → Technical Derivation → Build → QA/Breaker**

The operating method is in `docs/10-ops/PRODUCT_UX_WORKFLOW.md`.

## Decision capture

Every meaningful human-approved decision must be written into the repo before later work treats it as settled.

Synchronize:

1. `docs/09-decisions/DECISION_LOG.md`;
2. the authoritative product/UX artifact;
3. `docs/CURRENT_STATE.md` and/or `docs/10-ops/WORKBOARD.md` when control state changes.

Do not overwrite history when a decision changes; mark prior decisions `SUPERSEDED` where appropriate.

## Journey rules

- Existing J01–J14 material is `INVENTORY`, not Golden product truth.
- Use `docs/02-journeys/JOURNEY_TEMPLATE.md` for later rewrites.
- Journey status lives in `docs/02-journeys/JOURNEY_REGISTRY.md`.
- A journey cannot self-promote to Golden.
- Golden journeys require explicit human approval after breaker review.
- Implementation cannot invent new user-visible transitions outside Golden journeys.

## Treatment of technical drafts

Preserve domain/state/security/aggregation/replay/migration documents, but treat them as **technical hypotheses / constraints** until the relevant Golden journey reaches P10 Technical Derivation.

## Anti-drift rule

Before substantial work, identify its phase/gate in `WORKBOARD.md`.

If it belongs to a later phase, park it as evidence/hypothesis and return to the active gate.

## Durable memory

Git/repo-owned approved artifacts are project memory. Conversational memory is working context, not final product authority.
