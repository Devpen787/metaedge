# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Canonical relaunch workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base branch: `codex/metaedge-v5-paper-checkpoint`
- Base SHA: `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **Product foundation / documentation distillation**
- Implementation: **NOT AUTHORIZED**
- Real trading: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Why this branch exists

The previous MetaEdge accumulated a broad consumer UI, agent tooling, social/arena features, multiple research runtimes, multiple state authorities, and partially wired live execution before the product journeys and domain boundaries were sufficiently stable.

The relaunch does not assume the existing implementation is the product. The old system is retained as evidence and a source of reusable parts.

## Working product thesis

MetaEdge should help a user:

1. discover possible edges;
2. understand why they may exist;
3. test them through shadowing, backtests, simulation, and paper activity;
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
- review performance, execution assumptions, mistakes, and missed opportunities.

Not currently authorized for V1 implementation:

- unrestricted autonomous real execution;
- blind live copy trading;
- automatic promotion from paper to real;
- real-money pooling/vault behavior;
- product behavior that depends on a single model vendor.

## Agreed working principles

- Do not use one scalar confidence threshold as the permission to trade.
- Use an evidence profile plus hard safety checks and bounded position sizing.
- Fast-moving opportunities need a fast path; slower systematic ideas may use a deeper research path.
- Risk limits exposure; it does not decide whether a thesis is intellectually convincing.
- Strategies and observation loops emit views/desired exposures; portfolio coordination resolves conflicts.
- No-trade is a decision with measurable opportunity cost.
- Copying can target wallets, traders, strategies, agents, portfolios, cohorts, or signal providers.
- Copy sizing is transformed by the user's own policy; source leverage/notional is never copied blindly.
- Paper and real share strategy/evidence concepts, but use different intent, authority, execution, and reconciliation state.
- Human psychology is a legitimate evidence family.
- Agent autonomy should increase by maturity level rather than a single "autopilot" switch.

## Immediate work

1. Review this first documentation pack.
2. Run external-system archaeology and fill the gap matrix.
3. Freeze the Product Constitution and V1 Product Contract.
4. Define canonical journeys.
5. Derive domain/state/security contracts from those journeys.
6. Only then produce the clean implementation/migration plan.

## Open product decisions

- Exact V1 primary persona(s).
- Whether V1 is spot-only or includes paper perps.
- Which discovery surfaces ship first: markets, wallets, traders, strategies, agents.
- Whether Arena belongs in V1 or Phase 2.
- Exact exploration budget and risk-unit defaults.
- Exact source reputation / wallet-trader evaluation methodology.
- Which market, flow, behavioral, and on-chain data providers become canonical.
- Which MetaMask authority primitive(s) are appropriate for later bounded autonomous execution.

## Historical truth

Old `main`, `claude/backend-buildout`, V3 flywheel, V5 research, `.agentMemory`, and the separate `meta-edge` repository remain historical/reference sources. They are not automatically authoritative for the relaunch.
