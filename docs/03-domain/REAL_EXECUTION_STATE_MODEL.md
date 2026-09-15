# Future Real Execution State Model

Status: **Design-only draft — implementation NOT AUTHORIZED**

## Purpose

Define a vendor-neutral future execution boundary so paper architecture can remain compatible with later real execution without sharing authority or mutable state.

## Three separate concepts

### ExecutionGrant

Represents bounded human-authorized capability, independent from any one trade.

```text
DRAFT → REVIEWED → ACTIVE → SUSPENDED | EXPIRED | REVOKED
```

A grant may constrain account, network, venue, assets, operation types, notional, leverage, loss budget, strategy/agent scope and expiry.

A strategy or agent cannot expand its own grant. A wallet/provider adapter may further restrict it but cannot expand it.

### RealTradeIntent

A fresh real-only intent produced from the current portfolio target, current evidence and a valid ExecutionGrant.

```text
CREATED → PREVIEWED → AUTHORIZATION_PENDING → AUTHORIZED | REJECTED | EXPIRED
```

A PaperOrderIntent is never converted into a RealTradeIntent.

### ExecutionOperation

Represents one externally submitted step associated with a RealTradeIntent.

```text
PREPARED
→ SUBMISSION_RECORDED
→ SUBMITTED
→ PENDING
→ CONFIRMED | FAILED_FINAL | UNKNOWN | PARTIALLY_EFFECTIVE
```

Pending work may include an external approval state. Current MetaMask Agent Wallet behavior can expose asynchronous request identifiers and MFA-waiting states; those map into this generic pending lifecycle rather than changing the MetaEdge domain model.

## RealExecutionPlan

A single intent may require multiple ordered operations and different authority surfaces. For example, a future leveraged venue workflow can contain a wallet-controlled funding step and separate venue-controlled position steps. Those are reconciled independently.

## Unknown is first-class

`UNKNOWN` means MetaEdge cannot yet prove the externally observable result.

An equivalent fresh operation must not be submitted while the previous one remains unresolved. Existing wallet, chain or venue state must be reconciled first.

Timeout is not synonymous with failure.

## Partial effect

Multi-step execution may partially succeed. MetaEdge represents actual reconciled exposure rather than collapsing the whole plan into one success/failure boolean.

Examples include funding completed while a venue action did not, a partial position change, intended protective state missing, or external state differing from local state.

## Reconciliation

```text
PENDING | UNKNOWN | PARTIALLY_EFFECTIVE
              ↓
         RECONCILING
              ↓
CONFIRMED | FAILED_FINAL | PARTIALLY_EFFECTIVE | MANUAL_REVIEW_REQUIRED
```

A ReconciliationRecord preserves external identifiers, evidence sources queried, observed state, discrepancies and the canonical conclusion.

## Authority layering

```text
Human policy / ExecutionGrant
          ↓
MetaEdge portfolio + risk
          ↓
Execution adapter contract
          ↓
Wallet / delegation restrictions
          ↓
Venue / chain
```

Each layer may narrow permission. No lower layer legitimately expands the authority intended above it.

## MetaMask implications

- Agent Wallet server-wallet operations are asynchronous enough that pending/MFA/reconciliation must be native domain concepts.
- MetaMask Guard is useful defense-in-depth but is not MetaEdge portfolio risk.
- Leveraged venue exposure must be reconciled from venue truth, not inferred from wallet outflow alone.
- Agent Wallet, Smart Accounts/Advanced Permissions and future delegation mechanisms remain adapters beneath ExecutionGrant.

## Future recovery/security test classes

Before any real-execution build can be approved, the design must cover process restart while an operation is pending, ambiguous external outcome, partial execution, account/network change after preview, authorization expiry/revocation, external state differing from local state, equivalent-submission prevention, and recovery when one step of a multi-step plan succeeds and another does not.

## Implementation gate

Real execution remains unauthorized until product/domain/security contracts are approved, current platform capabilities are re-verified, paper operation is stable, and human approval explicitly opens a real-execution build phase.