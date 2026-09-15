# Paper / Real Isolation

Status: **Draft for human approval — future real design only**

## Purpose

Prevent paper execution from becoming real execution through a flag, UI toggle, shared route, reused identifier, or adapter shortcut.

The relaunch deliberately shares **strategy/evidence concepts**, not mutable execution authority.

## Core law

> **A paper action can never become a real action by changing mode. A fresh real intent and fresh real authority are always required.**

## Shared concepts

Paper and future real may share:

- `StrategyDefinition` / `StrategyVersion`;
- `CopySource` / `CopyPolicy` logic;
- observations;
- `EvidenceProfile`;
- `View`;
- portfolio aggregation logic;
- account-level risk methodology;
- target exposure semantics;
- outcome attribution concepts.

Sharing these lets us compare expected vs actual behavior without sharing authority.

## Separate concepts

Paper and real must have separate:

- intent types;
- identifiers/namespaces;
- storage collections/tables;
- lifecycle events;
- execution services;
- adapters;
- reconciliation records;
- permissions/authority;
- UI actions and labels;
- audit event types;
- operational metrics.

```text
StrategyVersion
      ↓
     View
      ↓
PortfolioTarget
   ↙       ↘
PAPER      FUTURE REAL
 ↓             ↓
PaperOrderIntent   RealTradeIntent
 ↓             ↓
PaperBroker        ExecutionGrant + RealExecutionPlan
 ↓             ↓
PaperFill          ExecutionOperation
 ↓             ↓
PaperPosition      external reconciliation
```

## Forbidden seam: semantic mode switching

Do not expose one endpoint whose meaning changes from simulation to real mutation based on `LIVE=true`.

Historical V5 contains this exact pattern in the MetaMask transfer path: when live is disabled, `/api/mm/transfer` returns a simulated paper fill; when live is enabled, the same route invokes the wallet CLI for a real transfer.

The relaunch must replace that seam.

Preferred shape:

```text
POST /paper/...  → paper-only domain service
POST /real/...   → future real-only domain service
```

or equivalent typed service contracts that cannot be confused by environment configuration.

## Paper identifiers are non-authorizing

A `PaperOrderIntent.id`, `PaperFill.id`, `PaperPosition.id`, or paper approval token must never satisfy a real execution API.

If a StrategyVersion graduates to real proposals, the system creates a new `RealTradeIntent` from current state.

The old paper order is historical evidence only.

## Real intent freshness

A future `RealTradeIntent` must bind to current:

- portfolio target/version;
- reconciled real position;
- user/account/wallet identity;
- network/venue;
- strategy/source lineage;
- risk policy version;
- requested exposure delta;
- quote/market state requirements;
- expiration/freshness window.

It may reference paper evidence, but paper evidence cannot substitute for current account/quote/authority checks.

## Separate position truth

Paper positions derive only from paper fills.

Real positions derive only from reconciled external fills/events.

Never combine paper and real fills into one mutable position row.

A comparison/reporting layer may show:

```text
Paper expected position
Real reconciled position
Divergence
```

without merging their authority or accounting.

## Paper-shadow during future real

When real execution eventually exists, MetaEdge should be able to continue a parallel paper shadow using the same strategy/view inputs.

Useful comparison dimensions:

- expected vs actual fill price;
- latency;
- fee/slippage;
- partial fill behavior;
- position timing;
- strategy PnL vs execution PnL;
- paper/real divergence.

The paper shadow must not be allowed to trigger or repair real state automatically.

## UI isolation

A future UI should make the distinction impossible to miss:

- paper and real balances are visually/semantically separate;
- paper action labels never become real labels after a toggle;
- real preview explicitly shows wallet/account/network/venue/amount/risk;
- pending/unknown real operations remain visibly pending/unknown;
- switching a global UI mode does not mutate existing paper objects into real ones.

## Environment isolation

Environment flags may enable/disable availability of the future real subsystem.

They may not change the financial semantics of a paper route/object.

Example:

```text
REAL_EXECUTION_ENABLED=false
```

may make real endpoints unavailable.

It must not cause the paper endpoint to become a different implementation when set `true`.

## Storage isolation

Future implementation should prefer explicit schemas/tables/collections such as:

```text
paper_order_intents
paper_order_events
paper_fills
paper_positions (derived/cache only)

real_trade_intents
execution_grants
real_execution_operations
real_reconciliation_records
real_positions (derived/cache only)
```

Shared lineage IDs may connect them analytically, but foreign keys must not imply authority promotion.

## Test requirements

1. Pass a paper ID to every future real mutation API → reject.
2. Flip all environment flags while calling a paper API → behavior remains paper-only.
3. Disable future real subsystem → paper continues unaffected.
4. Enable future real subsystem → no existing paper object gains authority.
5. Create real proposal from paper-proven strategy → new fresh RealTradeIntent required.
6. Switch wallet/network after real preview → preview invalidated.
7. Real operation becomes unknown → paper state cannot be used to infer external success/failure.
8. Paper and real positions can diverge without either overwriting the other.

## Migration consequence

Legacy mechanics that are reusable should be extracted behind paper-specific contracts first.

The old combined MetaMask paper/live route semantics should be **REPLACED**, not migrated as architecture.