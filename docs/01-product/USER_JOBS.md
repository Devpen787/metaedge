# Human + Agent Jobs-to-be-Done

Status: **P2 ACTIVE REVIEW — current product gate**

Updated: 2026-09-15

P1 authority: `V1_PRODUCT_WEDGE.md` is approved. MetaEdge is centered on **wallet-capable trading agents that can trade fast, smart, and disciplined**, operated by an active crypto trader / agent operator.

## Why P2 is two-actor

MetaEdge is not a conventional trading application where the human performs every step.

There are two active actors:

1. **Human operator** — defines mandate, capital, risk, authority, supervision, intervention, and trust progression.
2. **Trading agent** — senses, reasons, acts, manages, reconciles, and learns inside that mandate.

The UX must serve the relationship between them.

If we design only the human journey, the agent becomes a feature. If we design only the agent runtime, the human loses control and trust. P2 must define both.

---

# Primary human JTBD

> **When I want markets monitored and opportunities acted on without being at the screen for every decision, let me give a trading agent a wallet/capital mandate and clear boundaries, so it can operate quickly and intelligently while I remain able to understand, supervise, constrain, and decide whether it deserves more trust.**

This is the primary P2 job hypothesis.

---

# Human operator jobs

## H1 — Delegate a clear mission

Operator thought:

> “I want this agent working for me, but I need to be clear about what it is trying to do and what it is allowed to touch.”

The operator needs to be able to:

- choose a starter agent or later adapt/create one;
- state the mission/objective in understandable terms;
- choose markets/instruments or a permitted universe;
- assign a paper wallet / capital pool;
- set risk and authority boundaries;
- understand what the agent may do without asking again;
- understand what remains outside its authority.

Success means the operator can launch the agent with a clear mental model of **mission + money + boundaries**.

Failure means setup feels like configuring infrastructure or exposes dozens of parameters before the operator understands the agent's purpose.

## H2 — Know whether the agent is actually doing its job

Operator thought:

> “I should not have to babysit it, but I need to know whether it is healthy, watching the right things, and acting when it should.”

The operator needs to know, at an appropriate level:

- what the agent is currently watching;
- whether it is healthy / degraded / paused / blocked;
- whether it currently has exposure;
- whether it recently acted or deliberately stayed flat;
- whether something needs the operator's attention.

Success means the operator can leave the agent running without uncertainty about whether it silently stopped, froze, or exceeded its remit.

This does **not** imply showing every internal tick, tool call, or reasoning trace.

## H3 — Understand material decisions without becoming the approval loop

Operator thought:

> “Tell me what mattered and why, but do not make me click approve every time the agent sees a normal opportunity.”

The operator needs concise, decision-relevant explanations of:

- what materially changed;
- what the agent decided;
- what it did or chose not to do;
- the main supporting/conflicting information;
- the relevant risk/uncertainty;
- what it is watching next.

Success means the operator can reconstruct the important logic without reading a research report for every action.

Ordinary in-envelope paper actions should not require per-action approval merely to preserve the appearance of control.

## H4 — Intervene immediately when needed

Operator thought:

> “If I disagree, circumstances change, or the agent behaves badly, I need a clear way to take control.”

The operator needs to be able to:

- pause new action;
- stop an agent;
- reduce/narrow authority;
- change future mandate/policy through an explicit revision;
- inspect open exposure;
- understand what stopping means for existing positions;
- later resume or retire deliberately.

Success means control is obvious and effective without rewriting historical actions.

## H5 — Judge whether the agent deserves trust

Operator thought:

> “Is this agent actually getting better and behaving well, or did it just make money?”

The operator needs review that separates:

- outcome/PnL;
- decision quality;
- discipline/process adherence;
- speed/timeliness;
- risk management;
- management after entry;
- missed opportunities / over-conservatism;
- execution quality;
- regime/source effects;
- violations or near-misses.

Success means the operator can make an evidence-based decision to:

- keep authority unchanged;
- widen it;
- narrow it;
- change the agent/strategy;
- pause;
- retire;
- later consider real authority.

## H6 — Improve the agent without rebuilding it from scratch

Operator thought:

> “I learned something. Help me improve the agent while preserving what happened before.”

The operator eventually needs to:

- change mandate or strategy configuration;
- add/remove data/source inputs;
- alter risk or allowed markets;
- compare versions;
- understand why a new version exists;
- preserve prior history for honest evaluation.

This is important to the loop but may be a supporting V1 job rather than a first-session job.

---

# Trading agent jobs

These are product jobs of the agent actor, not implementation architecture.

## A1 — Sense continuously

Agent job:

> “Watch the markets and sources relevant to my mandate and notice material changes in time to matter.”

Success means:

- the agent watches the right scope;
- important changes are not chronically discovered too late;
- degradation/missing inputs are recognized rather than silently treated as normal.

## A2 — Form a decision under uncertainty

Agent job:

> “Turn incomplete and sometimes conflicting information into an actionable view without pretending I know the future.”

Success means:

- uncertainty is explicit;
- fact, inference, and unknown are distinguishable;
- the agent can participate when uncertainty is ordinary and bounded;
- it can also stay flat for a real reason;
- it does not invent certainty to justify action.

## A3 — Act fast inside the mandate

Agent job:

> “When action is warranted and permitted, take it while the opportunity is still relevant.”

Success means:

- ordinary in-envelope paper action does not wait for fresh human approval;
- risk/integrity/authority rules are respected;
- speed does not bypass safeguards;
- being uncertain does not automatically mean being inactive.

## A4 — Manage continuously after entry

Agent job:

> “Once I have exposure, keep managing it as the market changes rather than treating entry as the end of my job.”

Success means the agent can appropriately:

- hold;
- add;
- reduce;
- take profit;
- exit;
- reverse where permitted;
- react to thesis invalidation or changing risk.

## A5 — Recover and reconcile safely

Agent job:

> “When external or execution state is ambiguous, determine what actually happened before I create duplicate risk.”

Success means:

- restart does not erase financial truth;
- partial/pending/unknown states do not cause blind retries;
- the agent can resume from reconciled state.

## A6 — Learn without becoming unstable

Agent job:

> “Use outcomes and missed opportunities to improve future behavior without overreacting to one win or loss.”

Success means:

- good losses and bad wins can be distinguished;
- recent outcomes do not create fear/euphoria-style drift;
- changes are explicit/versioned where they affect behavior;
- learning does not silently expand authority.

---

# Relationship jobs: operator ↔ agent

These are especially important because they define the product's trust model.

## R1 — Authority must be legible

At any moment the operator should be able to answer:

- What is this agent allowed to do?
- With which capital/wallet?
- In which markets?
- Within what risk limits?
- What requires me?
- What happens if I pause/stop it?

## R2 — Attention should be earned, not demanded

The agent should not interrupt the operator for every ordinary event.

Working attention model to validate later:

```text
ordinary in-envelope paper decision
→ agent acts + records

material change / unusual risk / degraded capability
→ notify / surface

outside authority / authority expansion / future real escalation
→ explicit human action
```

This is a P2/P5 hypothesis, not yet a detailed notification design.

## R3 — Competence must be observable

Trust should grow because the operator can see a pattern of:

- timely action;
- sensible restraint;
- disciplined risk;
- coherent management;
- safe recovery;
- honest explanations;
- learning from mistakes and misses.

Trust should not be represented only by PnL or a mysterious score.

## R4 — Paper vs real must never be ambiguous

The operator must always know whether the agent is:

- observing;
- simulating/shadowing;
- operating a paper wallet;
- proposing future real action;
- or, later, operating under real bounded authority.

No subtle badge or color change may be the only distinction.

---

# Supporting jobs, not separate products

These may support the primary jobs without becoming the center of V1:

- discover wallets/traders/sources worth feeding to an agent;
- compare strategies/agents;
- express a trading idea in natural language;
- import/adapt a strategy or source into an agent;
- backtest/shadow before enabling paper autonomy;
- inspect market/on-chain evidence;
- run several agents under coherent account-level supervision.

---

# Anti-jobs

MetaEdge V1 should **not** make the operator responsible for:

- approving every normal paper action;
- reading raw chain-of-thought or long research reports to know what happened;
- manually checking whether the agent runtime is alive;
- translating every signal into an order;
- remembering why a position was opened;
- reconciling ambiguous execution by hand as the normal path;
- noticing subtle cues to distinguish paper from real;
- configuring a professional quant stack before seeing value.

MetaEdge V1 should **not** make the agent:

- merely recommend trades it cannot execute in paper mode;
- wait indefinitely for certainty;
- silently widen its own mandate;
- equate recent PnL with permission to become more aggressive;
- hide inactivity behind “no trade” without an understandable reason;
- optimize only for trade frequency or PnL.

---

# P2 working priority

The current candidate primary V1 jobs are:

1. **H1 — Delegate a clear mission.**
2. **A1/A2/A3 — Sense, decide, and act inside the mandate.**
3. **A4 + H2/H3 — Manage autonomously while keeping the operator appropriately informed.**
4. **H4 — Let the operator intervene immediately.**
5. **H5 + A6 — Review competence and evolve trust.**

H6 and many supporting research/copy/backtest jobs may be necessary, but they should earn their place by supporting this core loop.

# P2 questions for human review

We should settle these before P3 Master Experience Loop becomes active:

### Q1 — Is the primary human job delegation or discovery?

Working recommendation: **delegation**.

The operator's central job is not “help me find trades.” It is “let me put a capable agent to work under rules I understand.” Discovery becomes part of the agent's job.

### Q2 — How much should the operator see while the agent is running?

Working recommendation: **state + material decisions + exceptions**, not a live stream of every internal action.

### Q3 — What deserves an interruption?

Working hypothesis:

- normal in-envelope action: no approval;
- material/unusual event: notify;
- authority boundary or future-real escalation: require human action.

### Q4 — What is the minimum evidence of competence before the operator trusts the agent?

We should define this in user terms before inventing reputation scores or technical metrics.

### Q5 — Is improving/creating agents a primary V1 job or a second-session/supporting job?

Working recommendation: **supporting/next-loop job**. First prove that the operator can successfully launch and supervise a strong starter agent.

# P2 exit criterion

P2 is approved when the human owner agrees on:

1. the primary human JTBD;
2. the core operator jobs;
3. the core trading-agent jobs;
4. which jobs are primary vs supporting in V1;
5. the operator attention/interruption principle at a conceptual level;
6. what the operator must be able to understand/control to trust the agent.

Only then promote P3 `MASTER_EXPERIENCE_LOOP.md` to active review.
