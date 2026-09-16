# Journey Registry

Status: **P4 ACTIVE REVIEW — canonical journey status registry, no Golden journeys yet**

Updated: 2026-09-16

## Purpose

Translate the approved P1–P3 product foundation into coherent operator journeys, connections, entry/exit paths and approval states before UX laws, information architecture, detailed screen journeys or technical derivation.

Approved upstream authority:

- `V1_PRODUCT_WEDGE.md`
- `USER_JOBS.md`
- `MASTER_EXPERIENCE_LOOP.md`
- `DECISION_LOG.md`

## Approved master experience that journeys must serve

### Operator control / trust loop

**Delegate → Bound → Launch → Supervise / Intervene → Review → Evolve → Repeat**

### Agent operating loop

**Sense → Understand → Decide → Act → Manage → Reconcile → Learn → Repeat**

The journey registry must connect these loops without making every agent-loop step a separate page or forcing the human into every cycle.

## Status model

```text
INVENTORY
  ↓
DRAFT
  ↓
PRODUCT_REVIEW
  ↓
UX_BREAKER
  ↓
APPROVED
  ↓
GOLDEN
  ↓
SUPERSEDED (if later replaced)
```

Definitions:

- **INVENTORY** — we know this journey/job exists; current notes may contain useful requirements.
- **DRAFT** — rewritten from the operator's point of view using `JOURNEY_TEMPLATE.md`.
- **PRODUCT_REVIEW** — coherent enough for human review; open decisions clearly marked.
- **UX_BREAKER** — actively challenged against UX laws, edge states and adjacent journeys.
- **APPROVED** — human-approved content after breaker fixes.
- **GOLDEN** — approved, connected, fingerprinted product truth from which technical derivation may proceed.
- **SUPERSEDED** — retained for history but no longer active.

No journey currently has `GOLDEN` status.

---

# P4 journey-partition problem

The old J01–J14 set was drafted before the product was locked around wallet-capable trading agents.

P4 must now answer:

1. What journeys does the **operator** actually experience?
2. Which parts of the fast **agent operating loop** are behavior inside those journeys rather than journeys of their own?
3. What is the first-session path from “I arrived” to “my agent is operating under understood guardrails”?
4. What is the returning-user path when one or more agents are already running?
5. How do material decisions/exceptions pull the operator back into the loop?
6. How does intervention work without breaking continuity?
7. How does review change trust/authority and restart the loop?
8. Where do source discovery, strategy adaptation, backtest/shadow and agent improvement belong as supporting branches?

Do not answer these from the old file split or backend objects.

---

# Candidate journey clusters for P4 review

These are **working clusters, not approved journey IDs**.

## Cluster A — Put an agent to work

Covers the operator's path from intent to a running agent:

```text
arrive / choose starting point
→ understand/select agent
→ define mission
→ assign paper wallet/capital
→ set market/risk/authority guardrails
→ review what the agent can/cannot do
→ launch
```

Open partition question:

- Is this one coherent setup/launch journey, or should “choose/delegate” and “bound/launch” be separate journeys?

## Cluster B — Supervise a running agent

Covers normal returning use when the agent is operating:

```text
see agent health/state
→ see current exposure / wallet-capital state
→ see recent material decisions
→ see exceptions / attention needed
→ understand what is being watched next
```

This is **observability, not babysitting**.

Open question:

- What belongs on the primary operator surface versus drill-down?

## Cluster C — Understand a material decision / event

Triggered when something deserves operator attention:

```text
material event / trade / risk change / degradation
→ what changed?
→ what did the agent decide/do?
→ why was the risk/reward justified?
→ what conflicts/unknowns matter?
→ what happens next?
→ no action / supervise / intervene
```

This may absorb parts of legacy “Discover” and “Investigate” without turning the operator into the discovery engine.

## Cluster D — Intervene / take control

Covers deliberate human control:

```text
inspect situation
→ pause / stop / tighten / change scope
→ intentionally handle existing exposure
→ confirm resulting agent state
→ resume / remain paused / retire
```

Critical open question:

- What happens to existing positions under pause/stop? “Stop new action,” “continue management,” “flatten,” and “operator chooses” are financially different.

## Cluster E — Review competence

Covers event-level and broader trust review:

```text
reconstruct what was known at decision time
→ compare reasoning, risk/reward, action, management, preservation, exit and outcome
→ distinguish good loss / bad win / good abstention / missed opportunity
→ judge pattern over a meaningful sample
```

Open questions:

- immediate/event review vs periodic review;
- how much explanation is default versus drill-down;
- how competence is summarized without one opaque score.

## Cluster F — Evolve agent / authority

Covers what happens after review:

```text
keep unchanged
or tighten
or widen
or change mandate/configuration
or run more paper evidence
or pause/retire
or later consider real authority
→ explicit new operating context
→ relaunch/continue
```

Agent creation/improvement timing remains open. P4 must determine whether “build/create agent” belongs in first-session V1 or as a later/supporting loop.

## Supporting branch — Research/source/strategy inputs

Potential supporting paths:

- inspect wallet/trader/source intelligence;
- compare sources/strategies/agents;
- express a trading thesis;
- import/adapt a source or strategy;
- backtest/shadow before paper autonomy;
- feed useful source intelligence into an existing agent.

These are not separate V1 products by default. They must earn a journey home by supporting the competent-agent wedge.

---

# Legacy J01–J14 inventory

The following files remain source material only. Their IDs and boundaries are **not canonical**.

| Legacy ID | Working name | Useful requirement signal | Current status |
|---|---|---|---|
| J01 | Enter / Onboarding | safe entry, identity, first-use orientation | INVENTORY |
| J02 | Discover | attention/opportunity discovery | INVENTORY |
| J03 | Investigate Source / Opportunity | understand facts, inference, unknowns | INVENTORY |
| J04 | Follow Source | persistent source relationship / updates | INVENTORY |
| J05 | Create / Copy Strategy | turn idea/source into testable behavior | INVENTORY |
| J06 | Backtest | historical testing with honest assumptions | INVENTORY |
| J07 | Shadow | counterfactual test without paper exposure | INVENTORY |
| J08 | Paper Portfolio / Policy | paper capital and bounds | INVENTORY |
| J09 | Paper Try / Trade | bounded paper participation | INVENTORY |
| J10 | Paper Copy | follower-specific source transformation | INVENTORY |
| J11 | Manage Position | continuous management after entry | INVENTORY |
| J12 | Review & Learn | decision quality versus outcome | INVENTORY |
| J13 | Improve / Pause / Retire | lifecycle / version / stop behavior | INVENTORY |
| J14 | Paper Agent Operation | bounded autonomous paper operation | INVENTORY |

P4 may merge, split, rename, defer or replace these concepts.

---

# First complete Golden-journey candidate — P4 hypothesis

The first end-to-end candidate should probably prove the wedge itself:

```text
operator chooses/understands a starter agent
→ delegates a mission
→ assigns paper capital + guardrails
→ launches
→ agent operates autonomously
→ operator sees one or more material decisions
→ agent manages resulting exposure
→ operator can intervene if needed
→ operator reviews competence
→ decides whether to keep/tighten/widen/change authority
```

This is **not yet approved as one journey or a final journey sequence**. P4 must decide how to partition it into human-comprehensible journeys.

---

# Connection requirements

Before any journey becomes Golden it must declare:

- valid entry points;
- actor(s): operator, agent, or both;
- previous journey/state;
- next journeys/actions;
- cancellation/dismiss path;
- return path;
- back/refresh/restart behavior where relevant;
- what persists after the operator leaves;
- what the agent continues doing while the operator is absent;
- what conditions pull the operator back into the journey;
- what authority/mode is active;
- what happens if the operator intervenes;
- paper vs future-real status.

## Registry rules

1. A journey cannot become Golden with unresolved critical UX questions.
2. A Golden journey cannot point to a missing/nonexistent next journey.
3. Technical implementation cannot invent a new user-visible transition that bypasses the registry.
4. Research may propose new journeys but cannot silently add them as canonical.
5. A Golden change requires a decision-log entry and re-run of relevant UX breaker checks.
6. Fast agent-loop steps do not automatically become screens or user journeys.
7. Legacy journey IDs do not have preservation rights.
8. Every approved P1/P2 job must eventually map to at least one journey.

# P4 exit criterion

P4 is approved when the human owner agrees on:

- the journey inventory and boundaries;
- which legacy journeys survive/merge/defer;
- the first-session operator path;
- the returning/running-agent path;
- material-decision and intervention re-entry paths;
- review → authority-evolution path;
- the first complete Golden-journey candidate;
- a connection map with no critical dead ends;
- a journey home for every primary approved job.

Only then activate P5 UX Laws / Design Principles.
