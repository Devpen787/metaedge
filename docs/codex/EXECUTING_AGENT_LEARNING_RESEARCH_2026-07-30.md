# Executing Agents That Produce Evidence: Reddit, Repositories, and the MetaEdge v5 Design

Date: 2026-07-30
Status: source-audited research and build recommendation; no trading or runtime change
MetaEdge evidence cutoff: commit `6358c0a`
Money boundary: paper only; live execution remains locked

Related record:
[Reddit vs. MetaEdge: How We Build a Trading System That Actually Learns](./REDDIT_AGENT_TRADING_COMPARISON_2026-07-29.md)

Forensic source and test follow-up:
[External Execution and Learning Forensic Audit](./EXTERNAL_EXECUTION_LEARNING_FORENSIC_AUDIT_2026-07-30.md)

## Verdict

### Correction after owner review

MetaEdge has two problems, not one:

1. the canonical decision runtime uses evidence sufficient for **promotion** as
   the prerequisite for **any paper execution**; and
2. the previous recommendation answered that problem by centering Golden Cross
   and a tiny champion/challenger/control cohort.

The second answer reproduced the same bottleneck in a different form. Golden
Cross was an owner-supplied idea, not a product thesis or privileged trading
method.

At the cutoff:

- `evaluateLayeredDecision` emits `research_hypothesis` when a signal has not
  already earned `forward_paper_candidate`;
- only `paper_trade_candidate` is queued;
- `routePaperDecision` refuses every other outcome;
- the economic lifecycle likewise requires historical samples before moving
  from `research_candidate` to `shadow_paper`;
- Golden Cross can place paper trades, but it does so through a separate
  scanner path rather than the canonical decision/experiment lifecycle.

That is rigorous against false promotion, but it prevents the system from using
bounded paper execution to discover fill behavior, operational failure, regime
response, and forward outcomes.

The correction is to separate four permissions:

1. `research_only`: the idea may be compiled and tested, but cannot create a
   paper order.
2. `paper_discovery`: a frozen experiment may spend a small, capped paper
   information budget after data, instrument, cost-feasibility, and risk gates
   pass. This is permission to observe, not evidence of edge.
3. `paper_confirmed`: a frozen strategy has earned a larger paper allocation
   through untouched forward evidence and reconciliation.
4. `live_review`: an owner-gated review state only. It remains non-executable in
   the current product.

The practical operating rule is:

> Execute weak-but-valid hypotheses cheaply in paper mode; promote only strong
> evidence; never let an active strategy rewrite itself; keep admitting new,
> genuinely different hypotheses while earlier ones are still running.

One shared runtime is an accounting and safety decision. It is not a decision
to trade one signal family.

## Evidence method

The Reddit Answers page is an AI synthesis of Reddit posts and comments. It is a
discovery aid, not a primary authority. I followed its useful claims into the
underlying posts, repository code, project documentation, and papers.

Evidence labels in this record:

- **Code-backed capability**: an accessible implementation supports the claim.
- **Documented design**: maintainers document it, but this review did not
  reproduce the system.
- **Practitioner observation**: a useful field report, not independently
  verified.
- **Self-reported result**: performance claimed by the author; not proof.
- **Promotional claim**: insufficient detail or controls to support adoption.

Stars, leaderboards, trade counts, and paper P&L are not evidence of a durable
edge.

## What the Reddit conversation actually adds

The conversation progressed through four distinct questions:

1. how to run parallel paper experiments without multiplying overfitting;
2. how people discover or verify a profitable strategy;
3. how agents can execute enough controlled risk to learn;
4. which operational practices make automated trading resilient.

Across those answers, the useful recurring advice is:

- run many strategy variations and genuinely different strategies in parallel;
- keep per-strategy attribution even when they share one paper account;
- maintain a continuous pipeline in which weak strategies are retired and new
  ones enter, rather than waiting for a single winner;
- model fees, spread, slippage, funding, and imperfect fills;
- run frozen strategies on current data rather than repeatedly optimizing the
  same history;
- inspect executed trade logs, not only aggregate P&L;
- kill explanations that fail simple tests;
- distinguish signal quality from execution quality;
- compare results by regime and against a no-trade or market baseline;
- automate order-state handling and risk controls;
- treat trade count and win rate as weak evidence without payoff and tail-loss
  context.

The conversation also contains unsafe or weakly supported advice:

- “start with a little live capital” is not a necessary learning step for
  MetaEdge and does not override the product's live lock;
- universal trade-count thresholds such as 100 or 300 trades ignore event
  independence, regime coverage, and effect size;
- paper fills are not automatically realistic just because current market
  prices are used;
- an LLM explanation attached to a trade is not proof that the explanation
  caused the outcome.

Source:
[Reddit Answers conversation](https://www.reddit.com/answers/03026f42-6e9d-4f46-ac3b-a4ed280feefe/?q=paper+trading+multiple+strategies+parallel+experiments+fail+fast+overfitting&source=SERP_SEARCH_BAR_BUTTON&tl=en)

### Direct Reddit evidence that the operating unit is a population

The underlying discussions are more expansive than the previous recommendation:

- one practitioner reports approximately 80 correlated models and another
  reports about 10 strategies in one account; a separate implementation tags
  each order with the strategy name and replays the combined trade CSV for
  individual statistics;
- another practitioner describes 20–30 bots under continuous forward test,
  with stronger bots receiving more allocation and weaker bots being “fired”;
- a discussion of live-system iteration reports 20–50 strategies in demo at
  all times and hundreds tested over the research lifetime;
- the paper-account discussion explicitly recommends keeping
  `strategy | broker | broker_id` attribution outside the broker so many
  strategies can share one account without losing identity;
- the recent open-source `evo-trader` example runs momentum, mean reversion,
  trend following, breakout, and volatility-squeeze agents independently,
  while hard risk limits sit outside strategy code.

Sources:

- [Multiple strategies and overlapping trades](https://www.reddit.com/r/algotrading/comments/1ghawod/do_you_run_multiple_strategies_independently_or/)
- [How many strategies were tested](https://www.reddit.com/r/algotrading/comments/1uzzgxm/how_many_strategies_did_you_backtest_before/)
- [Running multiple paper ideas](https://www.reddit.com/r/algotrading/comments/1dcgg0g/whats_the_best_way_to_run_multiple_paper_trading/)
- [Continuously launching parallel strategies](https://www.reddit.com/r/algotrading/comments/1e40bak/to_people_currently_running_a_live_strategy_whats/)
- [Evolutionary multi-agent paper trader](https://www.reddit.com/r/algotrading/comments/1v4h5rs/built_an_evolutionary_multiagent_crypto_trading/)
- [`evo-trader` repository](https://github.com/hhhmehmet/evo-trader)

These are field reports and code examples, not audited profitability. Their
relevance is operational: they show that a common executor can support a broad
strategy ecology. They do not justify copying the P&L claims, automatically
cloning the latest winner, or moving to live money.

### Regime mismatch is not permanent strategy failure

The owner clarification adds an important state distinction that the earlier
“retire weak arms” language missed. A strategy may be:

- **eligible and armed**: its expected conditions are present, so its normal
  trigger can create a bounded paper trade;
- **active**: it currently has paper exposure;
- **reduced**: conditions are less favorable or portfolio overlap is high, so
  its risk budget is smaller;
- **dormant/shadow**: its expected conditions are absent or its health is
  uncertain; it creates counterfactual observations but no new exposure;
- **probationary**: its conditions have returned and it is testing re-entry at
  a small fraction of normal paper risk;
- **retired**: repeated eligible-regime evidence invalidated the strategy, the
  mechanism no longer exists, costs make it infeasible, or the implementation
  cannot be made trustworthy.

This means the system needs two separate estimates:

1. **strategy health**: is the strategy behaving as expected when it is
   eligible?
2. **current eligibility**: does the present market resemble the conditions in
   which the strategy is intended to operate?

Neither estimate is a perfect “regime oracle.” Use coarse, versioned,
known-at-time features such as trend strength, realized volatility, liquidity,
dispersion, correlation, funding/basis, and event state. Prefer probabilities,
hysteresis, minimum dwell times, and shadow tracking over switching a strategy
off after each loss.

An example paper-risk rule is:

`arm risk = base arm risk × eligibility weight × health weight × portfolio
diversification weight × liquidity/cost weight`

Every term is capped and deterministic. The strategy still decides whether its
own trade trigger fires; the portfolio layer decides whether it is eligible and
how much paper risk the trigger may receive.

True retirement requires all of the following:

1. data and execution records are valid;
2. the strategy was evaluated on enough independent opportunities from its
   intended conditions, preferably across repeated regime episodes;
3. results remain outside its precommitted expectancy/drawdown/cost envelope;
4. a temporary regime mismatch, normal statistical variance, and portfolio
   crowding have been ruled out;
5. continued shadow observation or a probationary re-entry no longer has
   useful information value.

The Reddit follow-up recommends regime splits, volatility filters, walk-forward
out-of-sample testing, cost stress, Monte Carlo analysis, parameter jitter, and
explicit failure conditions. These are useful diagnostics, not a license to
fit a complicated classifier to recent returns.

Source:
[Reddit Answers: regime mismatch versus permanent failure](https://www.reddit.com/answers/22c32390-4f52-4d71-90b1-f9449917d0a6/?q=How+are+people+actually+running+10+to+100+autonomous+or+algorithmic+paper-trading+strategies+in+parallel+without+waiting+for+one+perfect+edge%3F+I+want+concrete+strategy+families%2C+idea-generation+methods%2C+experiment+budgets%2C+retirement+rules%2C+agent+architectures%2C+repositories%2C+and+logs+from+systems+that+execute+and+learn+continuously.&source=ANSWERS&tl=en)

### Review of the owner's additional Reddit follow-ups

The owner added questions on:

1. best practices for multi-strategy systems;
2. portfolio diversification;
3. concrete examples of uncorrelated strategies; and
4. examples of algorithmic strategy families.

The answers add four useful operating ideas.

#### Regime classification must be multidimensional and point-in-time

The strongest underlying regime discussion rejects a single bull/bear switch.
It recommends a small number of interpretable states using dimensions such as
direction, volatility, breadth, and intraday persistence. It also makes the
most important implementation warning in this follow-up: classify from
information available at the prior decision cutoff. Full-sample HMM smoothing
can use later observations to relabel earlier states, so live-style evaluation
must use forward-filtered probabilities.

MetaEdge implication:

- cap the initial regime vocabulary at three or four interpretable states;
- use probability weights rather than a hard most-likely-state toggle;
- store the feature timestamp, classifier version, filtered probabilities, and
  eligibility weight with every decision;
- require a simple no-regime-filter baseline;
- judge the filter on untouched periods and on whether it improves net
  expectancy, drawdown, and costs—not merely whether it reduces trade count.

Sources:

- [How to establish a successful market regime filter](https://www.reddit.com/r/algotrading/comments/1rvfy12/how_to_establish_a_successful_market_regime_filter/)
- [Let's talk about regime detection](https://www.reddit.com/r/algotrading/comments/1razsuv/lets_talk_about_regime_detection/)
- [Most regime filters just reduce trading frequency](https://www.reddit.com/r/algotrading/comments/1skdizm/most_regime_filters_dont_improve_trading/)

#### Portfolio construction needs a transparent baseline

The multi-strategy discussions describe concurrent strategies with separate
signals and either static or dynamic weights. A useful baseline proposed in the
quant discussion is:

1. volatility-target each strategy to the same ex-ante paper risk;
2. use net-of-cost strategy returns;
3. estimate covariance conservatively, with shrinkage;
4. compare equal weight with Equal Risk Contribution before introducing a
   learned allocator.

This is a comparison baseline, not an instruction to optimize allocations from
recent winners. MetaEdge should first prove that its strategy returns,
covariances, and costs are comparable and point-in-time.

Sources:

- [Diversified multi-strategy portfolio](https://www.reddit.com/r/algotrading/comments/1r1gwo6/diversified_multistrategy_portfolio/)
- [Portfolio optimization for multiple strategies](https://www.reddit.com/r/quant/comments/1rznlij/quant_strategy_how_to_implement_portfolio/)

#### “Uncorrelated” is conditional, not a permanent property

The Answers page mixes strategy diversification with generic asset
diversification. Those are not interchangeable. MetaEdge must measure:

- return correlation and downside/losing-day correlation;
- common symbol, market, factor, direction, volatility, liquidity, and funding
  exposure;
- concentration after netting opposing strategy intents;
- correlation by regime and during stress;
- the marginal risk contribution of a new paper trade.

A pair of strategies is not accepted as diversified because its full-sample
historical correlation is low. Correlations move and often become less helpful
during stress.

#### A long strategy list is an idea catalog, not validation

The examples include trend, momentum, mean reversion, breakout, pairs/relative
value, rotation, seasonal, news/sentiment, arbitrage, grid, options, and machine
learning. This is useful for filling a broad idea backlog, but the entries do
not have equal evidence or risk.

In particular:

- martingale is not an admissible MetaEdge strategy family;
- grid and short-option strategies require explicit gap, tail, and liquidation
  modeling;
- arbitrage claims require executable venue access, synchronized prices,
  transfer/settlement constraints, and costs;
- machine learning amplifies supplied information and does not create an edge
  by itself;
- multiple parameterizations of the same price-pattern premise are not
  genuinely different structural hypotheses.

Sources:

- [Basic algorithmic strategy catalog](https://www.reddit.com/r/algotrading/comments/1naoem2/list_of_the_most_basic_algorithmic_trading/)
- [Seventeen failed strategies on one highly efficient instrument](https://www.reddit.com/r/algotrading/comments/1spd5nf/6_months_full_time_on_algo_17_strategies_dead_on/)
- [Seven years of algorithmic research lessons](https://www.reddit.com/r/algorithmictrading/comments/1qoiomx/lessons_from_7_years_of_algorithmic_trading/)

#### Advice explicitly not adopted

- no universal `2–5% per trade` or `25–30% total open risk` rule;
- no assumption that HMM, LSTM, or generative AI improves regime detection;
- no hard-coded VIX or moving-average threshold selected after inspecting
  losing trades;
- no permanent “uncorrelated” label;
- no automatic capital rotation to whichever strategy recently won;
- no live-plus-paper comparison requirement while MetaEdge live execution is
  locked.

## Three practitioner implementations worth understanding

### 1. ClawStreet: execution is easy; credible measurement is hard

The author reported an arena with dozens of agents, thousands of paper trades,
market data, agent reasoning, and public rankings. The open
[ClawStreet Python SDK](https://github.com/rgourley/clawstreet-python) exposes a
small agent interface for quotes, history, scanning, trades, orders, fills, and
agent iteration/versioning.

Useful pattern:

- a tiny execution API makes it easy for many heterogeneous agents to act;
- every action can carry an agent identity and version;
- fills and decisions are visible rather than hidden inside prompts.

Critical limitation:

- in the Reddit comments, the author acknowledged that the reported results did
  not include slippage, spread, or commissions;
- therefore the leaderboard measured simulated decision activity, not
  economically credible execution;
- the open repository is a client SDK, not the platform's execution, fill, and
  learning backend.

MetaEdge decision: copy the **small versioned agent adapter** pattern, not the
leaderboard logic or performance claims.

Sources:

- [Reddit: ClawStreet agent arena](https://www.reddit.com/r/algotrading/comments/1sf8o4s/i_built_a_platform_where_ai_agents_trade_stocks/)
- [ClawStreet Python SDK](https://github.com/rgourley/clawstreet-python)
- [ClawStreet documentation](https://docs.clawstreet.io/)

Evidence: code-backed client capability; practitioner/self-reported platform
results; execution realism not established.

### 2. Fourteen agents for 48 days: autonomous mechanics, not verified learning

The author reported 14 CrewAI agents trading a paper account for 48 days. The
system demonstrated that agents could gather information, make decisions, and
drive deterministic trailing-stop mechanics.

The comments also reveal the evidence boundary:

- paper trading was the only backtest;
- there was no historical simulation;
- 48 days covered little regime diversity;
- LLM nondeterminism was not controlled;
- the paper result underperformed the stated equity benchmark on a raw
  percentage basis.

MetaEdge decision: deterministic exits downstream of agents are useful. Moving
from a short paper run to real capital is not.

Source:
[Reddit: 14 agents, 48 days](https://www.reddit.com/r/algotrading/comments/1tsl3ef/48_days_of_ai_agent_paper_trading_3245_total_pl/)

Evidence: practitioner observation and self-reported result.

### 3. Mining one's own executed logs: the strongest loop in the thread

An Interactive Brokers practitioner described mining actual paper-execution
logs from an MNQ scalper:

- a proposed filter showed near-zero correlation across 367 entries and was
  rejected;
- a broad “momentum-aligned” result looked attractive on win rate, while its
  against-momentum cohort contained substantially worse losses;
- an apparently profitable backtest collapsed when execution assumptions were
  replaced with behavior closer to observed fills;
- the author added trigger-specific gates, market correlation/beta, and up/down
  day splits rather than applying one universal filter.

The exact performance numbers are self-reported, but the method is the most
useful thing in the Reddit trail:

`paper intent -> observed fill/outcome -> matched baseline -> falsification or challenger`

MetaEdge decision: every paper fill must create a structured observation that
can kill an explanation, expose tail risk, and recalibrate the fill model.

Source:
[Reddit: use real paper executions instead of only backtests](https://www.reddit.com/r/interactivebrokers/comments/1v00eb8/use_of_real_data_paper_trade_instead_of_backtest/)

Evidence: practitioner observation; method is reproducible, reported numbers
are not independently verified.

## Repository review

| Project | What it actually provides | Learning mechanism | Important limitation | MetaEdge use |
|---|---|---|---|---|
| [NautilusTrader](https://github.com/nautechsystems/nautilus_trader) | Event-driven strategy, risk, order, and reconciliation infrastructure across backtest and live-style environments | Persistent execution events and explicit reconciliation | A trading engine, not an alpha-discovery system | Adopt event/state/reconciliation contracts |
| [Freqtrade/FreqAI](https://github.com/freqtrade/freqtrade) | Mature crypto dry-run, backtest, strategy, protection, and ML retraining system | Forward dry-run plus scheduled model retraining and stored predictions | Retraining can create hidden adaptation debt without frozen cohorts and trial accounting | Adopt dry-run persistence and observation discipline; keep challengers frozen |
| [FinRL-X](https://github.com/AI4Finance-Foundation/FinRL-Trading) | Weight-based contract spanning data, strategy, backtest, and Alpaca paper deployment | Same target-weight output across modes | Repository results are self-reported; execution consistency is not causal learning | Consider target-weight interface for portfolio strategies |
| [RD-Agent](https://github.com/microsoft/RD-Agent) | Automated factor/model idea generation and implementation with Qlib | Researcher/Developer loop proposes and codes challengers | Upstream research system; it does not solve order execution or promotion governance | Use as a challenger factory, never an order source |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | Multi-agent analysis and portfolio decision graph | Stores decisions, later resolves return/alpha, writes reflections, recalls recent lessons | A decision is returned; broker execution is not the core contract. Prompt reflection is not causal proof | Adopt resolved-outcome memory shape with stricter controls |
| [AI-Trader](https://github.com/HKUDS/AI-Trader) | Agent integration, signals, paper surfaces, social/copy features, and large-cohort experiments | Fixed experimental variants and instrumentation | Low treatment/read adoption in its own experiment log; social activity and leaderboards can dominate edge measurement | Adopt cohort/variant instrumentation, not copy-trade popularity |
| [AgenticTrading](https://github.com/Open-Finance-Lab/AgenticTrading) | DAG orchestration with data, alpha, execution, memory, and agent-pool concepts | Execution contexts, result objects, memory events, and health checks | Broad architecture and samples do not prove resilient broker execution or returns | Reference for role isolation only |
| [Moss Trade Bot Factory](https://github.com/moss-site/moss-trade-bot-skills) | Natural-language parameterization, local segmented backtests, and a platform live client | A pre-written evolution schedule plus external human/LLM reflection guidance | The live runner advertises but does not implement `--evolve-every`; tests expose stale cross-version fingerprint drift; the platform fill backend is not in the repository | Borrow deterministic signals and bounded challenger drift; reject forced mutation and parity claims |
| [TradeSight](https://github.com/rmbell09-lang/tradesight) | Self-hosted research plus Alpaca paper execution, evidence labels, and reconciliation | Optimizer, feedback history, and a persisted champion file | README says no auto-promotion, but `ChampionTracker` automatically writes the first champion, can force replacement without challenger forward sessions, and can promote after three sessions | Borrow evidence labels and paper reconciliation; reject its champion authority |
| [AI Hedge Fund](https://github.com/virattt/ai-hedge-fund) | Many analyst personas, risk/portfolio discussion, and a backtester | Role debate | README explicitly says it does not actually trade | UX inspiration only |
| [Polymarket Paper Trader](https://github.com/agent-next/polymarket-paper-trader) | Agent-facing paper simulator using current prediction-market order books | Paper ledger, P&L, and leaderboard | Real order books do not by themselves prove realistic queue/fill behavior or edge | Possible future calibration sandbox; not a current dependency |

### What the strongest projects agree on

The credible common architecture is not “one smart agent.” It is:

`versioned strategy -> deterministic intent -> risk veto -> execution adapter -> durable order/fill state -> reconciliation -> evaluation`

The agent may propose a hypothesis, write strategy code, summarize context, or
explain a postmortem. It should not:

- submit an untyped natural-language order;
- size outside a deterministic risk policy;
- modify the active strategy after seeing a loss;
- declare itself improved from its own narrative;
- promote itself from a leaderboard rank;
- treat a missing or unresolved order as a loss, fill, or no-trade.

Primary supporting references:

- [NautilusTrader live trading and reconciliation](https://nautilustrader.io/docs/latest/concepts/live/)
- [Freqtrade dry-run configuration](https://docs.freqtrade.io/en/stable/configuration/)
- [Freqtrade strategy testing modes](https://www.freqtrade.io/en/stable/strategy-101/)
- [FreqAI configuration](https://docs.freqtrade.io/en/stable/freqai-configuration/)
- [LEAN algorithm engine](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/algorithm-engine)
- [LEAN live reconciliation](https://www.quantconnect.com/docs/v2/writing-algorithms/live-trading/reconciliation)
- [RD-Agent paper](https://arxiv.org/abs/2505.15155)
- [TradingAgents paper](https://arxiv.org/abs/2412.20138)
- [FinRL-X paper](https://arxiv.org/abs/2603.21330)

## Current MetaEdge code finding

### The canonical runtime conflates discovery and promotion

In `server/decision/engine.ts`:

- a valid non-hold signal without `forward_paper_candidate` validation becomes
  `research_hypothesis`;
- its `queueStatus` is `not_queued`;
- only a previously validated signal becomes `paper_trade_candidate`.

In `server/decision/runtime.ts`:

- `routePaperDecision` returns immediately unless the decision outcome is
  `paper_trade_candidate`;
- routed orders do use the shared `placePaperTrade` path, owner checks, active
  agent state, deterministic size, and an idempotency nonce.

In `server/discovery/economic_runtime.ts`:

- the first move from `research_candidate` to `shadow_paper` requires a minimum
  historical sample count;
- later moves correctly require untouched forward samples, positive
  cost-stressed lower bounds, fills, independent blocks, and kill-rule checks.

The missing concept is a small **paper-discovery execution budget** that is
allowed to create observations before the strategy has earned promotion.

### Golden Cross is one example of the missing mode

`server/decision/golden_cross_scanner.ts`:

- scans current market data;
- creates bounded paper entries through `placePaperTrade`;
- tags them `golden_cross` and records context;
- uses position limits, cooldowns, liquidity rules, and a trailing stop;
- does not require a `forward_paper_candidate` validation record;
- is separate from the layered-decision queue and economic experiment
  lifecycle.

Golden Cross is therefore already a de facto discovery-paper example. It
should not be removed or described as validated alpha. It may be brought under
the same experiment, intent, observation, and reconciliation contracts as
other v5 paper-discovery agents, but it has no priority over other ideas and
does not need to block their execution.

### The shared executor is a good base, not a complete fill model

`server/trades.ts` already provides:

- server-derived ownership;
- active-agent checks;
- typed order intent and idempotency nonce;
- deterministic risk evaluation;
- a shared ledger path for manual and agent paper orders;
- a configurable conservative per-side cost adjustment;
- thesis sanitization and audit records.

What it does not yet establish:

- bid/ask or order-book-aware fills;
- partial fills and queue position;
- explicit submitted/acknowledged/rejected/canceled/unresolved order states;
- missed-event and restart reconciliation against an external paper venue;
- separation of expected price, observed reference price, simulated fill price,
  and realized exit price;
- a counterfactual for valid opportunities the agent skipped or risk rejected.

## Proposed v5 execution-learning contract

### 1. `ExperimentSpecV5`

Frozen before execution:

- experiment, family, variant, and strategy-version IDs;
- code commit and strategy hash;
- mechanism and falsifier;
- instrument, venue, universe, and feature versions;
- decision cadence and maximum evidence age;
- entry, exit, invalidation, and time-stop rules;
- benchmark and no-trade/control definition;
- cost and fill model;
- paper-discovery budget and kill limits;
- total charged trials and parent challenger;
- review clock and promotion criteria;
- `liveExecution: "locked"`.

### 2. `OrderIntentV5`

Created by deterministic strategy code, never raw prose:

- experiment and strategy version;
- event and decision IDs;
- symbol, side, quantity or target weight;
- decision timestamp and evidence cutoff;
- order policy;
- reference price and maximum admissible cost;
- invalidation and expiry;
- risk-policy version;
- idempotency key.

### 3. `ExecutionObservationV5`

Written for every intent, including non-fills:

- terminal state:
  `filled | partially_filled | rejected | canceled | expired | unresolved |
  risk_blocked | skipped_control`;
- submit, acknowledge, fill, and resolution timestamps;
- expected, reference, and simulated/observed fill prices;
- fees, spread, slippage, funding, latency, and total execution drag;
- filled quantity and remaining quantity;
- signal, execution, and outcome linkage;
- regime, benchmark, factor exposure, and independent event block;
- restart/reconciliation status;
- immutable source IDs.

An `unresolved` intent is not silently converted into a fill or ignored.

### 4. Learning output

An evaluator may produce only:

- `continue_discovery`;
- `activate_for_regime`;
- `reduce_for_regime`;
- `suspend_to_shadow`;
- `probationary_reentry`;
- `reduce_discovery_budget`;
- `kill_variant`;
- `execution_incident`;
- `data_incident`;
- `propose_challenger`;
- `eligible_for_paper_confirmation`.

The evaluator cannot modify the active strategy. A change creates a new frozen
challenger with a new trial charge.

## How a strategy population should execute and learn in parallel

### Pipeline

1. **Idea scouts** continuously source hypotheses from different mechanism
   families, markets, horizons, observations, papers, and failed trades.
2. **Hypothesis compiler** turns each idea into a small deterministic,
   versioned paper arm.
3. **Integrity gate** checks only the minimum needed to avoid meaningless
   execution: data freshness, instrument validity, obvious leakage, cost
   feasibility, and hard risk.
4. **Discovery paper executor** immediately spends a capped information budget
   for every admitted arm.
5. **Observation ledger** records fill, no-fill, block, skip, and outcome with
   strategy identity.
6. **Reconciler** detects data, signal, order, fill, and restart mismatches.
7. **Evaluator** classifies what was learned instead of demanding certainty.
8. **Lifecycle agent** activates, reduces, suspends, places on probation, or
   retires an arm; it may launch a new version but never edits an active one.
9. **Portfolio governor** limits shared exposures across all active arms.
10. **Exploration scheduler** protects capacity for new mechanism families,
    rather than allocating everything to recent winners.

These stages can run concurrently across experiments. The active variant inside
one experiment remains immutable.

### What “more execution” means

It does not mean maximizing orders. It means maximizing useful, non-duplicative
observations within a paper risk and review budget.

The scheduler should prefer an experiment when it:

- represents a new independent event or under-observed regime;
- resolves an important fill/cost uncertainty;
- distinguishes a strategy from its control;
- can falsify a current explanation;
- does not duplicate the portfolio's existing symbol/factor exposure.

It should not trade merely because an agent is idle.

### Minimum analysis for every active paper variant

- all opportunities: enter, skip, risk-block, stale-data block, and no-signal;
- net expectancy and payoff after costs;
- tail loss and drawdown depth/duration;
- fill and execution drag;
- market/benchmark beta;
- up/down/sideways and volatility regimes;
- symbol, factor, and losing-day correlation;
- no-trade and simple-rule control delta;
- independent event blocks and total charged trials;
- expected-versus-observed signal and order agreement;
- result with and without the largest one or two winners.

## Initial operating policy

These are safe starting defaults for implementation, not universal statistical
truth:

- paper mode only;
- one canonical v5 runtime and ledger;
- a backlog of 100 or more ideas across genuinely different families;
- a first operating target of 12–20 concurrent small paper arms, expanded only
  while attribution, reconciliation, and review remain current;
- no privileged champion is required during discovery;
- equal, fixed discovery budgets before any adaptive allocation;
- diverse mechanism families, including trend, momentum, breakout, mean
  reversion, relative value/pairs, volatility, carry/funding/basis,
  cross-sectional ranking, event/news, and simple baselines where accessible
  data and paper instruments permit;
- use unleveraged or tightly bounded paper exposure by default; a leveraged
  paper arm needs explicit leverage and liquidation assumptions;
- no HFT/scalping lane until book data and fill reconciliation exist;
- hard per-variant position, loss, drawdown, concurrency, and opportunity
  limits;
- exits remain available when new entries are suspended;
- fixed scheduled reviews plus immediate integrity/kill events;
- regime activation rules use known-at-time data, probability bands,
  hysteresis, and minimum dwell times rather than recent-P&L whipsaw;
- dormant strategies keep producing shadow decisions so re-entry can be tested
  against what would actually have happened;
- no automatic promotion and no live activation endpoint.

The 12–20 number is an initial throughput target, not a claim that it is
optimal. MetaEdge should increase or reduce it based on its ability to retain
complete attribution and timely review. Small parameter changes do not count
as diversity.

Sample counts and review durations must come from event rate, dependence,
effect size, and regime coverage. A universal “100 trades” rule should not be
encoded.

## Ranked build plan

### P0 — Split permission from proof

Add `paper_discovery` as an explicit outcome/lifecycle state. It must pass
integrity, cost-feasibility, risk, and portfolio gates but must not require
promotable alpha.

Acceptance:

- a valid frozen hypothesis can create a capped paper intent;
- the UI labels it `Paper discovery`, not `validated`;
- `paper_confirmed` still requires untouched forward evidence;
- live remains locked.

### P1 — Open the strategy-population intake

Create a small versioned adapter that allows any deterministic paper strategy
to emit the shared minimum identity and risk fields. Do this incrementally;
do not wait for a perfect full-schema migration before running diverse paper
arms.

Keep strategy identity in the current trade list through family, strategy,
variant, version, and lifecycle labels; do not create a new dashboard panel.

Acceptance:

- at least 12 genuinely different paper arms can coexist without separate
  broker accounts or panels;
- every entry, skip, block, and exit keeps its strategy/version identity;
- current history remains visible and is not retroactively upgraded to v5
  evidence;
- Golden Cross may use the adapter like any other arm, but nothing depends on
  it going first.

### P2 — Add intent and observation contracts

Persist `OrderIntentV5` and `ExecutionObservationV5` for fills and non-fills.
Introduce explicit `unresolved` state and restart reconciliation.

Acceptance:

- totals reconcile from opportunity to decision to intent to fill to outcome;
- duplicate/replayed events do not create duplicate paper trades;
- expected and observed execution prices remain separate.

### P3 — Run a diverse first wave

Launch 12–20 small paper arms across several mechanism families and horizons.
Include simple controls and baselines where they are informative, but do not
make every new idea wait for a champion/challenger contest.

Acceptance:

- fixed small initial paper budgets;
- several genuinely different mechanism families;
- strategy labels visible in the existing trade list;
- cost, regime, benchmark, tail, and ablation views;
- continuous intake and retirement without changing active versions;
- active, reduced, dormant, probationary, and retired states remain distinct;
- no arm is called validated merely because it traded or won.

### P4 — Close the postmortem loop

Resolve outcomes, classify implementation failure, regime mismatch, normal
variance, portfolio crowding, and structural economic failure separately.
Allow agents to suspend or reduce an arm, test probationary re-entry, retire it,
propose a new version, or propose a genuinely different idea.

Acceptance:

- active strategy hash never changes;
- every revision has a parent, reason, and new trial charge;
- a genuinely new family does not need to descend from the current winner;
- one loss or one hostile regime cannot retire an arm;
- dormant arms continue shadow observation and retain re-entry criteria;
- permanent retirement requires repeated eligible-regime failure or a
  falsified mechanism;
- “no change” is a valid postmortem outcome;
- no forced parameter churn.

### P5 — Add portfolio scheduling

Allocate discovery opportunities using exposure caps and information value,
not recent P&L rank.

Acceptance:

- shared symbol, factor, regime, and losing-day exposure is visible;
- equal-budget baseline remains available;
- allocation cannot increase risk beyond fixed policy.

### P6 — Consider external paper adapters

Only after local reconciliation works, evaluate one broker/exchange paper
adapter. The objective is fill-model calibration and state recovery, not a path
to live capital.

## Adoption decisions

Adopt now:

- NautilusTrader's explicit order outcomes, persisted execution events, and
  reconciliation boundaries;
- Freqtrade's persistent dry-run discipline and bias-analysis mindset;
- TradeSight's evidence labels and broker/local reconciliation, but not its
  automatic `ChampionTracker` writes or initial accounting fail-open;
- TradingAgents' decision-to-resolved-outcome memory shape;
- AI-Trader's fixed cohort and treatment instrumentation;
- Moss's immutable core and bounded tactical drift, but only in newly created
  challengers;
- RD-Agent's separation of research proposals from implementation.

Do not adopt:

- social copy trading as validation;
- recent-winner allocation;
- agent personas as independent alpha;
- forced strategy mutation;
- self-reported paper P&L as proof;
- live capital as a learning shortcut;
- a second execution engine before the canonical v5 evidence spine works.

## Final conclusion

Reddit's most important lesson is not that other agents trade more. It is that
the useful systems turn every attempted action into evidence.

MetaEdge already has many of the difficult safety pieces: ownership, typed
intents, risk checks, idempotency, paper costs, immutable strategy concepts, and
live lock. The missing bridge is a governed discovery-paper state and a
complete observation/reconciliation loop.

Build that bridge first. Then agents can execute more, fail faster, and learn in
parallel without pretending that activity, explanations, or a favorable paper
leaderboard prove a profitable strategy.
