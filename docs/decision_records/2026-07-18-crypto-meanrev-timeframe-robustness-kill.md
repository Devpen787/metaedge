# Lane #2 (crypto mean-reversion harvest): KILLED on timeframe-robustness

Date: 2026-07-18
Status: DECIDED — the 3 survivors are overfit noise; retired. Lane #2 has no active
candidates. Companion: [[edge-lanes-scoreboard]].

## Why this test

Multi-timeframe was raised as a way to find MORE edge (confluence). We rejected the
confluence framing (timeframes are the same price resampled — autocorrelation, not
independent confirmation, and stacking them explodes the hypothesis count). Instead
we used timeframe as a **robustness filter**: a real edge should survive a change of
bar size; an edge that exists on exactly one bar size is fitted to that grid.

## Method

Aggregated the 2y 1h backfill for DOT/ZEC/PAXG to 2h and 4h and re-ran the sweep
(same mean-reversion families, walk-forward folds scaled to bar count).

## Result — all three are timeframe-fragile

| Survivor | 1h (baseline) | 2h | 4h |
|---|---|---|---|
| DOT rsi_meanrev | PF 2.13, n=41 (candidate) | n=1, signal vanishes | n=1 |
| ZEC meanrev_stab | PF 2.14, n=68 (candidate) | PF 1.38, rejected | PF 1.26, rejected |
| PAXG vol_squeeze | PF 2.15, n=37 (candidate) | PF 1.43, rejected | n=3, rejected |

Every one's edge exists at 1h and evaporates or falls below the survivor bar at 2h
and 4h. (ZEC vol_squeeze scored PF 2.30 at 2h — but that is a DIFFERENT family,
cherry-picked from 27 coin×family×timeframe combos, exactly the chance artifact the
multiple-testing accounting warns against. Not a discovery.)

## Verdict

The 3 survivors are **overfit to the 1h grid**, not a real edge. This is the third
independent strike, all pointing the same way:
1. 3 survivors from 3,484 hypotheses (chance-level),
2. no generalization across 37 coins,
3. no survival across timeframes.

Retired all three to `data/edgeops/retired.jsonl`; the forward runner now arms
nothing. Lane #2 (the crypto mean-reversion **income sleeve**) is closed as a
negative — waiting a year for forward n>=30 was not worth it against three
independent strikes.

## Consequence for the barbell

The barbell needed an income sleeve (harvest) to fund the convex sleeve (memecoin
pops). Lane #2 was the income candidate. It is now dead, so **there is currently no
income engine to fund the convex sleeve** even if memecoins prove out. Finding a
real, timeframe-robust income edge is the open structural gap.
