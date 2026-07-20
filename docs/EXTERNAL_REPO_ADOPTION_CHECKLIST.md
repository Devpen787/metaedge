# External repo adoption checklist — Freqtrade / OctoBot / Vibe-Trading

Date opened: 2026-07-20, revised same day five times (pass 1 was
headline-only; pass 2 went deeper across the whole pipeline; pass 3 dug into
OctoBot's trading-mode layer, Freqtrade's edge module fate, and Vibe-Trading's
correlation-regime skill; pass 4 was a direct self-audit — asked "what did I
skip" and found real ones: Vibe-Trading's `agent/backtest/engines/` and
`optimizers/` had only been listed, never opened, meaning the "neither
framework models slippage" claim was checked against 2 of 3 repos, not all 3.
Also opened OctoBot's actual `market_making_trading_mode` source instead of
citing it from a directory listing. Pass 5 was an explicit FULL EXHAUSTIVE
SWEEP, requested after the user asked directly "did you exhaustively go
through everything" and the honest answer was no — dispatched 4 parallel deep
reads covering every remaining unopened area in all three repos, including
ones previously skipped by relevance judgment without asking first
(Vibe-Trading's swarm/debate internals, options/pattern-analysis tools, and
China-market tools). Per explicit "no skimming" repeat instruction).
Status: LIVING —
work through in priority order, check off as implemented, do not silently
drop an item (reject explicitly with a reason instead). Companion to
[[2026-07-16-external-framework-evaluation]] (that record's "do not migrate to
a directional framework" verdict still stands — this checklist is about
INFRASTRUCTURE patterns, not adopting any of these as our strategy source).

**Verification key**, stated per item so nothing here is overclaimed:
- ✅ **CODE** — read the actual source, confirmed real and working
- 📄 **DOCS** — confirmed via README/docs only, source not read line-by-line
- ⚠️ **UNVERIFIED-DEPTH** — claimed in docs, searched for the implementation and
  did not find it at the depth claimed (flagged so it isn't silently credited)

Repos reviewed: [freqtrade/freqtrade](https://github.com/freqtrade/freqtrade),
[drakkar-software/octobot](https://github.com/drakkar-software/octobot),
[HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading).

---

## Organized by pipeline stage, priority within each

### DISCOVER — finding what to test

- [ ] **Composable universe/pairlist filter chain** (Freqtrade `plugins/pairlist/`, ✅ CODE) — TIER 1
  19 pluggable filters (Volume, MarketCap, Age, Spread, Price, Volatility,
  Precision, **Performance** — auto-deprioritizes pairs with a bad recent
  track record, Shuffle, etc.), TTL-cached auto-refresh (default 1800s).
  **Why it matters:** the exact class of bug we hit five separate times this
  session (37→202→452→638 coins, the Coinbase-scope gap, the off-by-one slice
  bug). One tested, composable subsystem — `scripts/lib/universe.mjs` — a
  filter-chain interface (`{filter(candidates) -> candidates}`), reusable
  across crypto/stocks/memecoin universes, instead of continuing to hand-patch.

- [ ] **ccxt unified exchange library** (✅ CODE — verified live: installed the
  real npm package, checked `ccxt.exchanges`) — TIER 1, NEW this pass
  MIT-licensed, 43k GitHub stars, **native JavaScript/TypeScript package**
  (no second language/stack needed — directly resolves the Python-vs-Node
  tension from the earlier migration discussion). Confirmed: covers all 5
  exchanges we currently hand-integrate (Coinbase, Kraken, OKX, Binance,
  Hyperliquid) under ONE consistent method signature (`fetchTicker`,
  `fetchOHLCV`, `fetchTrades`, ...). **Correction on my own first claim:**
  verified `ccxt.exchanges` directly — it does **NOT** include Kalshi or
  Polymarket despite the GitHub description mentioning "prediction markets";
  those stay bespoke (correctly — that's genuinely differentiated work we've
  already built well).
  **Why it matters:** we've hand-written 5+ separate exchange integrations
  this session, each with its own painfully-discovered quirks (Binance field
  names, Coinbase dollar-string quotes, Kraken key-renaming, OKX's `rubik`
  endpoints, Hyperliquid's `info` API). A single battle-tested library
  handling the crypto-exchange layer would have prevented most of those
  parse-bug discoveries. Highest-leverage NEW item from this pass.

- [ ] **Formalize the Evaluator pattern** (OctoBot `packages/evaluators/`, ✅ CODE) — TIER 2
  Independent, pluggable signal modules (`TA_evaluator`, `social_evaluator`,
  `realtime_evaluator`) combined by a strategy through one common interface.
  **Why it matters:** architecturally what `confluence_search.mjs` attempted,
  but we ran it once and moved on. OctoBot treats it as standing
  infrastructure other strategies register into continuously. Port as a
  registry other lanes plug into, not a one-shot script.

- [ ] **Google Trends + Reddit as market_context axes** (OctoBot
  `social_evaluator.py`, 📄 DOCS/code path confirmed, formulas not read) — TIER 2
  Extends the attention axis in `market_context.mjs` beyond Wikipedia
  pageviews alone — cheap, same pattern already proven there.

- [ ] **Event-driven / real-time re-triggering, not just fixed-interval polling**
  (OctoBot `EvaluatorMatrixTypes.REAL_TIME`, ✅ CODE — read the actual
  matrix-callback trigger logic) — TIER 2, NEW this pass
  A real-time evaluator can wake the strategy matrix mid-interval on a sudden
  price/volume move, instead of waiting for the next fixed cron tick.
  **Why it matters:** every one of our scouts (momentum, memecoin, stocks,
  Kalshi harness) is strictly cron-interval-driven (1-5 min, sometimes
  hourly). A fast, sharp move between ticks is invisible until the next
  scheduled run. Architecturally distinct from widening WHAT we scan (already
  underway) — this is about WHEN we scan. Lower priority than the universe-size
  work already shipped, but a real gap for anything hourly-cadenced.

- [ ] **Retry/backoff decorators + declarative per-exchange quirks table**
  (Freqtrade `exchange/common.py`'s `retrier`/`retrier_async` +
  `exchange.py`'s `_ft_has` override dict, ✅ CODE — read the actual retry
  math and per-exchange overrides, not just the file list) — TIER 1, NEW
  this pass (exhaustive-sweep)
  `retrier`/`retrier_async` (`common.py:115-144`) wrap every exchange call,
  catch `TemporaryError`, and back off `(max_retries-count)**2+1` seconds,
  with a special-cased Kraken 429 workaround. Per-exchange quirks (stop-order
  params, trade-pagination style, disabled OHLCV endpoints, forced
  market-order pricing) live in a small declarative `_ft_has` dict per
  exchange class, merged over a shared default (`exchange.py:131-174,
  965-968`) — e.g. `kraken.py:25-36`, `hyperliquid.py:36-53`.
  **Why it matters:** this session alone hand-wrote 5+ separate exchange
  integrations with quirks discovered painfully one at a time (Binance field
  names, Coinbase dollar-string quotes, Kraken key-renaming, OKX `rubik`
  endpoints, Hyperliquid's `info` API). A declarative overrides-dict + shared
  retry wrapper is the disciplined version of what we've been hand-rolling
  per script — directly complements the ccxt-adoption item above (ccxt
  handles the wire protocol; this pattern handles retry/backoff and the
  quirks ccxt itself doesn't paper over).
  **Small additional operational note, same read:** `exchange_ws.py:21-90`
  runs ccxt.pro websocket streaming on a dedicated background thread with a
  periodic forced reconnect specifically because long-lived connections start
  silently dropping after roughly 9 days — worth remembering if we ever run
  a persistent websocket instead of polling.

### DATA — sourcing, storing, and keeping it honest

- [ ] **Data-source fallback-chain pattern** (Vibe-Trading README "Data Sources
  & Smart Fallback", 📄 DOCS) — TIER 1
  One `get_market_data`-style call, 19 free sources, auto-selected per symbol,
  walked in an order ranked by **IP-ban risk** (never-banned public sources
  first, throttled/key-gated last).
  **Why it matters:** we've hit this exact pain repeatedly, separately, and
  solved it ad hoc every time — Yahoo rate limits, CoinGecko 429s mid-session,
  Kalshi blocked from the Swiss ISP (must run from the VM), Binance
  geo-blocked from the VM (must run from the Mac). A formal ranked
  fallback-chain abstraction generalizes the fix instead of hand-placing
  "run this on the VM, run that on the Mac" per script.

- [ ] **Formalized incremental / gap-safe historical downloads** (Freqtrade
  `data/history/history_utils.py`, ✅ CODE) — TIER 1, NEW this pass
  `drop_incomplete` flag for possibly-partial latest candles; downloads
  "always start at the end of available data to avoid data gaps" — a tested
  incremental-append pattern, not a full re-pull.
  **Why it matters:** `refresh_universe.mjs` currently re-derives full 730-day
  windows for delta symbols rather than true incremental appends from
  last-known-timestamp. Cheap, direct fix once ported.

- [ ] **Pluggable data storage backends** (Freqtrade
  `data/history/datahandlers/` — JSON, **Parquet**, Arrow, Feather, ✅ CODE) — TIER 2, NEW this pass
  **Why it matters:** our backfill is now 638 coins × ~17,520 hourly bars each
  in flat JSONL — tens of millions of rows, growing weekly via
  `refresh_universe.mjs`. Parquet (columnar, compressed, fast range-scans)
  would materially outperform JSONL as this keeps growing. Not urgent today,
  will become urgent.

- [ ] **Backtest result caching** (Freqtrade `backtesting.py`
  `dataprovider._set_cached_df`, per-pair detail/tradedir caches, ✅ CODE) — TIER 2, NEW this pass
  Avoids redundant recomputation across repeated runs on the same data.
  **Why it matters:** our sweeps (`backtest_sweep.mjs`, `confluence_search.mjs`)
  recompute features from scratch every invocation, even when re-run on
  unchanged data (e.g., iterating on a new family against the same 638-coin
  backfill). Cheap win once we're re-running sweeps often.

- [ ] **Real config-schema validation** (Freqtrade `configuration/
  config_validation.py` + `config_schema/config_schema.py`, ✅ CODE — read
  the actual `jsonschema.Draft4Validator` usage, not just noted the file
  exists) — TIER 2, NEW this pass (exhaustive-sweep)
  A real, substantial (1530-line) JSON-Schema, validated on load, with
  different required-field sets per run mode (dry-run/live vs backtest vs
  webserver) and auto-filled schema defaults.
  **Why it matters:** MetaEdge configs are plain JS objects with no schema
  enforcement anywhere — a typo'd or missing config field fails silently or
  late, at runtime, deep in a script, rather than loudly at startup. Genuine
  gap, not busywork — low effort relative to how many of this session's bugs
  were exactly this class of silent-wrong-config problem.

- [ ] **Retry-budget helper + content-addressed, don't-cache-the-forming-bar
  cache discipline** (Vibe-Trading `agent/backtest/loaders/base.py`, 609
  lines, ✅ CODE — read the full file, not the directory listing of the 25
  loader implementations sitting on top of it) — TIER 1, NEW this pass
  (exhaustive-sweep)
  `retry_with_budget` (`base.py:177`) is a shared bounded-retry helper for
  flaky data-source APIs, reused across all 25 loaders instead of each
  hand-rolling its own retry loop. Separately: an opt-in parquet cache keyed
  by a SHA256 hash of (source, symbol, timeframe, date-range, fields),
  written atomically (pid+uuid tmp file, then rename), that **deliberately
  only caches fully-elapsed date ranges** so a still-forming/provisional
  latest bar is never pinned into the cache as if it were final
  (`base.py:273-450`).
  **Why it matters:** directly strengthens two items already on this list —
  the data-source fallback-chain pattern above (this is the retry mechanism
  underneath it) and the backtest-result-caching item below (same
  don't-cache-provisional-data discipline applies to our own sweep caching,
  which doesn't currently exist at all). Also a real, specific bug-class
  prevention: without the "fully elapsed only" rule, a cache built mid-hour
  would permanently freeze that hour's still-accumulating volume/close as if
  it were the final settled bar.

- [ ] **STILL UNVERIFIED, but now more concrete — point-in-time (PIT)
  fundamental data safety** (Vibe-Trading, ⚠️ UNVERIFIED-DEPTH — the
  exhaustive-sweep pass read `agent/src/factors/fundamental/
  gross_profitability.py` directly, ✅ CODE for the *dependency*, still ⚠️
  for the safety mechanism itself) — flagged, not credited
  Confirmed this pass: `gross_profitability.py` reads from
  `panel["fund:gross_profitability"]` — i.e. fundamental factors assume a
  PRE-JOINED, presumably-PIT-safe panel is handed to them; the factor code
  itself contains no report-lag/filing-date logic. That's consistent with
  either "PIT safety lives elsewhere and we haven't found it" or "the panel
  is built without PIT discipline and the safety claim is aspirational" —
  still can't tell which without finding and reading whatever builds that
  `panel["fund:*"]` structure.
  **Why it matters if real:** the classic fundamental-backtesting bug is
  joining data by fiscal-period-end date instead of the date it was actually
  *published* — a real look-ahead leak. We haven't used fundamentals in any
  lane yet, so this hasn't bitten us — but see the corrected alpha-factor
  item below: fundamental factors are now a confirmed **harder** port than
  price-based ones specifically because of this unresolved panel-building
  step. Needs a proper code-reading pass (find the panel builder) before
  crediting either way.

### BACKTEST — proving a signal survives scrutiny

- [ ] **Empirical lookahead-bias checker** (Freqtrade
  `optimize/analysis/lookahead.py`, ✅ CODE) — TIER 1
  Re-runs signal computation on progressively truncated bar arrays, diffs
  indicator values against the full-array baseline. A difference proves
  future-peeking — empirically, not by code review.
  **Why it matters:** we've only ever verified causality in `strategy_core.mjs`
  by manual "bar i uses bars ≤ i" discipline. The four families added this
  session (golden_cross, rsi_divergence, macd_cross, volume_climax) were
  reviewed by eye, never proven. Port as: run `computeFeatures`/`signalAt` on
  `bars.slice(0, i+1)` vs the full array at index i, assert identical output.

- [ ] **Port real academic alpha factors** (Vibe-Trading `agent/src/factors/`,
  ✅ CODE — tests + golden CSVs confirmed, AND this pass actually read 5
  sample implementations — `academic/hml.py`, `alpha101/alpha_001.py`,
  `fundamental/gross_profitability.py`, `gtja191/alpha_001.py`,
  `qlib158/beta10.py` — not just their existence) — TIER 1
  461 factors: WorldQuant Alpha101, GTJA191, Qlib158, PIT-safe fundamentals.
  Formal taxonomy: momentum, reversal, volume, volatility, quality, value,
  liquidity, microstructure, sentiment, growth, leverage.
  **CORRECTION from the exhaustive-sweep pass, splits this item in two by
  difficulty:** the price-based factors (Alpha101/GTJA191/Qlib158/most of
  academic) are exactly as easy to port as originally assumed — short,
  clean `compute(panel) -> DataFrame` functions built on a small shared
  vectorized primitive library (`rank`, `ts_corr`, `delta`, `zscore`,
  `signed_power`, etc., all in `src/factors/base.py`), each self-documenting
  via `__alpha_meta__`. But the **fundamental-based factors are a harder
  port than assumed** — `gross_profitability.py` doesn't compute from OHLCV
  at all, it reads a pre-joined `panel["fund:gross_profitability"]` field
  whose PIT-safety is itself unverified (see the PIT item above). Porting a
  fundamental factor means building that panel-construction step first, not
  just translating one formula.
  **Why it matters:** highest-leverage single item overall, but sequence it
  correctly — start with the themed price-based subset (10-15 momentum +
  10-15 reversal, as originally planned), same multiple-testing discipline
  as everything else here, and treat the fundamental-factor subset as a
  separate, later phase gated on resolving PIT safety first, not a
  parallel-track item of equal difficulty.

- [ ] **Dual-timeframe RSI + Klinger Oscillator dip-detection signal**
  (OctoBot `dip_analyser_strategy_evaluator` — read
  `DipAnalyserStrategyEvaluator.md`, `dip_analyser_strategy.py`'s
  `matrix_callback`, AND the concrete
  `profiles/dip_analyser/specific_config/RSIWeightMomentumEvaluator.json`
  config, ✅ CODE) — TIER 1, NEW this pass
  A real, specific, portable signal (not just an architecture pattern):
  **gate-then-weight** combination — the Klinger Oscillator (volume-force,
  confirms a reversal is underway) must fire TRUE before RSI is even
  consulted; RSI then sets the signal's magnitude via a **dual-timeframe**
  read (slow RSI period=14/eval_count=16 for the base momentum reading, fast
  RSI eval_count=4 for a shorter confirmation window), mapped through a
  graduated threshold→weight table (not one fixed RSI<30 cutoff). Docs
  explicitly note it "works best on larger time frames such as 4h and more."
  **Why it matters:** our `rsi_meanrev` family (added this session) is a
  single-timeframe, single-threshold signal. This is a genuinely more
  nuanced, published, reimplementable design — a real config with real
  numbers, not a vague idea. The Klinger Oscillator itself is a standard,
  well-documented volume-based indicator we've never implemented (same
  reimplement-from-formula approach already used for MACD/RSI/golden-cross
  this session, not a code port). Add as a 5th signal family:
  `klinger_rsi_dip` in `strategy_core.mjs`, run through our existing
  walk-forward + timeframe-robustness rails — same as every other family.

- [ ] **Risk-adjusted parameter-search objective** (Freqtrade
  `optimize/hyperopt_loss/` — Sharpe, Sortino, Calmar, max-drawdown-relative,
  multi-metric, ✅ CODE — file list confirmed, math not read per-file) — TIER 2
  **Why it matters:** `backtest_sweep.mjs` selects params by raw PF/expectancy
  only. A Sharpe- or Calmar-based objective would prefer smoother, more
  survivable equity curves over lucky high-variance ones — directly relevant
  given how many of our "survivors" turned out to be noise.

- [ ] **Multi-leg position tracking as a flat, identity-matched list** (Vibe-
  Trading `agent/backtest/engines/options_portfolio.py`, 728 lines, ✅ CODE —
  read the full engine including the BS pricer/Greeks and
  `_find_matching_position`) — TIER 1, NEW this pass (exhaustive-sweep),
  HIGH RELEVANCE to the master plan's Stage 3 ledger build
  Their multi-leg (options) position tracking is NOT a paired-leg data
  structure — it's a flat `List[OptionPosition]`, each leg an independent
  object matched/closed by an identity tuple (underlying, type, strike,
  expiry) via `_find_matching_position` (`options_portfolio.py:542`), with
  P&L simply summed across legs at the portfolio level in
  `run_options_backtest` (`options_portfolio.py:225`).
  **Why it matters:** this directly answers an open design question for
  ME-001/ME-002 (the position/leg/group ledger the master plan gates behind
  a surviving carry edge) — a genuine two-leg carry position (spot leg +
  perp leg) doesn't need a bespoke paired-leg schema; it can be two
  independent leg records matched by a shared group/identity key, with
  portfolio equity computed as a plain sum. Simpler than what the review
  pack's ME-002 design implied was necessary — worth checking their two
  designs against each other before committing to a ledger schema.

- [ ] **Bar-execution engine pattern: close-before-open sequencing +
  capital-fit binary search** (Vibe-Trading `agent/backtest/engines/base.py`,
  997 lines, read in full, ✅ CODE — `_execute_bars` at line 546) — TIER 2,
  NEW this pass (exhaustive-sweep)
  Two specific, reusable mechanics: (1) each bar releases capital from
  closing positions BEFORE pricing/opening new ones (`base.py:572-587`), so
  a same-bar close-then-open sequence doesn't need borrowed/phantom capital;
  (2) when a basket of proposed opening orders doesn't fit available
  capital, a **binary search over one common scale factor** shrinks every
  order proportionally (`base.py:627-636`) — preserving relative position
  weights instead of privileging whichever symbol happens to iterate first
  and starving the rest.
  **Why it matters:** directly reusable for sizing a two-leg carry trade (or
  any multi-position simultaneous open) — the binary-search-for-common-scale
  approach is a clean answer to "what if we want positions A and B open
  together but can't fully fund both at requested size."
  Also worth noting from the same read: `composite.py` (a cross-market
  shared-capital-pool engine — stateless per-asset-class "rule books" for
  commission/slippage/lot-rounding, with all mutable state living in one
  `CompositeEngine`) is a clean pattern IF we ever unify crypto + stocks +
  prediction-markets under one shared-capital executor. Not urgent while
  each lane runs its own paper book independently.

- [ ] **Backtest metrics: numerical edge-case guards + realized-vs-implied
  turnover distinction** (Vibe-Trading `agent/backtest/metrics.py`, 348
  lines, read in full, ✅ CODE) — TIER 2, NEW this pass (exhaustive-sweep)
  Two specific, portable details, not new formulas: (1) explicit guards
  against degenerate inputs — a 1-bar return series producing a NaN from
  `ddof=1`, and a negative-equity wipeout breaking a fractional power in the
  Calmar calculation (`metrics.py:262-274`); (2) turnover is computed TWO
  ways — position-implied (from stated position sizes, `metrics.py:151-173`)
  and execution-realized (from actual recorded fills, `metrics.py:176-216`)
  — with the realized number taking precedence when both are available.
  **Why it matters:** small, cheap, and exactly the class of bug that has
  bitten this session repeatedly (off-by-one slices, silent zero-cost fills)
  — degenerate-input guards on our own grader metrics cost little and
  prevent a NaN or divide-by-zero from silently corrupting a survivor
  verdict. **Also worth noting as a genuine two-sided gap, not something to
  copy:** neither this file nor `options_portfolio.py`'s metrics contain an
  Omega ratio or VaR/CVaR tail-risk measure — if we want those, we'd be
  building beyond what any of the three reviewed repos has, not catching up.

- [ ] **Deterministic chart-pattern / candlestick detection library**
  (Vibe-Trading `agent/src/tools/pattern_tool.py`, ✅ CODE — read the actual
  implementation, confirmed pure numpy/pandas with zero ML or LLM in the
  loop) — TIER 1, NEW this pass (exhaustive-sweep, from an area we'd
  previously skipped as "probably not relevant" without opening the file)
  A real, rule-based signal library operating on plain OHLCV: peak/valley
  detection, candlestick patterns (doji/hammer/engulfing via body/shadow
  ratios), support/resistance via peak-clustering, rolling trend-slope
  (`np.polyfit`), head-and-shoulders (3-peak symmetry check), double-top/
  double-bottom (peak-pair proximity), and triangle/broadening
  (converging/diverging peak-valley regression slopes).
  **Why it matters:** this is exactly the shape of thing the user has asked
  for repeatedly this session ("why don't we have golden crossover, RSI
  divergence, human psychology plays") — a deterministic, published,
  reimplementable pattern library, not a vague idea, and fully portable to
  Node since none of it depends on ML or Python-specific tooling. Should be
  reimplemented from the described formulas (peak-clustering, symmetry
  checks, regression slopes) directly into `strategy_core.mjs`-style
  families and run through the same walk-forward + timeframe-robustness +
  chance-baseline rails as every other family — same discipline, not a
  shortcut past it. Found specifically because the user pushed back on
  skipping this area by relevance-assumption rather than actually reading it
  — a real miss the earlier "not relevant" judgment would have hidden.

### PAPER-EXECUTE — running a proven signal with discipline

- [ ] **Trailing stop-loss** (Freqtrade `trailing_stop_positive` /
  `trailing_stop_positive_offset`, ✅ CODE) — TIER 1, NEW this pass
  Configurable: the stop only starts trailing once price has moved favorably
  by an offset, then ratchets up (never down) by a stated distance.
  **Why it matters:** `practice_book.mjs` and `directional_harness.mjs` both
  only have a **fixed** hard-stop and a time-stop — never "let a winner run
  and protect the gain as it goes." This is a genuinely missing, standard
  risk technique, not a refinement of something we have. Real gap.
  **Extra confirmation this pass (exhaustive-sweep):** OctoBot's actual
  trailing implementation (`trailing_stop_order.py`,
  `trailing_stop_limit_order.py`, plus a `trailing_profiles/` subsystem) is
  genuinely more sophisticated than Freqtrade's flat offset+distance
  config — it supports **step-based trailing profiles** (the trail distance
  itself can change at different price levels, not one constant distance
  the whole way up). Worth designing our own trailing-stop with a
  profile/step table from the start rather than a single fixed distance,
  now that we know a fixed-distance design is the less-capable of the two
  real implementations we've seen.

- [ ] **Laddered / scaled exit orders** (confirmed independently in BOTH
  repos, ✅ CODE — Freqtrade's `adjust_trade_position` position-scaling hook,
  AND OctoBot's `dip_analyser_trading_mode/dip_analyser_trading.py`
  `self.sell_orders_per_buy = 3` plus a dedicated `scaled_order.py` order
  type; also found OctoBot's `trailing_limit_order.py` — a second,
  independent confirmation of the trailing-stop gap already logged above) —
  TIER 1, NEW this pass
  Place multiple exit orders at different price levels after a single entry,
  instead of one all-or-nothing exit.
  **Why it matters:** `directional_harness.mjs` and `practice_book.mjs` are
  strictly single-entry/single-exit — a position is either fully open or
  fully closed, nothing in between. Two independent mature frameworks both
  treat scaled exits as standard; this is a real, not hypothetical, gap.
  Lower priority than trailing-stop (bigger single win) but should ship in
  the same pass since the Risk OS changes overlap.
  **Extra confirmation + a new mechanic this pass (exhaustive-sweep):**
  `scaled_order.py` was actually opened and read (previously only
  grep-confirmed to exist) — `scaled_limit` (`scaled_order.py:21-124`)
  splits a total order amount evenly across N orders on a linear price
  ladder between a `scale_from`/`scale_to` range, a clean, small, portable
  pattern. Separately, OctoBot's `dca_trading_mode` adds a specific,
  worth-copying SAFETY mechanic alongside its own laddered secondary
  entries: a **max-asset-holding-ratio cap** (default 50%,
  `dca_trading.py:509-522`) that stops further laddered entries once a
  position has grown past a configured share of total holdings — preventing
  unbounded over-averaging into a single losing position. Any scaled-entry
  design we build should include an equivalent cap from day one, not add it
  after the first time laddering compounds a bad position.

- [ ] **Human-approval gate structurally separated from the agent process**
  (Vibe-Trading's Alpaca connector, `agent/src/trading/connectors/alpaca/
  sdk.py`, 885 lines, ✅ CODE — read the paper/live separation and the TAP
  proxy path in full) — TIER 2, NEW this pass (exhaustive-sweep), relevant
  to Stage 4 (first real money) of the master plan, not now
  Paper vs. live is a **structural** separation (different host + different
  key pair, `sdk.py:124-137`), not a runtime flag on one client. There's
  also an optional TAP (credential-isolation) proxy path where order-writing
  calls require human approval and the actual API secrets never touch the
  agent process at all (`_submit_via_tap`, `sdk.py:579`) — reads are
  auto-approved, writes are gated, and a deterministic idempotent
  `client_order_id` prevents an approval-flow retry from double-submitting
  the same order (`sdk.py:614-624`).
  **Why it matters:** directly relevant to the master plan's Stage 4 (real
  money, `LIVE_EXECUTION_ENABLED`/`LIVE_ALLOWLIST` gate) — not something to
  build now, but a concrete reference design for when we build the human
  approval step for live order placement: secrets-never-touch-the-agent,
  paper/live as separate credentials rather than a boolean, and idempotent
  order IDs to survive approval-flow retries safely.

- [ ] **Exit-reason taxonomy** (Freqtrade `enums/exittype.py` — ROI,
  STOP_LOSS, TRAILING_STOP_LOSS, LIQUIDATION, EXIT_SIGNAL, FORCE_EXIT,
  EMERGENCY_EXIT, CUSTOM_EXIT, PARTIAL_EXIT, ..., ✅ CODE) — TIER 1, NEW this pass
  **Why it matters:** `directional_harness.mjs` only records 2 close reasons
  ('stop', 'time'). A richer taxonomy is what lets us actually **learn** from
  accrued forward trades — e.g., "we're closing almost everything on
  time-stop" means our hold horizon is miscalibrated; "almost everything hits
  hard-stop" means the stop is too tight. Directly serves the "learning" half
  of what you asked this checklist to cover, and it's nearly free to add.

- [ ] **Per-symbol cooldown / performance-based deprioritization** (Freqtrade
  `plugins/protections/` — StoplossGuard, LowProfitPairs, CooldownPeriod,
  ✅ CODE) — TIER 1
  **Why it matters:** our Risk OS is portfolio-wide (hard stop + time-stop per
  position) with **no per-symbol memory** — a coin that just stopped us out
  twice gets no cooldown, no deprioritization. Port as a pluggable check
  before `directional_harness.mjs` opens a new position.

- [ ] **Dry-run / paper-mode parity check** (Freqtrade's order-book-aware
  paper simulation vs our `portfolio/ledger.mjs` + `practice_book.mjs`,
  ⚠️ UNVERIFIED-DEPTH — not feature-diffed) — TIER 2
  Worth a dedicated pass to see if their paper-fill simulation catches
  anything ours doesn't (partial fills, order-book depth awareness).
  **Partially resolved this pass (exhaustive-sweep) — the core backtest fill
  model, at least, does NOT do order-book-depth-aware partial fills:**
  entries fill at bar-open for the full requested size in one shot
  (`_enter_trade`, `backtesting.py:1122-1181`, no splitting), and exits use
  an OHLC-boundary "did the level get touched" model rather than a real
  order-book simulation — `_get_close_rate_for_stoploss`
  (`backtesting.py:598-650`) returns bar-open or the stop price itself
  (worst-case within the bar), `_get_close_rate_for_roi`
  (`backtesting.py:652-717`) clamps between bar low/high. Confirmed by
  direct grep of `backtesting.py`: zero occurrences of "slippage" or
  "partial_fill". This narrows what's still actually unverified to the
  LIVE dry-run path specifically (not the backtest engine, which we can now
  say plainly does not have order-book depth awareness — matches, doesn't
  exceed, our own simplicity there).

- [ ] **Typed notification fan-out with per-channel failure isolation**
  (Freqtrade `rpc/rpc_manager.py` + `rpc/webhook.py`, ✅ CODE) — TIER 2, NEW
  this pass (exhaustive-sweep)
  `RPCManager` conditionally instantiates N handlers (Telegram/Discord/
  Webhook/API) that all implement one `RPCHandler.send_msg()` interface;
  `send_msg()` fans a single typed message out to every registered handler
  and catches per-handler exceptions so one broken channel (e.g. a dead
  webhook URL) never blocks or crashes the others
  (`rpc_manager.py:22-84`). Messages are a closed enum
  (`RPCMessageType`: STATUS/WARNING/EXCEPTION/ENTRY/ENTRY_FILL/EXIT/
  PROTECTION_TRIGGER/...) rather than free-text strings.
  **Why it matters:** `edge_watcher.mjs` currently has exactly one sink
  (append to `alerts.jsonl`). This is the disciplined version of "add a
  Slack/Discord/webhook alert channel" — a typed-message + fan-out-to-N-
  handlers design where a JSONL handler is just one implementation of the
  interface alongside however many notification channels we add later,
  and a dead channel can never silently swallow the others.

- [ ] **Per-trade dynamic callback hooks with contained failure**
  (Freqtrade `custom_stoploss`/`custom_exit`, `strategy/interface.py:442-471,
  558, 590`, invoked via `strategy_safe_wrapper`, ✅ CODE) — TIER 2, NEW
  this pass (exhaustive-sweep)
  A strategy can define `custom_stoploss(pair, trade, current_time,
  current_rate, current_profit, ...)` returning a dynamic per-trade stop
  distance, genuinely wired into both live and backtest paths (not a stub —
  default just returns the static stoploss). Every call is wrapped in
  `strategy_safe_wrapper`, which catches exceptions from user-supplied
  strategy code and logs rather than crashes
  (`interface.py:1559-1569`).
  **Why it matters:** less about the specific stop-loss hook and more about
  the **error-containment pattern** — as `strategy_core.mjs` accumulates
  more signal families (now 9+), a bug in one family's `signalAt` should
  never be able to take down a whole sweep or scout run. Worth wrapping our
  own per-family signal functions in an equivalent "catch, log, treat as
  no-signal" boundary rather than trusting every family to never throw.

- [ ] **Real liquidation-price computation with per-exchange bankruptcy
  formulas** (Freqtrade `exchange.py:4007-4076`, `get_liquidation_price` +
  `dry_run_liquidation_price`, plus cached leverage tiers
  `fill_leverage_tiers`/`load_leverage_tiers`, ✅ CODE) — TIER 2, NEW this
  pass (exhaustive-sweep), relevant once a perps lane opens leveraged
  positions
  Branches cleanly: spot → no liquidation price; dry-run or an exchange
  without live position data → a real dry-run bankruptcy-price formula
  (with cited source comments for Gate/OKX's specific math,
  `exchange.py:4069-4076`); live → pulled from `fetchPositions()`, then a
  configurable safety buffer applied on top (default 5%,
  `exchange.py:4047-4052`). Leverage tiers are fetched and cached to a JSON
  file (`binance_leverage_tiers.json` exists on disk, confirming this is
  exercised, not theoretical).
  **Why it matters:** our perps lane (`FX trend`/`Perps (funding)` in
  `verdict_board.mjs`) doesn't currently model liquidation risk explicitly
  — this is a real, working reference design (not a sketch) for the moment
  we size a leveraged position and need to know how far price can move
  against us before forced closure, per exchange, with a safety buffer.

### LEARN — turning accrued history into better decisions

- [ ] **Formal hypothesis lifecycle status enum** (Vibe-Trading
  `hypotheses/registry.py` — `exploring / testing / validated / rejected /
  monitoring`, ✅ CODE) — TIER 2, NEW this pass
  **Why it matters:** our own `hypothesis-registry.jsonl` /
  `survivors.jsonl` / `retired.jsonl` split is functionally similar but
  informal and scattered across files rather than one clean state machine. A
  single formal status enum per hypothesis (with transition history) would
  make "what happened to idea X and why" answerable in one lookup instead of
  cross-referencing three files.

- [ ] **Correlation-regime detection + "de-grossing" risk-sizing rule**
  (Vibe-Trading `agent/src/skills/correlation-regime/SKILL.md`, ✅ CODE —
  read the actual `compute_edge_density` and `regime_exposure_context`
  functions, not just the README) — TIER 1, NEW this pass
  Two real, separable mechanisms:
  1. **Regime detection (Mode 1):** edge-density (fraction of asset pairs
     with |correlation| ≥ threshold) run through a hysteresis/Schmitt-trigger
     state machine (separate enter/exit thresholds with a dead band) to
     detect when the market fuses into one correlated bloc, without
     flip-flopping on noise near a single threshold.
  2. **Risk response (Mode 2, "de-grossing"):** when FUSED, halve gross
     exposure — `regime_exposure_context(regimes, base_gross=1.0,
     fused_gross=0.5)` — never fully liquidate. Their own stated reasoning:
     "regime onset lags the price top, so full liquidation locks in the
     worst prints."
  **Why it matters:** fills `portfolio/regime.mjs`, which has sat as an
  unbuilt pass-through stub since the portfolio system was first built. This
  is a sizing/risk mechanism, not a signal — it changes HOW MUCH is at risk
  across the whole book when correlation regime shifts, independent of any
  individual lane's edge.
  **Load-bearing honest caveat, carried over from their own docs so we don't
  mistake this for more than it is:** their own SKILL.md states plainly —
  *"What this skill is NOT: a trade-timing signal. The same validation
  program tested regime-based exits head-to-head against a plain price stop
  and lost — correlation regimes cannot time tops."* This is a genuinely
  self-honest negative finding baked into their own documentation, matching
  our own accumulated skepticism about regime-as-trigger. Adopt Mode 2
  (portfolio-wide exposure sizing) — do NOT adopt this as a per-trade entry
  or exit signal; that was tested and lost even in their own hands.

- [x] **DEFERRED, not rejected — Vibe-Trading's "Shadow Account"** (parses
  broker trade history → extracts behavioral biases → reconstructs implicit
  rules → backtests against actual behavior). Genuinely good idea, ✅ CODE
  confirmed real. **Not actionable yet** — no real forward trading history to
  analyze. Revisit once `practice_book.mjs` / `directional_harness.mjs` have
  accrued real forward history worth auditing.

---

## Explicitly rejected or deferred (with reason, so nothing silently disappears)

- [x] **REJECTED — FreqAI / ML feature-engineering hooks.** No labeled-outcome
  pipeline mature enough to feed an ML model honestly yet. Revisit only after
  a rule-based edge is proven and needs refining, not as a way to find one.
- [x] **REJECTED — OctoBot's `risk_judge_agent`/`risk_agent` (LLM-based risk
  override).** Non-deterministic. Breaks the frozen, reproducible-replay
  discipline everything else here depends on.
  **Extended, exhaustive-sweep pass:** OctoBot's `ai_trading_mode` is a real
  LLM-based multi-agent DAG (`team.py` orchestrates Signal → Bull/Bear
  Research → Risk Judge → Distribution, each a live LLM call with
  configurable model/temperature) — and it embeds this exact
  already-rejected `risk_judge_agent` as one of its stages. Same rejection
  rationale applies to the whole mode, not just the agent in isolation; not
  a separate item to re-litigate.
- [x] **REJECTED (as our core method) — Vibe-Trading's chat-generates-strategy-code
  interaction model and multi-agent swarm/debate workflows.** Every real
  result this session came from deterministic, walk-forward-tested rules, not
  conversational strategy authorship. Their underlying engine still runs
  deterministic backtests under the chat layer — reject the *interface*, not
  evidence their *engine* is unsound.
  **Confirmed with actual code this pass (exhaustive-sweep), not just
  inferred from the README — and the confirmation cuts a specific way:**
  the DAG *scheduler* itself (`agent/src/swarm/runtime.py`, `task_store.py`)
  is genuinely deterministic and separable — `topological_layers()` computes
  execution layers, each layer's tasks run in parallel via a thread pool,
  and any task whose upstream dependency isn't `completed` is marked
  `blocked` and never dispatched (`runtime.py:517-546`). That parallel-then-
  gated-merge scheduler is a legitimately reusable engineering pattern on
  its own, independent of the chat interface — noted for later, not adopted
  now (nothing in our current pipeline needs a DAG task scheduler).
  But the part that would have mattered most — HOW conflicting bull/bear/
  risk perspectives actually get reconciled into one decision — turned out
  to be **no mechanism at all, just a prompt.** The `investment_committee.yaml`
  portfolio-manager prompt literally instructs the LLM to weigh arguments
  "not [as] a naive average of three votes." A full grep of `swarm/` for
  vote/consensus/weight/disagreement logic found every hit inside YAML
  prompt text or docstrings, never as computed code in `worker.py` or
  `runtime.py`. So the original rejection was correctly scoped — there was
  no hidden deterministic reconciliation algorithm we were missing by
  rejecting the chat interface; synthesis really is 100% delegated to LLM
  judgment on concatenated text, with nothing else to extract.
- [x] **CONFIRMED NOT RELEVANT (was assumed, now actually verified) —
  Vibe-Trading's options-chain tool.** Exhaustive-sweep pass opened
  `options_chain_tool.py` directly rather than continuing to skip it by
  assumption: it's a pure data-fetch wrapper around Yahoo's options-chain
  endpoint, remapping fields into snake_case. No Greeks computed (delta/
  gamma/theta/vega all absent despite the tool's own docstring claiming
  "greeks-grade fields" — that claim is just IV pass-through, not a real
  pricing model), no strategy construction. Confirmed nothing portable here.
- [x] **CONFIRMED NOT RELEVANT (was assumed, now actually verified) —
  Vibe-Trading's China-market tools** (dragon-tiger board, Stock-Connect
  northbound flow, margin-financing balances). Exhaustive-sweep pass opened
  the actual tool files rather than skipping by name alone: exactly what
  the names suggest — Eastmoney-scraped A-share-market-structure data
  (龙虎榜 brokerage-seat disclosures, 沪股通/深股通 flow, 融资融券 balances),
  read-only, no generic logic underneath any of it. Confirmed not relevant
  to a US/global-crypto system, evidenced rather than assumed this time.
- [x] **LOW PRIORITY, evidenced this pass — OctoBot's `grid_trading_mode`,
  `arbitrage_trading_mode`, `index_trading_mode`** (exhaustive-sweep;
  previously only named from a directory listing). `grid_trading_mode`
  extends the same `staggered_orders_trading_mode` engine with a fixed
  quote-currency spacing mode and trailing-up/down grid regeneration — not
  a distinct pattern from what's already deferred under grid/DCA templates
  above. `arbitrage_trading_mode` is narrower than its name implies: it
  watches ONE symbol's mark price on the current exchange against the
  average mark price on OTHER connected exchanges and trades a directional
  convergence bet on the CURRENT exchange only — not simultaneous
  dual-venue execution — and its own `is_backtestable()` returns `False`
  (`arbitrage_trading.py:135-136`), so it isn't even simulator-testable in
  OctoBot itself. Portable idea for our existing gap-scanning
  ("Cross-venue arb" lane in `verdict_board.mjs`) but not an execution
  harness — we'd still have to build real simultaneous two-leg execution
  ourselves either way. `index_trading_mode` does a real 3-step basket
  rebalance (sell overweight into a reference market, split the reference
  market into underweight targets, configurable 5%/10% drift trigger) — low
  priority only because we don't have any basket/index product today, not
  because the mechanism is weak.
- [x] **LOW PRIORITY — OctoBot's TradingView connector, grid/DCA/basket
  strategy templates, 15+ exchange integrations, mobile app/Telegram/Web UI;
  Vibe-Trading's cross-session memory, Pine Script/MetaTrader5/TDX export;
  Vibe-Trading's 11 broker connectors (IBKR, Robinhood, Alpaca, Binance,
  Tiger, etc., ✅ CODE — confirmed real connector modules, not stubs) via its
  `mcp_server.py`.** Broker specifics don't fit our crypto-wallet-native
  stack (Hyperliquid). Operational/product conveniences, not research-stage
  priorities. Revisit at live execution scale.
  **One pattern worth extracting even though the brokers aren't:** their
  `mcp_server.py` docstring states plainly — *"Every exposed tool is
  read-only or research-only; no order-placing or order-cancelling tool is
  ever surfaced via MCP."* That's a stronger safety property than a runtime
  flag: the money-moving path is structurally absent from the agent-facing
  surface, not just gated by a boolean that could be flipped. Independent
  confirmation of the same instinct behind our own
  `LIVE_EXECUTION_ENABLED`/`LIVE_ALLOWLIST` discipline — worth remembering
  as we build any future LLM-agent-facing tool surface: no execution
  capability should even be *reachable* from that surface, not just denied
  by default.
- [x] **NOT AN ADOPTION ITEM — confirmed Freqtrade has NO first-class
  walk-forward / out-of-sample validation gate.** Searched directly; absent.
  Confirms our own walk-forward + chance-baseline + timeframe-robustness
  discipline stays genuinely ours and load-bearing, not automatically
  inherited by adopting any of these three repos.
- [x] **CORRECTED — "neither mature framework models slippage" was true for
  2 of 3, not all 3.** Freqtrade and OctoBot's core engines confirmed no
  slippage model (fees/order-tolerance only) — that finding stands. But this
  was written *before* Vibe-Trading's `agent/backtest/engines/` had actually
  been opened; I'd only seen the directory listing. Reading it this pass
  found real, asset-class-specific cost modeling, ✅ CODE:
  `engines/crypto.py` — fixed-rate slippage (`config["slippage"]`, default
  0.0005) applied unfavorably by direction, **maker/taker fee separation**,
  and **funding-fee settlement every 8 hours** actually walked into the
  per-bar PnL (not just projected as an APR), plus liquidation-price checks
  with slippage applied on forced closes. `engines/global_futures.py` — a
  real per-product commission table (`_COMMISSION_PER_CONTRACT`, $1-3/side
  typical, $2.50 default) plus a separate slippage rate. `engines/forex.py`
  — spread-as-cost (half-spread + `slippage_pips`) instead of a flat
  commission, symbol-aware.
  **Why this correction matters beyond the specific fact:** we scale
  slippage by liquidity tier in every grader we've built, which remains
  genuinely more granular than Freqtrade/OctoBot's flat/absent models — that
  part of the original claim holds. But we do NOT currently walk real 8-hour
  funding-fee settlement into `carry_trial.ts`'s per-bar PnL the way this
  engine does — that's a specific, concrete, adoptable pattern for the
  funding-carry lane, not just "we're ahead, nothing to take." Filed as its
  own item below.
  **Second correction, exhaustive-sweep pass — the OctoBot side of "no fee
  model" also needed a follow-up that had been left dangling:** a prior
  grep for `fee\b` in `backtesting.py` came back empty and was never
  chased further. Resolved this pass: fees ARE modeled, just one layer
  below `backtesting.py` — in the exchange simulator
  (`ccxt_client_simulation.py:277-283`'s `get_trade_fee`, backed by
  `order.py:829-858`'s `get_computed_fee`), maker/taker rates configurable
  per symbol via `CONFIG_SIMULATOR_FEES`, but **defaulted to 0**
  (`CONFIG_DEFAULT_SIMULATOR_FEES = 0`, `constants.py:210`) — opt-in, not
  automatic. Slippage genuinely remains absent (that part of the finding is
  unchanged). Precise statement of the finding, corrected: neither engine
  has a slippage model; OctoBot has a real fee model that most users likely
  never turn on; Freqtrade's fee handling wasn't re-checked this pass (out
  of scope for this correction, flagged in case it needs the same
  dig-one-layer-deeper treatment later).
- [ ] **8-hour funding-fee settlement walked into per-bar PnL** (Vibe-Trading
  `engines/crypto.py`, ✅ CODE — `calc_crypto_funding_fee` called on a
  00:00/08:00/16:00 UTC per-bar hook, deducted directly from capital) —
  TIER 1, NEW this pass
  **Why it matters:** our funding-carry lane (per
  [[2026-07-16-external-framework-evaluation]] and the master plan) projects
  APR from funding rate series but the mechanism for actually walking
  funding settlement bar-by-bar through a real equity curve — same
  discipline as trade-level PnL — isn't confirmed to exist yet. This is a
  small, concrete, directly-relevant pattern: settle funding on the same
  schedule the exchange actually does (Hyperliquid is hourly, not 8h — the
  SCHEDULE differs, but the walk-it-into-equity-per-bar MECHANISM is the
  portable part), rather than only computing an aggregate projected APR.
- [ ] **Portfolio-weight optimizers** (Vibe-Trading `agent/backtest/
  optimizers/` — equal-volatility, max-diversification, mean-variance,
  risk-parity, turnover-aware, ✅ CODE — read `base.py`'s causal rolling-window
  covariance handling and `risk_parity.py`'s equal-risk-contribution solve)
  — TIER 2, NEW this pass
  **Why it matters:** every lane we've built sizes and opens positions
  independently — there is no layer that, given N simultaneously-open
  candidates across lanes, allocates capital by risk-parity or
  diversification rather than a flat per-position sizing rule. Not urgent at
  today's single-position-per-lane scale, but becomes real the moment
  multiple lanes hold positions simultaneously (which the directional
  harness already allows). `base.py`'s causal (no-lookahead) rolling
  covariance window is itself worth copying independent of which optimizer
  sits on top of it.
  **Remaining optimizer variants, read this pass (exhaustive-sweep):**
  `equal_volatility.py` (inverse-vol weighting, no covariance needed —
  simplest, cheapest to implement first if this ever gets built),
  `max_diversification.py` and `mean_variance.py` (SLSQP-based, maximize
  diversification ratio / Sharpe respectively), and the most sophisticated,
  `turnover_aware.py` (251 lines) — mean-variance utility minus an L1
  turnover penalty against the prior period's weights, with per-name and
  per-group exposure caps and a feasible-start-point solver for when those
  caps make equal-weight infeasible. If we ever build this, `turnover_aware`
  is the right end-state design (avoids needless position-flipping on every
  rebalance) but `equal_volatility` is the honest starting point.
  **Two adjacent files also read and confirmed genuinely not relevant:**
  `agent/backtest/correlation.py` is a standalone cross-asset correlation-
  matrix endpoint, distinct from and redundant with the correlation-regime
  skill we already adopted-as-candidate above. `agent/backtest/benchmark.py`
  picks a market-appropriate benchmark ticker and computes excess return/
  information ratio — a standard pattern equivalent to what we'd build
  ourselves, nothing novel to take.
- [ ] **Laddered market-making order-book distribution, volume-scaled to
  real daily volume** (OctoBot `market_making_trading_mode/
  order_book_distribution.py`, 804 lines, ✅ CODE — read `compute_distribution`,
  `get_ideal_total_volume`, `get_shape_distance_from`,
  `is_spread_according_to_config`) — TIER 1, NEW this pass
  A genuinely more sophisticated design than a directory name suggested:
  quote SIZE is derived from real `daily_base_volume`/`daily_quote_volume`
  (a configured fraction of actual market turnover), not a flat size — this
  avoids being a disproportionate, easily-picked-off share of the book.
  Orders are laddered across a configurable min/max spread band (multiple
  bids/asks, not one quote per side), and rebalancing is gated by a "shape
  distance from ideal" metric rather than firing on every tick — an explicit
  mechanism to avoid unnecessary cancel/replace churn (a real cost).
  **Why it matters:** directly relevant to `mm_scout.mjs`, our one live
  market-making lane. Worth a dedicated feature-diff pass: does our current
  quote logic size relative to real market volume, ladder across a spread
  band, and gate re-quoting by a distance-from-ideal check — or does it
  quote flat-size, single-level, and re-quote every cycle regardless of
  whether anything moved?
  **Naming correction, exhaustive-sweep pass:** OctoBot also has a
  `simple_market_making_trading_mode` that sounded, from the name alone,
  like a lighter-weight alternative worth comparing. It's the opposite —
  `SimpleMarketMakingTradingMode` actually **extends**
  `MarketMakingTradingMode` (`simple_market_making_trading.py:58`,
  confirmed against the base class at `market_making_trading.py:98`), adding
  a hedging engine, scheduled-volume pacing, and a REST API layer on top.
  Despite the name, it's the more elaborate of the two, not a simpler
  design point — don't go looking there for something easier to port.
- [x] **REJECTED — Freqtrade's "edge" module (risk-of-ruin position sizing).**
  Found the docs page for this earlier, but `freqtrade/edge/
  edge_positioning.py` does not exist in current source — confirmed via
  `docs/deprecated.md`: **"The edge module has been deprecated in 2023.9 and
  removed in 2025.6... having edge configured will result in an error."**
  Not a code-reading miss on our part — the framework's own maintainers
  abandoned it. Worth recording as evidence the idea itself (or at least
  their implementation of it) didn't hold up in production use, not just an
  item we happened to skip.
- [x] **RESOLVED (was UNVERIFIED) — Vibe-Trading's "Monte Carlo, Bootstrap,
  Walk-Forward, run cards" validation layer IS real** (`agent/backtest/
  validation.py`, 461 lines, `agent/backtest/run_card.py`, 249 lines — ✅
  CODE, read the actual functions, not just README/skill-markdown this time).
  Reverses the earlier flag. Three genuinely new, useful, separable tools:
  1. **`monte_carlo_test`** — shuffles a strategy's own realized trade-PnL
     order N times (default 1000), computes a p-value for whether the
     observed Sharpe/max-drawdown beats random reorderings of the SAME
     trades. **This is new to us and worth adopting** — it's a different
     question than our chance-baseline (which asks "would this many
     survivors appear across many DIFFERENT trials by chance"); this asks
     "is THIS specific trade sequence's path better than random luck in
     trade ORDERING." Complementary, not redundant.
  2. **`bootstrap_sharpe_ci`** — resamples returns (default 1000x) to produce
     a confidence interval + `prob_positive` on Sharpe. Also new to us —
     quantifies uncertainty in the risk-adjusted return metric itself, not
     just a point estimate.
  3. **`run_card.py`** — writes a JSON+Markdown reproducibility card per
     backtest run: config hash, strategy-source-file hash, data sources,
     metrics, validation results. A real "prove this exact run is
     reproducible" audit artifact.
  **Important honest caveat, found on the same read:** their
  `walk_forward_analysis` is **NOT** equivalent to true walk-forward — it
  splits ONE backtest's equity curve into N sequential windows and checks
  consistency (in-sample sub-period stability), with **no train/embargo/test
  fold structure and no out-of-sample refit**. Our own walk-forward
  discipline (train/embargo/test folds, survivor bar computed OOS-only)
  remains materially more rigorous on that specific axis — do not adopt
  their `walk_forward_analysis` function itself; keep ours as-is. Adopt
  items 1-3 above as ADDITIONS alongside our existing walk-forward, not
  replacements for it.

---

## Working rule

One item at a time: read the real mechanism before porting it (not just the
README claim), test with a synthetic/forced case before deploying (same as
`directional_harness.mjs`'s adapters), and update this file's checkbox + a
one-line note on what actually shipped. If an item turns out not to fit, mark
it rejected here with the reason — never let it quietly disappear. If a new
pass through these (or other) repos turns up more items, add them under the
right pipeline stage rather than starting a second document.
