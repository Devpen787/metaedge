# Paper to Real

Status: **Draft for human approval**

## Goal

MetaEdge should allow a proven strategy/source/agent process to move from paper evaluation toward real proposals **without allowing paper state to become real execution authority**.

The transferable artifact is the **strategy/source logic and target-exposure decision**, not the paper order itself.

## Canonical split

`StrategyVersion / SourceView`
→ `DesiredExposure`
→ branch into separate execution domains:

- `PaperOrderIntent` → Paper Broker → Paper Fill → Paper Position
- `RealTradeIntent` → Exact Preview → Explicit Authorization → Wallet/Venue → Reconciliation → Real Position

A `PaperOrderIntent` can never be converted, promoted, or relabeled into a `RealTradeIntent`.

## What may be shared

Paper and real may share:

- strategy version;
- copy-source lineage;
- evidence profile;
- market observation references;
- desired target exposure;
- risk methodology/template;
- portfolio intent;
- thesis and invalidation logic;
- explanation.

## What must remain separate

Paper and real must have separate:

- intent types;
- authorization state;
- order/execution identifiers;
- adapters;
- execution ledgers;
- fill/position state;
- reconciliation;
- failure/unknown handling;
- user-visible mode labeling.

## Promotion boundary

A future real path should resemble:

Learn / discover
→ test
→ paper
→ demonstrate behavior
→ choose real mode
→ configure risk
→ generate exact real proposal
→ preview current quote/costs
→ authorize exact bounded action or delegated policy
→ wallet/signing boundary
→ submit
→ reconcile
→ position/history
→ learn.

There is no automatic paper-to-real transition.

## Strategy portability

The user should eventually be able to say:

> Run Strategy ABC v7 in paper.

and later:

> Allow Strategy ABC v7 to generate real proposals.

The strategy rules do not need to be rewritten merely because the execution environment changed.

## Paper and real in parallel

When real execution eventually exists, paper should continue in parallel wherever useful.

This enables measurement of:

- expected paper fill vs real fill;
- expected slippage vs actual slippage;
- expected fees/funding vs actual;
- decision time vs submission time vs finality;
- paper PnL vs real PnL;
- model/broker assumption error;
- execution quality by venue/adaptor.

Paper should become an ongoing calibration environment, not something discarded once real mode is enabled.

## Real intent requirements — future architecture

A `RealTradeIntent` should eventually bind at least:

- user/account;
- wallet/address;
- network/chain;
- strategy/source/version;
- instrument;
- direction;
- amount/size/notional bounds;
- current evidence snapshot;
- risk-policy snapshot;
- quote/price assumptions;
- execution adapter/venue;
- expiry;
- approval/delegation reference;
- operation/idempotency id;
- execution state;
- reconciliation evidence.

## Unknown execution law

A real execution timeout or ambiguous provider response does not prove failure.

The system must represent an explicit `UNKNOWN` / reconciliation-required state and prevent a retry that could duplicate exposure until canonical execution truth is established.

## Agent authority progression

Paper competence may contribute evidence for later real authority, but does not create that authority automatically.

Future levels:

- supervised exact-action approval;
- bounded delegated execution;
- adaptive allocation only among explicitly approved strategies and limits.

Every authority grant must be revocable and narrower than the user's total wallet capability.

## MetaMask boundary

MetaMask Agent Wallet / Smart Account capabilities should be isolated behind adapters.

MetaEdge domain state determines **what is authorized**. MetaMask provides wallet/security/execution primitives. Vendor SDK state must not become MetaEdge's canonical strategy, portfolio, or reconciliation model.

Current MetaMask capabilities must be re-verified against current official documentation before real implementation begins.
