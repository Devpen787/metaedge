# System / Strategy Boundary

Status: **Draft for human approval — architecture boundary**

## Purpose

Prevent MetaEdge from accidentally becoming one giant house trading strategy while we design evidence, portfolio, risk, agent, and execution infrastructure.

## Core law

> **A StrategyVersion decides what opportunity exists and what exposure it wants. MetaEdge decides whether that request is valid, coordinated, permitted, executable, recoverable, and attributable.**

MetaEdge owns the trading operating system. It does not own the universal market thesis.

## Strategy responsibility

A `StrategyVersion`, copy policy, manual thesis, or agent strategy may decide:

- what constitutes an opportunity;
- which evidence families matter;
- which evidence is required versus optional;
- the horizon;
- direction;
- requested target exposure;
- invalidators;
- scaling / reduction / exit / reversal logic;
- which instruments and regimes are in scope;
- whether exploratory/scout participation is permitted;
- how its own thesis changes as evidence changes.

Different strategies may reach different conclusions from the same EvidenceProfile.

Example:

```text
MomentumStrategy     ETH +0.40R
MeanReversion        ETH -0.20R
WalletCopyPolicy     ETH +0.15R
MacroHedge           ETH -0.10R
```

MetaEdge must preserve those disagreements rather than forcing all producers through one shared market opinion.

## MetaEdge system responsibility

The platform owns:

- immutable observations and provenance;
- EvidenceProfile representation;
- observed / inferred / unknown separation;
- strategy/source version lineage;
- View contract validity;
- portfolio aggregation and duplicate-lineage handling;
- allocation sleeves;
- account-level risk constraints;
- hard integrity / feasibility blockers;
- canonical PortfolioTarget;
- execution intent lifecycle;
- idempotency;
- paper broker mechanics;
- execution reconciliation;
- position truth;
- audit / attribution;
- missed-opportunity accounting;
- session / authority boundaries;
- future wallet / venue adapters.

The platform may reject a malformed, stale, unauthorized, impossible, duplicated, or over-budget request. It may not silently rewrite a valid strategy thesis into its own thesis.

## EvidenceProfile is not a strategy

`EvidenceProfile` describes the state of evidence.

It may contain:

- bullish and bearish evidence simultaneously;
- contradictions;
- unknowns;
- freshness;
- reliability;
- coverage limitations;
- regime;
- execution conditions.

It does **not** define one universal rule such as:

```text
strong price + strong volume = long 0.25R
```

That mapping belongs to a producer/StrategyVersion.

## Risk is not a strategy

Risk may:

- allow;
- clip;
- block;
- force reduction;
- prevent fresh exposure while execution truth is unresolved.

Risk may not invent a market thesis or demand extra thesis confirmation merely because it is uncomfortable with uncertainty.

## Portfolio is not a strategy

Portfolio aggregation resolves simultaneous requested exposures. It does not decide which market idea is intellectually correct.

A near-zero aggregate target may result from genuine disagreement between valid Views. This must remain distinguishable from weak evidence, no opportunity, or a hard block.

## Scenario-fixture law

Scenario stress tests may use realistic market examples such as breakouts, liquidation cascades, whale accumulation, funding crowding, reversals, or social attention spikes.

Those examples are **fixtures used to exercise the platform contracts**.

They are not canonical MetaEdge signal definitions.

For a platform-level stress test, the important condition is usually:

```text
A StrategyVersion says an opportunity is eligible
+ its View is valid
+ critical state is fresh
+ account risk is available
+ no hard blocker exists
→ MetaEdge must have a path to bounded paper participation
```

The stress test does not prove that the StrategyVersion's edge is economically valid.

## House-strategy non-goal

The relaunch should not create a hidden `MetaEdgeMasterStrategy` by aggregating every available indicator into one master market score.

That would recreate several prior problems:

- endless evidence requirements;
- accidental confidence gating;
- difficulty attributing what actually worked;
- all agents behaving similarly;
- risk logic leaking into thesis logic;
- inability to test independent strategies cleanly.

## Strategy quality is learned separately

MetaEdge can compare StrategyVersions using outcome evidence, decision quality, regime fit, drawdown, execution costs, opportunity capture, and missed-opportunity behavior.

A strategy may be poor even if the platform executed it perfectly.

The platform may be defective even if a strategy made money.

These diagnoses must remain separable.

## Required test

For any future implementation, prove all of the following:

1. Two strategies can consume the same EvidenceProfile and emit opposing Views.
2. Neither can invoke the broker directly.
3. Portfolio aggregation preserves both lineages.
4. Risk can clip the aggregate target without altering either strategy's historical View.
5. Execution receives one canonical delta.
6. Outcome attribution can explain which producer contributions led to the final target.
7. Replacing one StrategyVersion does not require changing portfolio/execution code.

If those conditions fail, strategy logic has leaked into platform authority.