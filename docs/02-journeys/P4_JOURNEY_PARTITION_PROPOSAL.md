# P4 Journey Partition Proposal

Status: **P4 PROPOSAL — not approved product authority**

Updated: 2026-09-16

## Purpose

Turn the approved P1–P3 foundation into a small, coherent set of operator journeys before UX laws, information architecture, screen design or technical derivation.

Upstream authority:

- `V1_PRODUCT_WEDGE.md`
- `USER_JOBS.md`
- `MASTER_EXPERIENCE_LOOP.md`
- `DECISION_LOG.md`

Approved operator/trust loop:

**Delegate → Bound → Launch → Supervise / Intervene → Review → Evolve → Repeat**

Approved agent operating loop:

**Sense → Understand → Decide → Act → Manage → Reconcile → Learn → Repeat**

The agent loop is behavior. It should not automatically become seven operator journeys or seven product surfaces.

---

# Recommended core journey partition

## ME-J01 — Put an Agent to Work

### Operator job

> “I want this agent working for me. Help me give it a clear job, capital and boundaries, understand what it can do, and put it on duty.”

### Starts when

- the operator has no suitable running agent for the job; or
- the operator intentionally starts a new operating context after creating/adapting/changing an agent.

### Includes

```text
arrive / choose starting point
→ understand/select agent
→ define mission
→ choose permitted market scope
→ assign paper wallet / capital
→ define adjustable risk + authority guardrails
→ define operator-attention expectations
→ review “what this agent can / cannot do”
→ launch deliberately
→ verify RUNNING state
```

### Ends when

The operator can truthfully say:

> “This agent is now working, I know its job, I know what capital it controls, and I understand the boundaries.”

### Recommendation

Treat **Delegate + Bound + Launch as one coherent journey with internal phases**, not three separate journeys.

Reason: the user's mental job is “put this agent to work safely.” Splitting the setup into separate journey IDs adds product/process fragmentation without creating a separate user outcome.

### Legacy material absorbed

- J01 Enter / Onboarding
- parts of J08 Paper Portfolio / Policy
- parts of J14 Paper Agent Operation
- selected J05 create/adapt concepts only when needed for setup

### Critical open questions

- starter agent versus create/import/adapt entry;
- exact V1 market scope;
- how many guardrails are essential before launch versus advanced;
- whether the operator can launch immediately into paper operation or needs an optional pre-launch test step.

---

## ME-J02 — Supervise Running Agents

### Operator job

> “Show me whether my agents are healthy, what they are doing with my capital, and whether anything deserves my attention — without making me babysit them.”

### Starts when

- the operator returns while one or more agents are running;
- ME-J01 finishes;
- the operator returns from a material-decision, intervention or review branch.

### Includes

```text
see which agents are running / paused / degraded
→ understand paper wallet / capital and current exposure
→ understand whether agents recently acted or stayed flat
→ see material decisions / exceptions / attention needed
→ understand what each agent is broadly monitoring next
→ choose whether to inspect, intervene, review, or leave it running
```

### Ends when

Usually it does not “complete” like a form. It is the normal returning operating state.

The operator may leave MetaEdge while agents continue operating.

### Important distinction

This is **observability**, not a live stream of every agent thought/tool call.

### Legacy material absorbed

- parts of J14 Paper Agent Operation
- parts of J11 Manage Position
- relevant dashboard/agent-status ideas from historical UI, but no old screen is preserved by default

### Critical open questions

- one-agent-first versus multi-agent supervision emphasis in V1;
- what is summary versus drill-down;
- how to show “deliberately stayed flat” versus “agent silently froze”;
- whether the primary returning entry is agent-centered (recommended) or something else; IA decision later.

---

## ME-J03 — Understand a Material Agent Decision

### Operator job

> “Something important happened. Tell me what changed, what my agent decided, what it did, why that risk was justified, and what it expects next.”

### Starts when

- a material trade/action occurs;
- unusual risk or meaningful evidence change occurs;
- an agent reduces/exits/reverses materially;
- a capability/data/runtime degradation deserves attention;
- the operator drills into a recent material decision from ME-J02.

### Includes

```text
what changed?
→ what did the agent observe / infer / not know?
→ what did it decide?
→ what action / no-action did it take?
→ what risk/reward made that appropriate?
→ what existing exposure changed?
→ what is the agent watching next?
→ return to supervision OR intervene OR mark for later review
```

### Ends when

The operator can reconstruct the **material decision** without needing raw chain-of-thought or a long research report.

### Important distinction

This journey does not turn the operator into a per-action approver. It explains important agency after/in parallel with permitted action.

### Legacy material absorbed

- useful parts of J02 Discover
- useful parts of J03 Investigate
- decision explanation aspects of J09/J10/J11/J14

### Critical open questions

- materiality threshold / alert channels are later UX decisions;
- default explanation depth versus drill-down;
- whether event review and material-decision explanation are one journey or adjacent modes.

---

## ME-J04 — Intervene / Take Control

### Operator job

> “I need to change what this agent is allowed to do right now without losing control of existing exposure or historical context.”

### Starts when

- the operator disagrees with behavior;
- conditions outside the agent's model/mandate change;
- unusual risk or degradation deserves intervention;
- the operator voluntarily pauses/stops/tightens scope;
- the agent reaches an authority boundary requiring human action.

### Includes

```text
inspect current agent + exposure state
→ choose intervention
   pause new action
   stop agent
   tighten guardrails
   change permitted scope
   deliberately widen authority where allowed by current product phase
→ choose how existing exposure should be handled
→ confirm resulting state
→ remain paused / resume / continue supervision / retire
```

### Ends when

The operator knows:

- what the agent may now do;
- what happened to existing exposure;
- whether the agent is running, paused or stopped;
- what action is required next, if any.

### Critical open decision

**Pause/stop cannot have ambiguous financial meaning.**

Candidates:

1. stop new entries but continue protective management;
2. stop all autonomous actions but leave exposure unchanged;
3. flatten exposure;
4. operator explicitly chooses among financially distinct outcomes.

Current recommendation: **operator explicitly chooses**; detailed UX belongs later.

### Legacy material absorbed

- J13 Improve / Pause / Retire
- J11 Manage Position
- J14 Paper Agent Operation

---

## ME-J05 — Review Agent Competence

### Operator job

> “Did this agent actually behave well, or did it merely make/lose money?”

### Starts when

- the operator reviews one completed material episode/trade;
- enough decisions accumulate for periodic review;
- an intervention/problem triggers retrospective review;
- the operator is considering changing authority.

### Includes

```text
reconstruct what was known at the time
→ inspect reasoning quality
→ inspect opportunity capture / timeliness
→ inspect risk taken relative to potential reward
→ inspect capital preserved / downside avoided
→ inspect position management and exits
→ inspect execution effects
→ inspect missed opportunities / over-conservatism
→ inspect mandate/discipline adherence
→ inspect realized outcome
→ compare with broader sample where appropriate
→ form a trust judgment
```

### Must support

- good loss;
- reckless win;
- good abstention;
- missed justified opportunity;
- good capital preservation;
- strong opportunity capture with justified bounded risk.

### Ends when

The operator can say:

> “I understand whether this behavior deserves more, less or unchanged trust.”

### Review cadence proposal

One journey with two entry modes:

- **event review** — after a material episode;
- **period review** — across a meaningful sample.

Do not create two journey IDs unless later UX work proves the mental jobs diverge.

### Legacy material absorbed

- J12 Review & Learn
- missed-opportunity concepts from older decision work
- parts of J06/J07 only as supporting evidence

### Critical open questions

- default competence summary;
- meaningful sample definition;
- quantitative metrics / thresholds;
- review depth and comparison period.

---

## ME-J06 — Evolve the Agent / Authority

### Operator job

> “Based on what I have learned, decide what this agent should be allowed to do next and change it without rewriting its history.”

### Starts when

- ME-J05 produces a trust judgment;
- the operator proactively wants to change mandate/authority;
- repeated behavior suggests a configuration/strategy/source change;
- the operator wants to pause, retire, or later promote authority.

### Includes

```text
keep unchanged
OR tighten guardrails
OR widen guardrails
OR change mission / allowed universe / configuration
OR change source / strategy inputs
OR require more paper evidence
OR pause / retire
OR later consider real authority
→ review new operating context
→ continue or relaunch
```

### Ends when

The next operating context is explicit and historical behavior remains attributable to the prior context/version.

### Important distinction

Trust progression is not automatic promotion after profit. The operator remains authority owner.

### Legacy material absorbed

- J13 Improve / Pause / Retire
- J05 Create / Copy Strategy
- parts of J04 Follow, J06 Backtest and J07 Shadow when they support agent evolution

### Critical open questions

- when full agent creation becomes primary versus supporting;
- how backtest/shadow/source comparison enter this journey;
- future real-authority progression is later-phase design, not V1 implementation.

---

# Supporting journey branches — provisional

These are real jobs, but the current recommendation is **not** to make them the V1 spine.

## S1 — Research a Source / Market / Strategy Input

Purpose:

> Give an operator enough understanding to choose or improve an agent/input when deeper human research is useful.

May absorb legacy J02/J03/J04.

Likely entry points:

- from ME-J01 while choosing/configuring;
- from ME-J03 while drilling into evidence;
- from ME-J06 while evolving an agent.

## S2 — Validate an Agent / Strategy Before More Authority

Purpose:

> Run shadow/backtest/paper evidence when the operator wants additional proof before launch or before widening authority.

May absorb legacy J06/J07/J09/J10.

Likely entry points:

- optional branch from ME-J01;
- branch from ME-J06.

## S3 — Create / Adapt an Agent

Purpose:

> Build or substantially modify agent behavior when starter agents are insufficient.

May absorb legacy J05 and parts of J14.

Current bias:

- supporting / later-loop journey in V1;
- not required before the first “agent working for me” wow moment.

This remains open for human decision.

---

# Recommended connection map

```text
FIRST SESSION

ME-J01 Put Agent to Work
        │
        ├──── optional S1 Research input
        ├──── optional S2 Validate before launch
        └──── optional S3 Create/adapt agent
        │
        ▼
ME-J02 Supervise Running Agent(s)


RUNNING / RETURNING LOOP

ME-J02 Supervise
   │
   ├── material decision ──→ ME-J03 Understand Decision ──┐
   │                         │                             │
   │                         ├── no intervention ──────────┤
   │                         └── intervene ─→ ME-J04 ──────┤
   │                                                       │
   ├── direct intervention ───────────────→ ME-J04 ────────┤
   │                                                       │
   └── review ────────────────────────────→ ME-J05         │
                                                   │       │
                                                   ▼       │
                                           ME-J06 Evolve   │
                                            │   │   │      │
                                            │   │   └─→ pause/retire
                                            │   └─────→ S1/S2/S3
                                            └─────────→ ME-J01/ME-J02

All normal paths return to an explicit operating, paused, retired, or reconfiguration state.
```

---

# Why this partition is recommended

## 1. It follows operator mental jobs

The journeys are named around outcomes the operator is trying to achieve, not backend objects.

## 2. It preserves the agent as the actor doing the heavy lifting

Sense/Understand/Decide/Act/Manage/Reconcile/Learn are agent behaviors that surface through supervision, material decisions and review. They do not become mandatory human workflows.

## 3. It creates a clear first-session wedge

The first value path is simply:

> **Put an agent to work → see it operate competently.**

## 4. It gives returning use a stable center

Returning use begins with **Supervise Running Agents**, not mandatory rediscovery or setup.

## 5. It makes human-in-the-loop concrete

The human has explicit explanation, intervention, review and authority-evolution journeys without being forced into every agent action.

## 6. It keeps supporting research/build tools subordinate to the agent wedge

Source research, backtest/shadow and agent creation remain available where they help the operator hire, understand or improve an agent.

---

# P4 decisions needed from the human owner

Review these one at a time:

1. **ME-J01 partition:** approve “Put an Agent to Work” as one journey containing Delegate + Bound + Launch, or split it.
2. **Core set:** approve/revise the six core journeys.
3. **Returning path:** approve ME-J02 Supervise as the normal returning journey for running agents.
4. **Material decision path:** approve ME-J03 as a distinct journey rather than only a detail view inside supervision.
5. **Intervention path:** approve ME-J04 concept and later resolve stop/pause handling of open exposure.
6. **Review cadence:** approve one competence-review journey with event + periodic entry modes.
7. **Evolution:** approve ME-J06 as the authority/agent lifecycle decision journey.
8. **Supporting branches:** decide whether S1/S2/S3 stay supporting or any belong in the V1 spine.
9. **First Golden candidate:** choose which journey to detail first after later P5/P6 gates. Recommendation: **ME-J01 Put an Agent to Work**.

No item in this document becomes approved merely because it is recommended here.
