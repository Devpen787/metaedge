# Data Requirements & Contracts

Rule: **No backtest may run without a data contract.** The funding units bug
(2026-07-08: thresholds in percent compared against fractions, invalidating two
full study runs) is the defect class this document exists to prevent — a
contract's FIELDS/UNITS section forces the check before code runs.

**UNITS ARE NOW CODE (2026-07-09).** Prose did not prevent the funding bug, and it
did not prevent the open-interest bug six weeks later. Every unit conversion now
lives in `server/units.mjs` — one implementation, imported by both the TypeScript
server and the `.mjs` scripts (previously the funding annualization was re-derived
by hand in **four** places):
- `fundingAprPercent(fundingHourly)` — hourly FRACTION → annualized PERCENT
- `openInterestUsd(oiCoin, markPx)` — BASE-COIN units → USD notional (null if no mark)
- `annualizedReturnPercent(returnFraction, hoursDeployed)` — a *different* conversion,
  named separately so it can never be conflated with the rate conversion.

Do not re-derive these. The sections below describe what the data means; `units.mjs`
is what enforces it.

## Contract template

```markdown
### Contract: <dataset-slug>
- Venue / instrument / timeframe:
- Source (exact API/file):
- Fields (name, type, UNITS, example value):
- Timestamp convention (tz, open/close-of-bar, ms/s):
- Alignment (how it joins other datasets; join key):
- Missing-data policy (gaps, halts, listing dates):
- Survivorship considerations:
- Fee model · spread/slippage model · funding/borrow model (if applicable):
- Latency assumption:
- Corporate action / event handling (if applicable):
- WHAT CANNOT BE CONCLUDED from this dataset:
```

## Retroactive contracts for datasets already in use

### Contract: binance-klines-1h
- Venue/instrument/timeframe: Binance spot USDT pairs, 11 tokens, 1h OHLCV, 2y.
- Source: `GET /api/v3/klines` → `data/market/backfill-<SYM>-1h.jsonl` (rebuildable, gitignored).
- Fields: t (ms, bar OPEN time), o/h/l/c (quote USDT, float), v (base vol), qv (quote vol), trades (count).
- Alignment: join on `Math.floor(t/3600000)`; note HL funding stamps ~hh:00 + drift.
- Missing data: MATIC truncated (POL migration, ~2mo only) — excluded from sweeps.
- Survivorship: universe hand-picked from CURRENT majors → survivorship bias
  acknowledged; delisted/collapsed tokens absent. Results overstate universe quality.
- Fees/slippage model: 10bps/side flat (vs measured live 4.5–13bps) — conservative.
- Latency: signals on bar close, entries at NEXT bar open.
- CANNOT conclude: intrabar path (stop-vs-target sequencing is assumed
  conservative), spread dynamics, book depth, exchange downtime effects.
  Binance prices ≠ our live CoinGecko-derived feed (survivors must forward-verify).

### Contract: hyperliquid-funding-history
- Venue/instrument/timeframe: Hyperliquid perps, hourly funding + premium, 2y, 7 coins.
- Source: `POST /info {type:fundingHistory}` → `data/market/funding-hist-<COIN>.jsonl`.
- Fields: t (ms), funding (HOURLY RATE as FRACTION, e.g. 0.0000125 = 1.25bp/h ≈ 11% APR — **always annualize ×24×365×100 before comparing to percent thresholds**), premium (perp-vs-oracle FRACTION).
- Alignment: hour-floor join to klines (see above; timestamps drift seconds past the hour).
- Missing data: none observed in 17,519-row pulls; kPEPE = 1000×PEPE (ratio-safe).
- Fee model: 40bps per 4-leg episode (open/close × spot/perp), conservative.
- CANNOT conclude: exchange/custody risk, fill quality at size, spot-leg borrow
  availability, funding of coins not pulled, pre-2024-07 regimes.

### Contract: metaedge-recorder-live
- Venue/instrument/timeframe: our production feed (CoinGecko primary/Coinbase
  fallback), 11 tokens, 1-minute ticks + hourly funding snapshot, 30d rotation.
- Source: `server/recorder.ts` → `data/market/ticks-*.jsonl`, `funding-*.jsonl` (on the VM).
- Fields: t (ms), sym, px (USD float), chg24h (PERCENT), vol24h (USD), hi/lo24h.
- Alignment: the ONLY dataset that matches live paper fills exactly (same feed).
- Missing-data policy: recorder gaps = server restarts; strategies requiring
  history must DECLINE (INSUFFICIENT_HISTORY), never backfill from other feeds.
- CANNOT conclude: anything before 2026-07-07 (recorder birth); order-book
  microstructure; true spreads.

## Data inventory & classifications (Foundation Task B, 2026-07-08)

| Data item | Class | Detail |
|---|---|---|
| OHLCV (1h, 2y, 10 tokens) | **available** | binance-klines-1h contract; MATIC truncated |
| OHLCV (4h/1d) | **missing-required-now** | derivable by aggregation from 1h — needed to escape the 1h-default anti-pattern |
| Live feed ticks (1m) + 24h vol | **available** | metaedge-recorder-live contract; born 2026-07-07, 30d rotation |
| Volume (bar volume, quote volume, trade count) | **available** | in klines fields v/qv/trades |
| Realized volatility | **available (derived)** | ATR/σ computable from klines; contract covers units |
| Spread / slippage (historical) | **missing — useful-later** | only our own 15 live fills measured (4.5–13bps); no historical book data |
| Order book / depth | **missing — useful-later** | no free historical source; live snapshots possible via HL API if a card needs them |
| Funding rates (hourly, 2y, 7 coins) | **available** | hyperliquid-funding-history contract |
| Spot-perp basis (premium) | **available** | same contract, premium field |
| Open interest | **partial** | live OI captured hourly by recorder (since 2026-07-07); historical OI missing — useful-later |
| Liquidation data | **missing-required-now** for the dislocation pool | HL has no free historical liquidation feed; blocks dislocation cards — investigate alternatives before that pool opens |
| Options volume/OI/skew/expiry | **missing — required for law-16 cards** | Deribit public API has CURRENT data; historical is paid. Expiry CALENDAR is free (deterministic dates) → expiry-effect cards testable from price alone |
| Event / macro / earnings calendar | **missing — useful-later** | no source wired; blocks event-driven pool |
| Session / timezone data | **available (derived)** | timestamps carry it; session-effect cards testable now |
| Venue fees | **available** | HL taker 4.5bps measured; paper model 10bps/side documented |
| Wallet / execution constraints | **available** | policy limits, allowlist, canonical guard — in safety policy |
| Live feed coverage | **available** | 11 tokens; expansion = deliberate universe decision, not convenience — REQUIRES a universe contract (below) before use |
| Timeframe choice | **decision, not default** | timeframe (1h/4h/1d) must be justified on the card from cost + signal half-life; 1h-by-default is a logged failure mode |
| **Dangerous to fake** | — | intrabar path (stop/target sequencing), spreads, book depth, liquidation prices, pre-recorder live history, borrow availability. NEVER simulated with assumptions — strategies decline instead |

### Contract (REQUIRED before any universe expansion): metaedge-universe
- Selection rule: assets enter the universe by an EXPLICIT criterion, never by
  hand-typing a favorite. **Criterion set 2026-07-09, derived from live data
  (not assumed)** — rank top 40 by 24h volume, then EXCLUDE:
  1. `BROKEN_FEED` — missing price, high_24h, low_24h, or market_cap. (RSPCX
     reported $35B volume with no high/low.)
  2. `STABLECOIN` — detected structurally, NOT by denylist: `|price−1| < 0.02`
     AND `(high−low)/price < 0.01`. A maintained denylist is fragile — the first
     draft caught USDT/USDC/USD1/USDS but MISSED USDG. Peg + zero range is the
     property that matters, so test the property.
  3. `WASH_ADJACENT` — `volume_24h / market_cap > 0.5`. Evidence: legitimate
     majors observed at 0.01–0.13×; SHEB at **92,283×** ($19.6B volume on $212k
     cap), QUQ 107×, CAP 13×. Turnover far above float is not liquidity.
  4. `LIQUIDITY_FLOOR` — volume_24h < $50M.
- Exclusions are RECORDED with reasons in universe_membership_snapshot, never
  silently dropped — the excluded set is evidence, not waste.
- API cost: ONE CoinGecko `/coins/markets` call returns the whole ranked set
  (cached 10 min). **Hyperliquid LIVE funding is also ONE call** — see the
  corrected note under funding_scanner_snapshot. The funding-capture universe is
  listed explicitly because membership is a recorded data decision, NOT because
  calls are rationed.
- **Rank is a FETCH BOUND, never a criterion.** Membership is decided by the
  liquidity floor + quality filters above. A top-40 rank cutoff (first draft)
  silently excluded DOT — rank 52, $67M volume, and our ONLY directional survivor
  — for no reason but a round number. Round-number cutoffs are the same
  unexamined-default failure as the 1h timeframe. Fetch 100; filter by rule.
- KNOWN GAPS in the criterion (recorded, not silently tolerated):
  - No wrapper/duplicate rule. WETH is excluded, but as `WASH_ADJACENT` — right
    outcome, WRONG reason (its market cap counts only wrapped supply, inflating
    vol/mcap). A wrapper of an asset already in the universe should be excluded
    as a duplicate.
  - No asset-class rule. XAUT and PAXG (gold-backed, ~$4,095) pass every filter.
    Gold proxies have different drivers than crypto and are not obviously in scope.
- WHAT CANNOT BE CONCLUDED: that surviving these filters means an asset is
  manipulation-free or tradeable at size — only that the four stated defects
  are absent. Depth and spread remain unmeasured.
- Survivorship: expanding only into current-liquid majors repeats the existing
  bias; the criterion must state how delisted/dead names are represented or why
  their absence is acceptable for the card using it.
- API cost: CoinGecko `/coins/markets` fetches all symbols in one call (adding
  tokens is ~free). Hyperliquid LIVE funding (`metaAndAssetCtxs`) is ALSO one
  call returning all 231 perps. Only HISTORICAL funding (`fundingHistory`) is
  per-coin. The funding-capture universe must still be listed explicitly — not
  to ration calls, but because membership is a recorded decision.
- Storage: ~2MB/day/11 tokens → budget linearly; 30-day rotation holds.
- WHAT CANNOT BE CONCLUDED: that a criterion-selected universe is unbiased —
  only that its bias is now stated and intentional.

## Scanner contracts (opportunity-screener architecture, 2026-07-09)

**HARD RULE for all scoring (prevents the review's formula-units bug):** a
composite score may NEVER sum terms of different units (an APR in percent + a
percentile + an unnamed penalty). Every term is either normalized to a percentile
[0,1] or a z-score BEFORE summation, and the contract lists each term's raw unit
and its normalization. A formula like `funding_apr + basis_quality - penalty` is
INVALID until every term's unit and transform is declared here.

### Contract: universe_membership_snapshot
- Fields: t (ms), symbol, tier (0–3|excluded), included (bool), reason (string),
  criterion_version (string).
- Cadence: daily re-evaluation; append-only. Source: universe_policy.md criteria.
- Retention: full history (small; the point is auditable membership over time).
- CANNOT conclude: that inclusion criteria are optimal — only what they were and when.
- Dangerous to fake: retroactive membership (would recreate survivorship bias).

### Contract: opportunity_scanner_snapshot
- Fields: t (ms), symbol, pool, raw_score_terms (map: name→{value,unit}),
  normalized_terms (map: name→percentile|zscore), score (float, dimensionless),
  decision (candidate|decline), reason, blocked_by[], allowed_for[], data_age_s.
- Cadence: per scan interval (per pool, may differ). Source: scorer over snapshots.
- Retention: 30d rolling (matches recorder), plus survivors logged to registry.
- CANNOT conclude: that a high score predicts profit — only that eligibility held;
  edge is proven downstream by forward paper, never by the score.
- Dangerous to fake: any term with no live source (spread, depth) — omit + decline.

### Contract: funding_scanner_snapshot
- Fields: t (ms), symbol, funding_hourly (FRACTION — annualize ×24×365×100 before
  any percent comparison), funding_apr (PERCENT, derived), premium/basis (FRACTION),
  open_interest_usd (USD NOTIONAL, derived = openInterest × markPx),
  negative_hour_share (fraction), liquidity_flag.
- **UNITS TRAP (caught 2026-07-09 by the scanner's first run):** Hyperliquid's raw
  `openInterest` is in BASE-COIN units, not USD. Percentile-comparing coin counts
  across symbols inverts the true ranking (38k BTC ≈ $2.38B outranked by 5.3M SOL
  ≈ $412M). Only the USD notional is cross-symbol comparable. Never rank on raw OI.
- Missing-data policy: a row lacking markPx is INCOMPLETE → decline
  (NO_FUNDING_DATA). Absence of data is never scored as a low value.
- Cadence: hourly (matches funding capture). Source: recorder + HL metaAndAssetCtxs.
- **COST CORRECTION (2026-07-09).** Two endpoints, previously conflated:
  - `metaAndAssetCtxs` (LIVE): **ONE call returns all 231 perps**, each with
    funding + openInterest + markPx. `recorder.ts:47` filters to `['ETH','BTC','SOL']`
    and DISCARDS 228 coins already fetched. Widening live capture costs ZERO
    additional API calls — the constraint was a hardcoded `if`, never cost.
  - `fundingHistory` (HISTORICAL backfill): genuinely per-coin and paginated.
    This is where linear cost lives (7 coins × ~2,500 rows = 17,519 rows).
  Claiming "funding is per-coin" without naming the endpoint is a cost-model error.
- Note: this is the shared contract the funding-basis-v2 B $100 forward accrual
  reads via `readFundingSeries()` — the scanner's first consumer, NOT a private file.
- `premium` captured from 2026-07-09 (the recorder previously discarded it, making
  basis unmeasurable on our own live feed). Rows before that date report premium
  as **null = UNMEASURED**, never 0. Basis PnL for a short perp = premium(entry) −
  premium(now).
- **Capture coverage is itself evidence.** A recorder gap does not accrue funding,
  so gaps UNDERSTATE carry. Any trial reading this series must compute
  `hoursCaptured / hoursElapsed` and refuse a verdict below 90% — otherwise an
  outage is indistinguishable from a failing strategy.
- CANNOT conclude: fill quality at size, exchange/custody risk.

### Contract: energy_liquidity_snapshot
- Fields: t (ms), symbol, realized_vol_1h/4h/24h (percent, annualized note in card),
  atr_percent (percent of price), volume_24h (USD), range_expansion (ratio),
  vol_percentile [0,1], volume_percentile [0,1], data_age_s.
- Cadence: per scan interval. Source: recorder ticks + derived hourly closes.
- CANNOT conclude: that energy = edge (it is TRADABILITY only); intrabar path.
- Dangerous to fake: spread_proxy without a real basis — omit if unavailable.

### Contract: candidate_decline_record
- RECONCILIATION: this does NOT invent a new store. Declines reuse the existing
  `server/declined.ts` closed-vocabulary counter stream (extended with scanner
  reasons: STALE_DATA, LIQUIDITY_FLOOR, NOT_IN_UNIVERSE, NO_FUNDING_DATA,
  VENUE_UNSUPPORTED). Per-symbol candidate/decline detail lives in
  `opportunity_scanner_snapshot`; aggregate discipline counters live in declined.ts.
- Fields (aggregate): date, source ("scanner"), family (pool), reason (enum), count.
- Fields (per-record, in scanner snapshot): t, symbol, pool, decision, reason,
  blocked_by[].
- Cadence: per scan interval (detail) + daily rollup (counters).
- Retention: detail 30d rolling; counters 90d (declined.ts KEEP_DAYS).
- CANNOT conclude: that declines prove edge — they prove PROCESS DISCIPLINE only.
- Dangerous to fake: a "decline" that was actually a missing-data gap mislabeled
  as a deliberate no-trade — the reason must reflect the true cause.
