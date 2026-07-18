# Findings

## 2026-07-18 superseding availability diagnosis

- The latest invalid final soak ran on the local 12-core Mac, not the GCP e2-micro. At the first failing sample, `/api/session` and `/api/opportunity-factory/v3` were approximately 17 ms, recorder evidence was 254 ms old, storage was healthy, and live execution was locked.
- The first wrong value was `challenger_research.fresh=false`: its running heartbeat was 74,085 ms old against a fixed 60,000 ms budget. The soak monitor then wrote `OPERATIONAL_HEALTH_DEGRADED` to the global pause. Recorder and dependent clock shutdown were consequences of that pause, not demonstrated CPU starvation.
- The invalidation record's earlier resource-starvation wording is superseded by this causal sequence; original evidence remains immutable.
- The legacy multi-market `flywheel_v3_cycle.ts` is already a one-shot child. The failed fast-perp challenger is a different component inside `fast_perp_clock_daemon.ts` and requires its own disposable batch boundary.
- The safe bridge is proposal-only: research consumes immutable evidence exports and returns immutable candidate proposals. The continuous-paper node validates/imports them and remains the sole canonical writer.
- A one-shot batch still requires liveness semantics: persisted attempt identity, lease/deadline, terminal status, timeout, abandoned-attempt recovery, and atomic publication. It must not participate in the global continuous-operation heartbeat gate.

## Repository truth

- The active opportunity factory is in `/Users/devinsonpena/Documents/metaedge-gemini` on `claude/backend-buildout`, not the older Python product repo.
- The worktree already contains modified and untracked user/Claude work. It must be preserved and extended carefully.
- `opportunity-factory-v1` currently has three catalyst experiments: pooled stock filing drift, crypto momentum plus quote-volume acceleration, and a memecoin participation experiment with hard blockers for missing holder concentration and turnover.
- Current market-lane types cover stocks, crypto, and memecoins only. Perpetuals, prediction markets, and cross-chain arbitrage are not discovery lanes yet.
- The current relationship scan is a bounded stock-to-crypto Pearson lead/lag search.
- Live execution is explicitly locked in discovery result contracts.

## Initial architectural diagnosis

- Existing validation is stronger than existing candidate discovery.
- The current stock catalyst is unsigned: filing arrival does not encode surprise direction or magnitude.
- Quote-volume acceleration is market activity, not an independent attention source.
- The memecoin lane correctly refuses to infer missing on-chain safety evidence.
- Discovery, portfolio construction, and execution policy are not yet separate persistent objects.
- Scheduled reruns must distinguish new evidence from unchanged historical recomputation.

## Evidence policy

- Treat source collection, signed state encoding, forecast quality, portfolio contribution, execution quality, and forward outcomes as separate evidence families.
- Keep failed and blocked experiments visible. Negative results are inputs to the next research question, not disposable output.

## Baseline reproduced

- `opportunity-factory-v1`: 3,763 observations, 3 cards, 20 retained relationship results, 3 declines, 0 forward-paper candidates, 0 errors.
- Baseline discovery tests, decision tests, independent Python math parity, and TypeScript checking pass.

## Flywheel v2 first live evidence

- 128 point-in-time state snapshots and 6 lane trials are now persisted under `data/opportunity-factory-v2/`.
- Stocks: partial; signed surprises and point-in-time expectations are missing.
- Spot crypto: historical experiment is implemented, but independent attention and order-flow history are missing.
- Perpetuals: 102 captured funding observations; 60-day window is incomplete and depth/liquidation history is missing.
- Memecoins: blocked by liquidity plus unmeasured holder concentration and turnover.
- Prediction markets: 600 odds rows collected; no resolved outcome labels yet.
- Cross-chain: blocked by missing synchronized executable quotes and gas/bridge/finality/inventory evidence.
- The flywheel endpoint and CLI expose these states without claiming blocked lanes are implemented.

## Final architecture and result

- The canonical flywheel now runs every six hours from the production server and refreshes the baseline before the layered research cycle.
- The durable ledger includes point-in-time states, candidate contracts, trials, validations, novelty, portfolio decisions, execution decisions, forward observations, attribution, lifecycle, re-research queue, and coverage.
- Price research spans criterion-selected stock and spot universes plus an explicit research-only meme universe. It tests momentum, mean reversion, regime variants, explicit state transitions, and cross-sectional variants.
- Auxiliary contracts cover signed events, cross-market relationships, spot/perp microstructure, funding carry, prediction calibration, and executable cross-chain arbitrage; unavailable evidence is recorded as a blocker.
- Validation separately records direction, calibration, gross and net return, lower-confidence edge, walk-forward stability, cost stress, capacity, tail loss, leakage purge, and declared search count.
- Portfolio gating accounts for duplicate/correlated bets, crowding, tail budget, and drawdown. Execution chooses maker, taker, delayed, or no-trade only after validation and portfolio approval.
- Forward prediction observations use the first valid point-in-time probability per market. Only an exact authoritative resolved outcome becomes a label; ambiguous 50/50 or unresolved closures are not invented as outcomes.
- The live operator result is intentionally negative: zero promoted alpha, zero portfolio approvals, and all current validated price contracts routed to no-trade. This is a discovery improvement, not yet a money-making improvement.
- The running API at `/api/opportunity-factory/flywheel` reports current decisions separately from append-only history and proves all live execution remains locked.

## Flywheel v3 source audit

## 2026-07-16 Fast-perps recovery findings

- Current production-shaped evidence reached 1.6 GB: 494 MB fast-perp evidence plus 1.1 GB economics state.
- `research-runs.jsonl` contained 37 rows / 253,271,121 bytes; `paper-trade-contracts.jsonl` contained 14,312 rows / 1,223,820,040 bytes.
- Lifecycle events, shadow decisions, and shadow outcomes were all absent. This proves the runtime accumulated derived files rather than forward paper evidence.
- Root cause 1: the default recorder store getter constructed a new store repeatedly, defeating its per-file known-ID cache and forcing repeated scans.
- Root cause 2: research runs and contracts embedded unbounded source-event arrays, multiplying the same provenance across every minute/version.
- Root cause 3: the controlled cycle created a newest active contract before shadow evaluation, so rolling evidence superseded observing lineages.
- Root cause 4: shadow decisions were reconstructed only after the future outcome book already existed and lacked a durable record-time field.
- Root cause 5: request-time operator snapshots synchronously reparsed all evidence and derived files while the UI polled every 15 seconds.
- The server was no longer listening on port 3000 on 2026-07-16. The runaway state was archived read-only and replaced with empty active directories.
- Legacy derived state is quarantined as `LEGACY_RETROSPECTIVE_FAST_PIPELINE`; raw archived evidence is replay-only.

## 2026-07-16 Adversarial second-audit findings

- **Blocker - challenger continuity:** the research epoch identity excludes a finite epoch boundary. With the current 13-symbol grammar, look one charges 1,820 trials and look two charges 3,640, exceeding the 3,500 ceiling. That makes every later look report-only until the universe, grammar, or policy changes. The signal evaluator reads only the newest research run, so a report-only run has no evaluation parameters and can stop an already-observing contract from receiving decisions.
- **Blocker - forward timing:** outcome selection bounds exchange `eventTime` but not availability `receivedAt` against the expected entry/exit time. A late-arriving book whose exchange timestamp is in tolerance can be accepted later as a timely, promotable forward outcome.
- **Blocker - future live exactly-once:** authorization creation is not locked per preparation, failed/cancelled authorizations may be reserved again, and wallet success is recorded only after the external call returns. Concurrent approval or a successful wallet call followed by persistence failure can therefore permit more than one real open from one intended approval. Live execution remains disabled today.
- **Blocker - current live-lock truth:** MetaMask and v3 snapshots hardcode `liveExecution: locked`; health derives `currentLiveLock` from that constant rather than the runtime switch. Enabling `LIVE_EXECUTION_ENABLED` would create an integrity failure but still report the top-level lock as true, and the UI also renders `Live locked` unconditionally.
- **High - false operational health:** clock heartbeats hardcode `queueDepth: 0`; freshness permits up to 5 seconds for the 250 ms evaluator, 2.5 cadences for other clocks, and 15 hours for challenger research. `contractChurn` is total contracts and `unresolvedDecisions` is decisions minus all outcomes. These fields cannot prove bounded queues, within-cadence liveness, churn, or explicit unresolved outcomes.
- **High - soak performance defect:** the one-second resolver rematerializes the complete v3 snapshot even though a separate 15-second materializer already exists. The active soak currently reports operational while its first 48 samples show 42.25% average CPU, 143.3% p95 CPU, 650.7 ms v3 p99, and an early uncompressed storage trajectory around 1.3 GB/day. The 24-hour gate is not passed.
- **High - unbounded scans remain:** challenger research loads every raw book/trade/context partition before slicing; every economic snapshot and evaluator/resolver cycle reparses complete JSONL ledgers. `/api/opportunity-factory/economics` and live-review snapshots still do synchronous full-ledger reads on the Express thread.
- **High - malformed derived state is fail-empty:** economic and live-review JSONL readers catch one parse error by returning an empty ledger. They do not retain valid rows or quarantine the malformed line, so one bad row can hide contracts, decisions, outcomes, or authorization state.
- **High - live execution rechecks incomplete:** the reviewed execution route rechecks contract state, wallet, signal expiry, and price/fee bounds, but does not rerun portfolio exposure, daily-loss, drawdown, correlation, and capacity reservations immediately before execution. The prepare route also accepts any decision evidence mode; it does not require `paper_forward`, so a canary decision could be selected for a future live-reviewed contract.
- **High - placeholder risk economics can promote:** fast research writes zero tail-risk and drawdown penalties, while contract/lifecycle gates do not mark zero placeholders ineligible. This violates the explicit non-promotion rule for placeholder penalties.
- **Medium - counterfactual attribution is wrong:** a filled outcome records `noTradeCounterfactualNetPnlUsd` equal to the trade's net P&L. The regression test explicitly expects it to be nonzero. A true no-trade counterfactual should be zero or a separately defined benchmark.
- **High - proof harness is incomplete:** the independent verifier checks archive counts/hash, zero active contracts at one point in time, replay support/determinism, and the environment flag. It does not independently validate active decision/outcome/lifecycle/auth ledgers, duplicates/orphans, timing availability, ledger identities, current health, or soak acceptance. The soak monitor does not measure decision-commit latency, raw versus derived growth, final-six-hour RSS, duplicates/orphans, or expired-decision coverage, and it does not fail on the declared CPU/session/storage acceptance gates.
- **Medium - partition maintenance is coupled to research:** gzip/retention runs only after a challenger evaluation and uses synchronous whole-file level-9 gzip. Completed hours can remain open for roughly six hours, and maintenance does not run when challenger research is disabled or blocked.
- **Medium - runtime packaging overhead:** each of the four production clocks launches through `tsx`, adding wrapper/compiler processes and memory/CPU overhead instead of using compiled workers.
- The active server and soak were not stopped or modified by this audit. Live execution is still locked and active economic state still has zero contracts, decisions, outcomes, lifecycle events, authorizations, and executions.

- Max Dama supplies the inner quantitative method: feature encoding, normalization, smoothing, regression calibration, information horizons, event studies, stable parameter surfaces, reproducible one-event-at-a-time simulation, covariance/factor risk, execution impact versus alpha loss, and capacity.
- Loop Engineering supplies the outer operating system: durable scheduling/state, constraints, budgets, run logs, independent verification, circuit breakers, worktree isolation, collision locks, least privilege, phased autonomy, readiness/drift audits, and explicit escalation.
- Loop Engineering's own quant studies establish a binding boundary for v3: an LLM may not approve a backtest; the checker must be deterministic and non-overridable, and a research winner must still survive data that did not exist during research.
- Current MetaEdge has a strong v2 numerical kernel but lacks a complete signal-transformation layer, information-horizon/event-study artifacts, parameter-plateau scoring, true write-once lockboxes, historical as-of universe membership, empirical execution cohorts, target-portfolio optimization, and the outer operational loop controls.
- The Loop Engineering audit scored the current repo 25/100 L0 and loop-sync 60/100 warning. Those tools under-recognize MetaEdge's custom JSON ledgers, but correctly identify missing LOOP/state/constraints/budget/run-log/circuit-breaker/worktree/governance artifacts.

## TradingAgents paper and repository audit

- Reviewed arXiv:2412.20138v7 in full, including the rendered organization and communication diagrams, and audited `TauricResearch/TradingAgents` at commit `01477f9afb7a47b849ed4c9259d3a9a4738d9fda` (v0.3.1, 2026-07-05).
- The transferable architecture is a decision council: specialist market, sentiment, news, and fundamentals reports feed a bounded bull/bear debate; a research manager selects the stronger case; a trader emits a typed proposal; aggressive, neutral, and conservative reviewers debate it; and a portfolio manager issues the final rating.
- The strongest implementation ideas are typed shared state, structured output for the three decision nodes, exact vendor routing, deterministic instrument identity, verified as-of market snapshots, future-news filtering, graph-shape-aware checkpoint identity, persistent append-only decision memory, benchmark-relative outcome resolution, and explicit separation of quick versus deep reasoning models.
- The paper's experimental evidence is not an acceptable promotion standard for MetaEdge: it reports only AAPL, GOOGL, and AMZN over roughly January-March 2024, notes 11 LLM calls and 20+ tool calls per prediction, gives no convincing ablation or multiple-testing correction, does not establish broad out-of-sample robustness, and treats live deployment as future work.
- The current repository remains a research decision aid rather than an alpha factory. Its analyst graph is sequential; historical news/social inputs are not frozen and therefore are not reproducible; the memory outcome is a fixed five-day return; its risk agents are language-model opinions rather than a numerical covariance/scenario/capacity engine; and it has no sealed trial ledger, survivorship-safe universe history, empirical execution-cost model, or untouched forward promotion gate.
- Its market breadth is useful context but must not be overstated: Yahoo-supported stocks and spot-crypto symbols are decision targets, Polymarket probabilities are an analyst input, and there are no operational perpetual, memecoin, prediction-market trading, or cross-chain execution lanes in that framework.
- MetaEdge will therefore implement the council downstream of evidence production and before portfolio/execution decisions. Each specialist must cite immutable evidence IDs and may return `insufficient_evidence`; adversarial reviewers must preserve dissent; numerical verification remains non-overridable; and all graph, prompt, model, dataset, universe, trial, and decision-policy versions must be persisted.
- Reflection will be stronger than prose memory: every paper decision gets horizon-aware raw, benchmark, factor, cost, and counterfactual outcomes; attribution records which evidence and council claims held or failed; lessons become hypotheses that must re-enter the declared-trial pipeline rather than silently altering strategy policy.

## QuantJourney Backtester audit

- Audited `QuantJourneyOrg/quantjourney-bt` at commit `aa723357657af7b220855c815bd854ccef93d33c` (release 0.10.1, 2026-07-11) and its public documentation. Apache-2.0 licensing, Python >=3.11 packaging, and the `quantjourney-bt` distribution are verified.
- The repository contains exactly 50 strategy files: 25 weight mode, 20 order mode, and 5 walk-forward/optimization workflows. A clean temporary environment passed 134/134 tests; the deterministic sample-data SMA run completed and generated weights, equity, metrics, summary files, and a 20-chart report pack.
- The central warning is correct. A fast signal-times-return curve is not evidence of implementable PnL. Weight mode explicitly shifts targets to the following return period; order mode turns orders into fills and uses a single stateful ledger for cash, positions, average entry, exposure, margin, buying power, and marked NAV.
- The execution engine covers market, limit, stop, stop-limit, trailing, bracket, and OCO orders; commissions and slippage at the fill; bar-volume participation; partial fills; pre-submit and fill-time risk; contract specifications; and conservative stop-before-limit handling when OHLC bars make the intrabar path unknowable.
- The walk-forward implementation distinguishes slice diagnostics from genuine per-fold refits, supports rolling/expanding/anchored/purged folds, and includes deflated Sharpe. Its PBO module is unusually honest: fold-level Sharpe pairs are explicitly rejected as insufficient, and PBO requires out-of-sample ranks for the in-sample-selected trials.
- The promotional language needs qualification. “Fast” is not substantiated by a published benchmark suite, and the exact “80+ metrics” count is not a clear public runtime contract. The package is marked Alpha. Local strategy logic and sample runs need no account, but real-data workflows normally use QuantJourney Cloud credentials; this is local-first, not fully offline real-data research.
- The engine openly does not provide first-class historical universe membership or infer fundamental publication lags. It also leaves stock borrow, financing, funding, and some market-impact assumptions to the user. Therefore it cannot by itself make MetaEdge's backtests honest.
- MetaEdge will adopt the verified contracts, not outsource truth to a new dependency: fast weight simulation and stateful order simulation must share one immutable world/strategy contract; cash plus marked positions must reconcile to NAV; timing, missing bars, corporate actions, contracts, costs, margin, and same-bar ambiguity must be explicit; and an optional independent Python parity oracle should test the TypeScript kernel rather than become its unexamined authority.

## 2026-07-16 recovery finding

- Containment audit found a second startup path: the ordinary six-hour controlled flywheel invoked `runControlledFastPerpCycle` even when the dedicated fast scheduler was off. This produced one empty research artifact during smoke. The controlled entry point is now fail-closed too, and the 16 KB leak was separately archived read-only.

## 2026-07-16 staged-proof findings

- The first all-clock burn-in exposed that insufficient and declined evaluations were being persisted as research-candidate contracts. They were non-executable, but they inflated operator discoverability and derived-state growth. That entire pre-acceptance run was hash-inventoried and quarantined as `RECOVERY_PREACCEPTANCE_NONCANDIDATE_CONTRACTS`; only `shadow_candidate` evaluations may now create contracts.
- The second burn-in exposed a multi-process cache race: recorder and research stores could atomically replace the materialized summary with locally consistent but stale counters. Raw ledgers remained intact. Summary writes now take an inter-process lock, reload the latest snapshot, merge monotonic counters/IDs/latest records, and atomically rename. A two-stale-writer regression test proves trade and book counts both survive.
- The corrected first research epoch evaluated 260 family/speed/symbol summaries and produced zero contracts because no result cleared the declared validation and post-cost gates. A later evidence change consumed the second global look and exceeded the fixed 3,500-trial ceiling, so it emitted a report-only research record with no evaluation or contract creation.
- The current honest forward result is therefore operational no-trade: four healthy clocks, current recorder evidence, zero queue depth, zero contract churn, zero unresolved decisions, zero contracts, zero decisions, and live execution locked.
- Polymarket currently presents a TLS certificate for a different hostname. MetaEdge keeps certificate validation enabled and records this as `source_unavailable`; the collection stage now returns an explicit no-op instead of an unhandled child exception.
- Restart is part of the causal research contract: a process boot is not a predeclared statistical look. The challenger now resumes its persisted six-hour cadence, and four report-only rows created during preflight restarts are quarantined rather than retained as active trial history.

## 2026-07-16 final scoped audit findings

- The earlier day-sized research epoch was an overcorrection: it prevented trial-budget exhaustion but also reduced a declared six-hour challenger to one statistical look per day. The corrected epoch is aligned to UTC six-hour boundaries; repeated evaluation and restarts inside an epoch share the charged budget, while the next scheduled epoch receives a fresh budget.
- A literal queue zero was still present in clock evidence. Completed clock heartbeats now combine reported backlog with measured schedule overrun, and health reports the measured depth and lag. Challenger work emits a running heartbeat and becomes visibly stale if it hangs.
- Forward portfolio risk originally ignored reservations created earlier in the same evaluator call and scoped daily loss to the current contract. Both omissions could admit correlated or over-budget simultaneous paper decisions; reservations and losses are now portfolio-wide.
- Research used best-book midpoint returns and normal-approximation confidence after the lifecycle layer had already been upgraded. Selected candidates now use executable L2 VWAP, globally corrected block-bootstrap confidence, independent-block minimums, and persisted alpha/block evidence.
- Fee semantics were ambiguous between per-side and round-trip costs. The active fast policy now names a conservative configured round-trip fee and subtracts it exactly once from the reconciled ledger.
- A crash after persisting a `no_trade` decision but before its outcome could allow the resolver to reconsider it as a fill. Decision blockers are now durable, no-trades resolve immediately, and recovery reconstructs the original risk rejection.
- The executed preacceptance archive was recursively read-only, but its helper protected only top-level directories. The helper now discovers and chmods every nested directory so future cutovers reproduce the same invariant.

## Portfolio and execution result

- The TypeScript kernel now has separate target-weight and stateful order/fill modes. Both calculate NAV from cash plus marked positions rather than assuming signal returns are portfolio returns, and both reject same-frame execution of a newly created decision.
- Target portfolios use sample, diagonal-shrinkage, factor, and blended covariance with explicit gross, position, capacity, scenario-loss, expected-shortfall, and drawdown gates. Order mode adds fill-time exposure and short/reduce-only controls, volume caps, partial fills, commissions, slippage, borrow, funding, and margin/maintenance accounting.
- Maker, taker, delayed, and no-trade execution cohorts are deterministic from a sealed seed and measure fill rate, alpha decay, adverse selection, impact, and shortfall. Cohort conclusions remain insufficient until each cohort reaches its declared minimum sample.
- Current evidence does not authorize those engines to produce an operator portfolio: both current-policy lockbox evaluations are blocked, leaving zero untouched-forward candidates. The portfolio audit therefore stores a blocked, live-locked record with null target/weight/order results and zero cohort outcomes instead of recycling retrospective signals.
- Refreshed seven-stream evidence remains honest: 0 forward candidates, 6 research-only streams, 1 no-trade stream, 0/7 numerical council gates passed, and every ledger integrity check clean.

## Forward learning and nine-loop operation

- Forward evidence is now a separate immutable v3 ledger, not a relabeling of the legacy pending forecast stream. Every resolved observation must postdate its sealed cutoff and cite its evaluation, quarantine enrollment, signal artifact, dataset, universe, world, and source events.
- Attribution reconstructs net paper edge from raw signal return, benchmark, locked factor betas/returns, signed funding and non-negative costs, execution impact/decay, and the no-trade counterfactual. Any reconciliation error above one millionth of a basis point blocks lifecycle review.
- Dataset drift measures PSI, mean shifts in reference-standard-deviation units, variance ratios, missingness, version changes, and source-authority changes. Hard source or distribution breaches stop the shadow and reopen research; negative tail events kill immediately; all re-research requires a new lockbox.
- Current real result remains admission-blocked: the two current-policy evaluations are not forward candidates, so there are zero v3 forward observations, attributions, drift claims, cohort claims, promotions, or queue items. Synthetic unit contracts prove the positive, decay, drift, and kill paths without contaminating operator evidence.
- The production child cycle now invokes all nine governed loops. Every loop has a successful append-only completion record; repeated evidence produces no-op/cadence outcomes; failed actions can retry until the three-attempt circuit breaker; legacy artifacts are warnings rather than current-policy integrity failures.

## First final-soak invalidation and challenger repair - 2026-07-16

- The first final soak is permanently invalid. At its scheduled challenger boundary, the research process stayed in `running` beyond the 60-second heartbeat budget, produced 31 non-operational samples, and raised aggregate CPU p95 to 102.4% against the fixed 70% limit.
- Root cause was quadratic event access: aggressive-flow and liquidation families scanned every trade for every book, while funding reversal copied and reverse-scanned every context for every book. A deterministic regression measured 198,000 numeric corpus reads on the old flow path.
- Binary range lookup plus bounded-window scans reduced the same regression below 10,000 reads without weakening thresholds. The real accumulated corpus then exposed an independent `Math.max(...largeArray)` argument-list overflow; a 150,000-event report-only regression now covers it and all large research extrema use reductions.
- The repaired policy is versioned as `fast-perp-research-policy-v7` / `fast-perp-research-v2`. On 36,091 books, 319,733 trades, 189,504 contexts, 13 symbols, and 1,820 declared trials, the real challenger completed healthy with 260 evaluations in 19,955 ms rather than exceeding the heartbeat window.
- The soak monitor previously recorded false operator health but did not automatically pause. A pure fail-closed policy and regression now make any `operational !== true` sample produce `OPERATIONAL_HEALTH_DEGRADED`; the fixed gate remains unchanged.
