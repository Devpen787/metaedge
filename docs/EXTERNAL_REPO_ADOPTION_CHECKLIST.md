# External repo adoption checklist — Freqtrade / OctoBot / Vibe-Trading

Date opened: 2026-07-20, revised same day twice (first pass was
headline-only; second pass went deeper across the whole pipeline; this THIRD
pass dug into OctoBot's trading-mode layer, Freqtrade's edge module fate, and
Vibe-Trading's correlation-regime skill, per explicit "no skimming" repeat
instruction). Status: LIVING —
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

- [ ] **UNVERIFIED — point-in-time (PIT) fundamental data safety** (Vibe-Trading,
  referenced in README + several file paths, ⚠️ UNVERIFIED-DEPTH — searched
  `get_fundamentals_tool.py` and a sample factor for a report-lag/filing-date
  mechanism; not found in either) — flagged, not credited
  **Why it matters if real:** the classic fundamental-backtesting bug is
  joining data by fiscal-period-end date instead of the date it was actually
  *published* (or joining pre-restatement financials as if the restated
  numbers were known at the time) — a real look-ahead leak specific to
  fundamentals. We haven't used fundamentals in any lane yet, so this hasn't
  bitten us — but the moment we act on Tier-1's alpha-factor port (many of
  which are fundamental-based: quality, value, growth themes), this becomes
  load-bearing. Needs a proper code-reading pass before crediting.

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
  ✅ CODE — tests + golden CSVs confirmed) — TIER 1
  461 factors: WorldQuant Alpha101, GTJA191, Qlib158, PIT-safe fundamentals.
  Formal taxonomy: momentum, reversal, volume, volatility, quality, value,
  liquidity, microstructure, sentiment, growth, leverage.
  **Why it matters:** highest-leverage single item overall. We hand-derive one
  signal at a time (today alone: 4 new families, each a real build+test
  cycle). These are published, vetted formulas — reimplement the formulas
  (not their Python) into `strategy_core.mjs`-style families, run through our
  EXISTING walk-forward + timeframe-robustness + chance-baseline rails (which
  Vibe-Trading itself does not clearly have — see below). Start with a themed
  subset (10-15 momentum + 10-15 reversal), not all 461 at once — same
  multiple-testing discipline as everything else here.

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

### PAPER-EXECUTE — running a proven signal with discipline

- [ ] **Trailing stop-loss** (Freqtrade `trailing_stop_positive` /
  `trailing_stop_positive_offset`, ✅ CODE) — TIER 1, NEW this pass
  Configurable: the stop only starts trailing once price has moved favorably
  by an offset, then ratchets up (never down) by a stated distance.
  **Why it matters:** `practice_book.mjs` and `directional_harness.mjs` both
  only have a **fixed** hard-stop and a time-stop — never "let a winner run
  and protect the gain as it goes." This is a genuinely missing, standard
  risk technique, not a refinement of something we have. Real gap.

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
- [x] **REJECTED (as our core method) — Vibe-Trading's chat-generates-strategy-code
  interaction model and multi-agent swarm/debate workflows.** Every real
  result this session came from deterministic, walk-forward-tested rules, not
  conversational strategy authorship. Their underlying engine still runs
  deterministic backtests under the chat layer — reject the *interface*, not
  evidence their *engine* is unsound.
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
- [x] **NOTED, not a gap — NEITHER Freqtrade's NOR OctoBot's core backtest
  engine models slippage** (fees/order-tolerance only). Checked OctoBot's
  `packages/backtesting/octobot_backtesting/backtesting.py` directly this
  pass — no slippage handling in the core engine; the only "slippage" hits
  repo-wide are in order-TYPE scripting (e.g., limit-order tolerance), not a
  systematic backtest cost model. Freqtrade finding stands unchanged (fees
  only, conservative worst-tier default). Every grader we've built
  (memecoin/momentum/stocks) scales slippage by liquidity tier. Now confirmed
  across TWO mature, widely-used frameworks — this is genuinely uncommon
  rigor on our side, not something to feel behind on.
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
