# Product Constitution

Status: **Draft for human approval**

## Purpose

MetaEdge exists to help people and agents **find, test, understand, and manage trading edges without confusing uncertainty with permission, simulation with reality, or automation with authority**.

The system should develop agents that are:

> **decisive under uncertainty, disciplined under risk, explainable after action, and progressively trusted through evidence.**

MetaEdge is not merely a trading bot and not merely an AI assistant. It is a decision-and-execution system for turning observations into bounded experiments, positions, evidence, and eventually tightly controlled real financial actions.

## Product laws

### 1. Observation is not authority

A price move, wallet action, social signal, model output, trader action, or market narrative may create evidence. It does not itself authorize an order.

### 2. A signal is not an order

Strategies, agents, copied sources, and research loops propose views or target exposure. They do not directly own broker execution.

### 3. Many may propose; one portfolio decides

Multiple loops may operate asynchronously and disagree. One portfolio authority resolves aggregate desired exposure. One execution authority mutates trading state.

### 4. Risk bounds action; risk does not become the strategy

Risk answers questions such as:

- how much may be risked;
- whether an instrument/account/venue is valid;
- whether portfolio limits permit more exposure;
- whether an unresolved operation prevents another action.

Risk does not answer whether a market thesis is intellectually convincing.

### 5. Uncertainty normally changes size, not permission

Weak or incomplete evidence should normally lead to smaller exposure, shadowing, or a scout experiment.

Only a **hard safety, integrity, authority, or feasibility condition** may force a block.

### 6. Lack of evidence is permission to experiment cheaply, not permission to claim confidence

The system needs explicit bounded exploration budgets. It must be able to learn by acting in paper mode without first proving the edge it is trying to evaluate.

### 7. No-trade is an accountable decision

Abstention is not automatically correct. Eligible skipped opportunities must remain observable so MetaEdge can measure false negatives, late entries, under-deployment, and the opportunity cost of excessive caution.

### 8. Copying is transformation, not blind cloning

MetaEdge may observe and copy wallets, traders, strategies, agents, portfolios, cohorts, and signal providers.

Source size, leverage, venue, timing, and portfolio context are evidence. The follower's action is independently transformed through the follower's own policy, risk, portfolio, and execution constraints.

### 9. Paper state can never grant real execution authority

Paper and real may share strategy versions, source evidence, desired exposure logic, and risk methodology. They use separate intents, authorization state, execution adapters, and financial ledgers.

No paper order or paper fill may be "promoted" into a real order.

### 10. Real authority is explicit, bounded, revocable, and progressively earned

The long-term goal is not to "give AI a wallet." It is to give an agent exactly enough authority to perform a defined job under measurable constraints.

Authority must be limited by dimensions such as account, network, assets, actions, notional, leverage, slippage, losses, frequency, expiry, and revocation.

### 11. Unknown is not failed

Submission, inclusion, execution, settlement, and reconciliation are separate states.

If the outcome of a real operation is unknown, the system must reconcile that operation before granting fresh authority that could duplicate it.

### 12. Human psychology is market data; human emotion is not execution authority

Fear, greed, attention, FOMO, capitulation, crowding, narrative rotation, leverage euphoria, and behavioral divergence may be legitimate evidence families.

The operator's fear, excitement, frustration, or impulse does not silently change execution rules.

### 13. AI is a reasoning component, not durable truth

Gemini, Claude, local models, or future models may help synthesize, explain, classify, challenge, and propose.

They do not own canonical state, strategy lineage, financial authority, or project memory.

### 14. Performance claims must preserve mode and provenance

Backtest, simulation, shadow, paper, and real results are not interchangeable.

Every claim must preserve the strategy/source version, market evidence, costs, execution assumptions, and operating mode that produced it.

### 15. Position management is continuous

Trading is not only a binary entry decision. Evidence changes after entry. MetaEdge should be capable of scaling in, scaling out, holding, reducing, hedging, exiting, and—where appropriate—reversing as the thesis evolves.

### 16. Strategy logic and execution authority are separate

A strategy may be portable from paper evaluation to real proposals without rewriting the strategy. The execution path and authority remain separate.

## Failure we will not repeat

MetaEdge previously became increasingly capable of proving why it should **not** trade. Safety, statistical caution, evidence gates, and architecture accumulated until legitimate paper experimentation could be starved of action even while markets moved materially.

The relaunch prevents that failure structurally:

- hard safety is separated from evidence quality;
- uncertainty normally reduces size rather than forcing inactivity;
- exploration has an explicit budget;
- fast-moving opportunities have a fast path;
- no-trade decisions are counterfactually evaluated;
- the system is tested for its ability to **act validly**, not only reject invalid actions;
- risk is independent from opportunity generation;
- target exposure is continuously revisable.

A system that never loses because it never acts is not a successful trading system.

## Safety/liveness dual requirement

MetaEdge requires both:

**Safety invariants** — dangerous state transitions must never occur.

**Liveness invariants** — when valid market evidence, available paper risk, an eligible instrument, and a permissible opportunity exist, there must be a bounded path to experimentation rather than an accidental permanent no-trade state.

## Change policy

This Constitution should change rarely. Changes require an explicit decision record describing:

- the law being changed;
- the failure or evidence motivating the change;
- impact on product journeys, authority, risk, and security;
- migration implications;
- human approval.
