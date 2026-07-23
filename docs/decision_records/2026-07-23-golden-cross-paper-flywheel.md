# Golden-cross paper flywheel: wired end to end

Date: 2026-07-23
Status: DECIDED — the Volume-Confirmed Golden Cross runs end to end in paper; proven by
`scripts/golden_cross_flywheel_probe.ts` (FACT_CLOSED).

## What was blocking it, and how each blocker fell

The edge is a 2,253-coin, 200-DAY phenomenon; the live runtime priced only 11 majors and kept
~16 days of hourly closes. Three slices closed the gap, each probe→fix→re-proof:

- **Eyes** (`server/broad_feed.ts`, commit 36e829e): one bulk-ticker call per venue (Binance
  ~700 + Gate ~2000 USDT pairs) every 30s → live price + 24h volume for the whole universe.
  `getSpotPrice()` falls back to it, so the runtime + Risk-OS can price long-tail tokens.
- **Brain** (`server/decision/daily_features.ts`, commit 141f390): daily 50/200 SMAs + 50-day
  avg volume bootstrapped from the on-disk cache and evolved with today's live bar; a daily roll
  keeps the series current. Fixes that `sma200` was a 200-HOUR SMA.
- **Trigger** (`server/decision/golden_cross_scanner.ts`, this commit): scans the liquid universe
  for a fresh 50/200 cross + >=3x 50-day volume + >=$1M turnover, opens a paper long, and tags it
  with a 15% trailing stop in `db.trailingState`.
- **Exit** (Risk-OS, extended this commit): `checkStopsOnce` now trails MULTI-SYMBOL positions
  driven by `db.trailingState` (one book agent holds many symbols), keeping the hard-stop path for
  single-symbol strategies. Race-safe as before.

## Re-proof (end to end, isolated DB)

`scripts/golden_cross_flywheel_probe.ts`:
```
class FACT_CLOSED
entryGatesMatchResearch: true    (fresh cross + 3x vol + $1M; dropping any gate → no entry)
entryOpensAndTagsTrailingStop: true   (opened BTC @100, trailingState trailPct 15, hwm 100)
riskOsTrailsAndFlattens: true    (peak → 120 persisted, flatten @101, pos → 0)
[golden-cross] entry BTC @ 100 (trail 15%)
[risk-os] trailing_stop flatten Golden Cross Book BTC @ 101 (stop 102.00)
```
Both earlier Risk-OS probes still FACT_CLOSED after the multi-symbol refactor; tsc clean;
test:decision 15/15. Wired in `server.ts`: startBroadFeed → startDailyRoll → startRiskLoop →
startGoldenCrossScanner.

## Honest limits (logged, not fixed)

- The bootstrap daily cache is a snapshot; `startDailyRoll` keeps it current forward, but a coin
  newly listed after the snapshot has no 200-day history until it accrues. A periodic re-fetch of
  daily klines (like golden_cross_backtest) would fill gaps — not built.
- Paper only — no live order path (that is downstream of Paradox 2 and a CEX-vs-DEX execution
  decision). This collects a forward paper track record; the falsifier is the operating model's
  "post-cost forward expectancy <= 0 or win rate < 55% after 30 closed trades." It is allowed to fail.
