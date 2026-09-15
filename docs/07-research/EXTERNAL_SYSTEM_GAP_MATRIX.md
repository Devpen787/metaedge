# External System Gap Matrix

Status: **Research tranche 1 complete — architectural conclusions still require product review**

Updated: 2026-09-15

## Purpose

MetaEdge should not rediscover every trading, execution, copy-trading, or agent-architecture problem from first principles. This workstream reviews mature trading frameworks and current agent projects to identify patterns worth adapting, failure modes to avoid, and areas where MetaEdge still needs original work.

Research informs product decisions. It does not automatically become product authority.

## Evidence policy

Findings below distinguish between:

- **REPO VERIFIED** — supported by inspected repository code/docs;
- **OFFICIAL DOCS** — supported by the project's current official documentation;
- **PROJECT CLAIM** — stated by a hackathon/project author but not independently validated here;
- **METAEDGE INFERENCE** — our conclusion from the evidence.

## Highest-priority question

> How do systems remain decisive under uncertainty without becoming reckless — especially when evidence is incomplete but a market is already moving?

### Current answer from tranche 1

No mature system provides a magic answer in the form of one scalar confidence threshold. The most reusable pattern is architectural:

1. keep **opportunity/signal generation** separate from execution mechanics;
2. express desired state as **positions / portfolio targets / executor actions** rather than one permanent BUY/SELL verdict;
3. allow open positions to be **adjusted continuously** as evidence changes;
4. enforce deterministic **risk envelopes** outside the reasoning layer;
5. keep execution and reconciliation as dedicated stateful components;
6. allow many strategies/controllers to run in parallel while preserving ownership and state isolation.

For MetaEdge this supports progressive participation: weak-but-valid evidence can justify a small scout exposure, with later evidence scaling the target up or down. Hard safety/integrity failures remain true blockers.

## System comparison

| System | Maturity / evidence | Strongest reusable pattern | Important limitation / warning | MetaEdge disposition |
|---|---|---|---|---|
| **Hummingbot V2** | Mature open-source trading framework; repo + official docs | Long-running Controllers consume market data and emit ExecutorActions; finite Executors own order lifecycle; multiple controllers can run simultaneously | Designed as trading infrastructure, not source-intelligence or portfolio-reasoning OS | **ADAPT AS CORE PATTERN** |
| **Hummingbot Condor** | Active open-source agent layer over Hummingbot; repo verified | Splits deterministic mechanics from LLM reasoning; agents act through executors; per-agent isolation; journals/snapshots; dry-run; runtime risk permission checks | Base prompt still says “when in doubt, hold,” which can create conservative bias. Tick architecture can also become reactive rather than truly event-driven | **HIGH-PRIORITY STUDY / ADAPT SELECTIVELY** |
| **QuantConnect LEAN** | Long-running mature framework; repo + official docs | Universe → Alpha → Portfolio Construction → Risk → Execution; Alpha produces views, PortfolioTarget expresses desired holdings, risk adjusts targets before execution | Insight includes a `Confidence` field; do not copy confidence as permission gate. Framework docs acknowledge some strategies need hybrid coupling | **ADAPT TARGET-EXPOSURE SEPARATION** |
| **Freqtrade** | Mature crypto trading framework; repo + official docs | `adjust_trade_position()` supports repeated scaling in/out; open trades are continuously managed | Loose adjustment logic can repeatedly re-enter every loop; live callbacks can run far more often than backtest, creating parity gaps | **ADAPT CONTINUOUS POSITION MANAGEMENT; AVOID LOOSE LOOPING** |
| **NautilusTrader** | Production-grade event-driven engine; repo + official docs | DataEngine, RiskEngine, ExecutionEngine, Portfolio, Cache; execution events and reconciliation are first-class; same strategy code can run simulation/live | More infrastructure-heavy than V1 needs; strategy can still submit orders directly | **ADAPT EVENT/EXECUTION/RECONCILIATION MODEL** |
| **Jesse** | Mature crypto framework; repo verified | Strategy lifecycle and position callbacks; multi-route coordination; current repo exposes MCP resources for AI-assisted research | Cross-route shared state can become coupling if used as global authority | **INVESTIGATE FOR UX/STRATEGY WORKFLOW** |
| **VeighNa / vn.py** | Mature multi-market platform; repo verified | Modular gateways/apps; paper account; portfolio strategy; algorithmic execution; research/backtest/live modules | Broad institutional framework; not optimized around agent authority or copy-source reasoning | **REFERENCE FOR MODULAR VENUE/APP BOUNDARIES** |
| **Gajesh2007/copytrading-agent** | Small open-source Hyperliquid implementation; repo verified | Leader fills → target exposure per market; follower sizing via copy ratio; leverage/notional/slippage caps; periodic reconciliation against clearinghouse state | Uses follower private key; repo states no automated tests; narrow one-leader execution model | **ADAPT COPY TRANSFORMATION + RECONCILIATION; REJECT KEY MODEL** |
| **AEGIS (Colosseum)** | Public hackathon forum evidence | Analyst → Strategist → Risk/Sentinel → Executor; composable Intel Packets | Early project; architectural claims not production proof | **ADAPT SPECIALIZED-AGENT BOUNDARIES** |
| **Attention Velocity (Colosseum)** | Tiny repo + public forum; MVP | Fast-path discovery from volume, transactions, acceleration, price; intended social velocity overlay | Social portion was still in progress; ranking score alone does not prove tradable edge | **ADAPT AS FAST-DISCOVERY INPUT, NOT TRADE AUTHORITY** |
| **AgentAlpha (Colosseum)** | Repo + deployed devnet claims | Commit signal before outcome, then reveal and build verifiable source reputation; prevents hindsight/backdating | Signal schema still carries scalar confidence; outcome oracle/reputation quality needs deeper review | **ADAPT SOURCE PROVENANCE / REPUTATION** |
| **SlotScribe (Colosseum)** | Repo verified | Execution “flight recorder”: canonicalized trace hash anchored on-chain; integrity can be verified later | Explicitly verifies integrity, not truth of market inputs or quality of reasoning | **ADAPT EVIDENCE RECEIPT CONCEPT** |
| **AgentTrace (Colosseum)** | Public project description | Shared traces + outcomes + reward/reuse layer for agents | Project claims require independent technical review; on-chain trace economics may not fit MetaEdge | **INVESTIGATE LEARNING/EVIDENCE PORTABILITY** |
| **Syra (Colosseum)** | Public forum evidence | Research/analysis coverage is broader than execution coverage; on-chain + technical + narrative context; separate swap execution surface | Natural-language execution can collapse analysis and authority if boundaries are weak | **ADAPT ANALYSIS/EXECUTION COVERAGE SPLIT** |
| **AlphaVault (Colosseum)** | Public forum evidence | Exposes trading infrastructure as an MCP execution service, hiding venue plumbing from strategy agents | Custody/authority/trust model is external and not sufficient for MetaEdge self-custody goals | **REFERENCE FOR EXECUTION ADAPTERS ONLY** |

## Detailed comparison by MetaEdge concern

### 1. Decisiveness under uncertainty

**Hummingbot Condor — REPO VERIFIED**

Condor explicitly separates deterministic trading mechanics from LLM reasoning. Its agent framework says LLMs decide what to do next while executors own the mechanical order lifecycle. More importantly, Condor contains an explicit unattended authorization block because a prior house rule caused an agent to keep holding valid in-limit trades while waiting for human confirmation that would never arrive during an autonomous tick.

This is directly relevant to MetaEdge's historical paralysis problem.

However, Condor's base live prompt also says “Be conservative. When in doubt, hold and journal why.” MetaEdge should **not** inherit that blanket heuristic. Our equivalent rule should be:

> When evidence is uncertain but the opportunity is valid and risk capacity exists, prefer the smallest useful bounded experiment over an unexamined default hold.

A hold remains valid when the portfolio/evidence state actually supports it.

**LEAN — OFFICIAL DOCS + REPO VERIFIED**

LEAN does not require each Alpha to place an order. Alphas emit Insights; Portfolio Construction converts them into PortfolioTargets; Risk can adjust those targets; Execution tries to reach the targets. This provides a clean place to resize rather than re-litigate whether the signal deserves existence.

**Freqtrade — OFFICIAL DOCS + REPO VERIFIED**

Freqtrade's position-adjustment callback shows that trading need not be a one-shot entry. A strategy can increase or decrease an open position repeatedly as conditions change. The docs warn that “loose logic” can fire on every loop and overtrade, so MetaEdge needs change detection, cooldown/dwell rules, idempotency, and portfolio-level limits.

### 2. Parallel loops and asynchronous behavior

**Hummingbot V2** supports multiple Controllers in one running bot. Controllers are long-running; Executors are finite.

**Condor** runs one TickEngine per agent with isolated journals, state and controller ownership. Useful pattern: parallel reasoning seats should own their own working state but should not own the account globally.

**NautilusTrader** provides the strongest event-driven reference in this tranche. Market data, execution, positions and account changes are events routed through a message bus; execution reconciliation is a first-class responsibility of the ExecutionEngine.

**MetaEdge inference:** use event-driven inputs where possible, plus clocks for periodic research/health. Do not recreate the historical design where many unrelated interval loops independently mutate shared state.

### 3. Position targets and portfolio coordination

LEAN gives the clearest mature example of a view becoming a PortfolioTarget before execution.

For MetaEdge, the analogous contract should be richer than a share quantity:

- source/strategy id;
- instrument;
- desired signed exposure;
- horizon;
- evidence profile;
- invalidation/thesis state;
- urgency;
- source lineage;
- whether the change is exploratory, normal, or reduction-only.

The portfolio authority then combines simultaneous views and existing exposure into one desired portfolio state.

### 4. Continuous risk management

Mature systems consistently distinguish risk from alpha/strategy logic:

- LEAN Risk Management modifies PortfolioTargets;
- Nautilus RiskEngine validates order/balance/notional/trading-state constraints;
- Condor intercepts trading tool calls through a runtime permission/risk callback;
- copytrading-agent applies follower-specific leverage/notional/slippage caps.

This supports MetaEdge's law: **risk bounds action; risk does not own the thesis**.

### 5. Paper → real parity

**NautilusTrader** is the strongest reference: its docs explicitly target the same strategy source code across backtest and live, with common execution semantics/time model.

**Hummingbot** supports paper connectors and live connectors while keeping strategy/controller concepts reusable.

**Freqtrade** is a useful warning: live callbacks may run multiple times inside one candle while backtest callbacks may run once per candle, so paper/backtest/live parity must be measured rather than assumed.

MetaEdge should keep the same strategy/source view logic across modes while maintaining separate paper and real intents, execution state, authority, fills and reconciliation.

### 6. Copy transformation

`Gajesh2007/copytrading-agent` is the most directly relevant open-source implementation reviewed so far. It:

- listens to leader fills;
- derives target exposure per market;
- applies copy ratio and follower risk caps;
- sends follower IOC orders;
- periodically reconciles against authoritative venue state.

This strongly supports MetaEdge's CopySource model. The follower should reproduce **bounded target exposure**, not raw source orders.

We should not adopt its key custody approach or lack of tests.

### 7. Source trust and provenance

AgentAlpha's commit-reveal model is useful for providers whose signals cannot be independently observed on-chain: commit before the move, reveal later, keep the complete record rather than cherry-picked wins.

SlotScribe demonstrates a different trust primitive: execution logs can be cryptographically anchored so the story cannot be rewritten later. It correctly states that this proves integrity, not truth.

For MetaEdge, source reputation should combine:

- observation provenance;
- completeness/coverage;
- timestamp integrity;
- verified historical outcomes;
- risk-adjusted behavior;
- regime/context;
- sample independence;
- source-specific blind spots.

### 8. Fast-path opportunity discovery

Attention Velocity is small but conceptually relevant: it ranks current Solana pools using 1h volume, transactions, acceleration and price movement, with social velocity planned.

MetaEdge should treat such detectors as **attention/opportunity triggers**, not a complete strategy. Their job is to say “look now.” A fast-path agent can then form a bounded view using flow, liquidity, catalyst, wallet and positioning context.

### 9. Explainability and agent audit

Condor journals every tick/snapshot and preserves learnings. SlotScribe anchors execution-trace integrity. AgentAlpha preserves pre-outcome signal commitments.

MetaEdge should combine these ideas without exposing private chain-of-thought as product truth:

- durable decision facts;
- evidence references;
- proposal/target/risk transformations;
- tool/action records;
- final execution/reconciliation evidence;
- post-outcome attribution.

## Gaps none of the reviewed systems fully solve for MetaEdge

1. **Measuring bad inaction.** Mature frameworks measure trades well; none reviewed here makes missed-opportunity counterfactuals a central risk against paralysis.
2. **Unified CopySource model.** Wallet, trader, strategy, agent, cohort and signal-provider copying are usually separate products.
3. **Evidence-profile sizing without hidden scalar confidence.** Most systems either use fixed rules, strategy callbacks, or confidence-like values; MetaEdge needs explicit multi-dimensional evidence plus progressive sizing.
4. **Portfolio coordination across human ideas, copied sources, deterministic strategies and LLM agents simultaneously.**
5. **Progressive authority maturity from observer → paper → supervised real → bounded autonomy** with MetaMask as later execution boundary.
6. **Psychology/attention as one evidence family while operator emotion remains outside execution authority.**
7. **Paper and real running side-by-side as an ongoing calibration experiment**, not simply a deployment switch.

## Research-supported recommendations for journey design

These are not implementation approval.

- Discovery should be able to surface fast movers before complete research exists.
- Investigation must distinguish observed, inferred and unknown source context.
- Follow must never imply exposure.
- Shadow should use the user's own transformation/risk policy so it previews what copying would actually mean.
- Paper Trade and Paper Copy should begin from desired exposure, not direct order construction.
- Position Management must be a continuous journey, not an afterthought to entry.
- Review must grade both actions and eligible skipped opportunities.
- Paper Agent operation needs a bounded unattended authorization envelope; it must not wait for per-tick human confirmation after the human has launched the session.

## Next research tranche

- MetaMask Agent Wallet / Guard / delegation capability ledger using current official sources.
- Hyperliquid official execution semantics and more copy-trading implementations.
- Manipulation-resistant copy/source selection research.
- Hummingbot Condor risk implementation and production lessons in more depth.
- Agent outcome/reputation systems beyond Colosseum.
- Property/stateful testing patterns from production-grade trading engines.
