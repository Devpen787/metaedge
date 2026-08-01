# External Execution and Learning Forensic Audit

Date: 2026-07-30
Status: source and test audit; no MetaEdge runtime or trading change
MetaEdge authority: v5 only; older MetaEdge records remain historical evidence
Money boundary: paper only; live execution remains locked
MetaEdge cutoff: `6358c0a`

Related records:

- [Executing Agents That Produce Evidence](./EXECUTING_AGENT_LEARNING_RESEARCH_2026-07-30.md)
- [Reddit vs. MetaEdge](./REDDIT_AGENT_TRADING_COMPARISON_2026-07-29.md)

## Decision

### Correction after owner review

The original decision below narrowed the system around Golden Cross and a
three-strategy cohort. That was wrong.

It confused two different decisions:

1. MetaEdge needs one shared v5 execution, attribution, observation, and
   reconciliation substrate.
2. MetaEdge does **not** need one privileged strategy, one tiny closed cohort,
   or a pause on new trading ideas.

The shared substrate is valuable only if it lets many different paper
strategies execute and become comparable. It is not an admission gate that
requires a hypothesis to prove an edge before it can trade, and it is not a
Golden Cross funnel.

**Go:** operate a broad v5 paper strategy population while completing the thin
shared execution-evidence spine incrementally.

**No-go:** add another general agent framework, let an active strategy rewrite
itself, infer profitability from paper activity, or unlock live execution.

**Paper execution is allowed now:** any versioned hypothesis that passes
minimum data-integrity, cost-feasibility, instrument, and risk checks may spend
a small paper information budget. Golden Cross is one non-privileged seed arm
among many.

The blunt economic conclusion is:

> None of the five audited projects proves a transferable profitable edge.
> NautilusTrader and Freqtrade can help us execute and measure hypotheses more
> honestly. TradeSight, TradingAgents, and Moss provide narrower patterns, but
> their current code does not justify handing them promotion authority.

MetaEdge still has no verified basis to claim that it can make money trading.
That is not a reason to wait for one perfect edge before trading. It is a
reason to execute many genuinely different ideas cheaply in paper mode, learn
which mechanisms and operating assumptions fail, and reserve stronger claims
or larger paper allocation for the few that survive.

## Scope and method

The review used clean shallow clones and pinned exact source revisions:

| Project | Audited revision | What was inspected |
|---|---|---|
| [NautilusTrader](https://github.com/nautechsystems/nautilus_trader/tree/45903fc8b925adae6323035fb0b4fb5b49b4f89b) | `45903fc8b925adae6323035fb0b4fb5b49b4f89b` | system kernel, backtest exchange, execution engine, startup and continuous reconciliation, tests |
| [TradeSight](https://github.com/rmbell09-lang/tradesight/tree/8b2de128b5180d05e87a51a191685298e2e888e6) | `8b2de128b5180d05e87a51a191685298e2e888e6` | paper trader, accounting truth, runtime risk, evidence labels, optimizer, champion tracker, tests |
| [Freqtrade](https://github.com/freqtrade/freqtrade/tree/02ff7c4a2c63308df8fa7221e3a52bce3d286ef9) | `02ff7c4a2c63308df8fa7221e3a52bce3d286ef9` | shared bot path, dry-run orders, fill model, persistence, FreqAI retraining and prediction history, tests |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents/tree/a33fd4c0f134485a43553a2c23a63cb14adbd88f) | `a33fd4c0f134485a43553a2c23a63cb14adbd88f` | decision graph, checkpointing, outcome resolution, reflection memory, tests |
| [Moss Trade Bot Skills](https://github.com/moss-site/moss-trade-bot-skills/tree/b276ccd15aa4f771ffd4a37d8d716bb7985994f8) | tag `v1.0.28`, commit `b276ccd15aa4f771ffd4a37d8d716bb7985994f8` | decision code, local backtest, segmented evolution, live runner/client, fingerprint parity, tests |

The audit distinguishes:

- **implemented**: present in the inspected source;
- **tested here**: a targeted test passed in a clean temporary environment;
- **documented**: stated by the project but not proved end to end here;
- **external backend**: required behavior is outside the open repository;
- **profit claim**: requires net forward results and was not established.

No private key, exchange credential, broker credential, paid model call, or
trading action was used.

## Test ledger

| Project | Command scope | Result | Interpretation |
|---|---|---|---|
| NautilusTrader | Rust execution reconciliation library | **236 passed** | Strong local proof for partial fills, drift recovery, inferred fills, duplicate/overfill handling, terminal states, and convergence |
| Freqtrade | dry-run order/fill tests plus entry and order-state tests | **421 passed, 6 skipped** | Strong local proof for its documented dry-run mechanics and bot order lifecycle |
| TradeSight | runtime risk, live lock, accounting, paper trading, evidence, registry | **72 passed** | Good proof for those bounded surfaces |
| TradeSight | optimizer guards | **collection failed** | The test hard-codes `/Users/luckyai/Projects/TradeSight`, so it is not clean-checkout reproducible |
| TradingAgents | memory, checkpoint, and structured-agent tests | **100 assertions passed; process did not exit cleanly** | Functional assertions passed, but pytest hung during teardown and was interrupted; this is not a clean green run |
| Moss | both published Python test directories | **80 passed, 1 failed, 4 skipped** | The failing golden fingerprint exposes cross-version drift in a claimed verification boundary |

Test counts prove the behavior covered by those tests. They do not prove market
edge, broker parity, or profitable forward operation.

## Capability matrix

| Project | Shared execution path | Fill realism | Restart/reconciliation | Learning mechanism | Promotion governance | Adoption |
|---|---|---|---|---|---|---|
| NautilusTrader | Strong shared kernel and typed command/event path | Configurable simulated venue; still a model | Strong startup and continuous reconciliation | None for alpha discovery | External to engine | **Adopt contracts and reconciliation concepts** |
| Freqtrade | Same bot order lifecycle for dry-run and live modes | Better than price-only; limited L2 walk and instant full limit fills | Durable trades/orders; mature state handling | FreqAI scheduled retraining and prediction history | Model rotation, not governed champion/challenger proof | **Adopt dry-run persistence and bias tools; freeze our challengers** |
| TradeSight | Paper broker and local accounting path | Broker paper fills plus local reconciliation | Good paper accounting evidence | Optimizer plus feedback and champion tracker | README says no auto-promotion; code can auto-promote | **Borrow labels and reconciliation only** |
| TradingAgents | Returns a BUY/SELL/HOLD decision; no core broker path | None in core decision graph | Graph checkpointing, not broker reconciliation | LLM reflection on later raw return and alpha | No causal or execution-aware promotion contract | **Borrow pending-to-resolved memory shape only** |
| Moss | Similar signal code is reused, but local backtest and platform live execution are separate systems | Local fees/depth/funding model; platform backend is closed | Client-side API handling; venue truth is external | Predefined segmented parameter schedule plus human/LLM reflection guidance | Drift caps help; forced-change guidance causes churn | **Borrow deterministic signals and drift caps only** |

## Findings by repository

### NautilusTrader: the strongest execution substrate

The common system kernel constructs the same `RiskEngine` and
`ExecutionEngine`. Backtests replace the venue with `SimulatedExchange` and
matching engines; the live node connects data and execution clients, waits for
readiness, reconciles venue mass status against cache state, and aborts startup
when reconciliation fails.

Continuous reconciliation separately checks inflight orders, open orders, and
positions. The test set covers partial-fill convergence, price and quantity
drift, duplicate reports, overfills, flips, synthetic orders, inferred fills,
and idempotence after recovery.

What this proves:

- typed order and fill outcomes;
- unresolved state is a first-class operational concern;
- restart truth must be reconstructed from venue plus local state;
- the same risk/execution concepts can span simulated and live-style modes.

What it does not prove:

- a profitable strategy;
- that a simulator produces venue-identical fills;
- automatic strategy learning or promotion.

MetaEdge use: model `OrderIntentV5`, `ExecutionObservationV5`, startup
reconciliation, and explicit terminal/unresolved states after this pattern.
Do not import the whole engine before the v5 vertical is working.

Pinned code:

- [common kernel engines](https://github.com/nautechsystems/nautilus_trader/blob/45903fc8b925adae6323035fb0b4fb5b49b4f89b/crates/system/src/kernel.rs)
- [live startup and reconciliation](https://github.com/nautechsystems/nautilus_trader/blob/45903fc8b925adae6323035fb0b4fb5b49b4f89b/crates/live/src/node/mod.rs)
- [backtest simulated exchange](https://github.com/nautechsystems/nautilus_trader/blob/45903fc8b925adae6323035fb0b4fb5b49b4f89b/crates/backtest/src/exchange.rs)

### Freqtrade: mature dry-run mechanics, not proof that paper equals live

Freqtrade's bot creates and updates persistent trades and orders through the
same bot lifecycle in dry-run and live modes. Its dry-run market fill model:

- requests 20 levels of L2 depth when supported;
- walks the relevant side of the book;
- caps modeled slippage at 5%;
- applies taker fees;
- persists the resulting dry order.

Its limit model closes an order for the full amount when the top of book crosses
the limit. It does not model queue position, latency, partial available size
over time, or market impact beyond the bounded depth walk. Therefore “same
pipeline” does not mean “same fills.”

FreqAI maintains a retraining queue, checks retraining/expiration clocks, saves
historic predictions with a backup, and can purge old models. This is useful
operational machinery, but it is active model replacement. Prediction history
preserves continuity; it does not prove that a replacement model improved
against a frozen control.

MetaEdge use:

- adopt durable paper orders and restart-safe trade state;
- adopt lookahead and recursive-analysis discipline;
- do not let an in-place retraining loop mutate an active v5 experiment;
- create a new frozen challenger for every material model change.

Pinned code:

- [dry-run order and fill model](https://github.com/freqtrade/freqtrade/blob/02ff7c4a2c63308df8fa7221e3a52bce3d286ef9/freqtrade/exchange/exchange.py)
- [FreqAI model and prediction lifecycle](https://github.com/freqtrade/freqtrade/blob/02ff7c4a2c63308df8fa7221e3a52bce3d286ef9/freqtrade/freqai/freqai_interface.py)
- [historic prediction persistence](https://github.com/freqtrade/freqtrade/blob/02ff7c4a2c63308df8fa7221e3a52bce3d286ef9/freqtrade/freqai/data_drawer.py)

### TradeSight: useful honesty on paper evidence, contradicted by promotion code

The good parts are real:

- broker/local paper accounting reconciliation;
- explicit broker-confirmed, pending, and legacy evidence labels;
- exits remain available when new entries are suspended;
- stale, missing, or unverified accounting blocks entries after an accounting
  epoch has been established;
- live activation is compiled and policy locked off;
- the targeted tests for those surfaces passed.

Two material contradictions change the adoption decision.

First, the README says:

- a challenger cannot promote automatically;
- there is no automatic strategy promotion;
- new paper entries fail closed on unverified accounting.

But `ChampionTracker.evaluate_challenger()` writes `data/champion.json` and:

- makes the first optimizer result champion immediately;
- can force-replace a losing champion with a challenger that has zero
  challenger sessions;
- can promote after only three feedback sessions using a 40% backtest and 60%
  average-P&L blend.

The overnight optimizer calls that method automatically after its quality gate.
This is automatic promotion authority, regardless of the README wording.

Second, `OperationalRiskGate.evaluate()` allows a new entry when the accounting
epoch file does not exist, returning
`accounting_epoch_not_established_paper_only`. It fails closed only after the
epoch has been created.

There is also a reproducibility defect: `tests/test_optimizer_guards.py`
hard-codes the original developer's absolute path, so the optimizer guard suite
cannot collect from a clean checkout.

MetaEdge use:

- borrow evidence labels, paper reconciliation, and exit-always-available
  behavior;
- do not use `ChampionTracker`;
- do not let any v5 optimizer write active strategy state;
- make “accounting not established” a block, not an implicit permission.

Pinned code:

- [README claims](https://github.com/rmbell09-lang/tradesight/blob/8b2de128b5180d05e87a51a191685298e2e888e6/README.md)
- [automatic champion writes](https://github.com/rmbell09-lang/tradesight/blob/8b2de128b5180d05e87a51a191685298e2e888e6/src/trading/champion_tracker.py)
- [optimizer calling the champion tracker](https://github.com/rmbell09-lang/tradesight/blob/8b2de128b5180d05e87a51a191685298e2e888e6/scripts/overnight_strategy_evolution.py)
- [initial accounting fail-open](https://github.com/rmbell09-lang/tradesight/blob/8b2de128b5180d05e87a51a191685298e2e888e6/src/trading/runtime_risk.py)
- [hard-coded optimizer test path](https://github.com/rmbell09-lang/tradesight/blob/8b2de128b5180d05e87a51a191685298e2e888e6/tests/test_optimizer_guards.py)

### TradingAgents: a reflection notebook, not an executing learning trader

The graph produces a final state plus a processed BUY, SELL, or HOLD decision.
It can checkpoint the graph by ticker and date. It writes the decision to an
append-only markdown log, then resolves same-ticker pending entries on a later
run using five-day raw return and benchmark alpha.

An LLM writes a short reflection, and recent resolved lessons are inserted into
future prompts.

The important evidence boundary:

- the outcome is the underlying asset's later price return, not an executed
  order or position result;
- direction, position size, fees, spread, slippage, funding, stops, missed
  fills, and portfolio exposure are not part of that outcome calculation;
- HOLD, BUY, and SELL can therefore be judged ambiguously by the same raw asset
  move;
- pending entries for other tickers remain unresolved until that ticker runs
  again;
- the reflection is free-form LLM prose, not a deterministic causal test;
- the core graph has no broker order, fill, position, or reconciliation
  contract.

MetaEdge use: borrow the pending-to-resolved record and atomic update pattern.
Replace raw return with an execution-linked, decision-adjusted net outcome and
keep LLM reflection downstream of deterministic scoring.

Pinned code:

- [decision graph and later return resolution](https://github.com/TauricResearch/TradingAgents/blob/a33fd4c0f134485a43553a2c23a63cb14adbd88f/tradingagents/graph/trading_graph.py)
- [append-only memory log](https://github.com/TauricResearch/TradingAgents/blob/a33fd4c0f134485a43553a2c23a63cb14adbd88f/tradingagents/agents/utils/memory.py)
- [LLM reflection prompt](https://github.com/TauricResearch/TradingAgents/blob/a33fd4c0f134485a43553a2c23a63cb14adbd88f/tradingagents/graph/reflection.py)

### Moss: useful local simulator work, but the advertised evolution loop is not there

The local source includes deterministic indicators, regime classification,
position sizing, fees, depth-based fills, funding, liquidation, and segmented
backtest aggregation. The live runner uses the same signal functions, queries a
platform account, and submits market-style actions through a client API.

The limitations are substantial:

1. The live runner's docstring advertises `--evolve-every`, but the parser does
   not define the option and the run loop never evolves parameters.
2. `run_evolve_backtest.py` applies a pre-written `evolution-file`; it does not
   contain an autonomous reflection agent.
3. The evolution guide requires at least one parameter change after three
   unchanged rounds. That manufactures activity when “no change” may be the
   correct conclusion.
4. The guide says float tactical drift is capped, but integer and boolean
   fields may jump anywhere within their schema bounds.
5. The script header says capital is continuous across segments, while the
   implementation explicitly runs independent fresh-capital segment
   backtests.
6. The published test suite fails its cross-language fingerprint golden test.
   The golden value is pinned to a `test-v4` branch and harness `v1`, while the
   current Python fingerprint declares harness `v2`.
7. The repository contains the client, local simulator, and upload verifier.
   The platform's actual live fill and account backend is external, so its
   claimed backtest/paper/live alignment is not end-to-end auditable here.

The external project's `test-v4` reference is historical evidence about Moss.
It is not a MetaEdge authority. MetaEdge remains v5-only.

MetaEdge use:

- borrow deterministic signal compilation, immutable personality fields, and
  bounded drift for newly created challengers;
- reject forced mutation;
- require a current fingerprint for every v5 experiment;
- never infer platform parity from a client repository.

Pinned code:

- [project claims](https://github.com/moss-site/moss-trade-bot-skills/blob/b276ccd15aa4f771ffd4a37d8d716bb7985994f8/README.md)
- [live runner without evolution option](https://github.com/moss-site/moss-trade-bot-skills/blob/b276ccd15aa4f771ffd4a37d8d716bb7985994f8/moss-trade-bot-factory/scripts/live_runner.py)
- [predefined segmented evolution schedule](https://github.com/moss-site/moss-trade-bot-skills/blob/b276ccd15aa4f771ffd4a37d8d716bb7985994f8/moss-trade-bot-factory/scripts/run_evolve_backtest.py)
- [forced-change guidance and drift scope](https://github.com/moss-site/moss-trade-bot-skills/blob/b276ccd15aa4f771ffd4a37d8d716bb7985994f8/moss-trade-bot-factory/knowledge/evolution_guide.md)
- [stale cross-language golden test](https://github.com/moss-site/moss-trade-bot-skills/blob/b276ccd15aa4f771ffd4a37d8d716bb7985994f8/moss-trade-bot-factory/tests/test_fingerprint_cross_language.py)

## What the deeper Reddit pass added

Reddit Answers is an AI synthesis and explicitly warns that its response may be
inaccurate. The useful output came from following its citations and comparing
the advice with the repository source.

### Useful: kill rules must separate execution drift from edge decay

The best answer recommends a two-stage decision:

1. determine whether forward operation still matches the tested signals,
   timing, orders, fills, and slippage;
2. only after operational parity is established, compare expectancy, hit rate,
   payoff, drawdown depth, and drawdown duration with precommitted bands.

That directly supports building reconciliation before adding strategies.

Sources:

- [Reddit Answers: strategy kill criteria](https://www.reddit.com/answers/b64b7e33-7de4-49aa-afa5-043342720aa2/?q=when+should+you+stop+algorithmic+trading+strategy+research+give+up+no+edge+project+kill+criteria&source=SERP_SEARCH_BAR_BUTTON&tl=en)
- [Decay versus normal drawdown](https://www.reddit.com/r/algotrading/comments/1u3q7ko/how_do_you_tell_a_strategy_is_actually_decaying/)
- [Two-stage execution-parity comment](https://www.reddit.com/r/algotrading/comments/1u3q7ko/comment/or948ap/)

Do not encode Reddit's example Sharpe or drawdown numbers as universal MetaEdge
thresholds. Each frozen experiment must derive bands from its mechanism,
opportunity process, dependence, costs, and precommitted risk budget.

### Weak: the version-cutoff answer did not answer the question

The answer about changing a strategy during a paper test described iteration,
stress testing, and out-of-sample work, but did not give a clean ledger rule
for combining or separating strategy versions.

MetaEdge resolution:

- a material rule, parameter, data, universe, cost, or fill-model change creates
  a new `strategy_version`;
- pre-change observations remain attached to the old version;
- versions may be compared, never pooled as if they were one frozen treatment;
- old MetaEdge authority stays historical and no active policy remains below
  v5.

Source:
[Reddit Answers: changed strategy during paper test](https://www.reddit.com/answers/60c35287-1f41-4af2-9182-ee1596b6a16e/?q=algorithmic+trading+changed+strategy+during+paper+test+combine+results+clean+cutoff+version&source=SERP_SEARCH_BAR_BUTTON&tl=en)

### Strategically relevant but anecdotal: tools may monetize sooner than alpha

Reddit Answers argues that traders pay for tools that change a decision or
prevent a mistake, especially journaling, risk sizing, replay, filtering, and
execution review. That maps closely to MetaEdge's strongest current
capabilities.

This is not market validation. It does justify a separate product-revenue test
instead of making trading profit carry the entire business thesis.

Sources:

- [Reddit Answers: tools versus own-capital trading](https://www.reddit.com/answers/714ac01e-0f90-462b-a08e-6321fa3b88d2/?q=build+trading+software+business+sell+tools+versus+trade+own+capital+which+makes+money&source=SERP_SEARCH_BAR_BUTTON&tl=en)
- [Do traders pay for tools?](https://www.reddit.com/r/Trading/comments/1tr8n4p/do_traders_even_pay_for_using_tools/)

### Submission limitation

A new focused question was entered asking which open-source agent systems prove
shared backtest/paper execution code, opportunity and rejection logs, restart
reconciliation, and net outcomes after costs. Reddit's controls accepted the
text but did not launch a new result from either the existing conversation or
the new-question page. No new answer was produced, so none is claimed.

That missing answer is itself consistent with the audit: Reddit surfaces many
trading anecdotes and agent demos, but not one cited open system that proves
execution, reconciliation, governed learning, and net profitability together.

## The v5 operating response

### One execution-learning vertical

Build one vertical before adding another framework:

`frozen ExperimentSpecV5`
`-> deterministic opportunity`
`-> OrderIntentV5`
`-> risk or skip outcome`
`-> paper order lifecycle`
`-> ExecutionObservationV5`
`-> restart reconciliation`
`-> deterministic net outcome`
`-> continue, kill, or propose challenger`

Every opportunity must end in one explicit state:

`no_signal | skipped_control | risk_blocked | stale_data | submitted |
acknowledged | partially_filled | filled | rejected | canceled | expired |
unresolved`

No LLM may:

- turn prose directly into an order;
- change active strategy rules;
- mark a result reconciled;
- promote a challenger;
- convert missing state into a fill or loss;
- unlock live execution.

### A continuous paper strategy population

Do not wait for a closed cohort to resolve before admitting another idea.
Maintain a continuously replenished, versioned population:

- a backlog of 100 or more diverse ideas is acceptable;
- use a practical first operating target of 12–20 active paper arms, then
  expand only while every opportunity, order, fill, and outcome still
  reconciles without a review backlog;
- diversify mechanisms, instruments, horizons, and data dependencies instead
  of counting small parameter changes as new ideas;
- give new arms equal small paper information budgets before adaptive
  allocation;
- deactivate or reduce arms quickly when their eligible conditions disappear
  or their health bounds break, but continue shadow observation;
- retire an arm only after separating regime mismatch, normal variance,
  data/execution failure, and structural mechanism failure;
- preserve dormant and retired arms, their expected regime envelopes, and their
  failure reasons while admitting new arms continuously;
- freeze each arm only for the duration of its own versioned run; improvements
  launch as a new version without stopping the rest of the population;
- keep a protected exploration allocation so recent winners cannot crowd out
  new mechanisms;
- do not merge results across strategy versions;
- do not unlock live capital.

The 12–20 target is an operating heuristic, not a statistical law or ceiling.
The real capacity limit is whether MetaEdge can attribute and reconcile every
paper observation. A thin v5 contract should be added alongside this activity,
not used to postpone it.

Review each arm on two clocks:

1. **Operational clock:** did every opportunity, intent, order, fill/non-fill,
   restart, and outcome reconcile?
2. **Economic clock:** after conservative costs, did the frozen strategy beat
   its control with acceptable tails across enough independent events and
   relevant regimes?

The economic review may end in:

- `continue_discovery`;
- `activate_for_regime`;
- `reduce_for_regime`;
- `suspend_to_shadow`;
- `probationary_reentry`;
- `kill_variant`;
- `propose_challenger`;
- `insufficient_independent_evidence`;
- `execution_model_invalid`;
- `no_promoted_alpha`.

“Try more things” is a valid portfolio-level operating policy. Each admitted
arm still needs a distinct identity, a bounded paper budget, and a recorded
reason for continuation, retirement, or revision. A failed arm is useful
evidence; it is not a reason to stop the factory.

One loss, one drawdown, or one hostile market cycle is not a retirement rule.
A strategy is eligible to retire only when its data and execution are valid,
it has accumulated enough observations in the conditions it was designed for,
and its behavior remains inconsistent with its precommitted expectations
across repeated eligible episodes or its economic mechanism has been
invalidated. A temporarily unsuitable strategy becomes dormant, not dead.

### Separate money scoreboards

Track two hypotheses independently:

| Hypothesis | Evidence needed | Current state |
|---|---|---|
| MetaEdge trading can produce net forward paper edge | reconciled frozen cohort, costs, controls, independent events, tail behavior | **Unproven** |
| MetaEdge evidence/replay/governance can earn product revenue | target users, painful workflow, willingness to pay, usage and retention | **Unvalidated but plausible** |

Trading failure should not be disguised as product success. Product traction
should not be described as trading edge. Running both scoreboards is how we
seek money without letting one ambiguous experiment absorb the whole project.

## Final adoption list

Adopt:

- NautilusTrader: explicit order states, inferred/unresolved handling,
  startup and continuous reconciliation;
- Freqtrade: durable dry-run orders, conservative cost modeling, lookahead and
  recursive-analysis discipline;
- TradeSight: paper evidence labels, broker/local accounting comparison, exits
  during entry suspension;
- TradingAgents: append-only pending-to-resolved memory record;
- Moss: deterministic signal compilation, immutable core fields, bounded
  challenger drift.

Reject:

- TradeSight automatic champion writes and initial accounting fail-open;
- FreqAI-style in-place active model rotation for v5 experiments;
- TradingAgents raw-return reflection as a trade outcome;
- Moss forced parameter churn, undocumented live/backend parity, and stale
  fingerprint authority;
- any claim that test counts, agent counts, trade counts, or paper P&L prove
  profitable alpha.

The corrected implementation decision is: keep one v5 paper execution and
learning substrate, and use it to support a broad, continuously replenished
strategy population. Add Golden Cross to that population under its existing
label when convenient; do not make it the first, central, champion, control, or
required route. Nothing in this audit justifies a second panel, a second
runtime, a new framework, or live money. It does justify much more diverse
paper execution.
