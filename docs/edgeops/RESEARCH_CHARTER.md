# Research Charter — SUPERSEDED (historical record)

> **Superseded 2026-07-08 by `docs/trading_research_operating_model.md`** (the
> research-OS reset — see decision record of the same date). Kept verbatim
> below as the issued document; do not operate from this file.

Issued by Devin, 2026-07-08. Supersedes ad-hoc ordering; TRADING_CANON laws
remain as evidence rules under this charter.

Core belief: trading is not prediction-first. It is identifying where
structural imbalance, forced behavior, risk transfer, liquidity demand, or
behavioral overreaction creates an exploitable opportunity after all costs and
tail risks.

## Mandatory order

1. **OPPORTUNITY MAP** — identify and rank the pool (carry/funding/basis,
   liquidity provision, forced flows/liquidations, behavioral overreaction,
   vol expansion/compression, options/expiry/dealer pressure, event-driven,
   relative value, trend/meanrev, market-making/arb) against OUR constraints:
   capital, venue, latency, data, fees, slippage, leverage, risk tolerance,
   ability to wait.
2. **WHO/WHY/WHEN/WHERE** — who is on the other side; why do they trade; why
   forced/emotional/constrained/hedging/paying for risk transfer; where does it
   show in data; when does the condition exist; why does it persist after
   costs. No answers → no strategy code.
3. **DATA FIRST** — verify data exists and aligns (OHLCV, spread/liquidity,
   vol, OI, funding/basis, borrow, options OI/skew/expiry, liquidations,
   event calendars). No data → no strategy. Never fake missing data.
4. **WHERE/WHEN SELECTOR BEFORE HOW** — liquidity, vol regime, participation,
   cost, funding/basis regime, expiry/event window, session regime. A selector
   defines when the market is worth trading; it is not a strategy.
5. **HOW** — only after 1–4: entry, exit, invalidation, stop/target/time stop,
   benchmark, falsifier, expected frequency, expected failure mode.
6. **HOW MUCH** — sizing only after historical + forward survival. Vol
   targeting, max loss, exposure/correlation/leverage caps, kill rules. Never
   optimize size to rescue a bad edge.
7. **TESTING DISCIPLINE** — walk-forward/OOS; realistic fees, spread, slippage,
   funding, borrow, latency; registry of ALL hypotheses; multiple-testing
   penalty; one backtest ≠ edge; historical survivor earns forward paper only.
8. **FORWARD TRIAL** — paper on live data; precommitted kill rules; minimum
   sample; benchmarks + random/control comparison; loses to benchmark → kill.
9. **REAL MONEY** — only after forward trial; tiny size; operator approval;
   no scaling without live evidence.

## Hard bans

- No "want me to build X?" when the next priority is known — execute it.
- No philosophy without a concrete research card, code change, data check, or
  test result.
- RSI/SMA/ATR/volume/breakouts are FEATURES, not strategies.
- Funding is not "yield" unless hedge, basis, funding, liquidation, and
  exchange risks are modeled.
- Options/expiry may be signal data even if we never trade options.
- No 1h bars by default — timeframe chosen by cost, latency, signal half-life,
  opportunity type.
- No overfit grids. n=30–50 is a forward-test candidate, never proof.
- No dashboards before strategy logic.
- No "I will" — produce the artifact now or state the blocker.

## Required output per research task

A opportunity pool · B participants & why they trade · C hypothesis · D data
required · E data available/missing · F WHERE/WHEN selector · G entry/exit ·
H cost model · I backtest design · J benchmark & falsifier · K results ·
L decision (kill/revise/forward-test) · M files changed · N next
highest-priority action.
