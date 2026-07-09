# Research Card: funding-crowding-signal-v1

Status: PRE-REGISTERED — hypothesis and test fixed BEFORE any result was seen.
Created: 2026-07-09 · Pool: positioning / forced-unwind · Instrument: crypto perp + spot
Type: **SIGNAL TEST, not a strategy.** It asks whether information exists. It
proposes no entry, no exit, no sizing. Those require a separate card if this survives.

## Why this card exists

Every family we have tested (momentum, trend, mean-reversion, vol-squeeze,
volume-surge, relative-strength) used **price-only features, long-only, at 1h, on
the ten most liquid and most arbitraged coins**, across one market regime. 61
out-of-sample combinations produced roughly what chance predicts (~3 expected
false winners; ~9 cleared a loose bar; none survives multiple-testing correction
honestly). That is not bad luck — it is searching the most crowded pool with the
most public features.

Meanwhile we hold 17,519 rows of hourly funding AND premium and have never asked a
DIRECTIONAL question of them. We only ever tried to harvest funding as a yield.

## Participant map (Market Researcher)

Funding is a published, real-time readout of **how crowded and how levered the long
side is**. It is not an indicator someone invented; it is a payment that levered
longs are *contractually forced* to make, every hour, to hold their position.

- When funding is extremely POSITIVE, longs are crowded and paying to stay in.
  Crowded levered longs are the population most vulnerable to forced liquidation on
  any dip. Their forced selling is supply that must be absorbed at a bad price.
- When funding is extremely NEGATIVE, shorts are crowded and paying. Same logic,
  mirrored.

**Who pays us:** the marginal levered participant who is squeezed out of a crowded
position. **Why it may persist:** leverage is structurally supplied by the venue and
crowding is visible only to those who look at funding, not price. **Why it may NOT
persist:** funding is public and free; if the effect were large, it would be arbed.
We therefore expect a SMALL effect, if any — and small effects die to costs.

## Core sentence

Because levered longs are forced to pay hourly funding to maintain crowded
positions, and because crowding therefore appears directly in the funding series,
periods of extreme positive funding should be followed by LOWER forward returns
than periods of extreme negative funding. False if that spread is statistically
indistinguishable from zero, or smaller than round-trip cost.

## Data (Data Engineer)

- Contracts: `hyperliquid-funding-history` (funding = hourly FRACTION; premium =
  FRACTION) + `binance-klines-1h`. Both already exist.
- Joinable universe: **AVAX, BTC, DOGE, ETH, SOL** (funding history ∩ price bars).
  WIF and kPEPE have funding but no bars — excluded, not faked.
- Units: annualization via `server/units.mjs` only. Never re-derived.
- Known bias: universe is current-liquid majors → survivorship acknowledged.

## PRE-REGISTERED TEST (fixed before execution)

**Primary hypothesis — ONE test, one direction, no fishing:**
- Feature: trailing 24h mean funding, annualized to PERCENT, ranked into deciles
  *within each coin* (so coins with different funding regimes are comparable).
- Sample: **non-overlapping** 48h forward windows (sampled every 48h) so returns are
  not autocorrelated. Overlapping windows would inflate significance.
- Horizon: 48h, chosen a priori (crowding unwinds over days; matches our existing
  48h time stops).
- Statistic: mean forward 48h return of the TOP funding decile minus that of the
  BOTTOM decile, pooled across the 5 coins.
- **Pre-declared direction:** top-decile minus bottom-decile is expected to be
  NEGATIVE. A positive result does not confirm a reversed hypothesis — it falsifies
  this one.
- Significance: two-sample t-test, one-sided, α = 0.05. This is the SINGLE
  confirmatory test; no multiple-testing budget is spent on it.

**Economic threshold (a p-value is not an edge):**
The decile spread must exceed **20bps** (a round-trip at our measured 4.5–13bps/side)
to be worth anything. A statistically significant 5bps spread is a curiosity, not money.

**Secondary analyses — EXPLORATORY, declared as such in advance:**
per-coin breakdowns and horizons {24h, 72h}. These may NOT be promoted to a claim.
They exist to describe, not to confirm. Any finding there requires a NEW card.

## Falsifier (pre-committed)

Kill if EITHER: (a) the pooled decile spread is not significantly negative at
α = 0.05 one-sided, OR (b) its magnitude is below the 20bps cost threshold.
No re-slicing, no horizon-hunting, no coin-dropping after seeing results.

## Power warning (stated before, not after)

2y hourly, sampled non-overlapping at 48h ≈ 365 windows per coin ≈ 1,825 pooled;
a decile is ~180 observations. We can detect a large effect. **We cannot detect a
small one.** If the true effect is 10bps, this test will fail to find it and we will
correctly conclude "no usable edge" — because a 10bps effect is not usable anyway.

## Safety classification (Product Safety Officer)

Analysis only. Touches no wallet, places no order, drives no agent. Even if it
survives, it produces a SIGNAL, not permission to trade. A strategy built on it
requires its own card, contract, WHERE/WHEN selector, cost model, and forward paper.

## Sign-offs
MR ✅ (forced-participant map with a stated reason it might NOT persist)
DE ✅ (both contracts exist; joinable universe named; unfakeable gaps excluded)
QR ✅ (single pre-registered primary; non-overlapping samples; direction and
       threshold fixed in advance; power limitation stated up front)
XR ✅ (analysis only, no execution path)
PS ✅ (no wallet, no agent, no trade)

## Decision log

2026-07-09 (pre-registration): Card fixed. Test not yet run.

2026-07-09 (result): **KILLED by its own pre-committed falsifier.**
- Pooled 48h decile spread: **+100.2 bps** (predicted NEGATIVE). Top-funding decile
  forward return +108.5bps; bottom decile +8.3bps. One-sided t = 1.482, p = 0.93.
- Falsifier (a) significantly negative? NO. (b) magnitude > 20bps cost? NO (wrong sign).
- The sign came out OPPOSITE to prediction. Per the pre-registration, **this falsifies
  the card and does NOT confirm a reversed hypothesis.** The reversed direction is not
  significant either (p ≈ 0.069), and it is confounded with trend — high funding occurs
  *because* price is rising and longs pile in. Trend was already tested and killed.
- Per-coin spreads are wildly heterogeneous (BTC −51.6bps, DOGE +310.7bps). The pooled
  positive number is driven by DOGE's fat tails, not a stable effect. No claim is made
  from this; it is descriptive only, as declared in advance.

**The deeper finding (see `reports/statistical-power-2026-07-09.md`):** at a 48h
horizon our data cannot detect ANY effect smaller than ~148bps. The observed 100bps
spread sits *inside the noise floor*. This test was honest and correctly killed the
card — but it never had the power to conclude anything else. The same is true of all
61 prior out-of-sample tests, every one of which held for 48–500 hours.

Do not resurrect this hypothesis at a 48h horizon. If it is retested, it must be at
H ≤ 6h and across the widest universe the data contract supports, where a tradeable
edge would actually be visible. That would be a NEW card (v2), not a re-run of this one.
