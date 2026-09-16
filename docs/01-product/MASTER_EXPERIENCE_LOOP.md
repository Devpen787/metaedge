# Master Experience Loop

Status: **P3 APPROVED — product authority**

Approved: 2026-09-16

P1 and P2 are approved. This document defines the repeatable experience between the **human operator** and the **wallet-capable trading agent**.

This is a product/UX loop, not a backend state machine.

## Core idea

MetaEdge should feel like operating a capable trading agent, not like manually trading through an AI interface.

There are two connected loops running at different speeds:

### Operator control / trust loop — slower

```text
DELEGATE
  ↓
BOUND
  ↓
LAUNCH
  ↓
SUPERVISE / INTERVENE AS NEEDED
  ↓
REVIEW
  ↓
EVOLVE AUTHORITY / AGENT
  ↺
```

### Agent operating loop — fast

```text
SENSE
  ↓
UNDERSTAND
  ↓
DECIDE
  ↓
ACT
  ↓
MANAGE
  ↓
RECONCILE
  ↓
LEARN
  ↺
```

The product's job is to connect these loops without forcing the human into every agent cycle and without allowing the agent to escape human-defined authority.

---

# 1 — Delegate

The operator decides what job the agent is being hired to do.

Operator questions:

- What is this agent for?
- What kind of opportunities should it care about?
- What is its objective?
- What markets/source types matter?
- What kind of behavior do I expect from it?

V1 should optimize for getting a capable agent to work quickly rather than requiring the operator to engineer a full strategy stack before seeing value. Exact starter-agent versus create/adapt entry mechanics remain a later journey decision.

Success state:

> “I understand what this agent is supposed to do.”

---

# 2 — Bound

The operator gives the agent money/authority boundaries before it operates.

Operator questions:

- Which paper wallet / capital pool does it control?
- How much capital may it use?
- Which markets/instruments are allowed?
- What risk boundaries apply?
- What may it do without asking me?
- What conditions require notification or explicit action?
- How do I pause/stop/revoke it?

The product should summarize the envelope in human terms before launch.

Success state:

> “I know exactly what this agent can and cannot do with this capital.”

---

# 3 — Launch

The operator deliberately puts the agent to work.

The launch moment should make clear:

- agent identity;
- mission;
- paper wallet/capital;
- allowed scope;
- guardrails;
- autonomy level;
- what the operator will be notified about;
- paper vs real status.

After launch, ordinary in-envelope paper decisions should not require repeated approval.

Success state:

> “It is working now, and I know the boundaries.”

---

# 4 — Operate

The agent performs the heavy lifting continuously.

Its inner loop is:

```text
sense relevant markets/sources
→ understand material change
→ decide under uncertainty
→ act when warranted and permitted
→ manage existing exposure
→ reconcile operational truth
→ learn from outcomes/misses
→ repeat
```

The operator should not experience this as a stream of internal machinery.

What matters to the operator is:

- Is it running?
- What is it watching?
- What exposure exists?
- Has something material changed?
- Did it recently act / reduce / exit / deliberately stay flat?
- Is anything degraded or outside expectations?

Success state:

> “The agent is doing the job without me babysitting it.”

---

# 5 — Surface what deserves human attention

The agent/product should earn the operator's attention rather than constantly demand it.

Approved conceptual model:

```text
ordinary in-envelope action
→ act + record

material decision / unusual risk / degraded capability
→ surface / notify

outside authority / authority expansion / later real-money escalation
→ explicit human action under the authority model then in force
```

A material decision should be explainable concisely:

- what changed;
- what the agent decided;
- what it did;
- why the action/risk was justified;
- what conflicts/unknowns matter;
- what it is watching next.

Success state:

> “When MetaEdge asks for my attention, there is a reason.”

---

# 6 — Intervene when needed

Human-in-the-loop becomes concrete here.

The operator can:

- inspect the situation;
- pause new action;
- stop the agent;
- tighten guardrails;
- later widen guardrails deliberately;
- change future mandate/policy;
- deal with open exposure intentionally;
- resume or retire.

Intervention is a branch of the operating loop, not the normal path for every trade.

The UX must make clear what happens to existing positions when the operator pauses or stops an agent. Exact pause/stop exposure semantics remain a later journey/UX-law decision because “stop new actions,” “continue managing,” and “flatten” are financially different actions.

Success state:

> “I can take control immediately without breaking the system or losing context.”

---

# 7 — Review competence

Review is not just a PnL screen.

The operator should be able to ask:

- Was the reasoning sound with what was known at the time?
- Did the agent act in time?
- Did it take appropriate risk for the possible reward?
- Did it miss justified opportunities because it was too timid?
- Did it preserve capital when the situation deteriorated?
- Did it recognize when it was wrong?
- Did it reduce/exit well?
- Did it manage winners effectively?
- Did execution quality materially affect the result?
- Did it follow the mandate and guardrails?
- Is the observed outcome representative or just one trade?

Review must support these truths:

- a losing trade may still be a good decision;
- a profitable trade may still be reckless;
- preserving capital may be success;
- failing to take justified bounded risk may be a process failure.

Success state:

> “I can tell whether this agent behaved competently, not merely whether the number is green.”

---

# 8 — Evolve trust and authority

Review should lead to a deliberate next state.

Possible outcomes:

```text
keep authority unchanged
narrow guardrails
widen guardrails
change mandate / configuration
run more paper evidence
pause
retire
later consider real authority
```

Authority should not increase merely because the last trade won.

A change creates a new explicit operating context/version rather than rewriting what the agent previously did.

Then the loop returns to **Delegate/Bound/Launch** as needed, or the agent continues operating under unchanged authority.

Success state:

> “Trust changes because the evidence changed.”

---

# Three product timescales

The UX should respect three different speeds.

## Fast — market/agent time

Seconds/minutes/hours:

- sensing;
- decision;
- trade execution;
- active management;
- risk changes.

The human should not be required to keep up with every event.

## Medium — operator supervision time

Minutes/hours/days:

- material alerts;
- intervention;
- understanding current state;
- checking open positions and agent health.

## Slow — trust/evolution time

Days/weeks/many decisions:

- competence review;
- strategy/agent changes;
- guardrail changes;
- authority progression;
- retirement/promotion.

The product must not evaluate long-term agent trust from one fast-loop outcome.

---

# Approved master loop

```text
OPERATOR
Delegate → Bound → Launch
                  ↓
AGENT
Sense → Understand → Decide → Act → Manage → Reconcile → Learn ↺
                  ↕
OPERATOR
Supervise ← Material decisions / exceptions
    ↓                 ↑
Intervene when needed ┘
    ↓
Review competence
    ↓
Keep / Tighten / Widen / Change / Pause / Retire
    ↺
```

Short form:

> **Delegate → Bound → Launch → Operate → Supervise/Intervene → Review → Evolve → Repeat**

## Approved interpretation

- **Delegate** defines the job.
- **Bound** defines money, scope, risk and authority.
- **Launch** deliberately puts the agent on duty.
- **Operate** means the agent does the heavy lifting without turning the operator into its approval loop.
- **Supervise** provides observability, not babysitting.
- **Intervene** preserves immediate human control.
- **Review** judges reasoning, risk/reward, capital preservation, management, timing, exits, execution and outcomes rather than PnL alone.
- **Evolve** changes trust/authority deliberately and progressively.

Human-in-the-loop means the human remains the authority owner and can change or revoke guardrails; it does not mean manual approval of every ordinary in-envelope action.

---

# What P3 intentionally does not decide

P3 does not define:

- exact screens/navigation;
- exact journey partition;
- whether Delegate and Bound are one screen/flow or separate UX moments;
- exact default home surface;
- exact market scope;
- exact alert thresholds/channels;
- exact review cadence/presentation;
- exact competence score/metrics;
- exact risk numbers;
- exact pause/stop handling of existing exposure;
- technical state machines;
- real-wallet implementation;
- strategy logic.

These remain later-gate work and must not be silently resolved from architecture convenience.

## P3 exit result

**APPROVED.** P4 Journey Registry is the next active gate. P4 must partition this approved two-loop model into coherent user journeys, connections and entry/exit paths without reverting to the legacy J01–J14 structure merely because those files already exist.
