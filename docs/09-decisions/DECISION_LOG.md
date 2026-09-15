# Decision Log

Status legend:

- `PROPOSED`
- `RESEARCHING`
- `DECIDED`
- `SUPERSEDED`
- `REJECTED`

This log records product/architecture decisions. Research notes do not become decisions until explicitly promoted here.

## DEC-001 — Relaunch from a clean product-foundation branch

Status: `DECIDED`

Decision: Use `relaunch/product-foundation`, branched from `codex/metaedge-v5-paper-checkpoint`, to define product truth before implementation.

Consequence: Existing code remains reference/evidence until individually classified and adopted.

---

## DEC-002 — Product cycle

Status: `DECIDED`

Decision: Organize MetaEdge around **Discover → Understand → Test → Act → Manage → Learn → Scale**.

---

## DEC-003 — Edge sources are plural

Status: `DECIDED`

Decision: An edge may originate from markets, wallets, traders, strategies, agents, portfolios, cohorts, signal providers, behavioral patterns, catalysts, or cross-market relationships.

---

## DEC-004 — Copying uses a shared CopySource abstraction

Status: `DECIDED`

Decision: Wallet copying, trader copying, strategy copying, agent copying, portfolio/cohort following, and signal-provider following should share one downstream copy/portfolio/risk model where possible. Copying is transformation, not blind cloning.

---

## DEC-005 — Remove scalar confidence from execution permission

Status: `DECIDED`

Decision: Do not use one numerical confidence threshold as the primary trade permission gate. Use evidence profiles, explicit hard blockers, and progressive participation/position sizing.

---

## DEC-006 — Risk bounds exposure; it does not own the thesis

Status: `DECIDED`

Decision: Opportunity/strategy loops decide what they want to do. Risk determines what is permitted and how much may be risked.

---

## DEC-007 — Use target exposure, not direct strategy orders

Status: `DECIDED`

Decision: Strategies/source loops emit views/desired exposure. Portfolio coordination resolves conflicts and existing positions before execution.

---

## DEC-008 — Many proposers, one portfolio authority, one execution authority

Status: `DECIDED`

Decision: Observation/reasoning loops may operate asynchronously and in parallel. Portfolio mutation and execution are serialized through canonical authorities.

---

## DEC-009 — Explicit exploration capacity

Status: `DECIDED`

Decision: Paper portfolios need bounded exploration capacity so weak-but-valid hypotheses can produce scout experiments rather than being permanently blocked for insufficient evidence. Exact values remain open.

---

## DEC-010 — No-trade is evaluated counterfactually

Status: `DECIDED`

Decision: Eligible skipped opportunities remain under observation so MetaEdge can quantify missed opportunities, good abstention, entry delay, and over-conservatism.

---

## DEC-011 — Fast path and research path coexist

Status: `DECIDED`

Decision: Fast-moving market events may justify bounded scout participation before slow systematic research completes. Slow research improves longer-term evidence, strategy lifecycle, and sizing.

---

## DEC-012 — Paper and real share logic, not authority

Status: `DECIDED`

Decision: Strategy/source/evidence logic may be portable from paper to real proposals. Paper intents/fills/positions never become real intents or authority.

---

## DEC-013 — Paper should continue alongside future real execution

Status: `DECIDED`

Decision: When real trading eventually exists, paper should remain available as an ongoing calibration path for fill, slippage, latency, cost, and model-vs-real comparison.

---

## DEC-014 — Human psychology is market data

Status: `DECIDED`

Decision: Fear, greed, attention, capitulation, FOMO, crowding, narrative rotation, and behavioral divergence may form a first-class evidence/strategy family. Operator emotion does not receive execution authority.

---

## DEC-015 — Agent is a system, not one LLM

Status: `DECIDED`

Decision: MetaEdge owns durable sensing, portfolio, risk, execution, reconciliation, and learning state. LLMs are replaceable reasoning/synthesis components.

---

## DEC-016 — Progressive agent maturity

Status: `DECIDED`

Decision: Agent authority should progress from Observer → Adviser → Paper Agent → Supervised Real → Bounded Autonomous → Adaptive Portfolio Agent rather than using a single Autopilot toggle.

---

## DEC-017 — External architecture archaeology before freeze

Status: `DECIDED`

Decision: Review mature trading frameworks, copy systems, Colosseum/agent projects, and current MetaMask authority primitives before freezing final architecture.

---

## DEC-018 — MetaMask is an execution/authority adapter, not product authority

Status: `DECIDED`

Decision: MetaEdge defines a vendor-neutral real execution/authorization contract above MetaMask. Wallet systems may implement or further restrict that contract.

---

## DEC-019 — Pending wallet work is first-class; do not retry ambiguity

Status: `DECIDED`

Decision: Future real execution must model asynchronous wallet states including pending requests and `AWAITING_MFA`. Ambiguous outcome reconciles before financially equivalent retry.

---

## DEC-020 — MetaMask Guard is defense-in-depth, not the trading risk engine

Status: `DECIDED`

Decision: Use wallet policy/security controls where available, but MetaEdge retains canonical account/portfolio/strategy risk.

---

## DEC-021 — Agent Wallet native plugins are optional adapters, not core architecture

Status: `DECIDED`

Decision: Do not make the relaunch depend on Agent Wallet native plugins. AI-host skills/plugins are a separate interaction layer and do not receive financial authority merely by being installed.

---

## DEC-022 — EvidenceProfile replaces universal confidence

Status: `DECIDED`

Decision: Represent market/source evidence as a multidimensional profile with contradictions, unknowns, freshness, reliability, coverage and invalidators. No universal aggregate confidence score becomes the primary execution gate.

Current authority note: the **principle** remains decided; the exact technical field schema is parked for P10 Technical Derivation.

---

## DEC-023 — V1 portfolio aggregation starts deterministic and sleeve-based

Status: `DECIDED`

Decision: Use deterministic budgeted-sleeve aggregation as the initial technical candidate before opaque optimization/voting.

Current authority note: the architecture candidate is parked for P10 and must be re-derived against Golden journeys before freeze.

---

## DEC-024 — Source reputation is a profile, not a universal score

Status: `DECIDED`

Decision: Source quality/copyability is decomposable and objective-specific rather than one universal leaderboard score.

---

## DEC-025 — Position truth is derived from reconciled execution evidence

Status: `DECIDED`

Decision: Position state must ultimately derive from reconciled execution evidence rather than an ungrounded mutable position row.

---

## DEC-026 — Authority narrows monotonically toward execution

Status: `DECIDED`

Decision: Downstream layers may restrict but never expand human-approved authority.

---

## DEC-027 — Future real execution separates grant, intent and operation

Status: `DECIDED`

Decision: Future real architecture should keep authority grant, fresh real intent, execution plan/operation and reconciliation conceptually separate.

---

## DEC-028 — Duplicate lineage must not masquerade as independent confirmation

Status: `DECIDED`

Decision: Preserve source/evidence lineage so multiple views derived from the same underlying event/source are not automatically treated as independent corroboration.

---

## DEC-030 — Product/UX definition precedes technical derivation

Status: `DECIDED`

Decision:

Use the sequence:

**Wedge → User/JTBD → Master Experience Loop → Journey Registry → UX Laws → Information Architecture → Detailed Journeys → UX Breaker → Golden Journeys → Technical Derivation → Migration → Build/QA.**

Consequence:

Later-stage technical drafts are preserved but cannot dictate P1–P9 product behavior.

See `ADR-030-product-ux-first.md`.

---

## DEC-031 — Existing J01–J14 are inventory until re-reviewed as UX journeys

Status: `DECIDED`

Decision:

Reclassify the current journey set as `INVENTORY`. Existing content is requirements/research input, not Golden product truth.

Promotion requires user-language rewrite/review, UX breaker validation, connection validation and explicit human approval.

---

## DEC-032 — Golden journeys gate technical freeze and implementation

Status: `DECIDED`

Decision:

No relevant domain/state/architecture contract becomes implementation authority before the user journey it serves is Golden.

No application implementation is authorized until a later explicit build approval.

---

## DEC-033 — Use an explicit product/UX operating loop

Status: `DECIDED`

Decision:

Substantial work follows:

**Research/Evidence → Product/UX Spec → UX Breaker → Human Approval → Golden → Technical Derivation → Build → QA/Breaker.**

Only one core product lane should create canonical UX decisions at a time. Supporting research may run in parallel but cannot independently advance the phase.

---

## DEC-034 — V1 wedge is the competent wallet-capable trading agent

Status: `DECIDED`

Approved: 2026-09-15

Decision:

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

The initial human user is an **active crypto trader / agent operator**. The operator defines mandate, capital/wallet, markets, risk, authority, supervision and intervention. The agent performs the operating loop inside that envelope:

**sense → understand → decide → act → manage → reconcile → learn**.

V1 is paper-first, but wallet identity, assigned capital and bounded authority are first-class product concepts from the start.

The operator must not become the agent's manual per-action execution loop.

Approved first wow moment:

> **“My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”**

Consequence:

Discovery, wallet/trader intelligence, strategies, evidence, risk, portfolio coordination, MetaMask integration, review and learning are supporting capabilities for the competent agent wedge rather than independent V1 products.

---

# Open decisions

## OPEN-001 — V1 market scope

- crypto spot only;
- crypto spot + paper perps.

Resolve from later product/journey value rather than architecture convenience.

## OPEN-002 — V1 discovery surface order

Markets, wallets, traders, strategies, agents, or a blended entry. Resolve from the agent/operator experience during P3–P7.

## OPEN-003 — Arena timing

V1 vs Phase 2. Current bias: defer unless Golden core journeys demonstrate a need.

## OPEN-004 — Exploration sizing

Exact `R` definitions, scout size, portfolio exploration budget and scaling rules. Technical/numeric design deferred until P10.

## OPEN-005 — Evidence representation

The no-universal-confidence principle is decided. Exact user-facing and technical representation must be derived from Golden journeys.

## OPEN-006 — Final portfolio aggregation formula

Technical candidate exists, but final formula is deferred until P10 and replay/simulation after UX approval.

## OPEN-007 — Source reputation presentation

Which objective-specific ranks/filters ship first and how incompleteness warnings appear in UX.

## OPEN-008 — MetaMask future authority substrate

Candidate implementations include Agent Wallet server-wallet + Guard, Smart Account Advanced Permissions, direct delegation, or multiple adapters. Not a P2 decision.

## OPEN-009 — MetaEdge native Agent Wallet plugin

Current recommendation: not required for V1; investigate later if a Golden journey needs it.

## OPEN-012 — P2 operator attention model

Define conceptually which agent events are handled autonomously, which should notify the operator, and which require explicit human action.

## OPEN-013 — P2 competence/trust evidence

Define what the operator must be able to see and understand before widening agent authority. Do not reduce this to one opaque score.

## OPEN-014 — Agent creation timing

Decide whether creating/improving agents is a primary first-session V1 job or a supporting/next-loop job. Current recommendation: start with a strong starter agent and make creation/adaptation progressive.
