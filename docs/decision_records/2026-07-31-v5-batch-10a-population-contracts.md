# V5 batch 10A — population expansion

Date: 2026-07-31
Status: locally implemented and contract-tested; not deployed
Money boundary: paper only; live execution locked

## Decision

Expand the population with genuinely different mechanisms, not parameter
copies of Golden Cross. Every arm is frozen, versioned, attributed, regime
gated, costed, controlled, and falsifiable before it can consume paper budget.

## Population

The registry now contains 14 arms across 13 families:

- RSI mean reversion;
- 24-hour momentum;
- 24-hour mean reversion;
- grid deviation;
- funding carry observation/control;
- Golden Cross strict;
- Golden Cross participate;
- volatility breakout;
- trend pullback;
- medium-term trend;
- capitulation rebound;
- liquidity expansion;
- low-volatility drift;
- negative-funding reversal.

The first 13 executable arms receive capped `paper_discovery` permission.
Funding carry remains observe-only because the current runtime does not yet
prove the required hedge leg. All trials freeze no-trade and buy-and-hold
controls. A 12–20 arm and 12-family policy range is immutable and hash checked.

## Local proof

Contract tests assert exact plugin identity and mechanism diversity, V5
authority, required features, benchmark, falsifier, failure regimes, frozen
trials, controls, permissions, and live lock.

## Boundary

Registration is not evidence that an arm is profitable. It makes each idea
eligible to generate comparable paper evidence without pretending all regimes
or mechanisms are the same.
