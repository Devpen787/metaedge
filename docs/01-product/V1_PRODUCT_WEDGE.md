# V1 Product Wedge

Status: **P1 DRAFT — revised around wallet-capable trading agents**

Updated: 2026-09-15

## Working wedge statement

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

The human operator defines the mandate, capital, risk boundaries, allowed markets, wallet/authority, and when authority should increase or be revoked. The agent is then expected to do the actual operating work:

**sense → understand → decide → act → manage → reconcile → learn**

without requiring the human to manually approve every ordinary paper decision inside an already-approved envelope.

V1 remains **paper-first**, but wallets and authority are first-class product concepts from the beginning so the product is training the right behavior for later real execution.

## The product thesis

Most trading systems optimize one or two qualities:

- bots can be fast but rigid or reckless;
- research assistants can be smart but slow and non-operational;
- humans can be disciplined but inconsistent, emotional, fragmented, and unable to watch every market continuously.

MetaEdge should develop agents that combine all three:

### Fast

The agent can:

- observe markets continuously;
- identify changes quickly;
- act inside an already-approved authority envelope without waiting for per-tick confirmation;
- avoid analysis paralysis and chronically late participation;
- manage an open position as quickly as it entered it.

Fast does **not** mean bypassing integrity, risk, authority, or reconciliation.

### Smart

The agent can:

- combine multiple forms of market/source evidence;
- distinguish observation from inference and unknowns;
- reason under incomplete information instead of demanding certainty;
- understand contradictions;
- adapt as conditions change;
- learn which sources, strategies, regimes, and decisions deserve more or less trust.

Smart does **not** mean one LLM improvising every decision.

### Disciplined

The agent can:

- obey explicit risk and authority boundaries;
- define the cost of finding out before taking exposure;
- avoid fear-driven hesitation and win-driven overconfidence;
- follow its approved process even after wins or losses;
- manage, reduce, exit, or reverse when the situation changes;
- reconcile ambiguous execution before retrying;
- preserve decision history so learning is based on what was known at the time.

Disciplined does **not** mean permanently inactive or over-conservative.

## Wallet-native principle

A trading agent without an execution identity is only an adviser.

MetaEdge is ultimately about **agents with wallets and bounded authority**.

For V1, that should mean a paper-wallet / simulated-capital equivalent with the same product concepts the user will later need for real authority:

- which agent is acting;
- which wallet/account it controls;
- how much capital it may use;
- which instruments/venues it may access;
- what risk rules apply;
- what actions it may take autonomously;
- when it must stop or escalate;
- how the human can pause/revoke it;
- how actions are reviewed afterwards.

Future real execution may use MetaMask Agent Wallet, Smart Account permissions, delegated authority, or another adapter. That implementation choice must not redefine the product model.

## Working primary user hypothesis

The first MetaEdge user is an **active crypto trader / agent operator** who wants to create, configure, or supervise wallet-capable trading agents rather than manually make every trading decision.

They likely:

- already participate in crypto markets;
- use exchanges and/or wallets;
- follow charts, wallets, traders, narratives, on-chain data, research, or signals;
- want agents to monitor more continuously than they can;
- want faster execution than a chat/research workflow provides;
- want more reasoning than a rigid rule bot provides;
- do not want an opaque autonomous bot with unconstrained capital;
- want to see agents earn more authority through demonstrated behavior.

This is the current P1 hypothesis, not yet a frozen persona.

## Human role vs agent role

### Human operator

The human should primarily:

- define objectives and constraints;
- choose/build/adapt the agent;
- allocate paper capital / future wallet authority;
- decide the allowed autonomy level;
- inspect and challenge behavior;
- intervene when needed;
- review performance and process quality;
- promote, constrain, pause, or retire the agent.

### Trading agent

The agent should primarily:

- watch markets/sources;
- identify opportunities;
- investigate enough to act intelligently;
- decide whether/how much exposure it wants;
- take permitted paper action;
- manage existing positions continuously;
- track what changed;
- explain material decisions concisely;
- learn from outcomes and missed opportunities;
- stay inside its wallet/risk/authority envelope.

The product should not make the human become the agent's manual execution loop.

## Core problem

Current choices tend to force a trade-off:

```text
FAST BOT
acts quickly
but often rigid / narrow / opaque

SMART ASSISTANT
reasons well
but usually stops at advice

HUMAN TRADER
can combine context
but cannot monitor continuously
and is vulnerable to hesitation, FOMO, inconsistency, and fragmented tooling
```

MetaEdge should make a fourth option credible:

```text
WALLET-CAPABLE AGENT
fast enough to catch the opportunity
smart enough to understand uncertainty
 disciplined enough to protect capital and follow process
```

## What V1 must prove

V1 succeeds if a user can repeatedly experience this loop:

1. Create/select an agent and give it a clear mandate.
2. Assign a paper wallet/capital pool and explicit authority/risk envelope.
3. The agent continuously watches relevant markets/sources.
4. The agent detects something material and forms a usable view without demanding certainty.
5. Inside its approved envelope, it can take bounded paper action without waiting for per-tick human approval.
6. The agent continues managing the position as evidence/risk changes.
7. The user can understand what the agent did, why, what changed, and what remains uncertain.
8. Review separates decision quality, discipline, execution, and outcome.
9. The user can tighten, widen, pause, retire, or eventually promote the agent's authority based on evidence.

The product thesis is not proven if MetaEdge only produces good analysis while the agent remains unable to operate.

## Product promise

**Build and operate wallet-capable trading agents that can trade fast, smart, and disciplined.**

Alternative language to test later:

- Trading agents that think before they act — without waiting until the opportunity is gone.
- Give an agent a wallet, a mandate, and boundaries. Make it earn your trust.
- Agents that discover, trade, manage, and learn under bounded authority.
- From market intelligence to disciplined autonomous action.

No marketing line is frozen yet.

## Candidate first wow moment

> “I gave an agent a paper wallet, a clear mandate and risk limits. It found an opportunity, explained the important part, acted without waiting for me, managed the position as conditions changed, and stayed inside the rules.”

The wow moment should come from **competent agency**, not from a dashboard or a clever chat answer.

## V1 boundaries — working

Likely in scope:

- agent creation/selection/configuration;
- paper wallet / agent capital assignment;
- explicit mandate, allowed markets and authority envelope;
- market/source sensing and opportunity discovery;
- agent reasoning under uncertainty;
- bounded autonomous paper decisions and execution;
- continuous paper position management;
- concise explanations / material alerts;
- human pause/stop/intervention;
- review of decision quality, discipline, execution and outcome;
- progressive agent trust/authority history;
- selected wallet/trader/source intelligence where it improves agent decisions.

Not required to prove V1:

- unrestricted autonomous real trading;
- automatic access to a user's full wallet balance;
- real copy trading;
- vault/pooling behavior;
- a broad social network;
- every old MetaEdge tab;
- every market/source/provider;
- a giant strategy marketplace;
- Arena unless it directly improves agent training/evaluation;
- requiring the user to manually approve every ordinary paper action.

## Wedge discipline

MetaEdge is not primarily:

- a research dashboard;
- a wallet tracker;
- a copy-trading exchange;
- a generic AI trading chat;
- a strategy IDE;
- a social trading network;
- a fully autonomous hedge fund with unrestricted capital.

Those may become supporting capabilities. The wedge is the **competent wallet-capable trading agent**.

## P1 questions to resolve before moving on

### Q1 — Primary human operator

Which operator should the first product experience optimize for?

A. Active crypto trader who wants agents to monitor/trade continuously under explicit limits.
B. Technical agent builder who wants a framework for composing trading agents.
C. Copy/source follower who mainly wants an agent to select and transform external signals.

Working recommendation: **A**. B and C can become strong jobs/capabilities without making V1 a developer framework or copy-only product.

### Q2 — Agent starting point

Should the first Golden experience begin with:

- creating/configuring a new agent;
- choosing a MetaEdge starter agent and setting its mandate;
- or importing/adapting an existing strategy/source into an agent?

Working bias: start with a **starter agent + explicit mandate**, because it proves agency faster without forcing the user to design a strategy from scratch.

### Q3 — First wow moment

Working candidate:

> “My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”

We should approve or rewrite this before navigation/design work.

### Q4 — Initial market scope

Does the first Golden agent need:

- crypto spot only; or
- crypto spot + paper perps?

This should be decided from the journey and what is required to demonstrate fast/smart/disciplined agent behavior, not from old code coverage.

### Q5 — Human attention model

What should the operator be interrupted for?

Candidate principle:

- **ordinary in-envelope paper decisions:** agent acts and records;
- **material change / unusual risk / envelope boundary:** notify;
- **outside authority / future real escalation:** require explicit human action.

This must be designed deliberately in later UX-law work.

## P1 exit criterion

Human approval of:

1. wallet-capable trading agents as the product wedge;
2. active crypto trader / agent operator as the initial human user;
3. fast / smart / disciplined as the core agent promise;
4. the human-vs-agent responsibility split;
5. the V1 proof loop;
6. the first wow moment;
7. major scope exclusions.

Only then move P2 User Jobs from draft to active review.
