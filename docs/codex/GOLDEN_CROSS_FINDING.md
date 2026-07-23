# Golden Cross (50/200 daily) — does it have a tradeable edge in crypto?

Status: RESOLVED (2026-07-23)
Tool: `scripts/golden_cross_backtest.mjs`

## Question
Does the classic daily golden cross (50-SMA crossing above 200-SMA) predict a move,
and is any of it a *tradeable* edge — not just a survivorship/illiquidity artifact?

## Data
- `--source multi`: deduped USDT-pair **daily** klines from Gate (2071) + Binance (470) +
  MEXC (1773) = **2,893 unique coins**, ~2,253 with enough history for a 50/200 cross.
  Cached under `data/market/momentum/gccache-multi/` (gitignored).
- `--source backfill`: the project's own 638-coin Binance+Coinbase hourly DB
  (`data/market/backfill-*-1h.jsonl`, via `refresh_universe.mjs`) resampled to daily.
- CoinGecko/CMC deliberately NOT used for deep history: free tier caps at 365d and
  rate-limits bulk pulls (same rationale as `refresh_universe.mjs`). Exchange klines are
  the only free path to thousands-of-coins deep daily history.

## Method
Per coin: detect golden crosses, then measure three things —
1. **Pop analysis** — did price close ≥ +2/5/10% within a forward window, and how fast,
   vs an *ambient baseline* (every eligible day) so the cross has to beat a random day.
2. **Round-trip** — hold to the next death cross: peak (MFE on intraday highs), exit,
   giveback, hold days. This is how the strategy is naively traded.
3. **Managed exit** — golden cross entry + a fast OHLC exit (trailing stop / TP / hard
   stop / time stop), conservative intrabar ordering (stops before TP).
Plus entry-quality filters: 200-SMA slope, volume expansion, freshness, absolute USD floor.

## Findings

**1. Naive golden cross = no edge.** Pop-rates look high but don't beat baseline, and the
edge flips sign by universe (noise). Held to the death cross, the median trade is **−22%**,
win rate **13%** — the median peak of **+14% (at ~day 7)** is entirely given back because the
death-cross exit lags ~55 days.

**2. The exit is not the problem — the entry is.** Trailing-stop tightness is *monotonic*:
the tighter the trail, the less bad the result (trail 15% ≈ breakeven; looser = worse;
death-cross = worst). When choking the trade is the only thing that helps, the entry is
dropping you into post-impulse exhaustion. Tight trail-15% is optimal and stays optimal
under every later filter.

**3. Volume is the one real filter.** Golden cross on **≥2–3× the 50-day average volume**
flips the edge positive; slope-200-rising only reaches breakeven; freshness does nothing
(real 50/200 crosses don't braid); stacking filters over-fits to noise. Volume ALONE.
Dose-responsive (more volume → better median AND win rate) = signature of a real signal.

Full universe (2,253 coins, 2,533 crosses, trail 15%). *Median + win rate are the honest
stats; the mean is inflated by untradeable microcap moonshots.*

| Entry filter | Trades | Median | Win |
|---|---|---|---|
| none | 2,533 | −1.9% | 44% |
| slope 20 | 587 | −0.2% | 49% |
| vol ≥2× | 393 | +2.1% | 55% |
| vol ≥3× | 235 | +2.6% | 57% |

**4. The edge survives an absolute liquidity floor.** Requiring cross-day 24h quote volume
(USDT≈USD) above a floor compresses the median but keeps it positive with a healthy sample —
so it is NOT purely a microcap-illiquidity artifact.

| Config | Trades | Median | P75 | P90 | Win |
|---|---|---|---|---|---|
| vol 2×, no floor | 393 | +2.1% | +19.5% | +51% | 55% |
| vol 2× + $250k | 276 | +1.6% | +18.1% | — | 54% |
| vol 2× + $500k | 239 | +1.0% | +17.2% | +57% | 53% |
| vol 2× + $1M | 211 | +0.9% | +17.2% | +56% | 53% |
| vol 3× + $1M | 134 | +1.1% | +22.6% | +63% | 54% |

## Verdict
The naive 50/200 golden cross is **dead as a standalone crypto entry**. **Volume-confirmed
(≥2–3× avg) with an absolute liquidity floor (~$1M/24h) and a tight 15% trailing stop, it is
a real but modest, executable edge**: positive median (~+1% before fees, ~+0.5–0.7% net),
53–55% win rate, fat right tail (p75 +17–23%). Best config: **vol 3× + $1M floor + trail 15%**.

## Asterisks
- Survivorship-biased optimistic (universe = today's listings; dead/delisted coins absent).
- Volume floor uses reported exchange 24h quote volume, not order-book depth — a proxy for
  executability, not a guarantee.
- Spot-long, raw price; ~0.4% round-trip fee assumed, no order-book slippage model.
- MEXC/Gate long-tail data quality is uneven; median/win-rate framing is deliberately
  outlier-robust to compensate.

## Reproduce
```
node scripts/golden_cross_backtest.mjs --source multi --fast 50 --slow 200 \
  --wait 90 --trail 15 --volmult 3 --min-vol-usd 1000000
```
First run fetches + caches ~2,900 coins (~10–15 min); re-runs are instant off cache.
