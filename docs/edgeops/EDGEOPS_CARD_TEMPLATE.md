# EdgeOps Research Card Template

Use one card per signal, strategy, catalyst class, or disqualifier.

## Card Header

- Card name:
- Date opened:
- Owner:
- Status: draft | testing | paused | killed | promoted-paper-only
- Signal family: regime | technical | liquidity | catalyst | sentiment |
  manipulation-disqualifier | execution | portfolio/risk

## Current Truth To Preserve

- MetaEdge is paper-first.
- This card does not authorize live trading.
- This card must not claim edge until paper-forward evidence exists.
- Existing code truth:
  - paper ledger:
  - backtest source:
  - agent/autopilot source:

## Hypothesis

`If <setup/context> and <trigger> occur while <regime/gates> hold, then <paper
trade behavior> should outperform <benchmark> over <holding window>.`

## Scope In

- Assets:
- Timeframe:
- Holding window:
- Entry trigger:
- Exit trigger:
- Regime filter:
- Liquidity filter:
- Catalyst/sentiment requirement:
- Manipulation disqualifiers:

## Scope Out

- Live trading:
- Leverage:
- Unverified social claims:
- Unsupported assets:
- Data not yet available:

## Data Sources

| Source | Field | Freshness | Authority | Missing/Limit |
| --- | --- | --- | --- | --- |
| Binance candles | OHLCV | daily/intraday | market data | no order book |
| MetaEdge prices | spot price, 24h change | app runtime | current app | limited universe |
| Manual research | catalyst notes | manual | variable | provenance required |

## Falsifier

This card fails if:

-
-
-

## Benchmark

Compare against:

- buy/hold for same asset and window
- random entry with same holding window
- current Autopilot baseline
- simple momentum or mean-reversion baseline

## Experiment Plan

1. Backtest or replay:
2. Paper-forward trial:
3. Minimum sample:
4. Review cadence:
5. Kill condition:

## Pass / Fail Threshold

- Fail:
- Weak:
- Promising:
- Promote paper-only:

## Required Evidence Artifacts

- Research note:
- Source links:
- Backtest output:
- Paper-trade ledger slice:
- Weekly report:
- Postmortems:

## GIVEN / WHEN / THEN Scenarios

### Scenario 1: Clean Setup

GIVEN

WHEN

THEN

### Scenario 2: Disqualified Setup

GIVEN

WHEN

THEN

### Scenario 3: Falsifier Triggered

GIVEN

WHEN

THEN

## Allowed Product Claim

Choose one:

- Not enough evidence.
- Being paper-tested.
- Promising in backtest, unproven paper-forward.
- Promising paper-forward, still not live-ready.
- Killed.

## Decision Log

| Date | Decision | Evidence | Next Action |
| --- | --- | --- | --- |
| | | | |
