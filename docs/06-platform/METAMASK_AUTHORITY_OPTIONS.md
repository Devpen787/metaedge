# MetaMask Authority Options for Future MetaEdge Real Execution

Status: **Architecture research — no real implementation authorized**

Updated: 2026-09-15

## Purpose

MetaMask now exposes more than one way to give software/agents bounded onchain authority. MetaEdge should define its own domain/authorization contract first, then choose the MetaMask substrate that best satisfies it.

Do not make the product model depend on one MetaMask authority primitive prematurely.

## Option A — MetaMask Agent Wallet server-wallet

### Model

A dedicated Agent Wallet is initialized in server-wallet mode. Key material is protected in MetaMask's server-side TEE environment. The agent/MetaEdge interacts through `mm` / Agent SDK rather than receiving raw key material.

### Current wallet-level controls

In Guard Mode, current official docs describe:

- threat scanning;
- network allowlist;
- address allowlist;
- token-recipient allowlist;
- rolling 24-hour outflow limit;
- human 2FA escalation outside policy or for risky/flagged actions.

### Current execution semantics

- signing/transaction requests can be asynchronous;
- a request can return `pollingId`;
- policy/threat checks can put a job in `AWAITING_MFA`;
- pending work is queried/watchable;
- current skills explicitly advise agents not to retry pending MFA requests.

### Strengths for MetaEdge

- purpose-built Agent Wallet CLI/SDK;
- dedicated wallet rather than broad access to a user's main wallet;
- strong transaction simulation/threat/security pipeline for supported EVM actions;
- deterministic error codes/hints useful to agent recovery;
- Guard policy is an additional authority layer independent of MetaEdge reasoning;
- natural fit for Level-3 Supervised Real and potentially Level-4 Bounded Autonomous Agent.

### Limits / risks

- MetaEdge must still reconcile asynchronous/unknown results.
- Guard/outflow controls do not represent full portfolio risk.
- Venue-internal operations can sit outside wallet-level controls. Hyperliquid perps are the clearest current example: wallet controls apply to collateral deposit, not the subsequent leveraged position actions.
- Sign-in method can map to different wallet addresses; app identity cannot be inferred from login label.
- Server-wallet behavior is a changing external platform contract.

### Likely MetaEdge role

Strong candidate for a **dedicated agent execution account** where the user explicitly funds a bounded amount and MetaEdge overlays strategy/portfolio/risk policy.

---

## Option B — MetaMask Smart Accounts + Advanced Permissions (ERC-7715)

### Model

A MetaMask user upgrades/uses a smart account and grants a dapp/session account a fine-grained execution permission. The session account can redeem the permission through ERC-7710 delegation. The session account does not need to hold the user's funds.

Current Smart Accounts Kit docs (2.0.0) describe `wallet_requestExecutionPermissions` and human-readable permission requests through MetaMask.

### Current production permission types documented

As of this research, MetaMask production lists support for:

- ERC-20 allowance;
- ERC-20 periodic;
- ERC-20 stream;
- native token allowance;
- native token periodic;
- native token stream.

Token approval revocation exists in Smart Accounts Kit but is not currently listed as available in production MetaMask.

### Strengths for MetaEdge

- authority can be scoped/time-bounded instead of requiring full wallet access;
- user can keep funds in their primary MetaMask smart account;
- suited to repeated bounded actions such as periodic spending/DCA;
- permissions are visible to the user and enforced independently from agent reasoning;
- ERC-7710 delegation/caveats offer a strong conceptual fit for least-authority agents;
- potentially useful for future user-controlled copy/automation where a dedicated funded wallet is undesirable.

### Limits / unknowns

- the currently documented production permission menu is token-centric; do not assume it can express every MetaEdge trading operation/venue workflow;
- exact support for arbitrary swaps, perps, prediction market actions, bridge flows, or venue-specific calls must be proven before design dependence;
- account/session/delegation/revocation recovery requires its own state machine;
- smart-account network/deployment constraints need targeted review;
- advanced permission semantics may evolve quickly.

### Likely MetaEdge role

Candidate for **bounded execution directly from a user's MetaMask smart account** when the required action can be expressed by supported permissions/delegations.

---

## Option C — Regular ERC-7710 delegation / custom caveats

MetaMask Smart Accounts Kit also supports direct delegations outside the Advanced Permissions extension flow. Delegations can be constrained by caveats and revoked/disabled through the Delegation Framework.

Potential benefit: more expressive contract-enforced authority than the currently exposed production Advanced Permission types.

Potential cost: MetaMask's own docs note that regular delegations are less human-readable and place more responsibility on the dapp to explain constraints safely.

**Status:** investigate only when a concrete MetaEdge action cannot be represented by production Advanced Permissions or Agent Wallet Guard.

---

## Option D — BYOK / locally controlled Agent Wallet

Agent Wallet supports bring-your-own-wallet mode with a local mnemonic.

This is technically possible but should not be MetaEdge's default real-authority architecture. MetaEdge should not require users to place seed phrases inside an application/server integration simply to automate strategies.

**Status:** defer / separate security review.

---

## MetaEdge abstraction that should exist above all options

MetaEdge's domain model should define its own authority objects independently of MetaMask:

`RealTradeIntent`
→ `QuoteSnapshot`
→ `RiskPolicySnapshot`
→ `ExecutionGrant`
→ `WalletAuthorization`
→ `ExecutionOperation`
→ `ExecutionEffect`
→ `ReconciliationRecord`

A wallet adapter then maps an `ExecutionGrant` onto one authority mechanism.

### Required ExecutionGrant dimensions

Candidate dimensions:

- user/account/wallet;
- chain/network;
- venue/protocol;
- instrument/asset;
- operation type;
- direction;
- exact or bounded size/notional;
- leverage ceiling;
- slippage ceiling;
- loss/drawdown constraints;
- frequency/rolling budget;
- expiry;
- strategy/source version;
- quote/evidence lineage;
- revocation/kill state.

The external wallet layer can impose additional restrictions. It must never silently widen the MetaEdge grant.

## Recommended design stance

### Level 3 — Supervised Real

Likely easiest first path:

1. MetaEdge prepares an exact/bounded action;
2. MetaEdge shows user-visible evidence/risk/quote;
3. user explicitly authorizes;
4. Agent Wallet/MetaMask still applies its own policy/security checks;
5. execution is submitted once;
6. MetaEdge reconciles actual outcome.

### Level 4 — Bounded Autonomous

Do not simply turn off confirmations.

Instead require a separately approved envelope whose enforceable constraints exist at multiple layers where possible:

- MetaEdge portfolio/risk engine;
- MetaMask Guard / Advanced Permission / delegation;
- venue/order constraints;
- runtime kill/revocation state;
- continuous reconciliation.

### Level 5 — Adaptive Portfolio Agent

Agent may vary strategy allocation only inside a pre-approved account-level envelope. It cannot change its own wallet/delegation policy, create broader permissions, or raise limits.

## Perps-specific conclusion

For Hyperliquid/perps, MetaMask Agent Wallet currently protects the funding/deposit leg but **does not provide the complete position-level authority model we need**.

Therefore a future perps adapter must treat MetaEdge as the primary position-risk authority and Hyperliquid as a reconciled venue:

- read full position/account state;
- calculate total effective leverage/exposure;
- constrain entry and scaling;
- verify protection orders;
- monitor funding/liquidation state;
- enforce reduction/kill logic;
- reconcile all venue actions independently of wallet funding policy.

## Decision status

### Decided

- MetaEdge's authority contract is vendor-neutral and sits above MetaMask.
- Wallet policy is defense-in-depth, not a substitute for portfolio/trading risk.
- Async/pending/unknown execution states are first-class.
- Agents cannot expand their own authority.

### Not yet decided

- Agent Wallet vs Advanced Permissions as primary production substrate.
- Whether both become supported adapters.
- Whether MetaEdge needs its own Agent Wallet CLI plugin.
- Exact delegation permission model for live copy trading.
- Exact first real venue/instrument.
