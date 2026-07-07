# Research Response 1: Bot Failures And Trader Heuristics

Date captured: 2026-07-07

Source: user-provided attachment at
`/Users/devinsonpena/.codex/attachments/570f11d5-b15d-47e8-92a3-e8756a122e1a/pasted-text.txt`

## Citation Status

The attachment contains many useful claims, but its citations are pasted as
transient `turn...` references rather than durable URLs. Treat this as a strong
research lead and implementation guide, not as a final bibliography. Before
publishing public claims from this note, recover or re-check the original source
URLs.

First durable source batch received:
`docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_1.md`. That ledger backs many of
the bot-failure, sentiment, catalyst, funding/OI, and journaling claims in this
note, but it is not yet a one-to-one citation map for every sentence.

## Core Takeaway

The response strongly supports the EdgeOps direction: MetaEdge should not chase
"smarter entry indicators" first. The more valuable product layer is a
failure-avoidance and evidence loop that records thesis, invalidation,
liquidity, costs, exit logic, catalyst context, crowding, and post-trade review.

## Bot Failure Taxonomy

The attachment groups repeated bot failures into two buckets:

1. Mechanical failures:
   - exchange/API state desynchronization
   - websocket drops
   - missed cancellation events
   - unsupported order types
   - rate limits
   - dry-run/live mismatch

2. Economic failures:
   - backtest leakage
   - under-modeled fees, funding, slippage, and liquidation costs
   - bad exits despite reasonable entries
   - grid/DCA short-volatility traps
   - liquidity mismatch
   - leverage/crowding blindness

MetaEdge implication: even in paper mode, the product should make execution
assumptions visible. A paper trade should record whether the setup depends on a
fill/liquidity assumption that would break in live markets.

## Signals Worth Testing

The response argues that signals that survive forward testing tend to be
structural, not decorative:

- higher-timeframe time-series momentum
- cross-sectional relative strength
- carry/basis, preferably hedged
- order-flow or participation confirmation
- volume confirmation
- funding plus open interest as a crowding filter, not a standalone trigger

MetaEdge implication: these should become the first signal families we test,
with the current 24h-change Autopilot preserved as a baseline.

## Sentiment Lessons

The response separates useful sentiment from dangerous sentiment:

- Useful sentiment is attached to credible distribution or structural demand:
  corporate balance-sheet disclosure, ETF filing, platform-level attention
  shock.
- Dangerous sentiment triggers confidence runs, fakeouts, or pump/dump
  dynamics: exchange solvency panic, hacked official account, rumor-led social
  spikes.

MetaEdge implication: sentiment should be a context field or disqualifier unless
supported by a credible catalyst and liquidity confirmation.

## Pre-Entry Disqualifiers

The strongest disqualifiers named in the response:

- no written invalidation
- spread/depth too poor
- major catalyst too close without an event plan
- extreme funding/open-interest crowding
- bad risk/reward
- thesis not written or not testable
- unclear market structure
- altcoin setup exposed to BTC shock

MetaEdge implication: EdgeOps should score disqualifiers before it scores entry
signals.

## Measurable Catalyst Classes

The attachment distinguishes "measurable in advance" from "tradable edge":

- token unlocks: usually measurable; impact conditional
- exchange listings: partly measurable; rumors dangerous
- governance votes: measurable process timing; market impact conditional
- ETF/regulatory dates: measurable date, uncertain outcome
- macro dates: measurable timing, uncertain impact
- exploits: mostly not measurable before trigger; treat as risk overlay
- funding/OI spikes: measurable intraday; useful for crowding, weak for timing

MetaEdge implication: catalyst calendars should become tagged context and
disqualifier inputs, not automatic trade triggers.

## Journal Fields To Promote Into Product Spec

The response adds useful fields beyond standard bot logs:

- thesis sentence
- catalyst tag
- regime
- market-structure score
- positioning snapshot
- liquidity/execution risk
- BTC beta/correlation risk
- invalidations overridden
- planned risk vs realized risk
- MAE/MFE
- exit taxonomy
- counterfactual result under original plan
- screenshot/state snapshot
- emotional/cognitive state for discretionary trades
- weekly mistake cluster
- missed-trade log

MetaEdge implication: the first product implementation should support a small
subset now, then leave room for richer post-trade review.

## Changes This Should Drive

1. Add `exitThesis` and `exitReasonPlanned` to the thesis model before we get
   too entry-focused.
2. Add `executionAssumption` and `liquidityRisk` fields even for paper trades.
3. Add `invalidationsOverridden` so the system can learn when users knowingly
   violated their own plan.
4. Add `benchmarkFamily` with options like current Autopilot, random entry,
   buy/hold, HTF momentum, and relative strength.
5. Add first research cards for:
   - `exit-logic-dominates-entry-v1`
   - `htf-momentum-baseline-v1`
   - `funding-oi-crowding-filter-v1`
   - `liquidity-first-disqualifier-v1`
