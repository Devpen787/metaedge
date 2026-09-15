# Source Reputation Model

Status: **Draft for human approval**

## Purpose

MetaEdge should help users discover wallets, traders, strategies, agents, cohorts and signal providers worth studying or copying without equating raw PnL with skill.

A source may look excellent because of leverage, one lucky trade, unrealized gains, survivorship bias, hidden hedges, deposits/withdrawals, favorable regime, or exposure that a follower cannot safely copy.

## Core law

**Reputation is a multidimensional profile, not one universal score.**

MetaEdge may rank sources for a declared objective, but the underlying profile stays decomposable.

## Candidate dimensions

### 1. Observation quality

History coverage, venue/network coverage, fill vs snapshot visibility, missing periods, identity certainty, external-hedge uncertainty and data freshness.

### 2. Tenure and sample

Source age, active days, trade/decision count, capital/regime exposure and dormant periods.

### 3. Realized performance

Prefer realized outcomes over headline unrealized PnL. Track realized PnL, return on capital where estimable, rolling windows, positive/negative period distribution and contribution by instrument/strategy.

### 4. Risk behavior

Maximum drawdown, average/peak leverage, concentration, liquidation proximity/events, downside tail, loss streaks, exposure persistence and reduction/exit behavior.

### 5. Consistency

Rolling-window profitability, return stability, performance across regimes, dependence on one trade/token and recovery after drawdown.

### 6. Efficiency

Return relative to risk taken, turnover/cost burden, capital utilization, adverse/favorable excursion where observable and leverage-adjusted performance.

### 7. Behavioral signature

Momentum vs mean reversion, typical holding period, scale-in/out behavior, averaging down, response to volatility, directional bias, asset concentration and frequency.

### 8. Copyability

A skilled source can still be hard to copy. Track latency sensitivity, liquidity, average size vs depth, slippage sensitivity, resting vs market execution, leverage requirements and whether actions are observable early enough.

### 9. Transparency / attribution quality

For strategies/agents/signal providers: versioned rules, timestamped pre-outcome signals, complete win/loss history, evidence lineage and execution trace integrity.

### 10. Regime dependence

Track performance across trending/range-bound, high/low volatility, risk-on/risk-off, funding/crowding and asset-sector conditions.

## Example profile

```text
Wallet A

Coverage:            High on Hyperliquid, unknown external exposure
Tenure:              14 months / 1,280 fills
Realized performance Strong across 6m and 12m windows
Drawdown:            Moderate
Peak leverage:       High
Concentration:       High in BTC/ETH
Consistency:         Good, but 41% of PnL from two periods
Copyability:         Medium — fast fills, liquid majors
Regime dependence:   Strongest in directional/high-volatility periods
External hedges:     Unknown
```

This is more useful than `Wallet score: 87/100`.

## Ranking is objective-specific

Discovery may expose ranks such as best risk-adjusted, most consistent, lowest drawdown, strongest recent momentum, highest copyability, best long-horizon, best in current regime, or best fit for the user's policy.

Every ranking states its objective and inputs. There is no hidden universal leaderboard formula treated as truth.

## Cohorts

Cohorts may group sources by equity/capital band, PnL band, leverage style, holding period, asset focus, risk profile or behavioral signature.

Cohort membership is descriptive evidence, not proof that each member shares the same edge.

## Reputation and CopyPolicy are separate

Reputation asks:

> What do we know about this source's behavior and track record?

CopyPolicy asks:

> Given my portfolio and constraints, what would I do with this source's action?

A strong source can still produce a zero follower target when the current action violates follower policy or creates excessive concentration.

## Anti-bias requirements

Explicitly account for survivorship bias, selection bias, unrealized-PnL inflation, deposits/withdrawals where visible, leverage distortion, source identity changes, duplicated wallets/strategies, hidden external exposure, changing venue conditions and hindsight in published signals.

## Outcome review

Copied activity should be evaluated two ways:

1. **Source outcome** — how the source itself performed.
2. **Follower outcome** — how MetaEdge's transformed copy performed after latency, sizing, leverage caps, slippage and portfolio constraints.

The difference is valuable product information and must not be collapsed into one number.