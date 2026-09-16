# Human + Agent Jobs-to-be-Done

Status: **P2 APPROVED — product authority**

Approved: 2026-09-16

P1 authority: `V1_PRODUCT_WEDGE.md` is approved. MetaEdge is centered on **wallet-capable trading agents that can trade fast, smart, and disciplined**, operated by an active crypto trader / agent operator.

## P2 decision

MetaEdge is a two-actor product:

1. **Human operator** — defines the mission, capital/wallet, risk, authority, supervision, intervention and trust progression.
2. **Trading agent** — does the heavy lifting: senses, reasons, acts, manages, reconciles and learns inside that mandate.

The human remains **in the loop**, but is not required to approve every ordinary action. Human-in-the-loop means the operator can understand, supervise, adjust guardrails, intervene, pause, revoke and decide whether authority should increase. The agent may execute trades when its current authority explicitly allows it.

---

# Approved primary human JTBD

> **When I want markets monitored and opportunities acted on without being at the screen for every decision, let me put a capable trading agent to work with a wallet/capital mandate and adjustable guardrails, so it can do the heavy lifting and execute when allowed while I remain able to understand, supervise, intervene and decide whether it deserves more authority.**

The operator's central job is **delegation and supervision**, not personally discovering and executing every trade. Discovery is primarily part of the agent's operating job.

---

# Approved human operator jobs

## H1 — Delegate a clear mission

The operator must be able to give an agent a clear mental model of:

- objective / mandate;
- wallet or paper capital;
- allowed markets/instruments;
- risk boundaries;
- autonomy / authority boundaries;
- what the agent may do without asking again;
- what remains outside its authority.

Success means the operator understands **mission + money + boundaries** without configuring a professional quant stack first.

## H2 — Supervise without babysitting

The operator should see:

- current agent state;
- whether the agent is healthy, degraded, paused or blocked;
- current exposure;
- important recent actions or deliberate non-action;
- material decisions and changes;
- exceptions/problems that need attention.

The product should not expose a firehose of every internal tick, tool call or chain-of-thought as the normal supervision model.

## H3 — Understand material decisions without becoming the approval loop

The operator should be able to understand, concisely:

- what materially changed;
- what the agent decided;
- what it did or chose not to do;
- the main supporting/conflicting information;
- the relevant risk and uncertainty;
- what it is watching next.

Ordinary in-envelope action may proceed without per-action approval.

## H4 — Intervene and adjust guardrails immediately

The operator must be able to:

- pause new action;
- stop an agent;
- narrow or later widen authority;
- change future mandate/risk policy explicitly;
- inspect open exposure;
- understand what stopping means for existing positions;
- resume or retire deliberately.

Human control must remain effective even as automation increases.

## H5 — Judge whether the agent deserves trust

The operator must be able to judge competence across more than PnL.

Trust should be informed by:

- soundness of reasoning at decision time;
- opportunity capture / willingness to act when reward justifies risk;
- risk taken relative to potential reward;
- capital preserved / downside avoided;
- position management after entry;
- ability to recognize when a trade is going wrong;
- quality and timeliness of reduction/exit;
- discipline/process adherence;
- execution quality;
- missed opportunities / over-conservatism;
- realized outcomes across a meaningful sample.

The operator may then keep, widen, narrow, pause, retire or later consider promoting authority.

## H6 — Improve the agent without erasing history

The operator eventually needs to evolve an agent while preserving honest evaluation of prior versions.

This includes changing mandate, strategy configuration, sources, risk or allowed markets and comparing versions.

**Timing remains open:** whether creation/improvement is a first-session job or a supporting/next-loop job will be decided later from the Golden journey.

---

# Approved trading-agent jobs

## A1 — Sense continuously

> Watch the markets and sources relevant to the mandate and notice material changes in time to matter.

The agent should not chronically discover opportunities too late, and should recognize degraded/missing inputs rather than silently treating them as normal.

## A2 — Form decisions under uncertainty

> Turn incomplete and sometimes conflicting information into an actionable view without pretending to know the future.

The agent must distinguish fact, inference and unknowns; participate when uncertainty is ordinary and bounded; stay flat when there is a real reason; and avoid inventing certainty.

## A3 — Act fast inside the mandate

> When action is warranted and permitted, act while the opportunity is still relevant.

Normal in-envelope action does not need fresh human approval. Speed may not bypass risk, authority, integrity or reconciliation.

## A4 — Manage continuously after entry

> Once exposure exists, keep managing it as conditions change.

The agent must be able to hold, add, reduce, take profit, exit or reverse where permitted. Entry is not the end of its job.

## A5 — Protect capital and get out when wrong

> When the trade stops deserving its risk, reduce or exit instead of defending the original decision.

A competent agent is not judged only by how much it makes. It is also judged by how much unnecessary loss it avoids, how quickly it recognizes deterioration, and whether it preserves capital for the next opportunity.

## A6 — Recover and reconcile safely

> When operational/execution state is ambiguous, establish what actually happened before creating duplicate risk.

Restart, partial, pending or unknown state must not cause blind retries.

## A7 — Learn without becoming unstable

> Use outcomes and missed opportunities to improve without overreacting to one win or loss.

Good losses and bad wins must be distinguishable. Learning cannot silently widen authority or create fear/euphoria-style behavioral drift.

---

# Approved operator ↔ agent relationship laws

## R1 — Human-in-the-loop, not human-in-every-click

The operator remains the authority owner and can inspect, adjust, intervene and revoke.

Automation should increase through **adjustable guardrails**, not by removing the human from the system.

## R2 — Attention model

Conceptually:

```text
ordinary in-envelope action
→ agent acts + records

material decision / unusual risk / degraded capability
→ surface / notify

outside authority / authority expansion / later real-money escalation
→ explicit human action under the authority model then in force
```

Detailed notification UX belongs to P5–P7.

## R3 — Competence must be observable

Trust is earned through a pattern of:

- timely opportunity capture;
- sound reasoning;
- appropriate risk/reward judgment;
- capital preservation;
- coherent position management;
- good exits when wrong;
- safe recovery;
- honest explanations;
- learning from mistakes and missed opportunities;
- realized performance over time.

There is no single PnL number or mysterious trust score that can substitute for this picture.

## R4 — Discipline does not mean conservatism

A disciplined agent should not optimize for avoiding losses at all costs.

Sometimes the correct behavior is to **take meaningful bounded risk because the potential reward justifies it**. The product should distinguish:

- reckless risk;
- justified risk-taking;
- sensible restraint;
- fear-driven under-participation.

## R5 — Trade quality is multi-dimensional

A trade is not good or bad solely because it won or lost.

Review should consider:

```text
quality of reasoning at the time
+ risk taken
+ potential / realized reward
+ downside preserved
+ opportunity captured or missed
+ management after entry
+ exit/reduction quality
+ execution quality
+ final outcome
```

Therefore:

- a losing trade may still be a sound, disciplined decision;
- a profitable trade may still be reckless or poorly reasoned;
- preserving capital can be a successful outcome;
- failing to take justified risk can also be a process failure.

## R6 — Paper vs real must never be ambiguous

The operator must always know whether an agent is observing, simulating/shadowing, operating a paper wallet, proposing a future real action, or later acting under real bounded authority.

---

# Primary V1 jobs

The approved core jobs are:

1. **Delegate:** give an agent a mission, capital/wallet and adjustable guardrails.
2. **Operate:** agent senses, reasons and acts inside the mandate.
3. **Manage:** agent manages exposure continuously, including getting out when wrong.
4. **Supervise:** operator sees state, material decisions and exceptions without babysitting.
5. **Intervene:** operator can adjust guardrails, pause, stop or revoke.
6. **Evaluate trust:** judge reasoning, risk/reward, preservation, management and outcomes, then decide whether authority should change.

Supporting capabilities such as wallet/trader discovery, source intelligence, backtests, strategy editing, agent comparison and agent creation must earn their place by supporting this core loop.

---

# Anti-jobs

MetaEdge V1 should not make the operator responsible for:

- approving every normal paper action;
- reading raw chain-of-thought to know what happened;
- checking manually whether the runtime is alive;
- translating every signal into an order;
- remembering why positions were opened;
- treating PnL as the only definition of competence;
- configuring professional trading infrastructure before seeing value.

MetaEdge V1 should not make the agent:

- merely recommend trades it cannot execute in paper mode;
- wait indefinitely for certainty;
- silently widen its mandate;
- become reckless after wins or timid after losses;
- hold a failing trade merely to avoid realizing a loss;
- hide inactivity behind unexplained `NO_TRADE` behavior;
- optimize only for trade frequency, win rate or PnL.

---

# P2 outcome

P2 is approved.

Resolved:

- primary human job = delegation/supervision, not manual discovery/execution;
- human remains in the loop through adjustable guardrails and intervention;
- agent may execute inside explicitly allowed authority;
- operator view = state + material decisions + exceptions;
- attention model = autonomous in-envelope, notify material/unusual, ask at authority boundary;
- trust = multidimensional competence, not PnL alone;
- trade quality includes opportunity capture, risk/reward, capital preservation, management and exits.

Still open, non-blocking for P3:

- exact agent creation/improvement timing;
- exact V1 market scope;
- exact notification thresholds and channels;
- quantitative competence metrics / authority-promotion thresholds.

## Next gate

Promote P3 `MASTER_EXPERIENCE_LOOP.md` to active review and rewrite it around the approved operator + wallet-capable-agent relationship.
