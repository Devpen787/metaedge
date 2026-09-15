# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Canonical relaunch workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base branch: `codex/metaedge-v5-paper-checkpoint`
- Base SHA: `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **External archaeology complete (tranche 1) / canonical journey definition in progress**
- Implementation: **NOT AUTHORIZED**
- Real trading: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Why this branch exists

The previous MetaEdge accumulated a broad consumer UI, agent tooling, social/arena features, multiple research runtimes, multiple state authorities, and partially wired live execution before product journeys/domain boundaries were sufficiently stable.

The relaunch does not assume the existing implementation is the product. The old system is retained as evidence and a source of reusable parts.

## Working product thesis

MetaEdge should help a user and their agents:

1. discover possible edges;
2. understand why they may exist;
3. test through shadowing, backtests, simulation and paper activity;
4. act with bounded exposure before certainty is available;
5. continuously manage positions as evidence changes;
6. learn from both actions and missed opportunities;
7. scale only when evidence and risk policy justify it;
8. eventually move approved strategy logic into a separately authorized real-execution path.

## Working V1 boundary

Candidate V1 is **paper-first**:

- discover markets / wallets / traders / strategies / agents;
- investigate and understand sources;
- follow sources;
- create or copy strategies;
- backtest where appropriate;
- shadow sources;
- paper trade / paper copy;
- manage positions dynamically;
- run bounded autonomous Paper Agents;
- review performance, execution assumptions, mistakes and missed opportunities.

Not currently authorized for V1 implementation:

- unrestricted autonomous real execution;
- blind live copy trading;
- automatic promotion from paper to real;
- real-money pooling/vault behavior;
- product behavior that depends on a single model vendor.

## Agreed working principles

- Do not use one scalar confidence threshold as the permission to trade.
- Use evidence profiles plus hard safety checks and bounded position sizing.
- Fast-moving opportunities need a fast path; slower systematic ideas may use deeper research.
- Risk limits exposure; it does not decide whether a thesis is intellectually convincing.
- Strategies/observation loops emit views/desired exposures; portfolio coordination resolves conflicts.
- No-trade is a decision with measurable opportunity cost.
- Copying can target wallets, traders, strategies, agents, portfolios, cohorts or signal providers.
- Copy sizing is transformed by the user's own policy; source leverage/notional is never copied blindly.
- Paper and real share strategy/evidence concepts but use different intent, authority, execution and reconciliation state.
- Human psychology is a legitimate evidence family.
- Agent autonomy increases by maturity level rather than one Autopilot switch.
- An unattended Paper Agent receives its authority at session launch; it does not wait for per-tick human confirmation inside that envelope.

## External archaeology — tranche 1 conclusion

Reviewed mature frameworks and current agent/copy projects support the relaunch direction:

- LEAN strongly supports view → portfolio target → risk → execution separation.
- Hummingbot V2 supports long-running controllers + finite executors and multiple controllers.
- Hummingbot Condor independently encountered an unattended-agent approval paralysis problem and now separates launch authorization from per-tick approval.
- Freqtrade validates continuous position adjustment while warning against loose repeated-loop re-entry.
- NautilusTrader provides a strong event-driven execution/reconciliation model and simulation/live parity reference.
- Hyperliquid copy-agent implementations support source state → follower target exposure → risk caps → delta execution → reconciliation.
- Colosseum projects add useful patterns for typed multi-agent handoffs, attention velocity, source reputation and execution evidence.

See `docs/07-research/`.

## Detailed journey progress

Detailed drafts now exist for:

- J02 Discover
- J03 Investigate Source
- J04 Follow Source
- J07 Shadow
- J09 Paper Trade
- J10 Paper Copy
- J11 Manage Position
- J12 Review and Learn
- J14 Paper Agent Operation

Remaining core drafts:

- J01 Onboarding
- J05 Create/Copy Strategy
- J06 Backtest
- J08 Paper Portfolio / Risk Policy
- J13 Improve/Pause/Retire

## Immediate work

1. Human review of research + detailed journey tranche 1.
2. Draft remaining V1 journeys.
3. Freeze Product Constitution / product boundary after journey feedback.
4. Derive domain model and state machines from approved journeys.
5. Define evidence taxonomy, portfolio aggregation and source-reputation contracts.
6. Perform MetaMask current-capability/authority research before future Real contracts are frozen.
7. Only then produce clean implementation/migration plan.

## Open product decisions

- Exact V1 primary persona(s).
- Whether V1 is spot-only or includes paper perps.
- Which discovery surfaces ship first: markets, wallets, traders, strategies, agents.
- Whether Arena belongs in V1 or Phase 2.
- Exact exploration budget / risk-unit defaults.
- Exact evidence taxonomy without recreating a hidden scalar confidence gate.
- Portfolio view aggregation method.
- Source reputation / wallet-trader evaluation methodology.
- Canonical market, flow, behavioral and on-chain providers.
- Future MetaMask authority primitive(s) for bounded autonomous execution.

## Historical truth

Old `main`, `claude/backend-buildout`, V3 flywheel, V5 research, `.agentMemory`, and the separate `meta-edge` repository remain historical/reference sources. They are not automatically authoritative for the relaunch.