# Hummingbot + Condor Review

Status: **Research evidence — not MetaEdge product authority**

Reviewed: 2026-09-15

Sources:

- `hummingbot/hummingbot`
- `hummingbot/condor`
- current Hummingbot Strategy V2 documentation

## Why this system matters

Hummingbot now provides both mature trading infrastructure and an active LLM-agent layer. That combination is unusually close to MetaEdge's long-term problem: reasoning agents that can act, while deterministic components retain execution/risk mechanics.

## Hummingbot V2 — verified architecture

Hummingbot V2 separates:

- **MarketDataProvider** — shared market data access;
- **Controllers** — long-running, reusable strategy logic;
- **Executors** — finite order/position workflows.

Controllers emit `ExecutorActions`; Executors manage order lifecycle such as placement, refresh, cancellation and closure. Multiple controllers can run simultaneously.

### MetaEdge lesson

Do not let every strategy/source implement its own broker lifecycle. A long-running source/strategy loop should emit a desired action/view, while finite execution workers own the mechanics.

## Condor — verified agent architecture

Condor's agent framework explicitly says LLMs are strong reasoners but poor at mechanical trading tasks such as durable state, PnL/breakeven arithmetic, risk-limit enforcement and state isolation.

It splits the system into:

### Deterministic layer

- providers;
- positions/executors;
- order lifecycle;
- risk limits;
- persistent journal/snapshots.

### Reasoning layer

The LLM sees pre-computed state and decides what to do next, such as:

- spawn an executor;
- stop one;
- take profit;
- scale a position;
- steer a controller.

The LLM does not place raw individual orders directly.

## Executor isolation / virtual portfolios

Each agent tags its executors with its own controller/agent identity. Condor uses this to isolate exposure, PnL and positions between agents even when they share an exchange account.

This is valuable for MetaEdge's multi-agent architecture, but MetaEdge should not assume virtual attribution is enough for aggregate portfolio risk. We still need one account-level portfolio authority.

## Journaling and restart memory

Condor persists:

- per-session config;
- journal summary;
- recent decisions;
- tick snapshots;
- cross-session learnings.

This supports MetaEdge's durable-memory law. Operational state belongs in durable artifacts/state, not conversational memory.

## Dry-run / run-once / loop modes

Condor differentiates:

- `dry_run` — reasoning without trading tools;
- `run_once` — one trading-capable tick;
- `loop` — repeated autonomous operation.

MetaEdge should preserve similar explicit operation modes, especially Observer/Adviser/Paper Agent maturity levels.

## The most relevant paralysis lesson

Condor's live prompt contains a specific `AUTHORIZATION_LIVE_UNATTENDED` block because an earlier generic human-confirmation rule caused an autonomous seat to hold valid in-limit trades while waiting for confirmation that no human would send during the tick.

The block clarifies that the human already approved the strategy/session/capital/risk envelope at launch and that, inside that envelope, the agent should act without asking each tick.

This is a strong pattern for MetaEdge Level-2 Paper Agents and eventually bounded real agents:

> authorization belongs to the launch/envelope, not to repeated conversational confirmation inside an unattended loop.

The runtime, not the LLM, must enforce the envelope.

## Important anti-pattern for MetaEdge

Condor's base live prompt also instructs:

> “Be conservative. When in doubt, hold and journal why.”

This is understandable for a real-money agent but is too blunt for MetaEdge's paper-learning objective. It can turn uncertainty into systematic under-participation.

MetaEdge should replace that with:

> If a hard blocker is absent and exploration risk is available, uncertainty should normally resize the experiment before it eliminates participation.

A hold still needs a thesis: flat target exposure must be an accountable decision, not the universal fallback.

## Position handover pattern

Condor describes executors that may stop while preserving inventory, leaving the agent a tagged position with breakeven/PnL that later ticks can manage. The next tick can scale down, hedge, or exit.

This strongly supports MetaEdge's position-management journey:

entry is not the end of the decision. The agent must continue to reason over inventory it created.

## Risks / limitations relative to MetaEdge

- Fixed tick loops can miss event urgency unless paired with event-driven triggers.
- Per-agent isolation does not by itself solve account-level aggregate exposure.
- Prompt heuristics can create behavioral bias even when risk code is correct.
- An LLM that directly manipulates executors is still closer to execution than MetaEdge's proposed `view → portfolio target → risk → executor` separation.
- Journals are useful evidence but should not become unstructured hidden authority.

## MetaEdge disposition

### Reuse as pattern

- deterministic mechanics + reasoning split;
- finite executors;
- per-agent journals/snapshots;
- dry-run/run-once/loop distinction;
- runtime-enforced risk permissions;
- bounded unattended authorization;
- ownership namespace for agent-controlled resources.

### Adapt

Insert a portfolio-target layer between agent reasoning and executors.

Use event-driven triggers in addition to periodic ticks.

Add missed-opportunity/liveness measurement so “hold” cannot become invisible default behavior.

### Avoid

- per-tick approval inside an already-authorized autonomous loop;
- generic “when in doubt, hold” as the default policy;
- allowing separate agents to believe their isolated virtual books are the whole account risk picture.
