# MetaEdge Relaunch — Start Here

Status: **Product & UX Foundation — P4 active**  
Branch: `relaunch/product-foundation`  
Base checkpoint: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`

## What MetaEdge is now optimizing for

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

The active human is an **active crypto trader / agent operator**. The human defines mission, wallet/capital, market scope, risk and authority guardrails. The agent performs the operating work inside those boundaries.

V1 remains paper-first, but wallet identity, assigned capital and bounded authority are first-class concepts from the beginning.

## Approved experience model

### Operator control / trust loop

**Delegate → Bound → Launch → Supervise / Intervene → Review → Evolve → Repeat**

### Agent operating loop

**Sense → Understand → Decide → Act → Manage → Reconcile → Learn → Repeat**

Human-in-the-loop does **not** mean human-in-every-click. Ordinary in-envelope action may proceed autonomously; the operator keeps sovereign control through guardrails, supervision, intervention, pause/stop/revoke and authority evolution.

Agent quality is not PnL alone. Sound reasoning, opportunity capture, risk/reward, capital preservation, management, exits, timing, discipline, execution and outcomes all matter.

## Product/UX-first progression

```text
P1 V1 Wedge + Primary User              APPROVED
→ P2 Human + Agent Jobs / JTBD          APPROVED
→ P3 Master Experience Loop             APPROVED
→ P4 Journey Registry                   ACTIVE
→ P5 UX Laws / Design Principles        BLOCKED
→ P6 Information Architecture           BLOCKED
→ P7 Detailed Journeys                  BLOCKED
→ P8 UX Breaker                         BLOCKED
→ P9 Golden Journeys                    BLOCKED
→ P10 Technical Derivation              PAUSED
→ P11 Legacy Migration                  PAUSED
→ P12 Build / QA                        NOT AUTHORIZED
```

## Current active task

**P4 — review and re-partition `docs/02-journeys/JOURNEY_REGISTRY.md`.**

The goal is to turn the approved operator/agent loops into coherent user journeys, entry/exit paths and connections before designing navigation or screens.

Do not preserve the old J01–J14 split just because those files exist.

## Current implementation rule

This branch remains **documentation/product-definition only** until a human explicitly approves implementation at a later gate.

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
- `docs/01-product/V1_PRODUCT_WEDGE.md`
- `docs/01-product/USER_JOBS.md`
- `docs/01-product/MASTER_EXPERIENCE_LOOP.md`
- `docs/02-journeys/JOURNEY_REGISTRY.md`
- `docs/10-ops/WORKBOARD.md`
- `docs/10-ops/DECISION_CAPTURE.md`

Useful but blocked for later gates:

- `docs/01-product/UX_LAWS_AND_DESIGN_PRINCIPLES.md`
- existing detailed J01–J14 drafts;
- technical/domain/security/replay/migration docs.

## What to do with existing J01–J14

Treat them as **legacy journey inventory and requirements research**.

They contain valuable thinking, but they were drafted too close to domain/engineering concerns and before the wallet-agent wedge was fully locked. P4 may merge, split, rename, defer or replace their journey boundaries.

## What to do with technical work already produced

Preserve it.

Domain models, state machines, EvidenceProfile, portfolio aggregation, security matrices, contract replays and migration maps are **technical hypotheses / constraints parked for P10+**.

They may inform feasibility and prevent us repeating known failures, but they do not dictate the user experience.

## Legacy status

The pre-relaunch codebase remains a quarry: useful tested mechanics, historical evidence and failure lessons. Nothing is deleted yet.

Later, after Golden journeys and technical derivation, every substantial capability earns `REUSE`, `ADAPT`, `REPLACE`, `REMOVE`, `DEFER`, or `NEEDS PROOF` status.

## Anti-drift check

If you cannot answer “what phase does this task belong to?” before doing the work, read `docs/10-ops/WORKBOARD.md` and stop until the phase is clear.
