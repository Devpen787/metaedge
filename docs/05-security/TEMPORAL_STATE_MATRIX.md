# Temporal State Matrix

Status: **Draft for human approval — state/recovery contract**

## Purpose

Security failures often happen not because a single state is invalid, but because an operation crosses time: submission, timeout, restart, stale data, policy revocation, partial fill, MFA wait, or concurrent actors.

This matrix defines what MetaEdge must believe **before**, **during**, and **after** those transitions.

## Temporal law

> **Never infer final financial truth from a local timeout, UI state, process restart, or missing response. Persist the last durable fact, then reconcile.**

## Matrix

| Sequence | Durable state before event | Event / ambiguity | Required system behavior | Forbidden behavior |
|---|---|---|---|---|
| New paper target | Reconciled position + permitted target | Create PaperOrderIntent | Persist intent/idempotency before broker mutation | Broker call before durable identity |
| Paper broker submission | `RISK_ACCEPTED` | Submit to broker | Move to broker-pending with append-only event | Treat submission as fill |
| Partial paper fill | `BROKER_PENDING` | Fill smaller than requested | Record fill, actual exposure, remaining quantity; continue from reconciled delta | Retry full original quantity |
| Paper timeout/restart | Nonterminal intent | Process dies or write outcome uncertain | Reconcile fills/trades/events before new equivalent intent | Assume failure and resubmit |
| Stale market data | Valid View/target | Critical quote exceeds age/integrity fails | Block fresh mutation; keep research/shadow alive; re-evaluate once fresh | Execute old target immediately on reconnect |
| View expiry | Active View | Horizon/expiry passes | Stop contributing to new PortfolioTargets; preserve historical lineage | Delete historical View or silently extend expiry |
| Strategy superseded | Active StrategyVersion | New version approved | New decisions use new version; existing lineage remains old version | Rewrite old decisions as if new version made them |
| Agent pause | Running AgentSession | Human pauses | Stop new View generation/action requests; preserve session/history | Implicitly liquidate unless policy says so |
| Agent restart | Running durable session | Process restarts | Recover envelope/session, reconcile portfolio/execution, refresh evidence, then resume if clean | Create new authority merely because process restarted |
| Risk policy change | Existing positions/intents | Human changes policy | Version policy; apply new policy to future targets and explicit required reductions | Rewrite historical risk decisions |
| Copy source disappears | Active CopyRelationship | Source data unavailable | Mark source coverage degraded; stop new copy transformations if required; maintain/reconcile existing position | Assume source went flat |
| Wallet/account change | Future real enabled | Active wallet/network/account differs | Invalidate relevant readiness/preview/grant binding and require fresh validation | Reuse old approval against new account/network |
| Real preview created | Valid RealTradeIntent | Price/nonce/quote ages | Expire preview when freshness contract fails | Sign stale preview as if current |
| Real submission | Authorized operation | Wallet/provider returns external request/polling ID | Persist operation + external ID immediately; transition to pending | Treat request creation as execution finality |
| MFA wait | Pending real operation | `AWAITING_MFA` | Preserve pending state; surface action required; watch same request | Retry as a new financial action |
| Provider timeout after submit | Submitted operation | Response absent | Mark unknown/pending reconciliation; query by external/idempotency identity | Declare failed and immediately resubmit |
| External success, local write uncertain | Possibly committed | App storage error after provider success | Reconcile external truth; repair local lineage/state | Reverse external fact because local write failed |
| Grant revoked with operation in flight | Active ExecutionGrant + pending operation | Human revokes grant | Block new operations; continue reconciling already-submitted operation | Pretend revocation cancels an external operation automatically |
| Partial real fill | Submitted real operation | Venue reports partial fill | Canonical position reflects actual fill; remaining action follows execution plan/policy | Assume target reached or retry full amount |
| Venue reports conflicting state | Local expected state | External state disagrees | Enter reconciliation/degraded state; prevent risky new mutation until resolved | Pick whichever state is more convenient |
| Audit/log write failure | Financial state mutation pending | Audit persistence fails | Financial mutation and audit must follow defined transactional/outbox contract; unresolved if atomicity cannot be proven | Report success with missing critical lineage |
| Backup recovery | Store restored from older snapshot | External operations may be newer | Reconcile all external/paper operation identities newer than snapshot | Trust restored snapshot as complete financial truth |

## Paper restart contract

Historical V5 already contains a useful pattern: nonterminal paper intents are reconciled at startup; a durable matching trade can recover execution, while uncertain nonterminal work is moved to `UNRESOLVED` rather than automatically retried.

The relaunch should preserve that principle while expressing it through the new domain types.

## Future real state ordering

Recommended conceptual progression:

```text
RealTradeIntent
  DRAFT
  READY_FOR_PREVIEW
  PREVIEWED
  AUTHORIZED

ExecutionOperation
  PREPARED
  SUBMITTING
  SUBMITTED
  AWAITING_EXTERNAL_ACTION   # e.g. MFA
  PENDING
  PARTIALLY_FILLED
  UNKNOWN
  RECONCILING
  CONFIRMED
  FAILED_FINAL
  CANCELLED_FINAL
```

`FAILED_FINAL` requires evidence that the intended mutation did not occur or cannot still occur.

`UNKNOWN` and `PENDING` are not aliases for failure.

## Revocation semantics

Revoking a future `ExecutionGrant` means:

```text
new operations under grant → forbidden
already prepared but not submitted → cancelled where safe
already submitted → reconcile to final external truth
```

Do not promise users that revocation can unwind an external transaction already accepted by a venue/network.

## Data freshness semantics

Freshness has at least three distinct clocks:

1. **market observation freshness** — is the price/liquidity state current enough?
2. **decision freshness** — is the View/target still within its thesis horizon?
3. **execution preview freshness** — is the exact quote/account/network/nonce state still valid?

These clocks must not be conflated.

## Required temporal tests

Every implementation should include restart/state tests for at least:

- crash after intent persisted but before broker submit;
- crash after broker submit but before local acknowledgement;
- crash after partial fill;
- stale observation becomes fresh again;
- concurrent duplicate submission;
- policy change while target is pending;
- agent stop while position remains open;
- wallet/account switch between preview and authorization;
- future MFA wait followed by success/failure/timeout;
- grant revocation while external operation is pending;
- storage restore followed by external reconciliation.

A design that is safe only on the happy-path call stack is not ready for real authority.