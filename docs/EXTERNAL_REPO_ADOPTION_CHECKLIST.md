# External repo adoption checklist — Freqtrade / OctoBot / Vibe-Trading

Date opened: 2026-07-20. Status: LIVING — work through in priority order, check
off as implemented, do not silently drop an item (reject explicitly with a
reason instead). Companion to
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

## Priority order (work top to bottom)

### Tier 1 — cheap, high-leverage, directly fixes pain we hit this session

- [ ] **Composable universe/pairlist filter chain** (Freqtrade `plugins/pairlist/`, ✅ CODE)
  19 pluggable filters (Volume, MarketCap, Age, Spread, Price, Volatility,
  Precision, **Performance** — auto-deprioritizes pairs with a bad recent
  track record, Shuffle, etc.), TTL-cached auto-refresh (default 1800s).
  **Why it matters:** this is the exact class of bug we hit five separate times
  this session (37→202→452→638 coins, the Coinbase-scope gap, the off-by-one
  slice bug in the delta computation). One tested, composable subsystem
  in Node — `scripts/lib/universe.mjs` — instead of continuing to hand-patch.
  Port as: a filter-chain interface (`{filter(candidates) -> candidates}`),
  reusable across crypto/stocks/memecoin universes.

- [ ] **Empirical lookahead-bias checker** (Freqtrade `optimize/analysis/lookahead.py`, ✅ CODE)
  Re-runs signal computation on progressively truncated bar arrays, diffs
  indicator values against the full-array baseline. A difference proves
  future-peeking — empirically, not by code review.
  **Why it matters:** we've only ever verified causality in `strategy_core.mjs`
  by manual "bar i uses bars ≤ i" discipline. Four new families added today
  (golden_cross, rsi_divergence, macd_cross, volume_climax) were reviewed by
  eye, not proven. Port as a standalone check: for each family, run
  `computeFeatures`/`signalAt` on `bars.slice(0, i+1)` vs the full array at
  index i, assert identical output.

- [ ] **Port real academic alpha factors** (Vibe-Trading `agent/src/factors/`, ✅ CODE — tests + golden CSVs confirmed)
  461 factors: WorldQuant Alpha101, GTJA191, Qlib158, PIT-safe fundamentals.
  Formal taxonomy: momentum, reversal, volume, volatility, quality, value,
  liquidity, microstructure, sentiment, growth, leverage.
  **Why it matters:** highest-leverage single item on this list. We hand-derive
  one signal at a time (today: 4 new families, each a real build+test cycle).
  These are published, vetted formulas — reimplement the formulas (not their
  Python) into `strategy_core.mjs`-style families, run through our EXISTING
  walk-forward + timeframe-robustness + chance-baseline rails (which they do
  NOT have — see Tier-3 rejection below). Start with a themed subset (e.g.
  10-15 momentum + 10-15 reversal factors), not all 461 at once — same
  multiple-testing discipline as everything else.

- [ ] **Per-symbol cooldown / performance-based deprioritization** (Freqtrade `plugins/protections/`, ✅ CODE)
  `StoplossGuard` (N stops in a window → lock the pair), `LowProfitPairs`
  (auto-disable a pair whose recent trades show low profit), `CooldownPeriod`.
  **Why it matters:** `directional_harness.mjs`'s Risk OS is portfolio-wide
  (hard stop + time-stop per position) but has NO per-symbol memory — a coin
  that just stopped us out twice gets no cooldown, no deprioritization. Port
  as a pluggable protection layer the harness checks before opening a new
  position.

### Tier 2 — real value, more design work

- [ ] **Data-source fallback-chain pattern** (Vibe-Trading README section "Data
  Sources & Smart Fallback", 📄 DOCS — fallback-chain code itself not read line-by-line)
  One `get_market_data`-style call, 19 free sources, auto-selected per symbol,
  walked in an order ranked by **IP-ban risk** (never-banned public sources
  first, throttled/key-gated last). Zero config, no single point of failure.
  **Why it matters:** we've hit this exact pain repeatedly and separately —
  Yahoo rate limits, CoinGecko 429s mid-session, Kalshi blocked from the Swiss
  ISP (must run from the VM), Binance geo-blocked from the VM (must run from
  the Mac). Each was solved ad hoc, per-script. A formal fallback-chain
  abstraction (ranked source list + automatic failover) would generalize the
  fix instead of hand-placing "run this on the VM, run that on the Mac."

- [ ] **Formalize the Evaluator pattern** (OctoBot `packages/evaluators/`, ✅ CODE)
  Independent, pluggable signal modules (`TA_evaluator`, `social_evaluator`,
  `realtime_evaluator`) combined by a strategy through one common interface.
  **Why it matters:** this is architecturally what `confluence_search.mjs`
  attempted — but we ran it once as a script and moved on. OctoBot treats it
  as standing infrastructure other strategies register into continuously.
  Port as: a registry other lanes' signals plug into, not a one-shot script.

- [ ] **Google Trends + Reddit as market_context axes** (OctoBot `social_evaluator.py`, 📄 DOCS/code path confirmed, formulas not read)
  **Why it matters:** extends the attention axis in `market_context.mjs`
  beyond Wikipedia pageviews alone — cheap, same pattern already proven there.

- [ ] **Risk-adjusted parameter-search objective** (Freqtrade `optimize/hyperopt_loss/`, ✅ CODE — file list confirmed, math not read per-file)
  Multiple loss functions: Sharpe, Sortino, Calmar, max-drawdown-relative,
  multi-metric — not just raw profit.
  **Why it matters:** `backtest_sweep.mjs` selects params by raw PF/expectancy
  only. A Sharpe- or Calmar-based objective would prefer smoother, more
  survivable equity curves over lucky high-variance ones — directly relevant
  given how many of our "survivors" turned out to be noise.

- [ ] **Dry-run / paper-mode parity check** (Freqtrade order-book-aware paper
  simulation vs our `portfolio/ledger.mjs` + `practice_book.mjs`, ⚠️ UNVERIFIED-DEPTH — not feature-compared)
  Not yet actually diffed feature-by-feature against our own ledger. Worth a
  dedicated pass to see if their paper-fill simulation catches anything ours
  doesn't (e.g., partial fills, order-book depth awareness).

### Tier 3 — explicitly rejected (with reason, so it isn't silently dropped)

- [x] **REJECTED — FreqAI / ML feature-engineering hooks.** We have no
  labeled-outcome pipeline mature enough to feed an ML model honestly yet.
  Revisit only after a directional/rule-based edge is proven and we need to
  refine it, not as a way to find one.
- [x] **REJECTED — OctoBot's `risk_judge_agent`/`risk_agent` (LLM-based risk
  override).** Non-deterministic. Breaks the frozen, reproducible-replay
  discipline everything else here depends on.
- [x] **REJECTED (as our core method) — Vibe-Trading's chat-generates-strategy-code
  interaction model and multi-agent swarm/debate workflows.** Every real
  result this session came from deterministic, walk-forward-tested rules, not
  conversational strategy authorship. Note: their underlying engine still
  runs deterministic backtests under the chat layer — reject the *interface*,
  not evidence their *engine* is unsound.
- [x] **DEFERRED, not rejected — Vibe-Trading's "Shadow Account"** (parses
  broker trade history → extracts behavioral biases → reconstructs implicit
  rules → backtests against actual behavior). Genuinely good idea, ✅ CODE
  confirmed real. **Not actionable yet** — we have no real forward trading
  history to analyze. Revisit once `practice_book.mjs` / `directional_harness.mjs`
  have accrued real forward history worth auditing.
- [x] **LOW PRIORITY — OctoBot's TradingView connector, grid/DCA/basket
  strategy templates, 15+ exchange integrations, mobile app/Telegram/Web UI.**
  Operational/product conveniences, not research-stage priorities. Revisit if
  we ever reach live execution at meaningful scale.
- [x] **LOW PRIORITY — Vibe-Trading's cross-session persistent memory,
  TradingView Pine Script / MetaTrader5 / TDX export.** Tangential to
  edge-finding; export formats matter only once we have something worth
  exporting.
- [x] **NOT AN ADOPTION ITEM — confirmed Freqtrade has NO first-class
  walk-forward / out-of-sample validation gate.** Searched directly; absent.
  This is not a gap to fill by adopting Freqtrade — it's confirmation that our
  own walk-forward + chance-baseline + timeframe-robustness discipline
  (which killed the confluence backtest, the golden-cross survivor, etc.)
  remains genuinely ours and load-bearing, not automatically inherited by
  adopting any of these three repos.
- [x] **NOTED, not a gap — Freqtrade's core backtest engine has NO slippage
  model** (fees only, conservative worst-tier default). Every grader we've
  built (memecoin/momentum/stocks) scales slippage by liquidity tier. One
  specific axis where we're already ahead — recorded so we don't undervalue
  our own work while adopting theirs.
- [ ] **UNVERIFIED — Vibe-Trading's claimed "Monte Carlo, Bootstrap,
  Walk-Forward, run cards" validation layer.** README claims this; only found
  skill-markdown *references* to walk-forward, not a dedicated validation
  module at the depth claimed. Needs a real code-reading pass before crediting
  or dismissing — currently neither adopted nor rejected, just unverified.

---

## Working rule

One item at a time, same discipline as everything else in this repo: read the
real mechanism before porting it (not just the README claim), test with a
synthetic/forced case before deploying (same as `directional_harness.mjs`'s
adapters), and update this file's checkbox + a one-line note on what actually
shipped. If an item turns out not to fit, mark it rejected here with the
reason — never just let it quietly disappear.
