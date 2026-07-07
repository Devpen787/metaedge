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
