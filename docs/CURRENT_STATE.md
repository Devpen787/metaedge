# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Canonical relaunch workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base branch: `codex/metaedge-v5-paper-checkpoint`
- Base SHA: `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **Canonical V1 journeys drafted / current MetaMask platform research complete (tranche 1)**
- Implementation: **NOT AUTHORIZED**
- Real trading: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Working product thesis

MetaEdge should help a user and their agents discover possible edges, understand why they may exist, test them through backtest/shadow/paper activity, act with bounded exposure before certainty is available, manage positions continuously, learn from both actions and missed opportunities, and eventually move approved strategy logic into a separately authorized real-execution path.

## Working V1 boundary

Candidate V1 is **paper-first**:

- onboarding into an app-owned identity and paper workspace;
- discover markets / wallets / traders / strategies / agents;
- investigate and understand sources;
- follow sources;
- create or copy strategies;
- backtest where appropriate;
- shadow sources;
- create a paper portfolio with explicit account-level policy;
- paper trade / paper copy;
- manage positions dynamically;
- run bounded autonomous Paper Agents;
- review performance, execution assumptions, mistakes and missed opportunities;
- improve, pause or retire strategy/source policies without rewriting history.

Not currently authorized for implementation:

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

- LEAN supports view → portfolio target → risk → execution separation.
- Hummingbot V2 supports long-running controllers + finite executors and multiple controllers.
- Hummingbot Condor independently encountered an unattended-agent approval paralysis problem and now separates launch authorization from per-tick approval.
- Freqtrade validates continuous position adjustment while warning against loose repeated-loop re-entry.
- NautilusTrader provides a strong event-driven execution/reconciliation model and simulation/live parity reference.
- Hyperliquid copy-agent implementations support source state → follower target exposure → policy caps → delta execution → reconciliation.
- Colosseum projects add useful patterns for typed multi-agent handoffs, attention velocity, source reputation and execution evidence.

## Current MetaMask research — tranche 1 conclusion

Official Agent Wallet, Smart Accounts Kit, Agent Skills, and native plugin documentation were re-reviewed against the relaunch model.

Key current facts:

- Agent Wallet CLI is now `@metamask/agent-wallet`; the historical MetaEdge `@metamask/agentic-cli@5.2.1` integration is stale.
- Server-wallet operations are asynchronous and may return `pollingId` or pause in `AWAITING_MFA`; pending requests must be watched/reconciled rather than blindly retried.
- Guard Mode adds meaningful wallet-level controls, but it is defense-in-depth rather than MetaEdge portfolio/trading risk.
- For Hyperliquid perps, MetaMask policy applies to the EVM funding/deposit leg; open/modify/close position operations occur at the venue and are not re-checked by the wallet outflow/allowlist/2FA policy based on leveraged position size.
- MetaEdge must therefore own perps leverage, notional, loss, protection, concentration and account-level exposure policy.
- Agent Wallet native CLI plugins now exist as a beta, in-process/unsandboxed extension system with command-level `wallet-read` / `wallet-submit` capabilities.
- AI-host Agent Skills/plugins (Claude/Codex/Cursor/etc.) are a different layer from Agent Wallet native `mm plugins` and must not be conflated.
- MetaMask Smart Accounts Kit 2.0.0 exposes ERC-7715 Advanced Permissions and ERC-7710 delegation as a second potential bounded-authority substrate.
- MetaEdge should define a vendor-neutral `ExecutionGrant` / real-execution contract above any MetaMask-specific adapter.

See:

- `docs/06-platform/METAMASK_CAPABILITY_LEDGER.md`
- `docs/06-platform/METAMASK_AUTHORITY_OPTIONS.md`
- `docs/06-platform/METAMASK_PLUGINS_AND_SKILLS.md`

## Journey progress

Detailed drafts now exist for the full candidate V1 journey set:

- J01 Onboarding
- J02 Discover
- J03 Investigate Source
- J04 Follow Source
- J05 Create/Copy Strategy
- J06 Backtest
- J07 Shadow
- J08 Paper Portfolio
- J09 Paper Trade
- J10 Paper Copy
- J11 Manage Position
- J12 Review and Learn
- J13 Improve/Pause/Retire
- J14 Paper Agent Operation

## Immediate work

1. Human review of the product-foundation + journey set.
2. Freeze Product Constitution and V1 Product Contract after feedback.
3. Derive the canonical domain model and state machines from journeys.
4. Define the Evidence Profile taxonomy without recreating a hidden scalar confidence gate.
5. Define portfolio view aggregation options and simulation plan.
6. Define source-reputation dimensions for wallets/traders/strategies/agents.
7. Translate the MetaMask findings into future Real authority/reconciliation state machines without implementing them yet.
8. Only then produce the clean implementation/migration plan.

## Open product/design decisions

- Exact V1 primary persona(s).
- Whether V1 is spot-only or includes paper perps.
- Which discovery surfaces ship first: markets, wallets, traders, strategies, agents.
- Whether Arena belongs in V1 or Phase 2.
- Exact exploration budget / risk-unit defaults.
- Exact Evidence Profile taxonomy.
- Portfolio view aggregation method.
- Source reputation / wallet-trader evaluation methodology.
- Canonical market, flow, behavioral and on-chain providers.
- Future real authority substrate: Agent Wallet server-wallet, Smart Account/Advanced Permissions, direct delegation, or multiple adapters.
- Whether a first-party MetaEdge Agent Wallet native plugin materially improves the future real execution path.

## Historical truth

Old `main`, `claude/backend-buildout`, V3 flywheel, V5 research, `.agentMemory`, and the separate `meta-edge` repository remain historical/reference sources. They are not automatically authoritative for the relaunch.
