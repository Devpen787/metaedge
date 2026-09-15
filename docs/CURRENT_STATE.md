# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Active phase: **P1 — V1 Wedge + Primary User**
- Implementation: **NOT AUTHORIZED**
- Real execution: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Relaunch method

MetaEdge follows a product/UX-first sequence:

**Wedge → User/JTBD → Master Experience Loop → Journey Registry → UX Laws → Information Architecture → Detailed Journeys → UX Breaker → Golden Journeys → Technical Derivation → Migration → Build/QA.**

See `docs/01-product/PRODUCT_UX_FOUNDATION.md`.

## Current exact task

Review and approve/revise:

`docs/01-product/V1_PRODUCT_WEDGE.md`

P1 is not complete until the human owner approves the wedge, primary operator, product promise, V1 proof loop, first wow moment and major exclusions.

## Current wedge direction

MetaEdge is being refocused around **wallet-capable trading agents that can trade fast, smart, and disciplined**.

The human operator owns objectives, capital, risk boundaries, allowed markets, wallet/authority and escalation. The agent is expected to do the operating work:

**sense → understand → decide → act → manage → reconcile → learn**

V1 remains paper-first, but wallet identity, capital assignment and bounded authority are first-class product concepts from the beginning.

### Fast

The agent can monitor continuously, recognize material changes, act inside an already-approved paper envelope without per-tick approval, and avoid chronic lateness/analysis paralysis.

### Smart

The agent can reason across incomplete/conflicting market and source evidence, distinguish observation/inference/unknown, and adapt as conditions change.

### Disciplined

The agent obeys risk/authority limits, avoids outcome-driven behavioral drift, manages positions continuously, reconciles ambiguity before retrying, and preserves decision history for learning.

## Working primary operator hypothesis

The first human user is an **active crypto trader / agent operator** who wants agents to monitor and trade more continuously than they can while remaining bounded, inspectable, and progressively trusted.

The operator should not become the agent's manual execution loop.

## Working V1 proof loop

1. Create/select an agent and give it a clear mandate.
2. Assign a paper wallet/capital pool plus explicit risk/authority limits.
3. The agent watches relevant markets/sources continuously.
4. It detects opportunities and forms usable views without requiring certainty.
5. It can take bounded paper action inside its approved envelope without waiting for per-tick human approval.
6. It manages the resulting position as evidence/risk changes.
7. The operator can understand what it did, why, what changed and what remains uncertain.
8. Review separates decision quality, discipline, execution and outcome.
9. The operator can constrain, pause, retire or later promote authority based on evidence.

## Candidate first wow moment

> “My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”

The wow moment should come from **competent agency**, not from a dashboard or chat response.

## Product/UX operating artifacts

### Active / current

- `docs/01-product/PRODUCT_UX_FOUNDATION.md`
- `docs/01-product/V1_PRODUCT_WEDGE.md`
- `docs/10-ops/WORKBOARD.md`
- `docs/10-ops/PRODUCT_UX_WORKFLOW.md`

### Draft inputs for upcoming gates

- `docs/01-product/USER_JOBS.md`
- `docs/01-product/MASTER_EXPERIENCE_LOOP.md`
- `docs/01-product/UX_LAWS_AND_DESIGN_PRINCIPLES.md`
- `docs/02-journeys/JOURNEY_REGISTRY.md`
- `docs/02-journeys/JOURNEY_TEMPLATE.md`

The upcoming drafts must be revised against the approved wallet-agent wedge before their gates open.

## Journey status

No journey is Golden.

Existing J01–J14 files are classified as **INVENTORY**. They remain useful requirements/source material but are not approved product journeys.

The earlier user-centric journey framing will need to be re-evaluated around the two-actor system:

- **human operator** — mandate, authority, supervision, intervention, review;
- **trading agent** — sensing, decision, action, management, reconciliation, learning.

## Product authority

The active authority order is:

1. Product Constitution.
2. Human-approved P1–P3 foundation artifacts.
3. Golden journeys.
4. Approved UX laws/design principles/information architecture.
5. Approved product capability contracts.
6. Technical/domain/security derivations.
7. Architecture/migration decisions.
8. Research/archaeology/historical implementation as evidence.

## Preserved research/evidence

The following remains valuable input:

- historical MetaEdge archaeology and failure lessons;
- Hummingbot/Condor, LEAN, Freqtrade, NautilusTrader, Jesse, vn.py and copy-system research;
- Colosseum/agent-project research;
- current MetaMask Agent Wallet / permissions / plugins research;
- Trading in the Zone product mapping;
- copy/source model;
- paper/real separation principles;
- anti-paralysis lessons.

## Parked technical hypotheses

The following are preserved but **paused as product authority until P10**:

- canonical domain model;
- authority/state machines;
- EvidenceProfile field schema;
- portfolio aggregation formula;
- source-reputation technical model;
- security/temporal matrices;
- scenario/contract replay results;
- production seam and migration maps.

They may be consulted for feasibility or known constraints, but cannot dictate P1–P9 UX decisions.

## Decisions that remain useful across the reset

- paper and real must remain unambiguously separate;
- unknown external execution is not equivalent to failure/retry permission;
- no universal scalar confidence gate;
- copying is transformation, not blind cloning;
- observed/inferred/unknown distinctions matter;
- automation should earn authority progressively;
- decision quality and outcome quality are different;
- strategy-specific market rules must not become platform UX laws.

## Paused work

Do not continue until later gates:

- Contract Replay 02;
- further portfolio-formula freeze;
- implementation migration planning;
- new application code;
- technical screen derivation from domain objects.

## P1 questions still open

1. Confirm the active crypto trader / agent operator as the first human user.
2. Confirm **fast / smart / disciplined wallet-capable agents** as the core product promise.
3. Confirm whether the first Golden journey starts from a MetaEdge starter agent, creating an agent, or adapting an existing source/strategy.
4. Confirm the first wow moment.
5. Keep spot vs paper perps open until journey work unless it is required to define the wedge.

## Next step after P1

When the wedge is approved:

1. update this file and `WORKBOARD.md`;
2. rewrite/promote P2 User Jobs around the operator + trading-agent relationship;
3. do **not** jump directly to information architecture or implementation.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted through the current Product/UX → Golden → Technical Derivation process.
