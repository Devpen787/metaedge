# External repo adoption checklist — Freqtrade / OctoBot / Vibe-Trading

Date opened: 2026-07-20, revised same day (first pass was headline-only; this
pass went deeper across the whole pipeline — discover, data, backtest,
paper-execute, learn — per direct instruction not to skim). Status: LIVING —
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
  Vibe-Trading's cross-session memory, Pine Script/MetaTrader5/TDX export.**
  Operational/product conveniences, not research-stage priorities. Revisit at
  live execution scale.
- [x] **NOT AN ADOPTION ITEM — confirmed Freqtrade has NO first-class
  walk-forward / out-of-sample validation gate.** Searched directly; absent.
  Confirms our own walk-forward + chance-baseline + timeframe-robustness
  discipline stays genuinely ours and load-bearing, not automatically
  inherited by adopting any of these three repos.
- [x] **NOTED, not a gap — Freqtrade's core backtest engine has NO slippage
  model** (fees only, conservative worst-tier default). Every grader we've
  built (memecoin/momentum/stocks) scales slippage by liquidity tier. One
  specific axis where we're already ahead.
- [ ] **UNVERIFIED — Vibe-Trading's claimed "Monte Carlo, Bootstrap,
  Walk-Forward, run cards" validation layer.** README claims this; only found
  skill-markdown *references*, not a dedicated validation module at the depth
  claimed. Needs a real code-reading pass before crediting or dismissing.

---

## Working rule

One item at a time: read the real mechanism before porting it (not just the
README claim), test with a synthetic/forced case before deploying (same as
`directional_harness.mjs`'s adapters), and update this file's checkbox + a
one-line note on what actually shipped. If an item turns out not to fit, mark
it rejected here with the reason — never let it quietly disappear. If a new
pass through these (or other) repos turns up more items, add them under the
right pipeline stage rather than starting a second document.
