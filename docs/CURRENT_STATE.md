# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Active phase: **P2 — Human + Agent Jobs-to-be-Done**
- Implementation: **NOT AUTHORIZED**
- Real execution: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Relaunch method

MetaEdge follows a product/UX-first sequence:

**Wedge → User/JTBD → Master Experience Loop → Journey Registry → UX Laws → Information Architecture → Detailed Journeys → UX Breaker → Golden Journeys → Technical Derivation → Migration → Build/QA.**

See `docs/01-product/PRODUCT_UX_FOUNDATION.md`.

## P1 — APPROVED

`docs/01-product/V1_PRODUCT_WEDGE.md` is now product authority.

Approved wedge:

> **MetaEdge is an agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined.**

Approved primary human operator:

> **Active crypto trader / agent operator** who wants agents to monitor and trade more continuously than they can while remaining bounded, inspectable, and progressively trusted.

Approved product promise:

> **Build and operate wallet-capable trading agents that can trade fast, smart, and disciplined.**

Approved first wow moment:

> **“My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”**

The operator must not become the agent's manual execution loop.

## Approved human vs agent split

### Human operator

Owns:

- objectives / mandate;
- paper capital and future wallet authority;
- allowed markets;
- risk and autonomy boundaries;
- supervision and intervention;
- pause/stop/constrain/promote/retire decisions;
- judgment of whether the agent deserves more trust.

### Trading agent

Owns, inside the approved envelope:

- sensing relevant markets/sources;
- reasoning under uncertainty;
- deciding what action/exposure is appropriate;
- taking bounded paper action;
- managing positions continuously;
- reconciling operational ambiguity;
- explaining material decisions;
- learning from outcomes and missed opportunities without silently expanding authority.

## Current exact task — P2

Review and approve/revise:

`docs/01-product/USER_JOBS.md`

P2 now models MetaEdge as a **two-actor product**:

1. human operator;
2. wallet-capable trading agent.

The key P2 question is not which screens exist. It is what each actor is trying to accomplish, what the relationship must make possible, and what the operator needs to trust the agent without babysitting it.

## P2 working priorities

Current candidate primary jobs:

1. Operator delegates a clear mission with wallet/capital and boundaries.
2. Agent senses, decides, and acts quickly inside that mandate.
3. Agent manages exposure continuously while keeping the operator appropriately informed.
4. Operator can intervene immediately when needed.
5. Operator reviews competence and decides whether trust/authority should change.

Supporting jobs such as source discovery, strategy adaptation, backtesting, copying, and agent creation must earn their place by supporting this core loop rather than becoming separate products.

## P2 decisions still open

1. Is the operator's central JTBD **delegation** rather than discovery? Current recommendation: yes.
2. How much should the operator see while an agent runs? Current recommendation: state + material decisions + exceptions, not every internal action.
3. What deserves interruption? Working principle: ordinary in-envelope paper action is autonomous; material/unusual changes notify; authority boundary or future-real escalation requires explicit human action.
4. What evidence of competence must the operator understand before trust can increase?
5. Is agent creation/improvement a primary first-session job or a supporting/next-loop job? Current recommendation: supporting; first prove a strong starter agent.

## Product/UX operating artifacts

### Approved / active

- `docs/01-product/PRODUCT_UX_FOUNDATION.md`
- `docs/01-product/V1_PRODUCT_WEDGE.md` — **P1 APPROVED**
- `docs/01-product/USER_JOBS.md` — **P2 ACTIVE REVIEW**
- `docs/10-ops/WORKBOARD.md`
- `docs/10-ops/PRODUCT_UX_WORKFLOW.md`

### Draft inputs for upcoming gates

- `docs/01-product/MASTER_EXPERIENCE_LOOP.md`
- `docs/01-product/UX_LAWS_AND_DESIGN_PRINCIPLES.md`
- `docs/02-journeys/JOURNEY_REGISTRY.md`
- `docs/02-journeys/JOURNEY_TEMPLATE.md`

Those upcoming drafts must be revised around the approved wallet-agent wedge before their gates open.

## Journey status

No journey is Golden.

Existing J01–J14 files remain **INVENTORY**: useful requirements/source material, not approved product journeys.

Future journey work must model the two-actor system explicitly:

- **human operator** — mandate, authority, supervision, intervention, review;
- **trading agent** — sensing, decision, action, management, reconciliation, learning.

## Product authority

1. Product Constitution.
2. Human-approved P1–P3 foundation artifacts.
3. Golden journeys.
4. Approved UX laws/design principles/information architecture.
5. Approved product capability contracts.
6. Technical/domain/security derivations.
7. Architecture/migration decisions.
8. Research/archaeology/historical implementation as evidence.

## Preserved research/evidence

Still valuable:

- historical MetaEdge archaeology and failure lessons;
- Hummingbot/Condor, LEAN, Freqtrade, NautilusTrader, Jesse, vn.py and copy-system research;
- Colosseum/agent-project research;
- current MetaMask Agent Wallet / permissions / plugins research;
- Trading in the Zone product mapping;
- copy/source model;
- paper/real separation principles;
- anti-paralysis lessons.

## Parked technical hypotheses

Paused as product authority until P10:

- canonical domain model;
- authority/state machines;
- EvidenceProfile field schema;
- portfolio aggregation formula;
- source-reputation technical model;
- security/temporal matrices;
- scenario/contract replay results;
- production seam and migration maps.

They may be consulted for feasibility or known constraints, but cannot dictate P2–P9 UX decisions.

## Paused work

Do not continue yet:

- Contract Replay 02;
- further portfolio-formula freeze;
- implementation migration planning;
- new application code;
- technical screen derivation from domain objects.

## Next step after P2

When P2 is approved:

1. update this file and `WORKBOARD.md`;
2. promote/rewrite P3 `MASTER_EXPERIENCE_LOOP.md` around the human-operator + trading-agent relationship;
3. do **not** jump to information architecture, screens, or implementation.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted through the current Product/UX → Golden → Technical Derivation process.
