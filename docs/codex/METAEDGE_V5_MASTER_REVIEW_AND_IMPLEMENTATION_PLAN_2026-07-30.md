# MetaEdge v5: Master Evidence Review and Implementation Plan

Date: 2026-07-30
Status: V5-00 through V5-10K locally implemented; isolated mechanics acceptance is GO, economic and deployment gates remain closed
Reviewed working tree: `codex/flywheel-availability-split`
Deployed commit: `6358c0aac947062b78df3e3db2aca19f0ea8099e`
Production: `https://34-57-51-25.sslip.io`
Money boundary: paper only; live execution remains locked
Authority target: MetaEdge trading runtime v5

Local implementation update (2026-07-30): V5-00 now has a machine-enforced
authority contract, immutable pre-V5 cutoff, read-only legacy adapter,
legacy-writer shutdown, V5 operator envelope, canonical `/api/v5/status`
surface, and active V5 product labels. Local proof is 35/35 decision tests,
158/158 discovery tests, passing TypeScript, and a passing production build.
This is not deployed or production-verified. See
`docs/decision_records/2026-07-30-v5-batch-3-authority-cutover.md`.

Local implementation update (2026-07-30, batch 4): V5-04 now has a
next-observation paper broker with durable pending, partial, rejected, expired,
executed, and unresolved states; caller prices are non-authoritative; costs and
liquidity assumptions are versioned; signed perp closes include conservative
funding and borrow. Local proof is 43/43 decision tests, 158/158 discovery
tests, passing TypeScript, and a passing production build. This remains
file-backed, undeployed, and not forward-tested. See
`docs/decision_records/2026-07-30-v5-batch-4-paper-broker.md`.

Local implementation update (2026-07-30, batches 5 and 6): V5-05 now
separates capped `paper_discovery` from `paper_confirmed`, registers a frozen
multi-family experiment population, records every opportunity, and routes
ordinary strategies plus separate Golden Cross strict/participate variants
through the same V5 intent and broker ledger. V5-06 adds conditional
dormancy, probation, reduced and retired states, separate eligibility and
health, durable lifecycle reasons, and immutable challenger creation. Local
proof is 48/48 decision tests, 158/158 discovery tests, passing TypeScript,
and a passing production build. This remains file-backed, undeployed, and not
forward-tested. See
`docs/decision_records/2026-07-30-v5-batch-5-paper-discovery.md` and
`docs/decision_records/2026-07-30-v5-batch-6-population-lifecycle.md`.

Local implementation update (2026-07-31, batch 7): V5-07 now seals immutable
trial and control contracts before order admission, clusters completed
positions into independent family/asset/episode evidence, reconciles
reference, execution, fees, funding, borrow and implementation shortfall,
preserves mandatory no-trade and continuous buy-and-hold controls, charges all
registered family variants, and produces multiplicity-adjusted promotion
classifications. Local proof is 55/55 decision tests, 158/158 discovery tests,
passing TypeScript, and a passing production build. This remains file-backed,
undeployed, and without a completed forward sample. See
`docs/decision_records/2026-07-31-v5-batch-7-trial-outcomes.md`.

Local implementation update (2026-07-31, batch 8): V5-08 replaces the coarse
population ceiling with a frozen, durable allocator that combines open and
same-cycle pending exposure, enforces gross/net, symbol, family, factor,
regime, liquidity, perp, information-budget, unresolved-order, and rolling
post-cost loss limits, prioritizes reductions, and atomically binds every V5
experiment intent to an exact portfolio reservation. Gross experiment
attribution survives shared-book netting. Local proof is 63/63 decision tests,
158/158 discovery tests, passing TypeScript, and a passing production build.
This remains file-backed, undeployed, and not forward-tested. See
`docs/decision_records/2026-07-31-v5-batch-8-portfolio-allocator.md`.

Local implementation update (2026-07-31, batches 9 and 10): the existing
Research Fleet now exposes V5/legacy-separated population, lifecycle, regime,
order health, portfolio exposure, lineage, and outcomes without adding a new
panel. The frozen registry has expanded to 14 arms across 13 mechanism
families. A five-clock supervisor, immutable operation policy, distinct-cycle
burn-in ledger, UI parity verifier, and explicit resilience gate are in place.
The authority-corrected isolated run completed 10/10 clean cycles and 5,460
evaluations but routed no intents under the available market evidence; ledger
and UI both showed zero V5 trades. Its overall verdict is `no_go`: execution,
partial-fill, portfolio-veto, lifecycle-reactivation, restart/reconciliation,
controlled-outcome, stale-fault, and write-failure evidence are not all present
in the same burn-in packet. An earlier pre-cutoff-registration run was
invalidated and excluded. This is local and undeployed. See the five
2026-07-31 V5-09/10 decision records. Full local proof after the correction is
71/71 decision tests, 158/158 discovery tests, passing TypeScript, a passing
production build, clean diff whitespace, and rendered desktop/mobile checks
with no browser errors.

Local implementation update (2026-07-31, next five resilience batches): a
fresh isolated, cross-process harness earned intent-restart, partial-fill
restart, outcome-restart, stale-data-rejection, and durable-write-failure
assurance records. The same database then completed 10/10 clean cycles and
5,460 evaluations with live locked. Partial-fill, reconciliation, controlled
outcome, lifecycle reactivation, and UI parity are now present. The two trades
are assurance fixtures, not economic evidence, and no organic intent routed in
that market window. The combined verdict remains `no_go` solely because no
portfolio veto was observed. See
`docs/decision_records/2026-07-31-v5-batch-10e-resilience-assurance.md`.
Full local proof is now 72/72 decision tests, 158/158 discovery tests, passing
TypeScript, a passing production build, and clean diff whitespace.

Local implementation update (2026-08-01, batch 10F): the portfolio-veto gap is
closed with a canonical symbol-cap decision linked to its reservation, risk
snapshot, frozen policy, reasons, and hashed assurance record. Lifecycle proof
was also hardened to require dormant-to-probation movement in the same
experiment after the declared dwell. A fresh one-command packet completed
seven resilience scenarios, 10/10 clean cycles, 5,418 evaluations, exact UI
parity, and all eleven evidence gates with zero reasons. The verdict is now
`go_local_paper_operation`. This means isolated local paper mechanics only:
zero organic intents routed, no economic edge proven, no deployment
authorization, and live remains locked. See
`docs/decision_records/2026-08-01-v5-batch-10f-local-mechanics-acceptance.md`.

Local implementation update (2026-08-01, batches 10G through 10K): the runtime
now keeps mechanics, economic evidence, deployment authorization, and live
capital as four separate operator truths. Each decision cycle receives a
content-addressed explanation by strategy, symbol, gate, and reason; zero
routes are classified as expected restraint, evidence blockage, risk veto,
routing gap, or unknown. Durable forward checkpoints track zero-route streaks
and incidents, while completed operation samples reconcile clock and order-SLA
state. The acceptance command emits a content-addressed evidence bundle, and
the existing Research Fleet view exposes all of this without adding another
product panel. Assurance fixtures are excluded from organic and economic
counts. This is local, undeployed, and live locked. See the five 2026-08-01
batch 10G-10K decision records.

Final fresh acceptance evidence for these batches used
`/tmp/metaedge-v5-resilience.ddGpfA/db.json`: 10/10 clean cycles, 5,040
evaluations, zero organic routed intents in that market window, exact
ledger/UI parity, seven assurance records, and bundle hash
`11cf793ca5480799ff48687ba7e6470f01c7551aaa8c080d5fb09ac38b061d16`.
All ten cycles were explicitly classified `evidence_blocked`. The
bundle still says economic edge false, deployment unauthorized, and live
locked. A desktop/narrow browser pass rendered the integrated truth and
incident codes without console errors or horizontal document overflow.

This is the authoritative consolidation of:

- the owner’s corrections to the earlier Golden Cross-centered plan;
- every question and answer reviewed in the two Reddit Answers conversations;
- the underlying Reddit threads, papers, repositories, and code claims;
- the existing MetaEdge research documents;
- the deployed production APIs and paper-trade state;
- a read-only review of the decision, discovery, data, execution, risk,
  persistence, and Research Fleet code;
- a staged implementation plan for one properly working v5 paper system.

This document records the evidence trail and the decisions made from it. It
does not expose private model chain-of-thought. It gives the complete,
inspectable rationale needed to reproduce, challenge, or implement the design.

Related detailed source records:

- [Reddit vs. MetaEdge](./REDDIT_AGENT_TRADING_COMPARISON_2026-07-29.md)
- [Executing Agents That Produce Evidence](./EXECUTING_AGENT_LEARNING_RESEARCH_2026-07-30.md)
- [External Execution and Learning Forensic Audit](./EXTERNAL_EXECUTION_LEARNING_FORENSIC_AUDIT_2026-07-30.md)

## 1. Executive verdict

### 1.1 Do we already have a proper working v5?

**No.**

MetaEdge has three valuable but disconnected bodies of work:

1. a deployed paper product with real users, a shared trade function, a
   running Golden Cross scanner, a risk loop, and visible paper results;
2. a layered decision runtime that freezes strategy definitions and records
   decisions, but requires promotion evidence before it can place a paper
   discovery trade;
3. a much richer v3 discovery/flywheel subsystem with immutable contracts,
   trial accounting, shadow cohorts, reconciliation, lifecycle gates,
   portfolio simulation, and strong tests, but which is disabled and empty in
   production.

The result is not one learning system. It is several partially overlapping
systems with different contracts, stores, clocks, versions, and meanings of
“paper.”

### 1.2 What is working now?

- The web product is healthy and publicly reachable.
- Database connectivity, as defined by the current health endpoint, is true.
- Global live mode is locked.
- Golden Cross is scanning and has created recent paper trades.
- The shared `placePaperTrade` path performs ownership, agent, price, basic
  balance/risk, cost adjustment, ledger, and audit work.
- The code builds and type-checks.
- The decision suite passes 17/17 tests.
- The discovery suite passes 157/157 tests.
- The research subsystem contains several reusable, well-tested designs.

### 1.3 What is not working?

- Production is not operating a broad, continuously replenished v5 strategy
  population.
- The shared decision runtime has not persisted a cycle since 2026-07-16.
- Its most recent 100 visible decisions are all declines for
  `REQUIRED_FEATURE_UNAVAILABLE`.
- The production opportunity factory has no cards, candidates, contracts,
  shadow decisions, outcomes, or lifecycle evidence.
- The fast-perp operation is explicitly disabled.
- Golden Cross bypasses the canonical decision/experiment lifecycle.
- Paper intents and the secure-core audit trail are in memory.
- The main paper fill and position model is too weak for reliable multi-family
  learning, shorts, partial fills, or restart reconciliation.
- Risk-reducing exits can be rejected by an entry-style balance check.
- Database write failure is logged but reported upstream as success.
- Current active strategy and policy artifacts use v1, v2, v3, and v7 naming
  without one explicit trading-system v5 authority.

### 1.4 The correct direction

Build **one canonical v5 paper execution-evidence spine** that supports many
frozen strategy experiments at once.

Golden Cross becomes one normal v5 experiment adapter. It is not the center,
the champion, the control, or the definition of how MetaEdge trades.

The v5 system must:

- admit weak-but-valid ideas to small, bounded `paper_discovery` budgets;
- preserve stricter evidence requirements for larger paper allocation;
- treat regime mismatch as dormancy or shadow observation, not automatic
  permanent retirement;
- reconcile every order and outcome;
- attribute every observation to a frozen experiment version;
- coordinate risk across all strategies and symbols;
- expose all strategies in the existing Research Fleet list with clear labels;
- keep live execution locked;
- preserve old evidence without letting pre-v5 artifacts remain active.

## 2. Evidence boundaries

The following labels are used throughout:

- **Implemented:** present in the inspected code.
- **Tested locally:** exercised by a passing test in this review.
- **Deployed:** included in production commit `6358c0a`.
- **Operational:** currently producing fresh production evidence.
- **Paper result:** simulated performance, not transferable profit proof.
- **External claim:** reported by another project or Reddit author.
- **Unknown:** not determinable from public APIs or the local checkout.

These states are not interchangeable.

A passing unit test does not prove that a scheduler is enabled. A healthy web
server does not prove that its research runtime is cycling. A paper profit does
not prove live profitability. A large trade count does not prove independent
evidence. A repository README does not prove its implementation or results.

## 3. How the plan changed

### 3.1 Initial framing

Earlier work correctly identified the need for:

- versioned strategies;
- a shared paper execution path;
- immutable active rules;
- forward observation;
- explicit outcomes;
- cost-aware evidence;
- a champion, challenger, and control comparison.

It then made an unjustified narrowing:

> route Golden Cross through the path and run only a frozen champion,
> challenger, and control.

### 3.2 Owner correction

The owner correctly rejected that narrowing:

- Golden Cross was one idea, not “the way” to trade.
- Strategies may work in different regimes and cycles.
- One bad period should not permanently kill a conditional strategy.
- The system is under-executing and over-waiting for a perfect edge.
- Discovery, execution, measurement, retirement, and replacement should run
  in parallel.
- Shared infrastructure must enable breadth, not become a bottleneck.

### 3.3 Corrected model

The correct unit is a **population of conditional specialists**:

- multiple mechanism families;
- multiple markets and horizons where data quality permits;
- separate frozen experiment versions;
- one common execution and evidence contract;
- shared portfolio risk;
- per-experiment attribution;
- regime eligibility separate from strategy health;
- dormant and shadow states separate from retirement;
- ongoing admission of new hypotheses.

### 3.4 What “one runtime” means

One runtime means:

- one order-intent authority;
- one order-event ledger;
- one position-lot authority;
- one portfolio-risk authority;
- one reconciliation authority;
- one experiment identity contract;
- one outcome attribution contract.

It does **not** mean:

- one strategy;
- one model;
- one signal family;
- one market;
- one privileged agent;
- one tiny cohort that blocks new entrants.

## 4. What the Reddit investigation established

### 4.1 Coverage

The review read all 31 questions and answers in the current Reddit Answers
conversation and inventoried 187 unique cited links. Reddit Answers itself
linked no GitHub repositories directly; repository work was found by following
the underlying posts and claims.

Reddit Answers is an AI synthesis and a discovery tool, not a primary source.
Claims were followed into posts, repository code, documentation, tests, and
papers where possible.

### 4.2 Durable field signals

The recurring useful practices were:

- run many strategy variations and genuinely different families in parallel;
- keep strategy identity on every order, fill, and outcome;
- let strategies share a paper account while preserving attribution;
- freeze active strategy versions;
- create challengers rather than mutate active rules;
- model costs and imperfect execution;
- use current forward observations, not only reused historical optimization;
- inspect individual trades and order states, not only aggregate P&L;
- compare against no-trade and market baselines;
- distinguish signal failure from execution failure;
- use external portfolio risk rather than letting every strategy size itself;
- continuously admit, reduce, shadow, re-test, and replace hypotheses.

These are operating patterns. They are not proof of profitability.

### 4.3 Unsupported or unsafe shortcuts

The investigation did not support:

- “paper trading at current price” as a realistic fill model;
- universal rules such as “100 trades proves it”;
- treating many correlated bots in one market period as independent evidence;
- allowing an LLM to change an active strategy;
- promoting the latest winner without a frozen control;
- starting with live money as a required learning step;
- equating a strategy explanation with causal evidence;
- assuming that a public leaderboard proves edge;
- copying a full external framework before MetaEdge has one working vertical.

### 4.4 Regime-aware lifecycle

Four questions must be separate:

1. **Trigger:** is this strategy’s specific setup present?
2. **Eligibility:** is the broader market regime appropriate?
3. **Health:** when eligible, is behavior inside the expected envelope?
4. **Portfolio fit:** does this trade add acceptable risk now?

The lifecycle must support:

`draft -> research_only -> paper_discovery -> paper_confirmed`

with conditional operating states:

`armed -> active -> reduced -> dormant_shadow -> probation`

and terminal or review states:

`retired` and `live_review_locked`

A strategy is retired only for reasons such as:

- repeated failure in eligible regimes;
- invalidated mechanism;
- infeasible post-cost economics;
- corrupt or unreconcilable implementation;
- redundant exposure with no incremental information;
- owner decision.

Normal loss, one drawdown, or an ineligible regime is not enough.

## 5. External repository and claim audit

### 5.1 Strongest reusable systems

| System | What is real | What is not proved | MetaEdge use |
|---|---|---|---|
| NautilusTrader | typed order/event engine, simulation, startup and continuous reconciliation, extensive tests | profitable edge; simulator-live fill identity | order lifecycle, unresolved states, reconciliation concepts |
| Freqtrade | durable dry-run orders, shared lifecycle, book-aware market fills, mature operational state | queue/latency-perfect fills; profitable FreqAI rotation | persistent paper orders, bias tools, restart state |
| Forven | hypothesis registry, graveyard, DSR trial accounting, gauntlet, paper/testnet reconciliation, 569 tests | profitable forward ledger; mature regime champions | trial accounting, reconciliation, frozen strategy contracts |
| PaperTrade-India | fees, T+1, depth, slippage, latency, rejection, idempotency, stale-price blocks, many tests | crypto/perp applicability; strategy discovery | broker-simulator mechanics and failure states |
| TorchTrade | substantial RL environments and tests | autonomous learning factory or profitable policy | optional research environment, not execution authority |

### 5.2 Operationally useful but economically negative examples

#### Trading Fleet Infrastructure

The repository demonstrates:

- 15 systemd-managed bots;
- separate Alpaca paper accounts;
- Discord notifications;
- log rotation;
- external equity reading;
- nightly fill-level P&L reporting.

Its own results are more important than its architecture:

- live leaderboard results had essentially no correlation with five-year
  backtests;
- 11 of 15 backtested strategies failed to beat SPY;
- several were deeply negative.

Its allocator README says it enforces kill lines, but the inspected code alerts
rather than enforcing them. The repository contains seven representative bots
for 15 claimed and no tests.

Lesson: strong operations can expose weak strategies faster. Operations do not
create edge.

#### RL-Trading

The code has:

- shared-equity recurrent SAC;
- correlated crypto-perp assets;
- fees and funding;
- testnet support.

The author later reported that initial paper results were not good. Six crypto
assets were largely one BTC-beta regime, not six independent alphas.

Lesson: a sophisticated agent is still an experiment and correlated assets do
not multiply evidence.

### 5.3 Claims that did not survive scrutiny

- A 60-day evolutionary system reported 2,729 trades and profit factor 1.15,
  but hid 100% ADA concentration, lacked a counterfactual entry price, and had
  a strategy bug. No repository or auditable logs were supplied.
- A proprietary StrategyQuant portfolio offered a paid course but no requested
  Myfxbook evidence or source.
- The IBKR discussion gave useful reconnect and order-state anecdotes but no
  public implementation or performance proof.
- A LangChain “production agent” had no repository and the linked article did
  not substantiate the trading implementation.
- A claim about AI systems running strategies publicly did not provide the
  promised logs or links.

### 5.4 Bottom-line external conclusion

No reviewed external project established a transferable profitable edge.

The useful material is narrower:

- how to generate and identify experiments;
- how to simulate and record orders honestly;
- how to recover and reconcile;
- how to keep trial accounting;
- how to operate many paper processes;
- how to prevent false promotion.

MetaEdge should adopt these mechanics selectively. It should not import a
second general runtime or hand promotion authority to an external agent
framework.

## 6. Production truth snapshot

Read-only production observations on 2026-07-30:

### 6.1 Web health

`GET /api/health`

- status: `ok`
- app: `MetaEdge`
- commit: `6358c0a`
- database connectivity: true
- users: 22
- global live-mode lock: true

Conclusion: the product is reachable and the current health definition passes.

### 6.2 Layered decision runtime

`GET /api/decision-runtime`

- persisted strategy specs: 6
- validations: 0
- recent decisions returned: 100
- queued decisions: 0
- last persisted cycle: 2026-07-16
- last cycle evaluated: 238
- declines: 238
- research hypotheses: 0
- paper candidates: 0
- routed trades: 0
- most recent 100 outcomes: all `decline`
- most recent 100 reason: `REQUIRED_FEATURE_UNAVAILABLE`

The deployed specs include five current plugin families plus a stale persisted
`deterministic_composite` spec that current code has removed.

Unknown: the public API does not expose whether the cycle stopped because of an
environment flag, startup failure, scheduling failure, resource failure, or
another cause. The plan must add explicit runtime configuration and heartbeat
truth. No exact cause is asserted here.

### 6.3 Research Fleet

`GET /api/research-fleet`

| Family | Trades | Closed | Realized paper P&L |
|---|---:|---:|---:|
| grid | 6,642 | 3,321 | -$1,656.06 |
| custom_ai | 5,012 | 1,579 | -$1,706.71 |
| mean_reversion | 292 | 0 | $0 |
| momentum | 106 | 0 | $0 |
| golden_cross | 2 | 1 | -$153.65 |
| total | 12,054 | 4,901 | -$3,516.42 |

The legacy trade event model makes these aggregates difficult to interpret:

- many entries have no modeled close;
- “wins” are counted from positive closing trade events;
- trade status does not robustly represent position closure;
- different families were produced by different runtimes and contracts;
- legacy records lack consistent versions, controls, regimes, and order state.

These values are paper bookkeeping, not comparable v5 experiment evidence.

### 6.4 Opportunity factory and fast-perp research

Production reports:

- opportunity-factory last run: null;
- cards: 0;
- relationships: 0;
- flywheel candidates: 0;
- trials: 0;
- forward observations: 0;
- economic contracts: 0;
- shadow decisions: 0;
- shadow outcomes: 0;
- fast-perp recorder: not running;
- fast-perp operation: disabled;
- fast-perp clocks: none;
- live execution: locked.

The v3 operator snapshot says “degraded” and “no promoted alpha,” but the more
fundamental fact is that there is no current production research evidence in
that subsystem.

### 6.5 Deployment configuration

The checked-in GCP setup explicitly sets:

- `OPPORTUNITY_FACTORY_DISABLED=true`
- `FAST_PERP_RECORDER_ENABLED=false`
- `FAST_PERP_OPERATION_ENABLED=false`
- `FAST_PERP_RESEARCH_ENABLED=false`

The serving deployment therefore cannot be described as an active v3
opportunity flywheel.

The setup uses `data/db.json` with daily rotated file copies. `DATABASE_URL` is
treated by code as a file path, not a Postgres URL. This conflicts with the
desired hosted-production boundary that persistent Postgres should back
canonical product state. The active production environment was not accessed,
so the exact deployed file path is unknown; the code and deployment script
make the persistence limitation explicit.

## 7. Read-only code review

### 7.1 Review scope

The review covered:

- `server/decision/**`
- `server/discovery/**`
- `server/trades.ts`
- `server/recorder.ts`
- `server/prices.ts`
- `server/broad_feed.ts`
- `server/storage.ts`
- `server/research.ts`
- `src/secure-core/trading/**`
- `src/secure-core/audit/**`
- `src/components/ResearchFleet.tsx`
- `server.ts`
- GCP deployment and research configuration
- decision and discovery tests

No runtime source was changed.

### 7.2 Verification ledger

| Check | Result |
|---|---|
| `npm run test:decision` | 17 passed, 0 failed |
| `npm run test:discovery` | 157 passed, 0 failed |
| `npm run lint` | passed |
| `npm run build` | passed |
| Source differences from deployed commit under `server`, `src`, `tests` | none found |

The build emitted a frontend chunk-size warning. It did not fail.

### 7.3 P0: database writes fail open

`server/storage.ts:159-181` catches every write error, logs it, and returns
normally.

`server/trades.ts:237-238` calls `writeDatabase(db)` and then reports
`{ ok: true }`.

Impact:

- a trade can be reported as successful without durable persistence;
- paper balance, position, trade, audit, and graph event can be absent after an
  I/O failure;
- downstream code can create trailing state for a trade that did not persist;
- restart truth can diverge from the UI response.

Required v5 behavior:

- canonical writes return an acknowledged durable event ID or throw;
- no fill is considered committed until its order/fill/position transaction is
  durable;
- ambiguous commit becomes `unresolved`, not `filled`;
- the UI never reports success on a failed write.

### 7.4 P0: risk-reducing exits can fail balance checks

`src/secure-core/trading/risk-engine.ts:20-27` calculates required margin for
every intent and rejects when it exceeds available balance.

`server/trades.ts:174-182` runs this check before determining whether the order
is reducing an existing position.

Impact:

- a sell intended to flatten an existing spot position can be rejected because
  the user has little cash;
- a risk stop can fail precisely when it should reduce exposure;
- the current “declined execution” counters do not expose this reason cleanly.

Required v5 behavior:

- establish side, current lot state, and `reduceOnly` before the risk decision;
- exits can be rejected for invalid quantity, stale price, corrupt state, or
  unresolved ownership, but not for requiring new entry margin;
- when a full exit cannot be completed, create a visible partial/unresolved
  risk incident.

### 7.5 P0: intents and secure audit are not durable

`src/secure-core/trading/intents.ts` stores:

- seen nonces in an in-memory `Set`;
- order intents in an in-memory `Map`;
- IDs from time plus randomness.

`src/secure-core/audit/logger.ts` stores its “immutable” audit trail in an
in-memory array.

Impact:

- restart loses idempotency and intent history;
- a retry after restart can duplicate an order;
- the secure-core audit does not reconcile with the persistent product audit;
- there is no durable submitted/acknowledged/partial/canceled/unresolved
  lifecycle.

Required v5 behavior:

- a persistent content-addressed or server-generated intent ID;
- a unique idempotency key at the database layer;
- append-only order events;
- restart reconciliation;
- one canonical audit record linked to the order and experiment.

### 7.6 P0: data universe and recorded feature history do not match

The decision runtime evaluates a Tier-1 top-volume universe.

`server/recorder.ts:41-46` records prices only from the small
`serverPrices` product set.

RSI, SMA, and realized-volatility features depend on recorded hourly history.
Most Tier-1 symbols therefore do not have the required history.

This directly explains the production wall of
`REQUIRED_FEATURE_UNAVAILABLE`.

The broad feed watches hundreds or thousands of symbols and supplies current
prices, but its long-tail data is not recorded into the same hourly evidence
series used by the plugins.

Required v5 behavior:

- a declared `UniverseVersionV5`;
- recorder coverage generated from the same universe authority used for
  strategy evaluation;
- explicit capture eligibility and retention;
- no strategy is armed for symbols whose required evidence is absent;
- missing evidence is an observable data-health state, not a silent endless
  decline loop.

### 7.7 P0: synthetic UI jitter enters research history

`server/prices.ts:122-140` adds centered random price jitter every three
seconds between real feed updates.

`server/recorder.ts` samples `serverPrices` once per minute.

Impact:

- synthetic display motion can enter the historical series used for RSI/SMA
  and forward evaluation;
- the history does not cleanly represent venue observations;
- the random path is not replayable from source evidence.

Required v5 behavior:

- display animation must be separate from canonical market evidence;
- recorder writes only source observations with source, venue, observed time,
  received time, sequence/hash, and freshness;
- synthetic simulation inputs must be explicitly labeled and never mixed into
  forward market evidence.

### 7.8 P0: Golden Cross multi-symbol cleanup can clear the wrong state

`server/decision/risk_loop.ts:73-96` records successful exits in
`flattened: string[]` using only `agentId`.

Golden Cross uses one agent for many symbols.

The cleanup loop checks `flattened.includes(b.agentId)` for every breach.

Impact:

If one Golden Cross symbol exits successfully and another symbol’s exit fails
in the same pass, the second symbol’s trailing state and cooldown can still be
cleared because both share the same agent ID.

Required v5 behavior:

- success identity is `experimentId + accountId + symbol + positionLotId`;
- cleanup follows the exact successful order/fill/lot event;
- failed or unresolved exits retain protective state and raise an incident.

### 7.9 P1: paper fill model is too simple

The main product path:

- stamps an immediate full fill;
- applies a fixed per-side basis-point penalty;
- has no bid/ask, depth, latency, queue position, partial fills, venue reject,
  cancellation, expiry, or unresolved state.

It also falls back to a caller-provided price when the symbol is not priced by
the server.

The richer discovery simulator already supports:

- next-bar timing;
- market, limit, stop, and stop-limit orders;
- volume participation;
- partial fills;
- expiry;
- fees and slippage;
- shorts, borrow, and funding;
- reduce-only;
- gross-exposure checks;
- cash/NAV reconciliation.

However, that simulator is research-only and not connected to actual product
paper trades.

Required v5 behavior:

- reuse or adapt the tested execution concepts;
- do not allow a strategy/client to author its own canonical fill price;
- preserve expected/reference price separately from simulated fill;
- record every order event and cost component.

### 7.10 P1: position accounting is long-spot-centric

The main `positionBefore` logic treats:

- buy/long as opening inventory;
- sell/short as closing long inventory.

It does not construct a short position.

The P&L path:

- does not correctly model short lots;
- does not apply leverage to perp P&L coherently;
- does not preserve fill-level fees separately;
- produces a separate closing trade event rather than a durable position-lot
  state machine.

The `funding_carry` plugin emits `short`, but `routePaperDecision` accepts only
`buy` or `sell`. It therefore cannot route.

Required v5 behavior:

- signed position lots;
- explicit open, increase, reduce, close, and flip transitions;
- leverage/margin/funding/borrow at the lot and account level;
- instrument-aware strategy adapters;
- delta-neutral multi-leg contracts where required.

### 7.11 P1: provenance can be wrong for long-tail symbols

`getSpotPrice` can return a broad-feed long-tail price.

`buildContext` obtains source and observed time from `getPriceFeedState`, which
describes the small product feed.

Impact:

- a broad-feed price can be attributed to CoinGecko/Coinbase product-feed
  provenance and timestamp;
- freshness can be assessed against the wrong source;
- evidence hashes cannot reliably reconstruct the observation.

Required v5 behavior:

- price lookup returns a complete observation object, not only a number;
- every feature cites its exact source event;
- per-source freshness is enforced before strategy evaluation.

### 7.12 P1: “portfolio” risk is currently per-position

`server/decision/runtime.ts:65-120` computes open notional from one
agent-symbol position and assigns it to `portfolioOpenNotionalUsd`.

It does not aggregate:

- all strategies;
- all symbols;
- shared directional beta;
- correlated family exposure;
- leverage;
- pending reservations;
- same-cycle orders.

Required v5 behavior:

- one reservation-aware book-level risk snapshot;
- symbol, family, factor, venue, liquidity, regime, gross, net, and daily-loss
  limits;
- a strategy may propose size, but the portfolio allocator authorizes it.

### 7.13 P1: Golden Cross is outside the experiment lifecycle

Golden Cross:

- scans a broad universe;
- creates a separate system owner and multi-symbol agent;
- calls `placePaperTrade` directly;
- maintains trailing state separately;
- uses its own scan log;
- has its own position and balance limits;
- does not create a canonical decision observation or lifecycle event.

Its comments overclaim the evidence as “proved” and the 15% exit as “proven.”
The prior review did not establish that strength of claim.

The default `participate` mode is wider than the strict fresh-cross hypothesis:
any current bull regime plus volume surge and liquidity can enter.

Although the scan log records the strict subset, the main thesis sanitizer
drops rich fields such as `context`, `mode`, `strictCross`, and
`trailingStopPct`.

Required v5 behavior:

- retain Golden Cross as a normal experiment family;
- freeze strict and participate as separate versions;
- create an opportunity observation for every evaluation;
- route entry and exit through v5 intents/events/lots;
- preserve its full context and regime tags;
- apply common portfolio risk and lifecycle rules.

### 7.14 P1: exit attribution is incomplete

Risk-stop theses do not include the experiment, strategy version, card, signal
family, or decision that owns the position.

Research Fleet can infer Golden Cross from the agent, but exit setup/card fields
remain incomplete.

Required v5 behavior:

- `PositionLotV5` carries experiment identity;
- every exit event inherits the lot’s identity;
- mechanical risk exits are attributed to the strategy outcome and separately
  to the risk policy that caused the exit.

### 7.15 P1: daily feature state is not restart durable

The daily feature layer:

- loads bootstrap files into memory;
- appends settled broad-feed daily observations in memory;
- does not persist those extensions back to the bootstrap evidence files.

After restart, post-bootstrap daily progress is lost until rebuilt from another
source.

Required v5 behavior:

- append-only daily bar evidence with source and venue identity;
- restart reconstruction;
- explicit gap and cross-venue policies;
- no in-memory-only research continuity.

### 7.16 P1: the discovery subsystem is sophisticated but disconnected

The v3 subsystem implements and tests:

- content-addressed candidate specs;
- declared-trial budgets;
- point-in-time features;
- data quarantine;
- world parity;
- purged temporal splits;
- multiple-testing controls;
- numerical lockboxes;
- forward quarantine;
- maker/taker/delayed/no-trade cohorts;
- paper contracts and lifecycle events;
- partial fills and cost accounting;
- immutable proposal/evidence bundles;
- exactly-once import and crash recovery;
- portfolio construction and scenario gates;
- fast-perp recording and research clocks;
- fail-closed live locks.

Production has none of its current evidence and its relevant operation is
disabled.

It also contains active names such as:

- v1 schemas and configs;
- v2 validation and economics policies;
- a v3 flywheel;
- a v7 fast-perp research policy.

These are local component versions, but without one global authority they
create ambiguity against the owner’s v5-only requirement.

Required v5 behavior:

- keep reusable modules;
- retire the v3 subsystem as an independent product authority;
- adapt its tested primitives behind v5 contracts;
- do not run two canonical paper ledgers;
- make one status endpoint show which components are active, shadow-only,
  legacy, or disabled.

### 7.17 P2: bounded stores can lose analytical history

The layered decision store retains a bounded recent decision history. A broad
universe multiplied by several plugins can exhaust it rapidly.

Required v5 behavior:

- append-only opportunity and order-event ledgers;
- compact/materialized current views for APIs;
- archival/partition policy;
- evidence is never silently overwritten by volume.

### 7.18 P2: type and naming drift

Examples:

- server startup logs `MetaEdge V1`;
- plugins are `1.0.0`;
- feature keys are `*.v1`;
- Golden Cross card is `*-v1`;
- a Golden Cross agent uses `tradeType: 'spot' as any` while product types use
  `token | perp`;
- the MetaMask Agent Wallet dependency is 5.2.1, which is unrelated to the
  trading runtime authority.

Required v5 behavior:

- `authorityVersion: 5` on every active canonical trading artifact;
- v5 schema discriminators;
- no `as any` for instrument identity;
- wallet package version and trading-system version remain separate.

## 8. Root causes

The current “we keep going in circles” behavior is not one bug.

### 8.1 Admission and promotion are conflated

The layered engine allows paper execution only after
`forward_paper_candidate`. This asks an idea to earn forward promotion evidence
before it can create forward paper evidence.

### 8.2 The rigorous research system is not the product executor

The strongest experiment and reconciliation code lives in a disabled research
subsystem. Product trades use a simpler ledger.

### 8.3 Strategy breadth has no common execution vehicle

The research loop can evaluate many plugin-symbol pairs, but routes only through
existing user autopilot agents. Golden Cross worked around that by creating its
own system book.

### 8.4 Data coverage is narrower than the declared universe

The system evaluates a broad universe using features recorded for a small one.

### 8.5 Evidence meaning is inconsistent

Legacy trade events, decision outcomes, opportunity cards, shadow outcomes, and
Research Fleet rows do not share one schema or lifecycle.

### 8.6 Operational health is fragmented

A web health check, decision cycle timestamp, v3 cached operator snapshot,
recorder state, scanner log, and fast-perp clocks each tell a different part of
the truth.

## 9. Definition of a proper working v5

V5 is not “all code renamed to v5.” It is an operational contract.

A proper working v5 exists only when:

1. every active strategy is registered under authority version 5;
2. every evaluation produces a terminal opportunity observation;
3. every paper order has a durable intent and ordered event history;
4. every fill changes a durable position lot and account ledger atomically;
5. every outcome is attributable to an experiment, regime, and risk policy;
6. all strategies share portfolio reservations and risk;
7. restart reconciliation resolves every nonterminal order;
8. pre-v5 artifacts are historical-only and excluded from v5 evidence;
9. production health shows every required v5 clock and its freshness;
10. multiple genuinely different frozen experiments are running concurrently;
11. dormant strategies keep shadow evidence and can enter probation;
12. Research Fleet shows the population in its existing list;
13. no LLM can place, resize, mutate, reconcile, promote, or unlock a live order;
14. live money remains locked.

## 10. V5 canonical contracts

All active contracts include:

- `authorityVersion: 5`
- `schema: <name>.v5`
- stable ID
- created/observed/received/effective timestamps as applicable
- source provenance
- experiment identity
- code/config hash
- live state: `locked`

### 10.1 `ExperimentSpecV5`

Required fields:

- experiment ID and version ID;
- family and mechanism;
- instrument and venue eligibility;
- universe version;
- feature contract;
- signal rule;
- entry rule;
- exit rule;
- regime eligibility model;
- expected failure regimes;
- cost model;
- position and portfolio risk request;
- information budget;
- declared parameter/search trials;
- control definition;
- benchmark;
- outcome horizon;
- falsifiers;
- lifecycle state;
- immutable code/config hash.

Material changes always create a new version.

### 10.2 `OpportunityObservationV5`

One row for every evaluated experiment-symbol-time opportunity:

- experiment version;
- symbol/instrument;
- regime features and eligibility weight;
- exact source event IDs;
- feature values;
- signal result;
- requested size;
- portfolio decision;
- terminal disposition;
- reason codes;
- decision time and expiry;
- control assignment.

Terminal dispositions:

- `no_signal`
- `regime_ineligible_shadowed`
- `data_unavailable`
- `stale`
- `instrument_ineligible`
- `cost_infeasible`
- `risk_blocked`
- `budget_exhausted`
- `control_no_trade`
- `intent_created`
- `internal_error`

### 10.3 `OrderIntentV5`

- intent ID;
- idempotency key;
- experiment and opportunity IDs;
- account/owner derived from server authority;
- symbol/instrument/venue;
- side and position effect;
- order type and time-in-force;
- requested quantity/notional;
- reference price;
- limit/stop fields;
- reduce-only;
- risk reservation ID;
- expiry;
- strategy and policy hashes.

### 10.4 `OrderEventV5`

Ordered event types:

- `created`
- `risk_reserved`
- `submitted`
- `acknowledged`
- `partially_filled`
- `filled`
- `rejected`
- `cancel_requested`
- `canceled`
- `expired`
- `unresolved`
- `reconciled`

Each event records:

- event sequence;
- quantities;
- expected/reference/fill price;
- fee, spread, slippage, impact, funding, and borrow components;
- source observation;
- simulator/broker adapter identity;
- raw external reference where applicable;
- reconciliation state.

### 10.5 `PositionLotV5`

- signed quantity;
- average entry;
- realized/unrealized P&L;
- margin;
- leverage;
- accumulated fees/funding/borrow;
- experiment ownership;
- open and closing order IDs;
- stop/risk policy;
- status;
- reconciliation timestamp.

### 10.6 `OutcomeV5`

- experiment and opportunity;
- lot/order lineage;
- entry and exit observations;
- gross return;
- each cost component;
- net return and P&L;
- benchmark return;
- no-trade counterfactual;
- implementation shortfall;
- maximum adverse/favorable excursion;
- regime at decision and resolution;
- operational validity;
- independence cluster/episode ID;
- promotable flag with reasons.

### 10.7 `LifecycleDecisionV5`

- prior and next lifecycle states;
- current eligibility;
- eligible-regime evidence;
- independent episode counts;
- trial accounting and multiplicity adjustment;
- health and drift;
- portfolio overlap;
- blockers;
- decision policy version;
- human approval only where declared;
- no live authorization.

## 11. Strategy population design

### 11.1 Initial breadth

Start with 12–20 genuinely different paper arms. This is a practical initial
operating range, not a permanent ceiling.

Candidate families should span mechanisms, not only parameter variations:

- trend/momentum at more than one horizon;
- mean reversion;
- breakout/volatility expansion;
- range/grid with a trend veto;
- Golden Cross strict;
- Golden Cross participate as a separate experiment;
- funding carry where a complete hedge can be modeled;
- basis or cross-venue dislocation where both legs are observable;
- volatility contraction/expansion;
- volume/liquidity shock;
- cross-sectional relative strength;
- event or catalyst reactions where point-in-time event data exists;
- no-trade controls;
- market/benchmark controls.

Do not activate a family until its required data and instrument model exist.
That is a readiness rule, not an edge gate.

### 11.2 Paper information budgets

Every `paper_discovery` experiment receives:

- small maximum notional;
- maximum concurrent positions;
- maximum daily loss;
- maximum number of new intents per day;
- maximum total information spend;
- a defined observation horizon;
- control allocation.

Budgets are comparable but may differ by instrument risk and opportunity
frequency.

### 11.3 Continuous intake

The population should not wait for the current cohort to finish.

New ideas can be:

- owner-supplied;
- deterministic grammar variants;
- research-agent proposals;
- postmortem-derived challengers;
- new mechanism families after review.

An agent may propose a spec. Deterministic code:

- validates it;
- charges its declared trials;
- freezes it;
- assigns its budget;
- records its lineage.

### 11.4 No in-place self-modification

Active versions are immutable.

An agent can:

- summarize evidence;
- identify missing data;
- propose a new version;
- propose a different family;
- explain anomalies;
- draft a postmortem.

An agent cannot:

- edit an active rule;
- change thresholds after seeing an outcome;
- alter a fill;
- reconcile an order;
- promote itself;
- increase its risk;
- unlock live execution.

## 12. Regime and lifecycle operation

### 12.1 Regime model

Use a small predeclared set of interpretable features:

- trend direction and strength;
- realized volatility level/change;
- liquidity/spread/depth;
- cross-asset correlation;
- market dispersion;
- funding/basis;
- event state.

Avoid unconstrained high-dimensional regime mining.

### 12.2 Soft eligibility

Regime output should usually be a weight, not a binary oracle.

Use:

- hysteresis;
- minimum dwell time;
- predeclared thresholds;
- shadow observations while dormant;
- probationary re-entry;
- state transition logs.

### 12.3 Two clocks

Operational clock:

- is the runtime alive?
- is data fresh?
- are intents resolving?
- is reconciliation current?

Economic clock:

- how many independent eligible episodes have resolved?
- which regimes were covered?
- what is net outcome after costs?
- is the control comparison stable?

An experiment can be operationally healthy and economically unresolved.

### 12.4 Trial accounting

Track:

- every tested parameter combination;
- same-family variants;
- discarded hypotheses;
- optimization attempts;
- overlapping time/symbol episodes;
- shared market-factor clusters.

Use independent episode/block counts, not raw trade count alone. Apply
multiple-testing corrections such as DSR where appropriate. Never describe
hundreds of highly overlapping trades as hundreds of independent trials.

## 13. Portfolio and risk design

The portfolio layer has final paper-order veto.

### 13.1 Reservations

Before submission:

- reserve symbol and account exposure;
- include same-cycle pending orders;
- enforce idempotency;
- release or convert the reservation on terminal order events.

### 13.2 Limits

At minimum:

- per-lot loss;
- per-experiment exposure and daily loss;
- per-family exposure;
- per-symbol exposure;
- gross and net exposure;
- leverage and margin;
- factor/beta concentration;
- correlation cluster exposure;
- liquidity participation;
- venue/instrument caps;
- aggregate daily loss;
- unresolved-order cap.

### 13.3 Exit priority

Risk-reducing orders:

- bypass entry margin checks;
- preserve ownership and size checks;
- receive priority over new entries;
- remain visible until filled, canceled, expired, or reconciled;
- never lose protective state because another symbol exited.

## 14. Paper execution and reconciliation

### 14.1 First v5 fill model

The minimum credible model should include:

- bid/ask or conservative spread;
- fees;
- depth/participation;
- latency or next-observation timing;
- partial fills;
- rejection/cancellation/expiry;
- funding/borrow for relevant instruments;
- stale price blocking;
- no caller-authored fills;
- explicit expected versus realized fill.

Use the tested discovery order simulator as a source of primitives, adapted to
the canonical product ledger.

### 14.2 Reconciliation

At startup and continuously:

1. load nonterminal intents;
2. inspect all durable order events;
3. compare reservations, fills, lots, balances, and audit events;
4. repair only from authoritative events;
5. mark ambiguity `unresolved`;
6. block new risk when accounting truth is uncertain;
7. keep risk-reducing exits available;
8. emit a reconciliation report and health metric.

Do not fabricate stale fills to make the ledger complete.

### 14.3 Transaction boundary

An accepted fill must atomically commit:

- order event;
- fill;
- position lot update;
- cash/margin update;
- fee/cost update;
- experiment outcome linkage;
- audit event;
- risk reservation update.

Persistent Postgres should become the canonical hosted store before v5 is
declared production-ready.

## 15. Research Fleet UI

The owner does not want another panel.

The existing list should show v5 rows with:

- strategy/family label;
- experiment version;
- lifecycle badge;
- current operating state;
- regime eligibility;
- paper budget and exposure;
- open/resolved/unresolved counts;
- net paper P&L after costs;
- independent episode count;
- latest opportunity/order state;
- health/data/reconciliation warning;
- `Paper discovery`, `Paper confirmed`, or `Live locked`.

Golden Cross should appear like every other strategy, for example:

- `Golden Cross · strict · v5`
- `Golden Cross · participate · v5`

The row detail can expand into:

- frozen rules;
- latest observations;
- order/fill lineage;
- regime history;
- controls;
- outcome and cost attribution;
- lifecycle decisions.

Legacy rows remain visible under a `Legacy pre-v5` filter and never blend into
v5 statistics.

## 16. Version and migration policy

### 16.1 Owner requirement

Anything active under v4 or older must be updated to v5.

### 16.2 Correct migration interpretation

Do not rewrite history.

- Historical artifacts retain original versions.
- Add `legacy_pre_v5: true`.
- Exclude them from v5 evidence, promotion, and active routing.
- Active contracts, policies, strategies, features, and order events require
  authority version 5.
- No active alias may silently point to a pre-v5 contract.

### 16.3 Version dimensions

Keep these separate:

- trading authority version: 5;
- schema version: explicit `*.v5`;
- strategy semantic version: per frozen experiment;
- policy version: v5-governed;
- software commit/build;
- external wallet dependency version.

The MetaMask Agent Wallet package version 5.2.1 does not make the trading
runtime v5.

### 16.4 Cutover

1. Freeze a pre-v5 evidence cutoff.
2. Snapshot and checksum existing stores.
3. Mark existing active specs and books legacy.
4. Create v5 experiment specs from reviewed active ideas.
5. Start v5 in shadow-write/compare mode.
6. Reconcile v5 outputs without creating duplicate paper risk.
7. Migrate Golden Cross and one simple spot strategy first.
8. Enable v5 paper intents only after transactional and exit tests pass.
9. Disable old writers.
10. Keep read-only legacy APIs for audit.

## 17. Detailed implementation plan

The work is organized into parallel workstreams with strict release gates.
Population design can proceed while the execution spine is hardened, but no
new implementation may bypass the canonical v5 contracts.

### V5-00: authority, inventory, and cutoff

Goal: make “v5” enforceable.

Change:

- add `server/v5/authority.ts`;
- add `authorityVersion: 5` and schema discriminators;
- inventory all active strategies, policies, feature IDs, cards, agents, and
  stores;
- create legacy adapters that are read-only;
- add one v5 status endpoint;
- replace `MetaEdge V1 Server` startup naming;
- define feature flags for shadow, paper intents, and old-writer shutdown.

Tests:

- active artifact below authority 5 is rejected;
- historical pre-v5 artifact remains readable;
- legacy artifact cannot route;
- status exposes commit, flags, clocks, writer authority, and data freshness.

Acceptance:

- no active artifact below v5;
- no historical record rewritten;
- one operator endpoint states the actual authority.

Rollback:

- disable v5 writer flags; legacy remains read-only.

### V5-01: data provenance and coverage

Goal: give every active strategy reconstructible evidence.

Change:

- return observation objects from price lookup;
- separate display jitter from canonical evidence;
- derive recorder coverage from `UniverseVersionV5`;
- persist broad-feed bars needed by active experiments;
- persist daily settled bars;
- add source, venue, observed, received, and hash fields;
- add data gap and cross-venue policies;
- add coverage/freshness matrices per experiment.

Tests:

- no synthetic jitter enters evidence;
- long-tail price cites the correct source;
- restart reconstructs hourly/daily features;
- missing coverage prevents arming, not runtime health;
- a Tier-1 evaluation cannot request unrecorded features silently.

Acceptance:

- at least 99% of armed opportunity evaluations have all required fresh
  features;
- missing data is visible by family and symbol.

### V5-02: durable intents, events, and audit

Goal: make an order restart-safe before improving strategy breadth.

Change:

- create Postgres-backed v5 tables for experiments, opportunities, intents,
  events, fills, lots, reservations, outcomes, lifecycle, and audit;
- add unique idempotency constraints;
- replace in-memory intent and audit authority;
- make database writes fail closed;
- create append-only event sequencing.

Tests:

- duplicate intent before and after restart is exactly once;
- write failure cannot return success;
- process kill at each commit boundary resolves safely;
- event order cannot be mutated;
- ownership always derives from server/session authority.

Acceptance:

- every paper order has durable lineage;
- zero ambiguous success responses;
- canonical audit survives restart.

### V5-03: position lots and exit-safe risk

Goal: make all risk-reducing actions safe and attributable.

Change:

- implement signed `PositionLotV5`;
- classify open/increase/reduce/close/flip;
- add `reduceOnly`;
- make exit checks position-aware;
- fix multi-symbol cleanup identity;
- inherit experiment identity on all exits;
- normalize `spot | perp` instrument types without `as any`;
- enforce one leverage policy.

Tests:

- a fully invested spot account can exit;
- partial close and over-close behavior;
- short open/reduce/close;
- perp leverage/funding/margin accounting;
- simultaneous GC breaches with one failed exit;
- stop state persists for unresolved exits.

Acceptance:

- no entry balance check blocks a valid risk reduction;
- lot, cash, and P&L reconcile after every fill.

### V5-04: paper broker adapter

Goal: replace instant full price-only fills.

Change:

- adapt tested discovery order primitives;
- implement market/limit/stop lifecycle;
- model spread, fee, depth, participation, latency, partials, rejects, expiry;
- preserve reference and fill prices;
- add unresolved and reconciliation states;
- add no-trade cohorts.

Tests:

- next-observation timing;
- partial fill across observations;
- stale quote rejection;
- limit/stop path conservatism;
- fee/slippage/funding/borrow accounting;
- restart during partial fill;
- no caller-provided canonical fill.

Acceptance:

- every intent reaches a terminal or explicitly unresolved state;
- fill model assumptions are versioned and visible.

### V5-05: `paper_discovery` and strategy adapter

Goal: break the “prove before paper” loop.

Local status: completed and verified; not deployed or forward-tested. See
`docs/decision_records/2026-07-30-v5-batch-5-paper-discovery.md`.

Change:

- add `paper_discovery` as a distinct permission;
- keep `paper_confirmed` promotion gates;
- build a standard strategy adapter;
- let system experiments route without ad hoc system agents;
- create an opportunity observation for every evaluation;
- route Golden Cross strict and participate through separate v5 specs;
- route one simple spot strategy through the same path;
- shut off direct Golden Cross writes after parity.

Minimum admission gates:

- active v5 spec;
- valid instrument;
- required data fresh;
- cost model available;
- paper budget available;
- portfolio reservation approved;
- live lock confirmed.

Tests:

- unproven but valid hypothesis can create a small paper-discovery intent;
- unproven status cannot become paper-confirmed;
- Golden Cross uses the same order ledger as other strategies;
- strict and participate results remain separable;
- no old direct scanner order after cutover.

Acceptance:

- at least two different families run end to end through the same v5 path.

### V5-06: population registry and lifecycle

Goal: operate conditional specialists continuously.

Local status: completed and verified; not deployed or forward-tested. See
`docs/decision_records/2026-07-30-v5-batch-6-population-lifecycle.md`.

Change:

- add population registry;
- implement draft, research-only, discovery, confirmed, dormant, probation,
  reduced, retired, and live-review-locked states;
- separate eligibility from health;
- add shadow observations for dormant strategies;
- add lifecycle hysteresis and dwell time;
- make active versions immutable;
- allow proposals only as new challengers.

Tests:

- one loss does not retire;
- ineligible regime becomes dormant/shadow;
- return of eligibility enters probation;
- repeated eligible-regime failure can retire;
- mutation creates a new version;
- agent cannot promote itself.

Acceptance:

- lifecycle reason and evidence are visible for every experiment.

### V5-07: trial accounting, controls, and outcomes

Goal: know what was actually learned.

Local status: completed and verified; not deployed or forward-tested. See
`docs/decision_records/2026-07-31-v5-batch-7-trial-outcomes.md`.

Change:

- reuse declared-trial and lockbox concepts from discovery;
- add family/asset/episode clusters;
- add no-trade and benchmark controls;
- calculate post-cost outcomes;
- add implementation shortfall and counterfactuals;
- keep independent episode counts;
- apply DSR/multiplicity correction where appropriate.

Tests:

- overlapping trades collapse into declared evidence clusters;
- controls cannot be dropped after seeing outcomes;
- trial count includes failed/discarded variants;
- costs can only reduce evidence;
- operationally invalid outcomes are non-promotable.

Acceptance:

- every resolved outcome is attributable, costed, controlled, and classified
  as promotable or not with explicit reasons.

### V5-08: portfolio allocator

Goal: coordinate many strategies without hiding their attribution.

Local status: completed and verified; not deployed or forward-tested. See
`docs/decision_records/2026-07-31-v5-batch-8-portfolio-allocator.md`.

Change:

- compute aggregate and pending exposure;
- add same-cycle reservations;
- implement symbol/family/factor/regime/liquidity caps;
- allocate information budgets;
- keep strategy P&L separate while sharing one account/book;
- support reductions before new entries.

Tests:

- simultaneous correlated entries respect the shared cap;
- later same-cycle reservation sees earlier pending risk;
- portfolio can veto a valid standalone signal;
- attribution survives netting and shared fills.

Acceptance:

- no strategy can size around the portfolio authority.

### V5-09: Research Fleet integration

Goal: make the operating population visible without a new panel.

Local status: completed and component/API verified; not deployed. See
`docs/decision_records/2026-07-31-v5-batch-9-research-fleet.md`.

Change:

- extend existing Research Fleet rows;
- add v5 version/lifecycle/regime/order/health labels;
- add expandable lineage and outcome detail;
- add a legacy filter;
- keep Golden Cross as a normal labeled row.

Tests:

- all lifecycle states render;
- GC strict/participate labels are distinct;
- unresolved order warning is visible;
- legacy results never merge into v5 metrics;
- responsive layout works without screen-size hiding.

Acceptance:

- the owner can answer “what is trading, why, under which version, in which
  regime, with what state and result?” from the existing list.

### V5-10: first population run

Goal: operate, not merely design, v5.

Local status: A/B implemented; C gate implemented but evidence incomplete; D
isolated burn-in completed with `no_go`. See
`docs/decision_records/2026-07-31-v5-batch-10a-population-contracts.md`,
`docs/decision_records/2026-07-31-v5-batch-10b-continuous-operation.md`,
`docs/decision_records/2026-07-31-v5-batch-10c-resilience-gate.md`, and
`docs/decision_records/2026-07-31-v5-batch-10d-local-burnin.md`. A later
combined resilience packet earned the five restart/fault assurances and left
only portfolio-veto evidence missing; see
`docs/decision_records/2026-07-31-v5-batch-10e-resilience-assurance.md`.
Batch 10F then earned the linked allocator veto and the full isolated local
mechanics acceptance; see
`docs/decision_records/2026-08-01-v5-batch-10f-local-mechanics-acceptance.md`.
Batch 10G-10K then made that boundary operationally visible and durable:
separate truth states, a reproducible acceptance bundle, zero-route
diagnostics, forward checkpoints/incidents, and the integrated Research Fleet
truth strip. These changes do not advance the economic or deployment gate.

Change:

- register 12–20 reviewed, genuinely different arms;
- assign small paper budgets;
- predeclare regimes, controls, costs, and falsifiers;
- run continuous opportunity, execution, reconciliation, and outcome clocks;
- admit new arms while existing arms resolve.

Proof:

- 10–20 consecutive clean runtime cycles;
- restart during intent, partial fill, and outcome resolution;
- stale-data and write-failure injection;
- at least one dormant-to-probation transition;
- at least one portfolio veto;
- at least one control/no-trade outcome;
- no unresolved order beyond its declared SLA without an incident;
- production UI matches the ledger;
- live remains locked.

Acceptance:

- multiple families are producing fresh, comparable v5 paper evidence;
- no old writer is creating active trades.

### V5-11: external adapter, only if needed

Goal: add realism without replacing the runtime.

Possible later work:

- one paper broker/testnet adapter;
- immutable external references;
- startup and continuous reconciliation;
- local simulator versus external-paper calibration.

Gate:

- local v5 vertical is stable first;
- no credential or live-money expansion;
- adapter cannot become a second strategy/evidence authority.

## 18. Recommended execution order

### Release gate A: accounting safety

Complete before enabling any new v5 paper intent:

- V5-00 authority;
- V5-02 durable intents/events;
- V5-03 exit-safe lots/risk;
- fail-closed writes;
- multi-symbol cleanup fix.

### Release gate B: evidence integrity

Complete before calling outcomes comparable:

- V5-01 provenance/coverage;
- V5-04 paper broker;
- V5-07 outcome/trial accounting.

### Release gate C: population operation

Then:

- V5-05 paper discovery;
- V5-06 lifecycle;
- V5-08 allocator;
- V5-09 UI;
- V5-10 population run.

Population specs and adapters can be prepared in parallel with gates A and B.
They cannot place canonical orders until gate A passes.

## 19. Go/no-go proof matrix

| Claim | Required evidence |
|---|---|
| “v5 is implemented” | v5 contracts, migrations, tests, no active pre-v5 authority |
| “v5 is deployed” | production commit and status endpoint |
| “v5 is operational” | fresh clocks, opportunities, intents, outcomes, reconciliation |
| “strategies run in parallel” | concurrent active experiment versions and shared risk |
| “paper fills are modeled” | versioned fill assumptions and order-event evidence |
| “system learns” | lifecycle decisions from resolved controlled outcomes |
| “regime-aware” | predeclared eligibility, shadow/dormant/probation transitions |
| “self-improving” | new frozen challengers from evidence, never in-place mutation |
| “profitable” | not claimable from current evidence |
| “live-ready” | separate owner, legal, operational, broker, and risk review; still locked |

## 20. Risks and safeguards

### Over-experimentation

Risk: 100 arms become 100 correlated variants.

Safeguard: mechanism-family taxonomy, declared trials, clustering, budget
ceilings, and independent episode accounting.

### Regime overfitting

Risk: a flexible regime model explains every loss after the fact.

Safeguard: low-dimensional predeclared features, hysteresis, dwell time, frozen
versions, and controls.

### Simulator confidence

Risk: paper fills look precise but are only assumptions.

Safeguard: versioned costs, conservative fills, cohorts, external calibration,
and separate operational/economic labels.

### Parallel-runtime drift

Risk: v3 discovery and product trades continue as separate authorities.

Safeguard: v5 adapters reuse components but only one canonical ledger writes.

### Legacy contamination

Risk: large old trade counts dominate v5 metrics.

Safeguard: immutable cutoff, legacy label, excluded evidence, separate views.

### Agent authority creep

Risk: an agent learns to change risk or promote itself.

Safeguard: deterministic gates, immutable versions, least privilege, explicit
human gates, live lock.

## 21. Decisions still requiring owner approval

The architecture does not need answers to these before V5-00 through V5-04:

1. Which 12–20 initial strategy arms should receive the first discovery
   budgets?
2. Which markets are in the initial authority: crypto spot only, or spot plus
   modeled perps?
3. What total paper NAV and per-experiment information budget should the first
   population use?
4. Should hosted Postgres be introduced in the first safety release or as the
   immediate next release behind a temporary transactional local store?
5. Which strategy families need owner review before deterministic proposal
   generation can add variants?

Recommended defaults:

- crypto spot first, then perps after signed lots and funding are proved;
- 12–20 arms;
- small equal discovery budgets adjusted only for instrument risk;
- Postgres in the first canonical v5 persistence release;
- Golden Cross strict and participate remain separate, non-privileged seeds.

## 22. Final answer

MetaEdge does not need another trading framework or one supposedly perfect
strategy. It needs to connect the strongest machinery already in the repo to
one durable product paper ledger.

The decisive change is:

> Paper execution becomes a bounded method of discovery, while promotion
> remains a high evidence bar.

That lets the system trade more ideas without pretending they are proven.

The immediate engineering priority is not to choose the winner. It is to make
every paper observation trustworthy:

1. v5 authority;
2. durable intent/event/lot accounting;
3. exit-safe risk;
4. correct data provenance and coverage;
5. a realistic versioned paper broker;
6. strategy adapters and `paper_discovery`;
7. population lifecycle, trial accounting, portfolio risk, and existing-list
   visibility.

Once those gates are met, the proper working v5 is not a document or a set of
passing tests. It is a running population of diverse frozen strategies,
producing fresh, reconciled, costed, regime-aware, controlled paper evidence
through one shared system—with live execution still locked.
