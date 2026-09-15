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

## DEC-018 — MetaMask is an execution/authority adapter, not product authority

Status: `DECIDED`

Decision:

MetaEdge defines a vendor-neutral Real execution/authorization contract above MetaMask. Agent Wallet, Smart Accounts/Advanced Permissions, delegations, or future wallet systems are adapters that implement or further restrict that contract.

---

## DEC-019 — Pending wallet work is first-class; do not retry ambiguity

Status: `DECIDED`

Decision:

Future Real execution must model asynchronous wallet states including pending requests and `AWAITING_MFA`. A request with ambiguous outcome must be reconciled before another financially equivalent submission is permitted.

---

## DEC-020 — MetaMask Guard is defense-in-depth, not the trading risk engine

Status: `DECIDED`

Decision:

Use wallet policy/security controls wherever available, but MetaEdge retains canonical account/portfolio/strategy risk.

---

## DEC-021 — Agent Wallet native plugins are optional adapters, not core architecture

Status: `DECIDED`

Decision:

Do not make the relaunch depend on Agent Wallet native plugins. AI-host skills/plugins are a separate interaction layer and do not receive financial authority merely by being installed.

---

## DEC-022 — EvidenceProfile replaces universal confidence

Status: `DECIDED`

Decision:

Represent market/source evidence as a multidimensional `EvidenceProfile` with separate families, contradictions, unknowns, freshness, reliability, coverage and invalidators.

No universal aggregate confidence score is permitted to become the primary execution gate.

---

## DEC-023 — V1 portfolio aggregation starts deterministic and sleeve-based

Status: `DECIDED`

Decision:

Use a deterministic budgeted-sleeve aggregation model as the initial architecture candidate: normalize each producer to its sleeve, account for duplicate/correlated lineage, net signed contributions, then apply account-level risk constraints.

Consequence:

Opaque optimization and majority voting are deferred until replay/simulation shows they add value.

---

## DEC-024 — Source reputation is a profile, not a universal score

Status: `DECIDED`

Decision:

Evaluate wallets/traders/strategies/agents through decomposable dimensions such as coverage, tenure, realized performance, drawdown, leverage, concentration, consistency, copyability, transparency and regime dependence.

Any ranking must declare the objective being optimized.

---

## DEC-025 — Position truth is derived from reconciled execution evidence

Status: `DECIDED`

Decision:

`Position` is derived canonical state from reconciled fills/events. A mutable position row is not sufficient execution truth by itself.

---

## DEC-026 — Authority narrows monotonically toward execution

Status: `DECIDED`

Decision:

Human-approved scope may be narrowed by portfolio, risk, execution adapter and wallet/venue policy, but no downstream layer may expand authority beyond what the upstream layer allowed.

---

## DEC-027 — Future real execution separates grant, intent and operation

Status: `DECIDED`

Decision:

Model future real execution with separate `ExecutionGrant`, `RealTradeIntent`, `RealExecutionPlan` and `ExecutionOperation` concepts.

Consequence:

Paper execution can remain portable at the strategy/view layer without sharing mutable authority/state with real execution.

---

## DEC-028 — Duplicate lineage must not masquerade as independent confirmation

Status: `DECIDED`

Decision:

Portfolio/evidence systems must preserve source/evidence lineage so multiple views derived from the same underlying event/source are not automatically treated as independent corroboration.

---

# Open decisions

## OPEN-001 — V1 market scope

- crypto spot only;
- crypto spot + paper perps.

## OPEN-002 — V1 discovery surface order

Markets, wallets, traders, strategies, agents — exact launch order remains open.

## OPEN-003 — Arena timing

V1 vs Phase 2.

## OPEN-004 — Exploration sizing

Exact `R` definitions, scout size, portfolio exploration budget and scaling rules.

## OPEN-005 — EvidenceProfile field semantics

The families are drafted. Strategy-specific mappings from evidence profile → requested exposure still require examples/replay testing.

## OPEN-006 — Final portfolio aggregation formula

Deterministic sleeve/netting is the default candidate. Exact normalization, duplicate caps, correlation handling and later optimizer comparison require replay/simulation.

## OPEN-007 — Source reputation presentation

Which objective-specific ranks/filters ship first and how incompleteness warnings appear in UX.

## OPEN-008 — MetaMask future authority substrate

Candidate implementations include Agent Wallet server-wallet + Guard, Smart Account Advanced Permissions, direct delegation, or multiple adapters.

## OPEN-009 — MetaEdge native Agent Wallet plugin

Current recommendation: not required for V1; investigate later.
