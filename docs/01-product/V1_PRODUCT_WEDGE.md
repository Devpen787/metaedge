# V1 Product Wedge

Status: **P1 APPROVED — product authority**

Approved: 2026-09-15

## Approved wedge

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

The human operator defines the mandate, capital, risk boundaries, allowed markets, wallet/authority, and when authority should increase or be revoked. The trading agent is expected to do the operating work:

**sense → understand → decide → act → manage → reconcile → learn**

without requiring the human to manually approve every ordinary paper decision inside an already-approved envelope.

V1 remains **paper-first**, but wallet identity, capital assignment, and bounded authority are first-class product concepts from the beginning so the product trains the right behavior for later real execution.

## Core promise: fast, smart, disciplined

### Fast

The agent can:

- observe markets continuously;
- identify material changes quickly;
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
- follow its approved process after both wins and losses;
- manage, reduce, exit, or reverse when conditions change;
- reconcile ambiguous execution before retrying;
- preserve decision history so learning is based on what was known at the time.

Disciplined does **not** mean permanently inactive or over-conservative.

## Wallet-native principle

A trading agent without an execution identity is only an adviser.

MetaEdge is ultimately about **agents with wallets and bounded authority**.

For V1, that means a paper-wallet / simulated-capital equivalent using the same product concepts needed later for real authority:

- which agent is acting;
- which wallet/account or paper capital it controls;
- how much capital it may use;
- which instruments/venues it may access;
- what risk rules apply;
- what actions it may take autonomously;
- when it must stop, notify, or escalate;
- how the human can pause/revoke it;
- how actions are reviewed afterwards.

Future real execution may use MetaMask Agent Wallet, Smart Account permissions, delegated authority, or another adapter. That implementation choice must not redefine the product model.

## Approved primary human operator

The initial human user is an **active crypto trader / agent operator** who wants to create, configure, or supervise wallet-capable trading agents rather than manually make every trading decision.

They likely:

- already participate in crypto markets;
- use exchanges and/or wallets;
- follow charts, wallets, traders, narratives, on-chain data, research, or signals;
- want agents to monitor more continuously than they can;
- want faster execution than a chat/research workflow provides;
- want more reasoning than a rigid rule bot provides;
- do not want an opaque autonomous bot with unconstrained capital;
- want agents to earn more authority through demonstrated behavior.

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

The product must not make the human become the agent's manual execution loop.

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
smart enough to reason under uncertainty
disciplined enough to protect capital and follow process
```

## Approved V1 proof loop

V1 succeeds if the operator can repeatedly experience this:

1. Create/select an agent and give it a clear mandate.
2. Assign a paper wallet/capital pool and explicit authority/risk envelope.
3. The agent continuously watches relevant markets/sources.
4. The agent detects something material and forms a usable view without demanding certainty.
5. Inside its approved envelope, it can take bounded paper action without waiting for per-tick human approval.
6. The agent continues managing the position as evidence/risk changes.
7. The operator can understand what the agent did, why, what changed, and what remains uncertain.
8. Review separates decision quality, discipline, execution, and outcome.
9. The operator can tighten, widen, pause, retire, or eventually promote the agent's authority based on evidence.

The product thesis is not proven if MetaEdge only produces good analysis while the agent remains unable to operate.

## Product promise

**Build and operate wallet-capable trading agents that can trade fast, smart, and disciplined.**

Marketing wording remains open; the product promise does not.

## Approved first wow moment

> **“My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”**

The wow moment comes from **competent agency**, not from a dashboard or clever chat response.

## V1 boundaries

Likely in scope:

- agent creation/selection/configuration;
- paper wallet / agent capital assignment;
- explicit mandate, allowed markets, and authority envelope;
- market/source sensing and opportunity discovery;
- agent reasoning under uncertainty;
- bounded autonomous paper decisions and execution;
- continuous paper position management;
- concise explanations / material alerts;
- human pause/stop/intervention;
- review of decision quality, discipline, execution, and outcome;
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

## Deliberately deferred from P1

The following are not needed to approve the wedge and move forward:

- spot only vs spot + paper perps;
- exact starter-agent design;
- exact human notification/interrupt rules;
- navigation/information architecture;
- evidence visualization;
- technical wallet substrate.

These must be resolved at the appropriate later Product/UX gate rather than guessed early.
