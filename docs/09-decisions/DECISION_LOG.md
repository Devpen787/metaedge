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

Decision:

Use `relaunch/product-foundation`, branched from `codex/metaedge-v5-paper-checkpoint`, to define product truth before implementation.

Consequence:

Existing code remains reference/evidence until individually classified and adopted.

---

## DEC-002 — Product cycle

Status: `DECIDED`

Decision:

Organize MetaEdge around:

**Discover → Understand → Test → Act → Manage → Learn → Scale**

---

## DEC-003 — Edge sources are plural

Status: `DECIDED`

Decision:

An edge may originate from markets, wallets, traders, strategies, agents, portfolios, cohorts, signal providers, behavioral patterns, catalysts, or cross-market relationships.

---

## DEC-004 — Copying uses a shared CopySource abstraction

Status: `DECIDED`

Decision:

Wallet copying, trader copying, strategy copying, agent copying, portfolio/cohort following, and signal-provider following should share one downstream copy/portfolio/risk model where possible.

Copying is transformation, not blind cloning.

---

## DEC-005 — Remove scalar confidence from execution permission

Status: `DECIDED`

Decision:

Do not use one numerical confidence threshold as the primary trade permission gate.

Use evidence profiles, explicit hard blockers, and progressive participation/position sizing.

---

## DEC-006 — Risk bounds exposure; it does not own the thesis

Status: `DECIDED`

Decision:

Opportunity/strategy loops decide what they want to do. Risk determines what is permitted and how much may be risked.

---

## DEC-007 — Use target exposure, not direct strategy orders

Status: `DECIDED`

Decision:

Strategies/source loops emit views/desired exposure. Portfolio coordination resolves conflicts and existing positions before execution.

---

## DEC-008 — Many proposers, one portfolio authority, one execution authority

Status: `DECIDED`

Decision:

Observation/reasoning loops may operate asynchronously and in parallel. Portfolio mutation and execution are serialized through canonical authorities.

---

## DEC-009 — Explicit exploration capacity

Status: `DECIDED`

Decision:

Paper portfolios need bounded exploration capacity so weak-but-valid hypotheses can produce scout experiments rather than being permanently blocked for insufficient evidence.

Exact budget/risk-unit values remain open.

---

## DEC-010 — No-trade is evaluated counterfactually

Status: `DECIDED`

Decision:

Eligible skipped opportunities remain under observation so MetaEdge can quantify missed opportunities, good abstention, entry delay, and over-conservatism.

---

## DEC-011 — Fast path and research path coexist

Status: `DECIDED`

Decision:

Fast-moving market events may justify bounded scout participation before slow systematic research completes. Slow research improves longer-term evidence, strategy lifecycle, and sizing.

---

## DEC-012 — Paper and real share logic, not authority

Status: `DECIDED`

Decision:

Strategy/source/evidence logic may be portable from paper to real proposals. Paper intents/fills/positions never become real intents or authority.

---

## DEC-013 — Paper should continue alongside future real execution

Status: `DECIDED`

Decision:

When real trading eventually exists, paper should remain available as an ongoing calibration path for fill, slippage, latency, cost, and model-vs-real comparison.

---

## DEC-014 — Human psychology is market data

Status: `DECIDED`

Decision:

Fear, greed, attention, capitulation, FOMO, crowding, narrative rotation, and behavioral divergence may form a first-class evidence/strategy family.

Operator emotion does not receive execution authority.

---

## DEC-015 — Agent is a system, not one LLM

Status: `DECIDED`

Decision:

MetaEdge owns durable sensing, portfolio, risk, execution, reconciliation, and learning state. LLMs are replaceable reasoning/synthesis components.

---

## DEC-016 — Progressive agent maturity

Status: `DECIDED`

Decision:

Agent authority should progress from Observer → Adviser → Paper Agent → Supervised Real → Bounded Autonomous → Adaptive Portfolio Agent rather than using a single Autopilot toggle.

---

## DEC-017 — External architecture archaeology before freeze

Status: `DECIDED`

Decision:

Review mature trading frameworks, copy systems, Colosseum/agent projects, and current MetaMask authority primitives before freezing the final architecture.

---

# Open decisions

## OPEN-001 — V1 market scope

Candidate options:

- crypto spot only;
- crypto spot + paper perps.

Recommendation pending journey/research review.

## OPEN-002 — V1 discovery surface order

Which should ship first:

- markets;
- wallets;
- traders;
- strategies;
- agents.

## OPEN-003 — Arena timing

V1 vs Phase 2.

## OPEN-004 — Exploration sizing

Exact `R` definitions, scout size, portfolio exploration budget, and scaling rules.

## OPEN-005 — Evidence taxonomy

Exact canonical evidence families and how evidence profiles are represented without recreating a hidden scalar confidence gate.

## OPEN-006 — Portfolio view aggregation

How conflicting views combine: deterministic rules, optimizer, voting, budgeted specialist sleeves, or hybrid approach.

## OPEN-007 — Source reputation methodology

How wallet/trader/strategy/agent quality is evaluated without raw-PnL bias or false completeness assumptions.

## OPEN-008 — MetaMask future authority primitive

Exact future architecture for supervised and bounded autonomous execution after current official capability review.
