# Research Card: best-trade-eth-breakout-v1

Status: ACTIVE (armed for the Agent Wallet competition window, through 2026-07-12)
Created: 2026-07-07 · Signal family: momentum · Venue: Hyperliquid ETH perp (real)

## Hypothesis

When ETH breaks its 24h extreme WITH momentum confirmation, the move continues
far enough to pay 2.5:1 before mean-reverting 1%.

## Trigger (ALL must hold — checked by scripts/best_trade_check.mjs)

LONG:  price ≥ 24h high × 0.999  AND  24h change ≥ +1.5%
SHORT: price ≤ 24h low × 1.001   AND  24h change ≤ −1.5%

## Execution plan (pre-committed — no improvising at fire time)

- Size: $3.00 margin @ 5x ≈ $15 notional (equity floor $4.00 respected: max loss ≈ $0.15 at stop)
- Stop: −1.0% from entry (hard invalidation — close immediately, no averaging)
- Target: +2.5% from entry (close at target, no "letting it run")
- Holding window: max 24h; if neither stop nor target hits, close at market
- Operator approval required before entry (never autonomous)

## Falsifier

If the trigger fires and price hits the −1% stop before +2.5% target in ≥3
consecutive firings, the card is killed.

## Benchmark

Buy/hold ETH over the same holding window.

## Honest limits

- n will be tiny (competition window) — this validates the PROCESS, not the edge.
- Win expectancy unknown; 2.5:1 payoff needs >29% win rate to break even.
- Real venue, real fees (~0.09% RT), real slippage — included in review.
