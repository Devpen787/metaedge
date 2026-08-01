# Reddit vs. MetaEdge: How We Build a Trading System That Actually Learns

Date: 2026-07-29
Status: research comparison and operating recommendation; no strategy or live-execution change
Evidence cutoff: production commit `6358c0a`

Execution-learning follow-up:
[Executing Agents That Produce Evidence](./EXECUTING_AGENT_LEARNING_RESEARCH_2026-07-30.md)

Pinned source and test audit:
[External Execution and Learning Forensic Audit](./EXTERNAL_EXECUTION_LEARNING_FORENSIC_AUDIT_2026-07-30.md)

## Bottom line

### Correction after owner review

The original recommendation overcorrected. It was right that MetaEdge needs
shared attribution and a measurable learning loop, but wrong to turn that into
four lanes, eight variants, and Golden Cross as the lifecycle center.

We are also behind because we do not execute enough genuinely different ideas.
The corrected model is one shared v5 paper substrate supporting a broad,
continuously replenished strategy population.

MetaEdge is already stronger than most Reddit projects at:

- keeping live execution locked;
- recording decisions and declined trades;
- separating paper evidence from live money;
- using deterministic gates that an LLM cannot override;
- treating `no_trade` and killed hypotheses as legitimate results.

MetaEdge is weaker at:

- running one current, healthy research plane end to end;
- reconciling historical simulation with forward-paper behavior;
- turning every experiment into a comparable record;
- correcting explicitly for the number of hypotheses tried;
- operating several genuinely different experiments as one risk portfolio;
- automatically retiring failed forward trials;
- maintaining one canonical version and one canonical runtime.

The right response is not one more privileged prediction model. It is to let
many small paper hypotheses trade while the v5 experiment operating system is
improved incrementally. Data collection, idea generation, paper execution,
reconciliation, retirement, and replacement should run in parallel. Each
active strategy version remains frozen, but the population never waits for one
cohort to finish.

## Evidence boundary

Reddit Answers explicitly says its responses are AI-generated from posts and
comments and may be inaccurate. I therefore use three evidence labels:

- **Field signal** — recurring practitioner experience worth testing.
- **Supported practice** — also supported by a primary paper or mature platform.
- **Anecdote only** — interesting, but not an operating rule.

Reddit is useful for finding failure patterns and questions. It does not prove
that a strategy makes money.

## Questions used

1. How should multiple paper strategies run in parallel without multiplying
   overfitting?
2. What should kill a strategy, and how do we distinguish decay from normal
   drawdown?
3. Does public OHLCV offer enough advantage, or does a small trader need unique
   data?
4. How should research, backtest, forward-paper, and live execution share one
   architecture?
5. What should autonomous/LLM agents do, and what must remain deterministic?
6. How should a small operator choose markets and timeframes?
7. Is the more dependable business trading capital or selling useful trading
   infrastructure?

I also submitted a focused follow-up asking how autonomous agents should divide
data quality, research, risk, execution, and postmortem work without allowing an
LLM to change frozen rules. Reddit Answers did not produce a new focused answer
in the session. That omission matters: Reddit has many agent demos, but no
credible consensus architecture for governed self-improvement.

## What Reddit told us

### 1. Freeze each version, not the whole discovery process

The most relevant Reddit discussion describes almost the exact loop we need:
optimize on one slice, freeze the setup, test it on unseen data, review, make a
controlled adjustment, freeze again, and repeat. Constantly modifying a running
system can look like learning while merely fitting the newest observations.

Source: [Stuck in a loop](https://www.reddit.com/r/algotrading/comments/1uibk8h/stuck_in_a_loop/)

Assessment: **supported practice**. This matches MetaEdge's intended immutable
strategy and forward-evidence model.

The important design consequence is:

> An active strategy does not self-improve by changing itself. The system
> improves by running many versioned ideas, retiring failures, and launching
> revisions or unrelated new families. A current champion is not required for
> discovery.

### 1A. Reddit practitioners run populations, not one privileged strategy

Direct threads contain the operating pattern the earlier recommendation
missed:

- approximately 80 models can be combined in one portfolio;
- strategy names can be attached to orders and fills in one shared account;
- 20–30 bots can remain in continuous forward testing while allocation changes
  and weak bots are retired;
- 20–50 demo strategies can run continuously while hundreds of ideas move
  through the research funnel;
- one paper-account discussion explicitly proposes local
  `strategy | broker | broker_id` attribution instead of multiplying accounts;
- an open-source evolutionary example runs five different mechanism families
  behind an external hard-risk engine.

Sources:

- [Multiple strategies and overlapping trades](https://www.reddit.com/r/algotrading/comments/1ghawod/do_you_run_multiple_strategies_independently_or/)
- [How many strategies were tested](https://www.reddit.com/r/algotrading/comments/1uzzgxm/how_many_strategies_did_you_backtest_before/)
- [Running multiple paper ideas](https://www.reddit.com/r/algotrading/comments/1dcgg0g/whats_the_best_way_to_run_multiple_paper_trading/)
- [Continuously launching parallel strategies](https://www.reddit.com/r/algotrading/comments/1e40bak/to_people_currently_running_a_live_strategy_whats/)
- [Evolutionary multi-agent paper trader](https://www.reddit.com/r/algotrading/comments/1v4h5rs/built_an_evolutionary_multiagent_crypto_trading/)

Assessment: **field signal plus code example**, not profitability proof. The
useful lesson is high-throughput paper execution with identity and external
risk controls. The P&L and live-readiness claims remain unverified.

### 1B. Strategies are conditional specialists, not permanent winners or losers

A loss does not prove a strategy is dead. Trend, mean-reversion, breakout,
carry, volatility, and event strategies can have different opportunity sets
and can fail for long periods outside the conditions they were designed for.

The operating model therefore separates:

- **trigger**: does the strategy see its specific trade setup now?
- **eligibility**: are the broader volatility, trend, liquidity, correlation,
  dispersion, funding, or event conditions appropriate?
- **health**: when eligible, is its observed behavior still within the expected
  cost, expectancy, and drawdown envelope?
- **portfolio fit**: would the trade duplicate exposures or exceed risk limits?

The lifecycle is:

`eligible/armed -> active -> reduced -> dormant/shadow -> probationary re-entry`

Retirement is a separate terminal decision reserved for repeated
eligible-regime failure, invalidated mechanics, infeasible costs, or
untrustworthy implementation. Dormant strategies continue producing
counterfactual shadow decisions so MetaEdge can measure whether the expected
conditions and behavior have returned.

To avoid turning regime awareness into recent-performance overfitting:

- define low-dimensional regime features before observing the next outcome;
- use soft eligibility weights, hysteresis, and minimum dwell times;
- do not deactivate after one loss or reactivate after one win;
- compare within intended regimes and across repeated episodes;
- keep the regime classifier versioned and separately scored;
- preserve a cash/no-trade allocation;
- log the counterfactual outcome while an arm is dormant.

Source:
[Reddit Answers: regime mismatch versus permanent failure](https://www.reddit.com/answers/22c32390-4f52-4d71-90b1-f9449917d0a6/?q=How+are+people+actually+running+10+to+100+autonomous+or+algorithmic+paper-trading+strategies+in+parallel+without+waiting+for+one+perfect+edge%3F+I+want+concrete+strategy+families%2C+idea-generation+methods%2C+experiment+budgets%2C+retirement+rules%2C+agent+architectures%2C+repositories%2C+and+logs+from+systems+that+execute+and+learn+continuously.&source=ANSWERS&tl=en)

### 1C. Review of the additional follow-up answers

The owner added follow-ups covering multi-strategy best practices, portfolio
diversification, concrete uncorrelated strategies, and algorithmic strategy
examples.

The reviewed conclusion is:

> MetaEdge should build a portfolio of conditional specialists, not a bag of
> indicator variants and not a regime-prediction supermodel.

What is useful:

- regime state should be multidimensional—at minimum direction plus
  volatility—and probabilistic;
- three or four interpretable states are safer initially than a large taxonomy
  with too few observations per state;
- classification must be point-in-time; forward-filtered probabilities are
  appropriate, while full-sample HMM smoothing can leak later information;
- strategies can run concurrently with separate signals and transparent
  weights;
- equal weight, volatility targeting, and Equal Risk Contribution are useful
  portfolio baselines before a learned allocator;
- diversification must be measured across mechanisms, markets, instruments,
  timeframes, factors, and losing periods;
- historical correlation is conditional and can deteriorate during stress;
- the strategy catalog should span trend, momentum, mean reversion, breakout,
  relative value/pairs, rotation, seasonal, event/news, volatility, carry/basis,
  and simple controls.

What is weak, unsafe, or unsupported:

- the Answers page repeats universal `2–5% per-trade` and `25–30% total-risk`
  figures without enough context; MetaEdge will not encode them;
- generic asset diversification is not evidence that trading strategies are
  independent;
- HMM, LSTM, and generative-AI regime suggestions are hypotheses, not proven
  upgrades;
- martingale is inadmissible; grid, short-options, and apparent arbitrage need
  specialized tail, execution, settlement, and cost proof;
- “uncorrelated” cannot be a permanent strategy label;
- filtering out losing historical trades after seeing them is curve fitting;
- running many variants of the same bar-pattern premise is not structural
  diversity.

The most actionable external baseline is:

`equal ex-ante paper risk -> net-of-cost returns -> conservative covariance ->
equal weight / ERC comparison -> only then test dynamic allocation`

The current MetaEdge version should record, for every triggered or shadow
decision:

- strategy/family/version;
- regime feature cutoff and classifier version;
- filtered state probabilities;
- eligibility, health, portfolio-fit, and final risk weights;
- expected and realized cost;
- normal and downside correlation contribution;
- active, reduced, dormant, probationary, or retired lifecycle state.

Sources:

- [How to establish a successful market regime filter](https://www.reddit.com/r/algotrading/comments/1rvfy12/how_to_establish_a_successful_market_regime_filter/)
- [Most regime filters just reduce trading frequency](https://www.reddit.com/r/algotrading/comments/1skdizm/most_regime_filters_dont_improve_trading/)
- [Diversified multi-strategy portfolio](https://www.reddit.com/r/algotrading/comments/1r1gwo6/diversified_multistrategy_portfolio/)
- [Portfolio optimization for multiple strategies](https://www.reddit.com/r/quant/comments/1rznlij/quant_strategy_how_to_implement_portfolio/)
- [Basic algorithmic strategy catalog](https://www.reddit.com/r/algotrading/comments/1naoem2/list_of_the_most_basic_algorithmic_trading/)
- [Seventeen failed strategies on one instrument](https://www.reddit.com/r/algotrading/comments/1spd5nf/6_months_full_time_on_algo_17_strategies_dead_on/)
- [Seven years of algorithmic research lessons](https://www.reddit.com/r/algorithmictrading/comments/1qoiomx/lessons_from_7_years_of_algorithmic_trading/)

### 2. Net expectancy matters more than win rate

Reddit repeatedly rejects “what win rate should I target?” as the wrong
question. The useful quantity is roughly:

`win_probability × average_win - loss_probability × average_loss - fees - slippage - funding - impact`

High frequency is not automatically better. If the average expected move does
not clear the cost hurdle, more trades make the loss compound faster.

Source: [Stuck in a loop](https://www.reddit.com/r/algotrading/comments/1uibk8h/stuck_in_a_loop/)

Assessment: **supported practice**.

### 3. Kill rules need two stages

Reddit Answers recommends:

1. Verify the system is still doing what was tested: same signal set, comparable
   timing, realistic slippage, and expected fills.
2. Only then decide whether the economic edge has decayed using precommitted
   expectancy, payoff, hit-rate, drawdown-depth, and drawdown-duration bands.

It also recommends judging drawdown against the distribution expected from the
backtest, rather than killing a system because the latest loss feels bad.

Sources:

- [Reddit Answers: strategy kill criteria](https://www.reddit.com/answers/b64b7e33-7de4-49aa-afa5-043342720aa2/?q=when+should+you+stop+algorithmic+trading+strategy+research+give+up+no+edge+project+kill+criteria&source=SERP_SEARCH_BAR_BUTTON&tl=en)
- [How do you tell decay from a normal drawdown?](https://www.reddit.com/r/algotrading/comments/1u3q7ko/how_do_you_tell_a_strategy_is_actually_decaying/)

Assessment: **supported practice**. QuantConnect's
[live reconciliation](https://www.quantconnect.com/docs/v2/research-environment/meta-analysis/live-reconciliation)
formalizes the same idea by comparing live and out-of-sample equity curves and
fills.

### 4. Parallel strategies must be evaluated as a portfolio

Reddit recommends running multiple frozen experiments at once, but measuring:

- rolling correlation between strategy equity curves;
- correlation specifically on losing days;
- shared symbol and factor exposure;
- aggregate drawdown and capital usage;
- whether apparently separate strategies are variations of the same bet.

Sources:

- [Reddit Answers: parallel paper experiments](https://www.reddit.com/answers/03026f42-6e9d-4f46-ac3b-a4ed280feefe/?q=paper+trading+multiple+strategies+parallel+experiments+fail+fast+overfitting&source=SERP_SEARCH_BAR_BUTTON&tl=en)
- [Diversified multi-strategy portfolio](https://www.reddit.com/r/algotrading/comments/1r1gwo6/diversified_multistrategy_portfolio/)

Assessment: **field signal with strong quantitative foundation**.

Reddit sometimes recommends allocating to the best recent strategy or building
a regime switch. That can create a second overfit model. MetaEdge should first
run equal or precommitted paper budgets and measure correlation. Dynamic
allocation is a later hypothesis, not a default feature.

### 5. Use one event path for simulation and forward execution

A strong Reddit architecture uses:

`data -> filtering -> signal -> order intent -> validation -> risk -> dispatcher`

Historical simulation feeds recorded events into the same pipeline and swaps
the real dispatcher for an account simulator. This reduces semantic differences
between backtest and forward operation.

Source: [Event-Driven Trading Systems](https://www.reddit.com/r/algotrading/comments/117sdkp/eventdriven_trading_systems/)

Assessment: **supported practice**. QuantConnect/LEAN similarly uses streaming
events so the same algorithm can run in backtest and live modes, while still
documenting the remaining timing, fill, state, and data differences:

- [LEAN algorithm engine](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/algorithm-engine)
- [Live/backtest reconciliation](https://www.quantconnect.com/docs/v2/writing-algorithms/live-trading/reconciliation)

### 6. Complete data beats clever analysis on incomplete data

Reddit emphasizes complete trade/candle coverage, explicit data lineage, and
granular order-flow data when the proposed mechanism depends on microstructure.
It also warns that retail is structurally disadvantaged in latency-sensitive
HFT.

Sources:

- [Reddit Answers: public and alternative data](https://www.reddit.com/answers/dac99bfc-2ee9-4bdf-8ac1-3cf469b6b181/?q=algorithmic+trading+public+price+data+unique+data+advantage+alternative+data+retail&source=SERP_SEARCH_BAR_BUTTON&tl=en)
- [What markets do you trade?](https://www.reddit.com/r/algotrading/comments/1uw4frb/what_markets_do_you_trade/)

Assessment: **mixed**. Data completeness is a supported practice. Specific
claims that CVD, order blocks, sentiment, or alternative data contain alpha are
only hypotheses.

### 7. LLMs belong upstream of deterministic execution

The credible Reddit position is not “let the AI trade.” It is:

- let models summarize context, propose hypotheses, classify documents, and
  explain decisions;
- translate accepted proposals into rigid, versioned rules;
- stress-test those rules across regimes;
- use a simple deterministic process for sizing, risk vetoes, and order routing.

Sources:

- [Full autonomous AI trading discussion](https://www.reddit.com/r/algotrading/comments/1ro3ye4/has_anyone_gone_full_autonomous_with_ai_trading/)
- [Multi-agent LLM crypto system](https://www.reddit.com/r/algotrading/comments/1o3i1ry/building_a_multiagent_llm_system_for_live_crypto/)

Assessment: **field signal**. The discussion contains unverified performance
claims, tiny samples, and basic metric disputes. Its architectural caution is
useful; its P&L claims are not evidence.

### 8. Tools may be a better business than trading capital

Reddit Answers argues that useful trading infrastructure can earn more
consistently than a small operator trading personal capital. The most valued
tools are often “boring”: risk sizing, journaling, replay, setup filters,
execution review, and mistake prevention.

Source: [Reddit Answers: trading tools versus own capital](https://www.reddit.com/answers/714ac01e-0f90-462b-a08e-6321fa3b88d2/?q=build+trading+software+business+sell+tools+versus+trade+own+capital+which+makes+money&source=SERP_SEARCH_BAR_BUTTON&tl=en)

Assessment: **anecdote only**, but strategically relevant. MetaEdge's evidence
and governance layer can be useful before MetaEdge discovers promoted alpha.

## What Reddit did not tell us

Reddit did not provide:

- a reproducible profitable strategy;
- immutable data, code, universe, and parameter hashes;
- a reliable correction for every hypothesis tried;
- proof that any cited multi-agent system survived realistic forward costs;
- a precise autonomous-agent permission model;
- an answer to how a running model may safely change itself;
- a consistent recommendation on markets or timeframes;
- a method for separating one market event that triggers many correlated trades
  from many independent observations;
- a production storage, restart, and concurrency contract;
- a trustworthy path from paper performance to live capital.

It also mixes incompatible contexts: discretionary day-trader psychology, prop
firm rules, equities, futures, crypto, and autonomous execution. Advice such as
“use three confluences,” “target this win rate,” or “paper trading cannot test
psychology” is not automatically relevant to a deterministic autonomous paper
system.

## Current MetaEdge truth

Live production checks on 2026-07-29:

| Surface | Current evidence |
|---|---|
| Deployment | Healthy at commit `6358c0a`; database connected |
| Money boundary | Global live lock is on |
| Decision runtime | 6 strategy specs |
| Latest decision cycle | 238 evaluated, 238 declined, 0 hypotheses, 0 paper candidates, 0 routed |
| Active validations | 0 |
| v3 operation | `degraded`; economic result `no_promoted_alpha` |
| v3 data world | No current audited dataset or universe; parity audit missing |
| v3 portfolio/execution | Blocked; no target portfolio, weight simulation, or order simulation |
| v3 forward learning | 0 resolved or attributed observations; audit missing |
| v3 economics | 0 contracts, decisions, outcomes, P&L, promotions, or kills |
| Fast perps | Disabled; recorder disconnected |
| Research Fleet | 12,053 paper trades; 4,900 closed; realized P&L `-$3,362.77` |
| Golden Cross | 1 open paper trade, 0 closed, no realized result |

The Research Fleet total is not evidence that the current learning system is
active. Most closed history belongs to legacy `grid` and `custom_ai` families,
which together produced the recorded negative P&L. The one Golden Cross trade
is useful forward telemetry, not proof of edge.

There is also a direct version-governance conflict with the owner's v5 mandate:

- `STATE.md` still declares “MetaEdge Flywheel v3”;
- production still exposes `/api/opportunity-factory/v3`;
- active code still names `validation-lockbox-policy-v2`,
  `signal-research-policy-v2`, and `economic-objective-policy-v2`.

These must not be cosmetically renamed. A real v5 migration needs compatibility,
data-provenance, and historical-record rules so old evidence stays auditable
while no old policy remains active.

## MetaEdge compared with Reddit

| Capability | Reddit's recurring advice | MetaEdge position | Verdict |
|---|---|---|---|
| Live safety | Hard stops and deterministic risk | Global lock, approval boundary, veto gates | MetaEdge ahead |
| LLM containment | Use AI for analysis, hard code execution | Already the intended boundary | MetaEdge ahead |
| Hypothesis lifecycle | Freeze, test, review | Canonical lifecycle exists | Strong design, weak current operation |
| Multiple-testing control | OOS, walk-forward, sensitivity | Trial accounting exists in older research; no current active validations | Partial |
| Data completeness | Complete tape and explicit source quality | Current v3 world audit missing; some collectors disabled | Behind |
| Backtest/forward parity | Same event path and reconciliation | Known daily-bar and trailing-stop mismatches; no live reconciliation surface | Behind |
| Parallel learning | Run frozen strategies together | Parallel scouts and portfolio objects designed, but zero active contracts | Designed, not operating |
| Portfolio risk | Track correlation and shared exposures | Portfolio kernel exists; no current target portfolio | Behind in evidence |
| Auto-retirement | Precommit statistical kill rules | Kill logic exists, but forward-learning and economics are empty | Incomplete |
| Cost realism | Expectancy after all costs | Costs are part of doctrine; legacy paper fleet lost money | Mixed |
| Observability | Logs, execution review, postmortems | Strong audit surfaces, but stale/versioned planes compete | Strong components, fragmented truth |
| Product value | Sell mistake prevention and workflow tools | MetaEdge already has a credible governance product | Potential advantage |

## The v5 learning architecture

### Agent roles

All lanes may run in parallel, but permissions stay narrow.

| Agent | May do | May not do |
|---|---|---|
| Data Scout | Collect, normalize, timestamp, hash, and quarantine data | Invent missing values or call incomplete data tradable |
| Mechanism Researcher | Propose a falsifiable reason an edge may exist | Optimize entry parameters or place trades |
| Experiment Designer | Create a frozen `ExperimentSpecV5` | Edit a running experiment |
| Validator | Run walk-forward, costs, perturbation, ablation, and bias checks | Choose a result after viewing the holdout |
| Paper Executor | Execute an approved frozen spec through deterministic risk | Use an LLM output as an order |
| Reconciler | Compare expected signals/fills/state with observed paper behavior | Explain economic decay before ruling out implementation drift |
| Portfolio Governor | Allocate fixed paper budgets and enforce exposure/correlation limits | Promote a strategy without sufficient independent evidence |
| Postmortem Agent | Classify failure and propose a challenger | Rewrite the champion or erase failed evidence |
| Human Owner | Approve policy changes and any future live-review step | Bypass immutable evidence gates |

### One experiment contract

Every experiment should have one immutable record containing:

- `experiment_id` and hypothesis-family ID;
- mechanism and expected counterparty/forced behavior;
- code commit and strategy hash;
- dataset and universe version IDs;
- known-at timestamps and survivorship status;
- parameter count and total charged trials;
- cost, slippage, funding, latency, and impact assumptions;
- benchmark and random/control comparison;
- precommitted falsifier and drawdown depth/duration bands;
- historical validation windows;
- paper allocation, maximum exposure, and kill rule;
- parent champion and challenger relationship;
- outcome state: `declined`, `fragile`, `paper_candidate`, `paper_active`,
  `killed`, or `promoted`.

### One event path

Use the same ordered event contract for historical, forward-paper, and any
future live-review execution:

`market event -> feature state -> signal -> order intent -> validation -> risk -> portfolio -> adapter -> fill -> attribution`

Only the source and terminal adapter change:

- historical events + account simulator;
- current events + paper fill model;
- current events + still-locked live-review adapter.

The reconciler must compare all three at signal, order, and fill levels.

### One self-improvement rule

An active strategy never changes.

New evidence can cause:

1. a data-quality incident;
2. an execution-parity incident;
3. a kill/reduce decision under the frozen rule;
4. a new challenger proposal.

Only the challenger may contain new parameters or logic. It receives a new
experiment ID and pays a new multiple-testing charge.

## What to trade now

This is a research allocation, not investment advice.

| Lane | Current role | Action |
|---|---|---|
| Golden Cross | Lifecycle tracer | Keep paper-only and frozen. Use the open BANK trade to verify signal, risk, exit, and attribution plumbing—not to claim edge. |
| Liquid spot, 1h/4h/daily | Cost-aware research lane | Prefer horizons where the expected move can clear fees and latency. Admit only mechanism-backed experiments with complete candles and explicit costs. |
| Prediction-market calibration | Non-directional research lane | Resume data accumulation only after the v5 data-world audit works. Study whether forecast probabilities are calibrated before proposing trades. |
| Perpetual microstructure | Data/engineering lane | Do not restart economic claims while the fast-perp recorder and audit plane are disabled. Restore bounded collection and reconciliation first. |
| Legacy grid/custom AI | Historical negative-control cohort | Do not use the 12,000 trades as evidence of current learning. Preserve them as a baseline for what ungated activity costs. |
| HFT/scalping | Out of scope | Retail latency, incomplete depth, infrastructure cost, and fee sensitivity make this the wrong first target. |
| Live capital | Locked | No change. |

Market selection should follow:

1. credible mechanism;
2. data completeness and known-at correctness;
3. expected move after all costs;
4. latency and capacity compatible with our infrastructure;
5. enough independent opportunities for a decision;
6. a benchmark we can beat;
7. an explicit reason the edge is too small, awkward, constrained, or
   specialized for larger competitors.

## Metrics that belong on the v5 scoreboard

Do not center win rate.

### Experiment integrity

- total hypotheses and charged trials;
- lookahead-bias result;
- parameter-sensitivity surface;
- ablation results;
- walk-forward IS/OOS gap;
- Deflated Sharpe Ratio or an equivalent multiple-testing correction;
- independent event count, not just trade count.

The [Deflated Sharpe Ratio paper](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf)
exists specifically to correct selection bias, backtest overfitting, and
non-normal returns. Freqtrade's
[lookahead-analysis](https://www.freqtrade.io/en/stable/lookahead-analysis/)
is a practical model for detecting a common class of false backtest profits.

### Economics

- net expectancy per trade after every modeled cost;
- conservative net paper dollars per day;
- profit factor and payoff ratio;
- turnover and capital utilization;
- max drawdown depth and duration;
- tail losses and gap exposure;
- capacity and market impact assumptions.

### Reconciliation

- expected vs observed signal match;
- expected vs observed trade-set match;
- expected vs observed entry/exit time;
- expected vs observed fill and slippage;
- missing/stale event count;
- state recovered correctly after restart.

### Portfolio

- rolling strategy correlation;
- losing-day correlation;
- shared symbol/factor/regime exposure;
- aggregate paper drawdown;
- marginal contribution to portfolio risk;
- paper capital allocated, idle, killed, and promotable.

## Reconciliation with the side-chat records

Compared with:

- `/Users/devinsonpena/Documents/meta-edge/metaedge/docs/edgeops/PARALLEL_PAPER_LEARNING_FINDINGS_2026_07_29.md`
- `/Users/devinsonpena/Documents/meta-edge/metaedge/docs/edgeops/REDDIT_MONEY_QUESTIONS_RESEARCH_2026_07_29.md`
- the EdgeOps README and artifact registry that index those records.

### Overall verdict

The three research records are directionally consistent. They independently
reach the same central conclusion:

> MetaEdge does not need another generic strategy or another unconstrained
> agent. It needs a versioned experiment system that can explore several
> mechanisms, falsify weak ideas, preserve controls, and produce clean forward
> evidence while live execution remains locked.

There is no substantive disagreement about live readiness, profitability, or
the current evidence. All three records say:

- MetaEdge has no proven trading edge;
- the 12,000-plus historical paper trades prove activity, not comparable
  forward alpha;
- Golden Cross is useful as lifecycle telemetry, not a profitable claim;
- self-improvement must create immutable challengers instead of mutating a
  running strategy;
- realistic costs, total trial count, controls, and untouched forward evidence
  are mandatory;
- several experiments may run in parallel, but their shared exposures and
  losing-day correlations must be measured;
- LLMs may propose and explain, while deterministic code validates, executes,
  sizes, and changes lifecycle state;
- real capital is not the next automatic step.

### What the side-chat records add

The side-chat records are stronger on research economics and stopping
governance:

1. **Owner economic mandate.** Trading profit and product revenue are separate
   theses. The owner must set capital, loss budget, benchmark, economic target,
   research budget, and a review date before performance can be judged.
2. **Clean evidence cutoff.** Historical trades should remain visible but be
   classified as historical/non-promotable when provenance, immutable versions,
   controls, or known-at cutoffs are missing.
3. **Mechanism admission.** A family needs a plausible payer or structural
   constraint, a persistence reason, accessible information, feasible timing,
   capacity, a cost frontier, a baseline, and a falsifier.
4. **Research funnel economics.** Measure trials by stage, promotion and kill
   rates, time and cost per stage, forward evidence produced, and cost per
   informative decision.
5. **False-negative control.** A system that always says `no_trade` can look
   rigorous while rejecting every thin real edge. Known or synthetic weak-edge
   cases should test both false promotion and false rejection.
6. **Variant, family, and project stops.** A failed variant does not
   automatically kill a mechanism family. Strategy-, family-, and
   project-level stopping rules must be precommitted separately.
7. **Paper capital as an information budget.** Equal initial budgets,
   protected exploration, and later successive halving are more defensible than
   allocating immediately to recent winners.
8. **Existing-list presentation.** Experiment identity should appear in the
   current activity list through labels such as family, variant, version, and
   lifecycle state. No additional dashboard panel is required.

### What this record adds

This record is stronger on the concrete implementation target:

1. a real v5 migration with read-only compatibility for pre-v5 historical
   records rather than a cosmetic rename;
2. explicit agent permissions and prohibited actions;
3. one ordered event contract across historical, forward-paper, and any future
   live-review adapter;
4. reconciliation at signal, order, fill, restart, and state levels;
5. a specific `ExperimentSpecV5` contract;
6. an initial, continuously replenished strategy population;
7. a ranked path from version truth through registry, reconciliation,
   retirement, and portfolio admission.

### Differences that require an explicit resolution

| Issue | Side-chat direction | This record | Resolution |
|---|---|---|---|
| First decision | Define the economic mandate and clean cutoff | Establish v5 runtime truth | Run these as parallel P0 workstreams; neither depends on inventing a strategy. |
| Discovery breadth | Up to 12 arms across three or four families | Four lanes, at most one champion and one challenger per lane | **Previous resolution withdrawn.** Start operating toward 12–20 genuinely different small paper arms, keep a backlog of 100 or more ideas, and expand or contract based on reconciliation and review capacity—not devotion to a fixed cohort. |
| Implementation home | Python EdgeOps registry still recommends `metaedge/fleet_policy.py` | Production evidence resolves to the TypeScript deployment at commit `6358c0a` | Do not create a second learning authority in Python. First designate the canonical v5 runtime and define whether Python is an adapter, product shell, historical source, or retired path. |
| Version language | Records the previous deployed snapshot | Owner requires all active authority to be v5 | Preserve pre-v5 records only as read-only historical evidence; every active route, policy, state document, label, and endpoint must be v5. |
| Explore versus repair | Explore broadly, confirm narrowly | Reconcile before more strategies | Run both continuously. Thin shared attribution and reconciliation should improve alongside broad paper execution, not block it. |

The only direct operational conflict is the old EdgeOps registry's recommendation
to implement a new Python `fleet_policy.py` next. That would deepen the current
three-truth problem unless the Python runtime is first chosen as the canonical
v5 authority. The two longer side-chat records themselves support reconciliation
before that implementation, so the registry recommendation should be treated as
stale.

## Ranked next work

### P0A — Define the owner economic mandate

Record whether trading profit, product revenue, or both are in scope, together
with capital, loss budget, benchmark, target outcome, research budget, and a
decision-review date. If both theses remain in scope, give them separate
scoreboards.

### P0B — Establish v5 truth and one canonical runtime

In parallel with P0A, inventory every pre-v5 route, policy, state file, and
runtime. Mark them historical or migrate them; none may retain active
authority. Designate one canonical evidence-producing runtime and migrate all
active authority to v5 without rewriting historical evidence.

Acceptance:

- one v5 operator endpoint;
- one v5 state document;
- explicit compatibility readers for historical records;
- no active policy below v5;
- an explicit role for the Python and TypeScript runtimes;
- global live lock still proven.

### P1 — Set the clean cutoff and build `ExperimentSpecV5`

Every existing and future strategy evaluation must charge a trial and reference
immutable code, data, universe, costs, benchmark, and falsifier.

Acceptance:

- every decision has `experiment_id`;
- every variation increments the family trial count;
- no result can appear in Research Fleet without provenance;
- historical legacy trades remain visibly separate;
- the existing list shows family, hypothesis, variant, version, and lifecycle
  status without adding another panel.

### P2 — Improve reconciliation while more strategies run

Run the historical simulator over each forward-paper period and compare signals,
orders, fills, state, and outcomes.

Acceptance:

- implementation drift and economic decay are separate statuses;
- Golden Cross daily/high-low versus forward snapshot differences are measured;
- restart and missed-event differences are visible.

### P3 — Run a diverse strategy population

Start with 12–20 small paper arms spread across several accessible mechanism
families and horizons. A reasonable idea inventory includes:

- trend and momentum;
- breakout and volatility expansion/contraction;
- mean reversion;
- relative value, pairs, and cross-sectional ranking;
- carry, funding, and basis where data is accessible;
- event/news hypotheses with explicit known-at cutoffs;
- simple market and no-trade baselines;
- Golden Cross as one optional labeled arm, not the center.

Keep a 100-plus idea backlog. Admit arms continuously. Activate, reduce,
suspend, place on probation, or retire each arm according to its versioned
eligibility and health rules. Capacity is limited by complete attribution,
risk, reconciliation, and review—not by a champion/challenger ideology.

### P4 — Close the retirement loop

Wire forward attribution to `activate`, `continue`, `reduce`, `suspend_shadow`,
`probationary_reentry`, `retire`, or `re-research` recommendations. Only
deterministic precommitted rules may change paper allocation automatically.
Add separate regime-mismatch, variant, family, and project stop rules, plus
false-positive and false-negative calibration cases.

### P5 — Add portfolio admission

Only after at least two eligible paper strategies exist, allocate paper capital
using exposure caps and measured correlations. Do not add a learned allocator
until the equal/precommitted baseline has forward evidence.

### P6 — Test product revenue separately

Treat willingness to pay for MetaEdge's evidence, risk, journaling, replay, and
decision-review workflow as a separate product experiment. Do not call it a
safer fallback or use it to imply that the trading thesis succeeded.

## Decision

Reddit does not reveal a missing magic trading idea. It does reveal that serious
experimentation is usually a population process: many ideas, many forward
tests, explicit attribution, frequent retirement, and only a few survivors.

The MetaEdge advantage is the control plane. The current bottleneck is that the
control plane is fragmented across historical records and its canonical v5
learning surfaces are incomplete. The next work should combine two tracks:
keep expanding diverse paper execution and incrementally strengthen the shared
v5 attribution and reconciliation spine. Golden Cross is merely one arm, and
strategy identity belongs in the existing list rather than another dashboard.

This lets MetaEdge trade, fail, and learn now in paper mode without confusing
activity with validated edge—and without allowing any model to spend real
money.
