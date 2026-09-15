# Relaunch Migration Map

Status: **Draft migration plan — implementation not authorized**

## Purpose

Define how the relaunch can eventually move from approved product/domain contracts to a clean implementation without dragging old product authority into the new system.

This is a **sequence and seam plan**, not permission to build.

## Migration principle

> **Adopt verified mechanics behind new contracts; do not retrofit new product truth around legacy routes, tabs, or state objects.**

The old V5 branch is a quarry of proven mechanics and failure evidence.

The relaunch branch is the authority for what the product should become.

## Phase 0 — Freeze product/domain authority

Required before implementation:

- Product Constitution approved;
- Product Contract approved;
- J01–J14 journeys reviewed/frozen enough for V1;
- System/Strategy boundary approved;
- Domain Model approved;
- Authority Model approved;
- EvidenceProfile contract approved;
- Portfolio aggregation candidate approved for implementation/replay;
- Source reputation contract approved;
- Security invariants / temporal matrix approved;
- paper/real isolation approved.

Output: a reviewed contract set that a build branch can implement against.

## Phase 1 — Clean domain/schema foundation

Future implementation objective:

Create the new domain/state layer without migrating product UI first.

Candidate domains:

```text
Identity
Observations / Sources
Evidence
Strategy / Copy
Views
Portfolio / Risk
Paper Execution
Agent Sessions
Review / Reputation
Future Real Authority (types/state only; disabled)
```

Migration rule:

- old rows/objects remain read-only unless explicitly migrated;
- new objects use new canonical IDs and schemas;
- no old agent/order/UI identifier grants new authority;
- import jobs are explicit and idempotent.

## Phase 2 — Observation/evidence spine

Future implementation objective:

Adopt the strongest V5 market-data mechanics behind the new Observation contracts.

Likely reuse/adaptation:

- content-addressed observations;
- provider/venue/dataset provenance;
- observed vs received time;
- freshness/integrity validation;
- gap policy;
- cross-venue preservation.

Add new evidence families without forcing them into one universal market-data object.

Exit gate:

A deterministic fixture can produce immutable observations and an EvidenceProfile without any trading/execution dependency.

## Phase 3 — Canonical View / portfolio / risk pipeline

Future implementation objective:

Make all producers—manual, strategy, copy, agent—emit the same `View` contract.

Then implement:

```text
View(s)
→ ViewContribution(s)
→ PortfolioTarget
→ RiskDecision
```

No broker code in this phase.

Exit gates:

- opposing Views coexist;
- duplicate lineage is bounded;
- one canonical target per portfolio/instrument/version;
- zero target reasons remain explainable;
- risk can clip without mutating original Views;
- scenario stress tests can replay through target/risk stage.

## Phase 4 — Paper execution extraction

Future implementation objective:

Adapt the V5 durable intent/event/broker mechanics into the new paper execution domain.

Strong candidates to preserve:

- idempotent durable intent creation;
- append-only order lifecycle;
- next-observation fills;
- stale/integrity rejection;
- TIF;
- limit/stop semantics;
- spread/slippage/fees;
- liquidity participation and partial fills;
- duplicate fill protection;
- `UNRESOLVED` / restart reconciliation;
- commit ambiguity handling.

Required changes:

- input must be a permitted PortfolioTarget delta, not an arbitrary agent order;
- paper-specific routes/services only;
- canonical new domain IDs/schemas;
- policy constants versioned and replayable;
- tests prove no old paper identifier can be used for future real authority.

Exit gate:

S01–S18 stress scenarios can run end-to-end in deterministic paper fixtures.

## Phase 5 — Agent and copy integration

Future implementation objective:

Wire reasoning/source systems as **producers of Views**, never direct execution clients.

### Paper Agent

- AgentSession/Envelope durable;
- unattended operation inside envelope;
- runtime refuses outside scope;
- no per-tick human confirmation inside approved paper envelope;
- restart recovery does not mint new authority.

### Copy

- CopySource/Observation/CompletenessAssessment;
- CopyPolicy transforms source into follower-specific View;
- hidden-hedge/completeness warnings preserved;
- source cannot bypass portfolio/risk.

Exit gate:

Multiple agents/copy sources can operate concurrently without multiple execution authorities.

## Phase 6 — Review / learning / reputation

Future implementation objective:

Implement the feedback system after execution truth exists.

Includes:

- DecisionQuality vs OutcomeQuality;
- OutcomeAttribution;
- MissedOpportunityRecord;
- source performance windows;
- objective-specific source ranking/filtering;
- evidence usefulness analysis;
- paper broker assumption calibration.

Learning proposes new strategy/policy versions. It does not mutate live authority silently.

## Phase 7 — V1 UI built from journeys

Only now should the new product surfaces become canonical.

UI is derived from journeys/domain state, not copied from old tabs.

Candidate product surfaces:

```text
Discover
Source / market investigation
Follow / Shadow
Strategy Lab
Paper Portfolio
Paper Agent
Positions
Review / Learn
```

Old UI components may be mined for presentation code only if they naturally fit these journeys.

Do not rebuild legacy tabs merely to preserve sunk cost.

## Phase 8 — Legacy cutover

Future implementation objective:

For each legacy subsystem, choose explicitly:

- read-only archive;
- one-time data migration;
- compatibility adapter;
- deletion from new runtime;
- Phase-2 feature.

No dual writers.

At cutover, one system owns each mutable domain.

Recommended rule:

```text
legacy reader may exist
legacy writer = disabled
new writer = canonical
```

This preserves the useful V5 cutover idea without making `authorityVersion=5` the new product authority.

## Phase 9 — Future real-readiness branch, separately authorized

Real execution is not part of V1 build authorization by default.

Before any implementation:

- exact current MetaMask capability ledger revalidated;
- `ExecutionGrant` contract frozen;
- RealTradeIntent/Operation state machines approved;
- wallet/account/network binding defined;
- MFA/pending/unknown reconciliation tested;
- paper/real isolation property tests passing;
- adapter-specific security review complete;
- human approval of the real-money implementation phase.

Only then create a real-readiness implementation branch.

## Legacy component migration summary

| Component | Future action |
|---|---|
| V5 durable paper intents/events | Adapt behind new PaperOrderIntent contract |
| V5 paper broker | Adapt and calibrate |
| V5 market observations | Adapt strongly |
| V5 Postgres durability/revision patterns | Adapt |
| V5 authority cutover/read-only legacy pattern | Adapt concept |
| V5 auth hardening | Adapt selectively |
| V5 global `/api/audit` | Replace; negative regression test |
| V5 MetaMask command integration | Replace against current official Agent Wallet |
| V5 MetaMask paper/live semantic switching | Remove completely |
| V5 direct agent/copilot trade routes | Replace with View pipeline |
| Research/flywheel machinery | Needs proof before selective adoption |
| Arena/social/gamification | Defer |
| Vault/pooling behavior | Outside V1 |
| Old UI navigation/tabs | Historical reference only |

## Migration proof rule

For every reused legacy module, a migration record should answer:

```text
OLD COMPONENT
NEW DOMAIN OWNER
WHY IT IS REUSED
WHAT CHANGED
WHAT AUTHORITY WAS REMOVED
WHAT TEST PROVES THE NEW CONTRACT
WHAT LEGACY STATE REMAINS READ-ONLY
```

If those questions cannot be answered, the module is not ready to migrate.

## Branch strategy after approval

Current:

```text
codex/metaedge-v5-paper-checkpoint
        ↓
relaunch/product-foundation   # docs/contracts/research only
```

After explicit implementation approval:

```text
relaunch/product-foundation
        ↓
relaunch/v1-build
```

Future real work should branch separately after paper V1 is stable and specifically approved.

## Current gate

**Do not create `relaunch/v1-build` merely because this migration plan exists.**

The next step is contract review + scenario/security validation, not implementation.