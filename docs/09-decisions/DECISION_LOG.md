# Decision Log

Status legend: `PROPOSED` · `RESEARCHING` · `DECIDED` · `SUPERSEDED` · `REJECTED`

This is the canonical decision ledger for the MetaEdge relaunch. Research does not become product authority until explicitly promoted here.

## Foundation decisions

### DEC-001 — Relaunch from a clean product-foundation branch
Status: `DECIDED`

Use `relaunch/product-foundation`, based on `codex/metaedge-v5-paper-checkpoint`, to define new product truth before implementation. Legacy code is evidence until individually adopted.

### DEC-002 — Product cycle
Status: `DECIDED`

Organize the product around **Discover → Understand → Test → Act → Manage → Learn → Scale**.

### DEC-003 — Edge sources are plural
Status: `DECIDED`

Edges may originate from markets, wallets, traders, strategies, agents, portfolios, cohorts, signal providers, behavior, catalysts or cross-market relationships.

### DEC-004 — Copying uses a shared CopySource abstraction
Status: `DECIDED`

Copying is transformation under follower-specific policy/risk, not blind cloning.

### DEC-005 — No scalar confidence execution gate
Status: `DECIDED`

Do not use one numerical confidence threshold as primary trade permission. Preserve uncertainty, blockers and progressive participation separately.

### DEC-006 — Risk bounds exposure; it does not own the thesis
Status: `DECIDED`

Strategy/opportunity logic proposes what it wants; risk determines what is permitted and how much may be risked.

### DEC-007 — Strategies propose target exposure, not direct orders
Status: `DECIDED`

Strategies/source loops emit desired exposure/views. Account coordination resolves conflicts and current positions before execution.

### DEC-008 — Many proposers, one portfolio authority, one execution authority
Status: `DECIDED`

Reasoning may be parallel; financial state mutation is coordinated through canonical authorities.

### DEC-009 — Explicit exploration capacity
Status: `DECIDED`

Paper portfolios need bounded capacity for weak-but-valid experiments so ordinary uncertainty does not force permanent inactivity. Exact sizing remains open.

### DEC-010 — No-trade is evaluated counterfactually
Status: `DECIDED`

Eligible skipped/under-participated opportunities remain reviewable so MetaEdge can distinguish good abstention from paralysis.

### DEC-011 — Fast path and research path coexist
Status: `DECIDED`

Bounded participation may occur before slow research completes when the active strategy/authority permits it.

### DEC-012 — Paper and real share logic, not authority
Status: `DECIDED`

Paper execution objects/state never become real execution authority/state.

### DEC-013 — Paper continues alongside future real execution
Status: `DECIDED`

Paper remains useful for calibration and expected-vs-actual comparison after real execution eventually exists.

### DEC-014 — Human psychology may be market data, not execution authority
Status: `DECIDED`

Behavioral/crowding evidence may inform strategy; operator emotion does not itself authorize execution.

### DEC-015 — An agent is a system, not one LLM
Status: `DECIDED`

Durable sensing, authority, portfolio, risk, execution, reconciliation and learning are MetaEdge responsibilities; LLMs are replaceable reasoning components.

### DEC-016 — Progressive agent maturity
Status: `DECIDED`

Authority progresses from Observer → Adviser → Paper Agent → Supervised Real → Bounded Autonomous → Adaptive Portfolio Agent rather than one Autopilot toggle.

### DEC-017 — External archaeology before technical freeze
Status: `DECIDED`

Mature trading/copy/agent systems and current wallet authority primitives are research inputs before architecture freeze.

### DEC-018 — MetaMask is an execution/authority adapter, not product authority
Status: `DECIDED`

MetaEdge owns vendor-neutral product contracts; wallet systems implement or further restrict them.

### DEC-019 — Ambiguous external execution reconciles before retry
Status: `DECIDED`

Pending/unknown/MFA states are first-class. Financially equivalent retries are blocked until ambiguity is reconciled.

### DEC-020 — Wallet security controls are defense-in-depth, not trading risk
Status: `DECIDED`

Use wallet controls where available, but MetaEdge retains account/portfolio/strategy risk authority.

### DEC-021 — Agent Wallet native plugins are optional adapters
Status: `DECIDED`

Do not make V1 depend on a native wallet plugin system.

### DEC-022 — Evidence remains multidimensional
Status: `DECIDED`

Contradictions, unknowns, freshness, reliability and coverage remain distinct. Exact technical schema is parked until P10.

### DEC-023 — Deterministic sleeve aggregation is a parked technical candidate
Status: `DECIDED`

It remains a technical hypothesis, not current product authority, until re-derived after Golden journeys.

### DEC-024 — Source reputation is decomposable, not a universal score
Status: `DECIDED`

Source quality/copyability depends on objective, regime, risk and data limitations.

### DEC-025 — Position truth derives from reconciled execution evidence
Status: `DECIDED`

An ungrounded mutable position row is insufficient financial truth.

### DEC-026 — Authority narrows monotonically toward execution
Status: `DECIDED`

Downstream layers may restrict but cannot expand human-approved authority.

### DEC-027 — Future real execution separates grant, intent and operation
Status: `DECIDED`

Authority grant, fresh trade intent, external operation and reconciliation remain distinct concepts.

### DEC-028 — Duplicate lineage is not independent confirmation
Status: `DECIDED`

Correlated/derived evidence and sources must not be naively multiplied.

## Product/UX operating decisions

### DEC-030 — Product/UX definition precedes technical derivation
Status: `DECIDED`

Use:

**Wedge → User/JTBD → Master Experience Loop → Journey Registry → UX Laws → Information Architecture → Detailed Journeys → UX Breaker → Golden Journeys → Technical Derivation → Migration → Build/QA.**

Technical drafts may inform feasibility but cannot dictate P1–P9 UX behavior.

### DEC-031 — Existing J01–J14 are inventory
Status: `DECIDED`

The old journey set is requirements/research input, not Golden product truth. Promotion requires UX rewrite, breaker review, connection validation and human approval.

### DEC-032 — Golden journeys gate technical freeze and implementation
Status: `DECIDED`

Relevant domain/state/architecture cannot become implementation authority before the journey it serves is Golden. Application implementation still requires explicit later approval.

### DEC-033 — Explicit product/UX operating loop
Status: `DECIDED`

Substantial work follows **Research/Evidence → Product/UX Spec → UX Breaker → Human Approval → Golden → Technical Derivation → Build → QA/Breaker**. One canonical product lane advances the phase at a time.

### DEC-034 — V1 wedge is the competent wallet-capable trading agent
Status: `DECIDED`
Approved: 2026-09-15

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

Initial human user: **active crypto trader / agent operator**.

Human defines mandate, capital/wallet, markets, risk, authority, supervision and intervention. Agent performs:

**sense → understand → decide → act → manage → reconcile → learn**.

V1 is paper-first, but wallet identity, capital and bounded authority are first-class concepts.

Approved wow moment:

> **“My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”**

Discovery, source intelligence, strategies, evidence, portfolio/risk, wallet integration and review support this wedge rather than becoming separate V1 products.

### DEC-035 — Approved decisions require durable repo capture
Status: `DECIDED`
Approved: 2026-09-16

Do not depend on chat memory for approved decisions. Follow `docs/10-ops/DECISION_CAPTURE.md` and synchronize the decision ledger, authoritative product artifact and control state when a decision changes direction or phase.

## P2 Human + Agent JTBD decisions

### DEC-036 — Human-in-the-loop uses adjustable guardrails, not per-action approval
Status: `DECIDED`
Approved: 2026-09-16

The human always remains the authority owner, but the product should increasingly automate through adjustable guardrails. The agent may execute actions/trades when its current authority permits them.

**Human-in-the-loop does not mean human-in-every-click.**

The operator must be able to understand, supervise, change guardrails, intervene, pause, revoke and decide whether authority should increase.

Consequence: ordinary in-envelope actions cannot depend on constant human confirmation merely to preserve the appearance of control.

### DEC-037 — Operator attention is state + material decisions + exceptions
Status: `DECIDED`
Approved: 2026-09-16

Conceptual attention model:

```text
ordinary in-envelope action
→ agent acts + records

material decision / unusual risk / degraded capability
→ surface / notify

outside authority / authority expansion / later real-money escalation
→ explicit human action under the authority model then in force
```

The operator should not be forced to consume every internal tick/tool call/reasoning trace.

Detailed thresholds/channels remain a later UX decision.

### DEC-038 — Agent competence and trade quality are multidimensional
Status: `DECIDED`
Approved: 2026-09-16

Agent trust must reflect more than PnL. Evaluation should include:

- soundness of reasoning at decision time;
- opportunity capture / willingness to act when reward justifies risk;
- risk taken relative to potential reward;
- capital preserved / downside avoided;
- position management after entry;
- recognition of deterioration;
- reduction/exit quality;
- discipline/process adherence;
- speed/timeliness;
- execution quality;
- missed opportunities / over-conservatism;
- realized outcomes across a meaningful sample.

A losing trade can still be a sound decision. A profitable trade can still be reckless. Preserving capital can be success. Failing to take justified bounded risk can be a process failure.

**Discipline does not mean conservatism.** Sometimes the correct action is to take meaningful bounded risk because the potential reward warrants it.

### DEC-039 — P2 Human + Agent Jobs-to-be-Done approved; P3 activated
Status: `DECIDED`
Approved: 2026-09-16

`docs/01-product/USER_JOBS.md` becomes product authority.

Core V1 job sequence:

**Delegate → Operate → Manage → Supervise → Intervene → Evaluate Trust**.

P3 `MASTER_EXPERIENCE_LOOP.md` is now the active gate. Exact agent-creation timing remains open and does not block P3.

## Open decisions

### OPEN-001 — V1 market scope
Crypto spot only vs spot + paper perps. Resolve from journey/product value, not old code coverage.

### OPEN-002 — Discovery surface order
Markets, wallets, traders, strategies, agents or blended. Resolve later from operator/agent experience.

### OPEN-003 — Arena timing
V1 vs Phase 2. Current bias: defer unless Golden journeys demonstrate a core need.

### OPEN-004 — Exploration sizing
Exact risk units, scout sizing, exploration budget and scaling rules. Deferred to technical derivation/replay.

### OPEN-005 — Evidence representation
Principle is decided; exact user-facing and technical representation waits for Golden journeys/P10.

### OPEN-006 — Final portfolio aggregation formula
Parked technical candidate. Revisit at P10.

### OPEN-007 — Source reputation presentation
Objective-specific ranks/filters and incompleteness UX remain open.

### OPEN-008 — Future wallet-authority substrate
Agent Wallet server wallet, Smart Account permissions, delegation or multiple adapters remain candidates. Not a current Product/UX decision.

### OPEN-009 — MetaEdge native Agent Wallet plugin
Not required for V1 unless a Golden journey later creates a clear need.

### OPEN-014 — Agent creation/improvement timing
Decide whether creating/improving agents belongs in the first-session Golden flow or a supporting/next-loop flow. Current bias: prove a strong starter-agent experience first.

### OPEN-015 — Notification thresholds and channels
DEC-037 fixes the attention principle, not exact alert thresholds, delivery channels or frequency.

### OPEN-016 — Competence metrics and authority-promotion thresholds
DEC-038 fixes what competence means conceptually. Exact quantitative metrics, sample requirements and promotion thresholds remain open until later UX/replay work.
