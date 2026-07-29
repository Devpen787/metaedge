# Research Card: rsi-meanrev-dot-v1

Status: CANDIDATE — screened, NOT verified. Next stage: paper forward test.
Created: 2026-07-07 · Signal family: rsi_meanrev · Universe: DOT only (as screened)
Source: walk-forward sweep `data/edgeops/backtest-report-2026-07-07.md` (grid of 180 configs, 1,620 fold-evaluations logged)

## Hypothesis

Buying DOT dips (RSI14 ≤ 35 on 1h bars) while above the 200-bar SMA (uptrend
filter) mean-reverts far enough to pay a 2R target before a 3% stop.

## Screened result (out-of-sample only, costs included at 10bps/side)

- n=40 OOS trades · 75% win rate · +0.766%/trade expectancy · PF 2.08
- positive in 7/9 walk-forward folds · max drawdown 12.2%

## Why this is NOT yet an edge (read before excitement)

1. **Multiple testing:** 1,620 evaluations produced exactly one survivor —
   consistent with a small real effect OR with luck clearing a strict bar once.
2. **Regime:** 2 years ≈ one macro regime. DOT-specific dip-buying may be a
   regime artifact.
3. **Feed mismatch:** screened on Binance candles, not our live feed.

## Falsifier (kill conditions)

- Paper forward test on OUR feed: if expectancy after costs ≤ 0 over n≥30
  forward trades, kill.
- If the live win rate drops below 55% over n≥30, kill (screened 75%).

## Forward-test plan

- Encode as autotrader family `rsi_meanrev_dot` using recorder-derived RSI
  (needs ≥14h of live ring history before first signal — no backfilled RSI).
- Entry: RSI14(1h) ≤ 35 AND price > SMA200(1h). Exit: +6% target / −3% stop /
  RSI ≥ 50 / 48h time stop. One position at a time.
- Family count check: adding this makes 5 active families — AT the cap. No
  further families until one is killed.

## Benchmark

Buy/hold DOT over the same window; the existing mean_reversion baseline.

## Selection audit — 2026-07-09 (re-derived from the registry, not from memory)

The claim "DOT is our surviving directional strategy" was repeated many times from
a single report line. Re-checked against `hypothesis-registry.jsonl` (deduplicated:
1,073 test rows contained 530 duplicate entries — the sweep wrote each row ~3×).

**What holds up:**
- The walk-forward is CLEAN. One config per fold on the test window; params were
  chosen on train. No selection leakage into out-of-sample data.
- DOT rsi_meanrev, deduped: n=40, 7/9 positive folds, +0.766%/trade.

**What does NOT hold up:**
- **It was never "the only survivor."** Nine (family × symbol) combos clear a
  comparable bar. **XRP meanrev_stab has HIGHER pooled expectancy (+0.998%/trade)**
  — from a family we declared dead. The selection rule that promoted DOT over XRP
  was never written down.
- **DOT appears in THREE of the nine clearing combos** — rsi_meanrev, volume_surge,
  AND meanrev_stab. Three unrelated families, all buy-the-dip-shaped, all "working"
  on the same coin. The parsimonious explanation is a property of DOT's price
  series, not three independent edges.
- **DOT is the thinnest name in the legacy universe** (rank 52 by volume, $67M; it
  fails the scanner's own top-40 cut). Thin books produce fat tails that flatter
  backtests and punish real fills. The flat 10bps/side cost model is likely too
  generous for DOT specifically.
- 61 out-of-sample combos were evaluated. Naive chance alone yields ~3 apparent
  winners; and these tests are NOT independent (one market regime, correlated
  assets), so the true multiple-testing penalty is worse than that estimate.
- n=40 sits exactly in the band our own rules call "observation, not belief."

**Verdict of the audit:** the card stays alive, but its status is demoted from
"the survivor" to **one of nine candidates, selected on grounds never recorded**.

**Pre-committed before the Jul 16 forward trial arms (so it cannot be chosen after):**
1. The falsifier metric is **post-cost expectancy per trade**, measured on our own
   live fills, benchmarked against buy/hold DOT over the identical window.
2. Costs for DOT are NOT assumed at 10bps/side. Real fills are measured; if the
   realized round-trip cost exceeds 0.766% of position value, the edge is arithmetic
   noise and the card dies regardless of hit rate.
3. **DOT's tri-family appearance is itself a testable hypothesis:** if the same
   dip-buying entry clears the bar on DOT across three families, the edge is
   properly attributed to the ASSET, not the signal. A v2 card must test the entry
   on a liquidity-matched control set before any claim of a signal edge.
