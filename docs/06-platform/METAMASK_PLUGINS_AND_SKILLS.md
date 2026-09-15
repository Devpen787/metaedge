# MetaMask Plugins, Skills, and Extension Layers

Status: **Current platform research — 2026-09-15**

## Why this document exists

MetaMask now uses the word "plugin" in more than one agent-related context. These layers are materially different and must not be conflated in MetaEdge architecture.

## Layer 1 — MetaMask Agent Skills / AI-host plugins

Official repo: `MetaMask/agent-skills`

Purpose: teach an AI coding/agent host how to use MetaMask Agent Wallet CLI correctly.

Current repo describes packaging for hosts including:

- Claude Code;
- Cursor;
- Codex;
- Antigravity CLI;
- Grok Build;
- legacy/non-plugin hosts through the skills installer.

The primary skill is `metamask-agent-wallet`.

### What this layer does

- provides command/workflow guidance to the reasoning agent;
- routes natural-language wallet tasks to `mm` commands;
- teaches confirmation/recovery behavior;
- can inject session-start readiness context;
- uses `mm doctor` to identify version/auth/init problems;
- tracks compatibility between the skill version and CLI version.

### What this layer does not do

- it does not become the wallet;
- it does not hold the private key;
- it does not replace MetaMask policy enforcement;
- it should not be MetaEdge's canonical state or authorization system.

### Important current recovery rule

The current Agent Skills changelog includes explicit `AWAITING_MFA` handling. Agents are instructed to watch the pending wallet request and **not retry while it is pending**.

That behavior should inform MetaEdge's execution adapter regardless of whether MetaEdge actually installs the official skill.

### Version caution

At the time of this review, the public Agent Skills README/changelog targets `@metamask/agent-wallet` CLI v6.1.5, while the current Agent Wallet native plugin reference says the CLI plugin system shipped in v6.2.0 and requires `minCliVersion: ^6.2.0` or later.

Treat this as proof that the ecosystem components can advance on different release cadences.

**MetaEdge rule:** detect/verify installed versions and supported capabilities at runtime/build time. Never assume that a skill version and the latest CLI/plugin surface are identical.

## Layer 2 — Agent Wallet CLI plugins (`mm plugins`)

Purpose: executable npm packages that add native commands inside MetaMask Agent Wallet.

Examples from the official `MetaMask/agent-wallet-plugin-examples` repo include a sample plugin and an ENS-resolution plugin.

Official template: `MetaMask/agent-wallet-plugin-template`.

### Current status

- beta;
- off by default;
- enabled through `experimentalPlugins`;
- local/git unverified installs require a separate development-only opt-in;
- npm plugin install is consent-gated and fails closed if package verification fails.

### Runtime trust model

Official docs state that native Agent Wallet plugins run:

> in-process and unsandboxed.

Therefore plugin publisher/code trust matters even though the wallet provides a curated command context.

### Current command capabilities

- `wallet-read`
  - account/balance reads;
  - auth state;
  - prices;
  - token discovery;
  - wallet-state snapshot;
  - fee estimates;
  - persisted swap quotes;
  - authenticated public EVM RPC client.

- `wallet-submit`
  - transaction submission;
  - message signing;
  - typed-data signing;
  - requests still pass through MetaMask policy.

- `network-manage`
  - reserved for future network management.

Reserved/rejected capabilities currently include `mnemonic-read` and `config-write`.

Session, CLI token, and mnemonic remain host-only and are not directly exposed to plugins.

### Least-capability pattern

Current manifest supports command-level capabilities/data-access declarations. MetaMask explicitly recommends keeping plugin-wide capabilities empty where possible so each command receives only what it needs.

**MetaEdge implication:** if a future MetaEdge plugin exists, it should follow least capability at command granularity.

Example conceptual split:

- `mm metaedge status` — no wallet-submit;
- `mm metaedge inspect` — wallet-read only;
- `mm metaedge execute-approved` — wallet-submit, only if a valid MetaEdge execution grant already exists.

Do not create a plugin with blanket wallet-submit merely because one command might need it.

## Layer 3 — MetaMask Smart Accounts / Advanced Permissions

This is not an Agent Wallet plugin system.

It is an onchain permission/delegation architecture through Smart Accounts Kit, ERC-7715, and ERC-7710.

It may eventually provide a separate MetaEdge execution adapter for bounded authority from a user's MetaMask smart account.

See `METAMASK_AUTHORITY_OPTIONS.md`.

## Layer 4 — MetaMask Snaps

Snaps extend the browser extension itself. They are not the same as Agent Wallet CLI plugins and are not currently required by the MetaEdge relaunch.

Status: **not a current architecture dependency**.

## Potential MetaEdge uses of Agent Wallet CLI plugins

### Reasonable future use cases

- expose MetaEdge read/status commands directly inside `mm`;
- fetch a prepared execution grant from MetaEdge and submit it through the wallet policy layer;
- add venue/data utilities not yet part of the core Agent Wallet command surface;
- provide standardized MetaEdge provenance/intent metadata to a wallet operation;
- make a narrow integration easier for AI hosts already using `mm`.

### Poor uses

Do not use a plugin as:

- canonical MetaEdge strategy state;
- the only copy-trading engine;
- the portfolio/risk authority;
- long-term learning memory;
- a place to hide wallet restrictions from the user;
- a bypass around Agent Wallet policy;
- a reason to couple V1 product architecture to a beta API.

## Proposed integration layering

```text
MetaEdge Product / Domain
        ↓
Portfolio + Risk + Real Execution Contract
        ↓
MetaMask Adapter
        ├── direct Agent Wallet CLI/SDK
        ├── optional MetaEdge Agent Wallet CLI plugin
        └── optional Smart Account / Advanced Permission adapter
        ↓
MetaMask policy / delegation enforcement
        ↓
Chain / venue
        ↓
MetaEdge reconciliation
```

AI-host skill/plugin lives beside the top of this stack as an interaction helper, not inside the authority chain:

```text
Claude / Codex / Cursor
        ↓  skill / AI-host plugin
MetaEdge + MetaMask commands
```

## Recommended relaunch stance

1. **Do not depend on native Agent Wallet plugins for V1.** They are beta and not needed for paper product value.
2. Design the future real-execution adapter so it can call the official CLI/SDK directly.
3. Re-evaluate a first-party MetaEdge plugin later if it reduces integration complexity or improves least-authority execution.
4. Keep AI-host skills separate; we may eventually ship a MetaEdge skill that teaches agents our product/domain contracts, but it should not become financial authority.
5. Track MetaMask plugin capability/version changes in the platform ledger before implementation.
