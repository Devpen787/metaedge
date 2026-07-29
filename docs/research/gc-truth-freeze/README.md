# Golden-Cross Research Truth Freeze (2026-07-27)

**Purpose:** make the existing in-sample result fully reproducible and define what genuinely
new evidence must come next. **This is not a proof of edge.** Nothing here is proven, real,
executable, validated, out-of-sample, or holdout-confirmed. See `manifest.json` for the
immutable pins (git SHA, script SHA-256s, cache fingerprint, data cutoff).

## 1. Frozen hypothesis (exactly as it exists now)

- **Instrument (intended):** eligible real crypto spot assets only.
- **Entry:** fresh daily SMA50 crossing above SMA200 **AND** cross-day volume ≥ 3× its 50-day
  average **AND** cross-day quote turnover ≥ $1,000,000.
- **Exit:** 15% trailing stop (ratchets on daily highs, triggers on daily lows).
- **No** slope, regime, funding, OI, archetype, or discretionary filter.

## 3. Corrected reproduction command (the documented one was broken)

```
node scripts/golden_cross_backtest.mjs --source multi --max 99999 --fast 50 --slow 200 \
  --wait 90 --trail 15 --volmult 3 --min-vol-usd 1000000
```

- **Documented command omitted `--max`** → defaulted to `MAX=211` → produced **−0.4% median /
  46% win / n=69**, not the claimed number. The corrected `--max 99999` reproduces the frozen
  result: **median +1.1% GROSS / +0.69% NET / 54% win(gross) / 52% win(net) / n=134.**
- Backtest logic was **not** changed to recover the number. The only change is an additive
  `--emit-trades` flag (read-only); both script SHAs produce byte-identical headline stats.

## 6/7. Frozen result (report the numbers, claim nothing)

| Metric | Gross | Net (−0.4% round-trip) |
|---|---|---|
| Median | +1.1% | **+0.69%** |
| Mean | +18.1% | +17.66% |
| Win rate (>0) | 54% | **52%** |
| n | 134 | 134 |
| Median net 95% CI (bootstrap) | — | **[−1.49%, +4.48%] — straddles zero** |

Mean ≫ median ⇒ a **right-tailed payoff dominated by a few winners** (see concentration below).

## 5/6. Robustness diagnostics (stress tests of an in-sample result — NOT holdout)

Full output: `robustness.txt`. Machine-readable trades: `trades.jsonl`. Sensitivity: `sensitivity.txt`.

| Diagnostic | Result | Survives? |
|---|---|---|
| **Bootstrap 95% CI (median net)** | [−1.49%, +4.48%] | ❌ includes zero |
| **Chronological folds (4)** | +5.4% / **−2.9% (29% win)** / +2.3% / +4.4% | ❌ one fold badly negative |
| **Early vs late half** | early −0.4% / late +3.3% | ⚠️ positive only late |
| **Leave-one-venue-out** | Binance-only **−0.6% (48%)**; Gate-only +3.9% (60%) | ❌ all edge from Gate |
| **Turnover cohorts** | ~+1% median across $1-5M/$5-50M/>$50M | ✅ roughly flat |
| **Volume-multiple cohorts** | 3-5x **−0.86% (46%)**; 5-10x +0.5%; **≥10x +20.8% (88%, n=16)** | ❌ edge only in ≥10x |
| **Real-spot-only (remove leveraged/stable/wrapped/tokenized)** | +0.48% / 51% (n=125; 9 non-spot removed) | ➖ ~unchanged |
| **Date-clustering (independence)** | 134 trades on **92 dates**; one date = 8 entries | ❌ effective n ≪ 134 |
| **Concentration** | top 1 = 20%, top 5 = 45%, **top 10 = 66% of total**; remove top 10 → **median −0.40%** | ❌ outlier-driven |
| **Sensitivity (vol×trail)** | vol2x/trail10 **+4.0%/65%**; vol3x/trail15 +1.1%/54%; **vol3x/trail20 −2.7%/45%** | ❌ knife-edge, chosen config not best |
| **Max DD (mark-to-market concurrency)** | not computed — closed-trade DD −16.9% only | ⛔ blocker (see below) |

## Classification: **FRAGILE HYPOTHESIS**

Positive point estimate, but it does not survive stress: net median +0.69% with a CI that
straddles zero; ~66% of the total return from 10 of 134 trades (remove them → negative median);
all of the edge sits in Gate-sourced symbols and in the ≥10x-volume subset; one time-fold is
strongly negative; the result is knife-edge in the trailing-stop width; and the 134 "trades" are
not independent (92 dates, heavy cross-correlation). Not **REJECTED** (mechanism is plausible;
day-level and high-volume signals are suggestive). Not a clean **FORWARD-TEST CANDIDATE** without
all of the above stated as unresolved. Net win rate 52% is **below the 55% kill threshold**.

## 8. The only acceptable future confirmation

1. **Genuinely unseen forward data** collected strictly after this freeze (live paper trades
   dated after 2026-07-27), evaluated once at the frozen config with no re-tuning; **or**
2. **A clearly independent dataset** never examined during this parameter search (a different
   exchange universe, or a pre-2023 history window never used here), evaluated once, no re-tuning.

## 9. Proposed forward falsifier (PROPOSED, NOT ADOPTED)

**Why "30 trades, win rate < 55%" is statistically inappropriate for this payoff profile:**

- The payoff is **right-tailed** (net mean 17.7% ≫ net median 0.7%; 66% of profit from 10 trades;
  win rate only ~52%). For such a distribution, **win rate is the wrong primary metric** — a
  strategy can win <50% of the time and still be highly profitable if winners are large enough
  (this profile), and a 55% win-rate gate would kill a genuinely profitable right-tailed strategy
  while passing an unprofitable high-win-rate one.
- **n = 30 is far too small** when a handful of trades dominate: the mean (the metric that
  actually matters here) has enormous variance, so expectancy can be neither confirmed nor
  rejected at n=30. And because trades **cluster on market-wide events** (92 dates for 134
  trades), the **effective** independent sample is smaller still.

**Proposed (do not adopt yet):**
- **Primary metric:** net expectancy per trade (bootstrap CI), on FORWARD data only.
- **Sample:** a target **effective (de-clustered) sample** (e.g., ≥50 distinct entry *dates*, not
  trades), acknowledging one big up-day is one observation, not many.
- **Secondary gates:** the CI lower bound > 0 after costs; a tail/drawdown check; and it must beat
  a naive baseline (buy-and-hold or random same-horizon entry).
- **Threshold pre-registered BEFORE seeing forward data**, and win rate demoted to a descriptive
  stat, not a kill trigger.

By the *current* inherited rule (from `rsi_meanrev`), the strategy would fail immediately (52% net
win) — but that rule is mis-specified for this payoff shape, so the failure is a statement about
the rule, not conclusive about the strategy.

## Unresolved blockers

1. **Mark-to-market concurrency max-DD not computed** — the trade log lacks intra-trade price
   paths; a proper portfolio MTM equity requires a separate backtest pass carrying daily marks.
2. **Venue provenance not persisted** — leave-one-venue-out uses a run-time re-derivation, not the
   fetch-time venue; may misclassify some symbols.
3. **Tokenized-equity detection is heuristic/incomplete** — the real-spot-only diagnostic may miss
   some non-spot instruments.
4. **Instrument contract undefined** — backtest (stable/wrapped excluded) ≠ production (Gate-only,
   nothing excluded).
