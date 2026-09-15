# Agent Model

Status: **Draft for human approval**

## Core idea

The "MetaEdge Agent" is not one LLM call that outputs BUY / SELL.

It is a durable decision system with cooperating capabilities:

**Sense → Understand → Form Thesis → Propose Exposure → Coordinate Portfolio → Bound Risk → Execute → Reconcile → Learn**

LLMs may help inside several stages, but they do not own the state machine.

## Component roles

### Sensing

Collect and normalize evidence from:

- market prices and volume;
- order flow / liquidity;
- derivatives positioning;
- wallets and trader activity;
- on-chain data;
- catalysts/news;
- narrative/attention;
- behavioral/psychology indicators;
- copied sources;
- strategy outputs.

### Interpretation

Explain what may be happening, what evidence agrees, what conflicts, and what is unknown.

This is a natural place for LLM-assisted synthesis, but interpretations must remain labeled as inference rather than market truth.

### Thesis / view generation

Produce a directional or neutral view plus desired exposure and reasons.

Examples:

- `ETH +0.25R scout`
- `BTC reduce from +0.60R to +0.30R`
- `SOL no position; hard block = stale data`

### Portfolio coordination

Resolve multiple views across strategies and sources into one aggregate desired exposure per instrument/portfolio.

### Risk

Clip or block exposure based on objective risk and integrity constraints.

Risk does not decide whether the thesis is "smart."

### Execution

Translate approved target changes into the appropriate paper or future real execution workflow.

### Reconciliation

Establish canonical execution outcomes and distinguish pending, partial, failed, unknown, and complete state.

### Learning

Attribute outcomes to:

- thesis;
- signal;
- regime;
- source;
- sizing;
- execution;
- costs;
- missed opportunity;
- behavioral assumptions;
- policy constraints.

## Human psychology as a first-class evidence family

MetaEdge should treat market psychology as observable data rather than operator emotion.

Potential behavioral evidence includes:

- fear/greed regime;
- panic selling;
- capitulation;
- FOMO;
- euphoria;
- narrative saturation;
- attention acceleration;
- crowding;
- retail vs sophisticated-wallet divergence;
- leverage euphoria;
- reflexive momentum;
- post-loss and post-win behavior.

A behavioral loop emits a view like any other loop. It does not receive special authority.

## Human emotion vs behavioral intelligence

Bad operator behavior:

> "Price dropped; I am scared; close everything."

Useful market evidence:

> "Price dropped, retail selling accelerated, leveraged longs were liquidated, funding reset, and large-wallet spot inflows increased. This may represent forced selling rather than thesis failure."

The agent should be able to use the second while being protected from the first.

## Agent maturity ladder

### Level 0 — Observer

May monitor and explain. No trading-state mutation.

### Level 1 — Adviser

May generate proposals and target exposures. Human or paper system chooses what happens next.

### Level 2 — Paper Agent

May autonomously manage bounded paper positions within explicit policy.

### Level 3 — Supervised Real Agent

May prepare exact real proposals. A human approves each exact action.

### Level 4 — Bounded Autonomous Agent

May execute inside narrowly delegated, revocable limits without per-trade approval.

### Level 5 — Adaptive Portfolio Agent

May allocate among approved strategies/sources within constitutional and portfolio constraints. It still cannot expand its own authority.

## Authority principle

The goal is not "give AI a wallet."

The goal is:

> Give an agent exactly enough financial authority to perform a defined job under measurable constraints.

Future real authority may be bounded by:

- wallet/account;
- chain/network;
- instruments/assets;
- operation types;
- max position/notional;
- max new exposure per period;
- max leverage;
- max slippage;
- loss/drawdown limits;
- expiry;
- frequency;
- counterparty/venue;
- emergency stop;
- revocation.

The agent may never change its own constitutional authority.

## Agent track record

Do not reduce agent quality to a single confidence score.

Candidate dimensions:

- decision quality;
- risk adherence;
- opportunity capture;
- false negatives / missed opportunities;
- overtrading;
- undertrading;
- drawdown handling;
- position management;
- execution quality;
- regime adaptation;
- paper-to-real divergence;
- recovery behavior;
- policy violations;
- unresolved-state handling;
- explanation/lineage completeness.

## Model-vendor independence

Gemini, Claude, local models, or future models are replaceable reasoning adapters.

MetaEdge owns:

- domain contracts;
- state transitions;
- source/evidence lineage;
- risk policy;
- portfolio authority;
- execution authority;
- durable memory;
- audit history.

No model vendor should become the hidden owner of product behavior.
