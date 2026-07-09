# Why We Found Nothing: A Power Analysis — 2026-07-09

This report explains, quantitatively, why 61 out-of-sample tests produced roughly
what chance predicts. The answer is not "there is no edge." It is worse and more
useful: **we were testing in a regime where no tradeable edge could ever have been
detected, no matter how real it was.**

## The two walls

A strategy must clear two independent hurdles:

1. **The cost wall.** Edge per trade must exceed the round-trip cost (~20bps at our
   measured 4.5–13bps/side).
2. **The detection wall.** Edge must be large enough to distinguish from noise given
   our sample. This is the smallest effect our data can see at 80% power, α=0.05.

An edge between the two walls is **real, profitable, and invisible.** We would test
it, fail to reject the null, and record "rejected" — correctly by the statistics,
catastrophically by the economics.

## Measured, from our own 2y × 1h bars (AVAX, BTC, DOGE, ETH, SOL)

| Holding horizon | Return σ | Non-overlapping windows | Smallest detectable effect | Binding wall |
|---|---|---|---|---|
| 1h | 82 bps | 87,595 | **3 bps** | cost |
| 2h | 116 bps | 43,795 | **6 bps** | cost |
| 4h | 164 bps | 21,895 | **12 bps** | cost |
| 6h | 199 bps | 14,595 | **18 bps** | cost |
| 12h | 278 bps | 7,295 | 36 bps | **detection** |
| 24h | 380 bps | 3,645 | 70 bps | **detection** |
| 48h | 569 bps | 1,820 | **148 bps** | **detection** |

Return σ grows as √H while the number of independent windows falls as 1/H, so the
detectable effect grows roughly **linearly with horizon**. The crossover is near **6
hours**.

## The indictment

**Every family we tested held positions for 48–500 hours.**
`momentum_breakout` maxHold=48 · `rsi_meanrev` maxHold=48 · `meanrev_stab` maxHold=72
· `vol_squeeze` maxHold=72 · `trend_atr` maxHold=500.

At 48h our data cannot see any effect smaller than **148bps per trade**. A 148bps-per-
48h edge on BTC would compound to several hundred percent a year. **Such an edge cannot
persist in a liquid market.** Therefore our entire research program was capable of
detecting only edges too large to exist.

We did not fail to find an edge. We ran a search that could not have found one.

This also reframes today's `funding-crowding-signal-v1` kill: its pooled spread was
+100bps at 48h with t=1.48 — inside the noise floor of 148bps. The test was honest and
correctly killed the card, but it never had the power to say anything else.

## What actually buys power

**1. Shorter horizons.** At H ≤ 6h, detection is cheap and *cost* becomes the only
barrier. Any edge worth trading (>20bps) is visible. This is where our existing data
already has power — and where we never looked.

**2. Breadth.** Windows scale with the number of independent assets. The scanner's
41-coin universe is ~8× our 5-coin sample, shrinking the detectable effect by √8 ≈ 2.8×:
36bps → 13bps at 12h, 70bps → 25bps at 24h. **The opportunity screener's real purpose is
statistical power, not "watching more coins."** That was not the argument made for it, and
it is a better one.

Short horizons × wide universe is the only region where our data can answer the question.

## Honest limits of this analysis

- σ is measured on close-to-close 1h bars; intrabar path is unknown, and our data
  contract forbids assuming it. Short-horizon strategies are more path-dependent, so a
  1–6h backtest carries stop/target sequencing risk a 48h one does not.
- 20bps round-trip is our measured spot cost. At 1–2h horizons trade count explodes,
  so cost realism (spread, impact at size) matters far more and is currently unmeasured
  below the daily scale. Cost being the binding wall is not good news — it means the
  edge must be genuinely large per trade.
- Assets are correlated; "independent windows" overstates true independence. The real
  detectable effects are somewhat worse than the table shows.
- Power ≠ edge. Testing where we CAN see does not mean there is anything to see.

## Consequence for the research program

Retire the 48h default. It was never chosen — it was inherited, exactly like the 1h bar,
the 11-token universe, and the top-40 rank cutoff. Every one of those was an unexamined
convenience that silently determined an outcome.

The next directional card must state its horizon **from the detection/cost analysis**,
not from habit, and must operate on the widest universe its data contract supports.
