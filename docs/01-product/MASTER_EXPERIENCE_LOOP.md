# Master Experience Loop

Status: **P3 ACTIVE REVIEW — current product gate**

Updated: 2026-09-16

P1 and P2 are approved. This document now defines the candidate repeatable experience between the **human operator** and the **wallet-capable trading agent**.

This is a product/UX loop, not a backend state machine.

## Core idea

MetaEdge should feel like operating a capable trading agent, not like manually trading through an AI interface.

There are two connected loops running at different speeds:

### Operator control loop — slower

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

Working V1 bias:

The first experience should probably start from a strong **MetaEdge starter agent** rather than forcing the operator to engineer a strategy/agent from scratch.

The operator may later adapt/create agents, but this remains an open timing decision.

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

The UX must make clear what happens to existing positions when the operator pauses or stops an agent.

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

The UX should respect three different speeds:

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

This separation is important: the product should not evaluate long-term agent trust from one fast-loop outcome.

---

# Master loop candidate

The working P3 expression is:

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

---

# What P3 intentionally does not decide

P3 does not yet define:

- exact screens/navigation;
- exact journey partition;
- exact market scope;
- exact alert thresholds/channels;
- exact competence score/metrics;
- exact risk numbers;
- technical state machines;
- real-wallet implementation;
- strategy logic.

Those remain later-gate work.

---

# P3 questions for human review

Before activating P4 Journey Registry, confirm or revise:

1. Does **Delegate → Bound → Launch → Operate → Supervise/Intervene → Review → Evolve** match how you imagine using MetaEdge?
2. Should **Delegate** and **Bound** feel like one setup flow or two clearly distinct moments?
3. After launch, should the default home experience center first on **agents** (who is working / health / exposure / attention needed) rather than a market dashboard?
4. Is review mainly periodic, event-triggered, or both? Working recommendation: **both** — immediate post-material-event review plus broader performance/discipline review over time.
5. When an agent is stopped, should “stop” mean **stop new actions but continue managing existing exposure**, **flatten exposure**, or should the operator explicitly choose? Working recommendation: the operator must explicitly choose because those actions are financially different.

## P3 exit criterion

P3 becomes approved when the human owner agrees on:

- the two connected loops;
- the end-to-end operator loop;
- how autonomous operation reconnects to human attention;
- the role of intervention;
- review → authority evolution;
- the loop's main entry/restart points.

Only then activate P4 Journey Registry.
