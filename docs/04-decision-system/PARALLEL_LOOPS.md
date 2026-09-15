# Parallel Loops and Coordination

Status: **Draft for human approval**

## Core architecture

MetaEdge should support many asynchronous loops operating in parallel, but they must not become independent writers to the portfolio or wallet.

> **Many loops may observe and propose. One portfolio authority resolves aggregate desired exposure. One execution authority mutates trading state.**

## Candidate observation / reasoning loops

- price / technical / momentum;
- flow / order-book / liquidity;
- derivatives positioning / funding / open interest;
- wallet / trader intelligence;
- on-chain activity;
- news / catalyst;
- narrative / attention;
- behavioral / psychology;
- copied-source activity;
- slow systematic strategy loops;
- fast-event opportunity loops;
- portfolio / correlation observation;
- execution-quality / slippage observation.

Not every loop must exist in V1.

## Output contract: views, not orders

A loop should emit a bounded `View` conceptually containing:

- source / loop identity;
- instrument;
- direction or neutral stance;
- desired exposure contribution;
- evidence profile;
- thesis/invalidation;
- freshness / expiry;
- contradictions;
- source observation ids;
- operating mode eligibility.

Example:

- momentum loop: `ETH +0.30R`
- wallet-flow loop: `ETH +0.25R`
- crowding loop: `ETH -0.15R`
- mean-reversion loop: `ETH -0.10R`

These do not execute independently.

## Portfolio allocator

The portfolio layer resolves:

- current position;
- competing views;
- source/strategy correlation;
- concentration;
- exploration vs confirmed allocation;
- portfolio risk budget;
- copied-source limits;
- regime and liquidity constraints;
- reduction priority;
- user policy.

It produces a `TargetExposure` per instrument/portfolio.

Example:

- current ETH exposure: `+0.15R`
- raw combined desired exposure: `+0.55R`
- portfolio/risk-permitted target: `+0.35R`
- required execution change: `+0.20R`

## Risk layer

Risk may:

- accept the target;
- clip it;
- force reduction;
- hard-block it for explicit safety/integrity reasons.

Risk does not independently decide market direction.

## Execution layer

Execution receives a target change and creates the correct paper or future real intent.

Only this layer mutates order/execution state.

## Reconciliation layer

Reconciliation converts broker/wallet/venue outcomes into canonical fills/positions and reports execution truth back to the rest of the system.

Unknown outcomes remain explicit and block duplicate-risk retries where necessary.

## Learning / attribution loop

Resolved outcomes feed back into:

- source quality;
- strategy evaluation;
- evidence-family usefulness;
- execution model calibration;
- risk-policy analysis;
- missed-opportunity analysis;
- agent track record.

Learning must preserve immutable historical lineage rather than rewriting prior decisions.

## Fast path

Fast path responds to events whose value decays quickly:

- acceleration in price/volume;
- sudden flow changes;
- liquidation cascades;
- large wallet accumulation/distribution;
- rapidly changing funding/OI;
- catalyst/news events;
- attention/narrative acceleration.

A fast loop may propose a small scout exposure without waiting for a slow research cycle if:

- the event is backed by valid current evidence;
- the instrument is eligible;
- exploration risk is available;
- no hard blocker exists.

## Research path

Slow research evaluates:

- systematic families;
- backtests;
- forward evidence;
- regime behavior;
- strategy variants;
- source persistence;
- attribution over longer windows.

Slow research should improve sizing and strategy lifecycle, not freeze every fast opportunity until statistical certainty arrives.

## Concurrency law

Parallelism is encouraged for observation, research, and review.

Financial mutation is serialized through clear authorities.

The system must prevent:

- multiple loops independently buying the same asset without portfolio awareness;
- one strategy closing a position another strategy still requires without attribution;
- simultaneous retries of an unresolved operation;
- race conditions between risk checks and execution state;
- different state stores disagreeing about canonical exposure.

## Event-driven direction

The relaunch should evaluate an event-driven internal model rather than starting many unrelated timers inside the web server.

Candidate event classes:

- `MarketObservationRecorded`
- `SourceObservationRecorded`
- `OpportunityDetected`
- `ViewUpdated`
- `TargetExposureChanged`
- `RiskBoundApplied`
- `IntentCreated`
- `ExecutionStateChanged`
- `PositionChanged`
- `OutcomeResolved`
- `CounterfactualResolved`
- `AuthorityRevoked`

Exact implementation is deferred until journeys/domain contracts are frozen.
