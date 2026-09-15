# MetaMask Agent Wallet Capability Ledger

Status: **Current platform research — 2026-09-15**

Purpose: record the current official MetaMask Agent Wallet surface and the implications for MetaEdge. This is platform evidence, not permission to implement real trading.

## Source policy

Prefer current official MetaMask developer docs, official MetaMask repositories, and dated MetaMask developer/security articles. The Agent Wallet surface is changing quickly; implementation must re-verify this ledger before depending on a specific command or permission.

Primary sources reviewed:

- https://docs.metamask.io/agent-wallet/
- https://docs.metamask.io/agent-wallet/quickstart/
- https://docs.metamask.io/agent-wallet/reference/architecture/
- https://docs.metamask.io/agent-wallet/reference/trading-modes/
- https://docs.metamask.io/agent-wallet/reference/outflow-policy/
- https://docs.metamask.io/agent-wallet/reference/commands/
- https://docs.metamask.io/agent-wallet/reference/plugins/
- https://docs.metamask.io/agent-wallet/plugins/
- https://docs.metamask.io/agent-wallet/guides/trade-perpetuals/
- https://metamask.io/news/trade-perps-metamask-agent-wallet
- https://github.com/MetaMask/agent-skills
- https://github.com/MetaMask/agent-wallet-plugin-template
- https://github.com/MetaMask/agent-wallet-plugin-examples
- https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/
- https://docs.metamask.io/smart-accounts-kit/get-started/supported-advanced-permissions/

## Current package / runtime baseline

- CLI package: `@metamask/agent-wallet`.
- Binary: `mm`.
- Node.js requirement: 22.18 or later in current setup docs.
- The package was renamed from the historical `@metamask/agentic-cli` name in CLI v6.
- `mm doctor` is the current readiness command for CLI version, skill compatibility, authentication, and initialization.
- Official agent skills live in `MetaMask/agent-skills`.

**MetaEdge implication:** the old `@metamask/agentic-cli@5.2.1` integration is historical. A future adapter must target the current package and must discover/verify the installed version rather than assume the old command grammar.

## Authentication and wallet identity

Current sign-in methods include:

- Google through browser login;
- email passwordless through browser login;
- MetaMask Mobile QR.

Official setup documentation states that these are separate sign-in methods and may load different server-wallet addresses even when the same email is involved.

**MetaEdge implication:** application identity and wallet identity must remain separate. A MetaEdge account may have zero, one, or several wallet connections. Never use an email/sign-in label as proof that the same Agent Wallet address is active.

## Wallet modes

### Server wallet

- Keys are managed in MetaMask's server-wallet environment/TEE.
- Agent code does not receive the key material.
- Signing and transaction workflows are asynchronous.
- Long-running requests can return a `pollingId` unless `--wait` is used.

### Bring your own wallet (BYOK)

- User supplies a BIP-39 mnemonic locally.
- Current docs recommend environment-variable handling rather than command-line mnemonic exposure.

**MetaEdge implication:** initial real-product design should prefer a wallet abstraction and should not require MetaEdge to ingest seed phrases. BYOK support, if ever exposed, needs a separate security review.

## Server-wallet asynchronous lifecycle

Current official flow can include:

1. submit request;
2. wallet service performs simulation, threat checks, and policy evaluation;
3. request may enter `AWAITING_MFA`;
4. CLI returns a `pollingId` unless waiting synchronously;
5. pending work can be queried via `mm wallet requests list` and `mm wallet requests watch <POLLING_ID>`.

The official `MetaMask/agent-skills` changelog now explicitly teaches agents to detect `AWAITING_MFA`, watch the request, and **not retry while the request is pending**.

**MetaEdge implication:** future real execution requires durable states such as:

- prepared;
- authorized;
- submitted_to_wallet;
- awaiting_mfa;
- pending_wallet;
- broadcast / venue-submitted;
- partial;
- confirmed;
- rejected;
- failed-before-submission;
- unknown;
- reconciled.

A timeout or missing immediate response must never automatically become permission to submit again.

## Security pipeline

Official Agent Wallet documentation currently describes:

- transaction simulation;
- Blockaid threat scanning;
- Smart Transactions / MEV protection where supported;
- Transaction Protection eligibility for qualifying transactions;
- gasless ERC-20 transfer/swap routing using EIP-7702 when native gas is insufficient;
- ERC-7821 atomic approval + trade batching where supported, with sequential fallback otherwise.

**MetaEdge implication:** these are valuable execution-layer protections, but they do not replace MetaEdge domain risk, portfolio controls, source validation, or venue reconciliation.

## Trading modes

Trading modes apply to server-wallet.

### Guard Mode — recommended by MetaMask

Current documented controls:

- threat scanning;
- network allowlist;
- address allowlist;
- token recipient allowlist;
- rolling 24-hour outflow limit;
- 2FA when transactions are malicious/risky, outside policy, or when the outflow limit is raised/exceeded.

### Beast Mode

- keeps threat scanning;
- removes the allowlist/outflow controls;
- malicious/risky transactions can still require human approval.

**MetaEdge implication:** a future production MetaEdge should default to Guard-compatible operation. Beast Mode should never be assumed or silently required by an automated strategy.

## Rolling outflow policy

Current Guard Mode outflow tracking:

- caps value leaving server wallet over a rolling 24-hour window;
- estimates value via transaction simulation;
- includes transfers, swaps, and deposits such as deposits to Uniswap, Polymarket, or Hyperliquid;
- may count successive swaps as separate outflows;
- can be imprecise when operations do not go through the MetaMask backend;
- signatures such as Permit2 are not currently included in outflow calculation.

**MetaEdge implication:** outflow is a funding-level control, not a full trading-risk model. MetaEdge must maintain its own exposure, leverage, loss, concentration, and venue-level policies.

## Current high-level capability surface

Official Agent Wallet documentation currently exposes these areas:

| Area | Current surface | MetaEdge relevance |
| --- | --- | --- |
| Authentication | login, doctor, init, logout | readiness / identity adapter |
| Wallet | address, balances, history, wallet selection | reconciliation/read model |
| Transfers | native/ERC-20 transfer | future controlled execution |
| Raw signing | messages, EIP-712 typed data, EVM tx | security-sensitive; restrict |
| Calldata decode | inspect unfamiliar calldata | useful pre-execution evidence |
| Swaps / bridges | quote, execute, track | future execution adapter |
| Perpetuals | Hyperliquid deposit/open/modify/close/read | strategically relevant; app-level risk required |
| Prediction markets | Polymarket search/quote/trade/redeem | potential future domain |
| Earn | discover/supply/withdraw yield vaults | outside current V1 |
| x402 | pay paywalled HTTP/MCP resources | possible agent data/service economy later |
| Market data | prices/token discovery/chains | useful secondary source, not automatically canonical |
| Plugins | custom native `mm` commands | possible MetaEdge adapter later; beta |

## Perpetuals — critical boundary

Official Sept. 9, 2026 MetaMask guidance is especially important.

Current `mm perps` supports Hyperliquid workflows including:

- list venues/markets;
- deposit and transfer collateral;
- quote;
- open;
- modify;
- close;
- orders/positions/balances;
- HIP-3 DEX scoping/aggregation;
- dry-run and scripted confirmation-skipping on relevant commands;
- explicit slippage caps on entry/exit in the detailed guidance;
- TP/SL through a **separate modify step** after opening.

### Security boundary MetaMask documents

The EVM **deposit** into Hyperliquid is processed through MetaMask wallet controls. The actual Hyperliquid **open / modify / close** actions are venue operations and are not re-checked by Agent Wallet's EVM outflow policy, allowlists, threat scanning, or 2FA based on position size.

Therefore:

> **MetaMask Guard does not constitute a leveraged-position risk engine.**

A small collateral deposit can support a much larger leveraged position. MetaEdge must independently enforce:

- max leverage;
- max position notional;
- max portfolio exposure;
- per-strategy/source budget;
- margin/collateral requirements;
- max slippage;
- stop/exit policy;
- funding-cost awareness;
- liquidation-distance constraints;
- DEX/venue scope;
- account-level aggregate exposure;
- reconciliation across Hyperliquid/HIP-3 DEXs.

### Entry protection gap

MetaMask documents TP/SL attachment as a separate `mm perps modify` action after the open. That means a position can exist briefly without the intended protective orders.

**MetaEdge implication:** future real-perps execution must explicitly model the open→protection gap. Options to evaluate later include reducing initial size, attaching protection immediately and verifying it, or refusing strategies whose required protection cannot be established within a bounded interval.

## Paper / rehearsal options in Agent Wallet

Current perps surface provides quote and `--dry-run` validation. MetaMask's Sept. 2026 guidance says Hyperliquid testnet is not currently a reliable end-to-end rehearsal path through Agent Wallet because its testnet funding path differs; current recommendation is quote + dry-run against live market inputs.

**MetaEdge implication:** this reinforces keeping MetaEdge's own realistic paper broker. Agent Wallet dry-run is useful as an execution-adapter preflight, not a replacement for long-running paper trading.

## Current plugin system

Agent Wallet's native CLI plugin system is **beta and off by default**.

A plugin is an npm package that adds native `mm` commands. Current capability model:

- `wallet-read` — balances/prices/tokens/authenticated public EVM reads and other curated read services;
- `wallet-submit` — transaction/message/typed-data execution through MetaMask policy;
- `network-manage` — reserved;
- `mnemonic-read` and `config-write` — reserved/rejected.

Current docs state:

- plugins run **in-process and unsandboxed**;
- users approve commands/data/capabilities at install time;
- npm installs fail closed when package verification fails;
- lifecycle scripts such as `postinstall` do not run;
- session, CLI token, and mnemonic are host-only;
- signing/submission via plugin still routes through MetaMask policy;
- security-critical command lifecycle methods are sealed;
- plugin system shipped in CLI 6.2.0 according to the current plugin reference.

**MetaEdge implication:** a first-party MetaEdge `mm` plugin is a plausible future adapter, not a foundation requirement. Because plugins are beta and unsandboxed, MetaEdge should request the smallest command-level capabilities and never place canonical product state or strategy authority inside the plugin.

## Agent skills / AI-host plugins — different from Agent Wallet plugins

`MetaMask/agent-skills` packages the `metamask-agent-wallet` skill for agent hosts such as Claude Code, Cursor, Codex, Antigravity CLI, and Grok Build.

That integration:

- teaches the AI host how/when to call `mm`;
- can run a session-start hook that checks readiness with `mm doctor`;
- does not itself embed the wallet or keys;
- is distinct from `mm plugins`, which load npm packages inside Agent Wallet.

**Terminology rule for MetaEdge docs:**

- **Agent skill / AI-host plugin** = guidance/integration loaded by Claude/Codex/Cursor/etc.
- **Agent Wallet CLI plugin** = executable npm extension loaded by `mm`.

Do not call these the same thing in architecture diagrams.

## x402

Current Agent Wallet skills support x402 payment workflows, including recent support for paid MCP tool calls. The helper flow inspects payment requirements, asks/records confirmation, signs through Agent Wallet, and retries the paid request.

**MetaEdge implication:** x402 may later let agents pay for data/compute/services under bounded authority. It is not required for trading V1 and should not be mixed into the trading authority model yet.

## Immediate platform conclusions

### Safe to treat as current design facts

1. Agent Wallet is a replaceable execution/authority adapter, not MetaEdge's product state machine.
2. Server-wallet execution is asynchronous; `AWAITING_MFA`, pending, and reconciliation must be first-class.
3. Agent Wallet Guard is valuable but does not replace MetaEdge portfolio/trading risk.
4. Perps position risk on Hyperliquid must be enforced by MetaEdge, not assumed to be guarded by wallet policy.
5. Application identity and Agent Wallet identity are separate.
6. Native `mm` plugins are beta/unsandboxed and should not become core product authority.
7. AI-host skills/plugins and Agent Wallet CLI plugins are separate integration layers.
8. Exact MetaMask CLI flags/version must be re-verified at implementation time.

### Still open

- Whether MetaEdge real execution should primarily use dedicated Agent Wallet server-wallets, Smart Account/Advanced Permissions delegations, or support both through adapters.
- Whether a MetaEdge native `mm` plugin materially improves safety/usability compared with an external adapter/service.
- Exact real-perps protection sequence and recovery policy.
- Exact wallet/account identity mapping for multi-wallet users.

## Revalidation trigger

Refresh this ledger before any real-execution implementation, and whenever:

- `@metamask/agent-wallet` changes major/minor version;
- plugin schema/capabilities change;
- Guard/outflow semantics change;
- a new venue becomes supported;
- Advanced Permissions add material permission types;
- MetaEdge depends on a command previously marked beta/experimental.
