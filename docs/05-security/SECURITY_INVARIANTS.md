# Security Invariants

Status: **Draft for human approval — no implementation authority**

## Purpose

Define properties that must remain true across UI, agents, APIs, persistence, paper execution, future real execution, crashes, retries, and provider failures.

Security here includes not only theft prevention but also authority integrity, user isolation, execution correctness, and protection against accidental double mutation.

## S1 — User isolation

A user may read or mutate only state explicitly scoped to that user, except for intentionally public market/source data.

Private objects include sessions, portfolio state, paper intents/fills, agent sessions, wallet connections, execution grants, audits, strategy drafts, copy policies, and future real operations.

**Legacy finding:** the V5 `/api/audit` endpoint returns the last 50 audit events globally without filtering by `req.userId`. This is a verified privacy defect and must not migrate into the relaunch.

## S2 — Observation is not authority

External data, model output, wallet activity, social data, and source observations can inform EvidenceProfiles and Views. None may directly mutate portfolio/execution state.

## S3 — Signal is not order

A `View` cannot call a broker or wallet adapter directly.

The mutation path is:

```text
View → PortfolioTarget → RiskDecision → execution intent → execution/reconciliation
```

## S4 — Authority narrows monotonically

No downstream component may expand authority beyond the upstream scope.

```text
human scope
  ≥ strategy/source scope
  ≥ portfolio allocation
  ≥ risk-permitted target
  ≥ execution adapter capability
  ≥ wallet/venue acceptance
```

## S5 — LLM text is not durable authority

Prompts may describe `AgentEnvelope`, `RiskPolicy`, `CopyPolicy`, `ExecutionGrant`, and other authority objects.

Authority exists only in canonical durable state.

No prompt, tool output, chat message, or model self-assertion can expand its own permissions.

## S6 — Paper cannot become real by mode switch

Paper and real execution use different intent types, operation state, authority, and adapters.

A paper endpoint must never become a real-money endpoint because an environment flag changed.

A PaperOrderIntent cannot be promoted into a RealTradeIntent.

## S7 — Unknown is not failed

If an external mutation may have been submitted or committed but final state is unknown:

- persist `UNKNOWN` / `PENDING_RECONCILIATION`;
- retain external identifiers if available;
- block financially equivalent fresh authority as needed;
- reconcile before retry.

Timeout does not imply failure.

## S8 — Idempotency before mutation

Every financially meaningful intent/operation has a durable idempotency identity before mutation can occur.

Duplicate nonces, repeated submission keys, duplicate fills, and replayed approvals must be rejected or resolved to the original operation.

## S9 — Reconciled execution is position truth

Requested target is not a position.

Submitted order is not a fill.

A fill is not canonical until lineage and persistence are valid.

Positions derive from reconciled execution evidence.

## S10 — Critical freshness is enforced at the mutation boundary

A strategy may reason about old information, but new execution cannot rely on critical stale or integrity-failed market/venue/account state when fresh state is required by the execution model.

Recovery from stale data requires re-evaluating the current opportunity; do not blindly execute an old target after freshness returns.

## S11 — Immutable facts, revisable interpretations

Raw observations, fills, external operation IDs, and audit facts are append-only or otherwise tamper-evident.

Evidence interpretation, thesis, reputation, and attribution may be superseded with new versions but cannot rewrite the original fact.

## S12 — Duplicate lineage cannot amplify authority

Multiple Views derived from the same source/event/observation cluster cannot automatically create independent confirmation or multiplied risk budget.

## S13 — Source incompleteness remains visible

Wallet/trader copying must preserve uncertainty about hidden hedges, other venues/accounts, options, OTC exposure, leverage, and incomplete observation coverage.

High reputation does not erase completeness risk.

## S14 — Agent scope is explicit and bounded

A Paper Agent may act unattended only inside its durable `AgentEnvelope`.

It cannot:

- change its own capital/risk limits;
- expand its instrument universe;
- grant itself new tools/authority;
- convert paper authority into real authority;
- override account-level portfolio/risk authority.

## S15 — Human stop changes future authority, not history

Pause/revoke/kill actions prevent or narrow future operations.

They do not erase already-submitted external operations. In-flight work must still reconcile.

## S16 — Wallet/venue adapters cannot define MetaEdge truth

Adapters own protocol interaction and external identifiers. They may reject/narrow an action.

They may not become the canonical source of strategy, portfolio, risk, or product authority.

## S17 — Secrets remain outside model-visible state

Seed phrases, private keys, raw signing secrets, and equivalent credentials must not enter prompts, logs, audits, model memory, or application domain objects.

Prefer wallet-controlled/server-wallet/delegated authority where the agent does not receive key material.

## S18 — Auditability without chain-of-thought dependency

Store decision facts, input references, policy versions, requested/permitted targets, operation lineage, refusals, and outcomes.

Do not require private model reasoning traces as the security/audit source of truth.

## S19 — Recovery cannot silently create new authority

Restart, failover, backup recovery, cache loss, or provider reconnection may restore existing durable authority/state.

They may not mint a new AgentSession, CopyRelationship, ExecutionGrant, or financial intent unless the normal creation contract is satisfied.

## S20 — Failure must fail closed only at the correct boundary

Critical integrity/authority/execution failures block mutation.

Noncritical evidence uncertainty should not silently become a global trading shutdown.

Security controls should prevent unsafe action without recreating ordinary-uncertainty paralysis.