# Attack Sequence Matrix

Status: **Draft for human approval — adversarial design input**

## Purpose

Model attacks and failure sequences that exploit timing, authority confusion, user isolation, stale data, duplicate execution, or agent self-expansion.

This is not a generic security checklist. Each row describes a concrete sequence MetaEdge must withstand.

| ID | Attack / failure sequence | Targeted invariant | Expected defense | Required evidence/test |
|---|---|---|---|---|
| A01 | Reuse same paper nonce to submit equivalent order twice | Idempotency | Durable nonce/idempotency index resolves/rejects replay | Duplicate request returns original/refusal; no second fill |
| A02 | Crash after submission, client retries because response timed out | Unknown != failed | Nonterminal operation enters pending/unknown and reconciles before fresh equivalent authority | Fault-injection between submit and acknowledgement |
| A03 | Partial fill followed by full-size retry | Reconciled position truth | Remaining quantity derives from actual fills, not original request | Partial-fill replay fixture |
| A04 | Agent writes prompt saying its risk budget was increased | LLM text is not authority | Runtime reads durable envelope/policy only | Prompt-injection test with forged authority claim |
| A05 | Strategy directly invokes broker/wallet tool | Signal is not order | Tool/API surface requires canonical target/risk lineage | Attempt direct call without PortfolioTarget/RiskDecision |
| A06 | Agent asks another agent to execute outside its sleeve | Monotonic authority | Cross-agent delegation cannot expand source envelope | Multi-agent privilege-escalation test |
| A07 | Four linked wallets and one independent wallet presented as five independent bullish sources | Duplicate-lineage control | Source/evidence cluster caps + explicit lineage | Cohort/identity-link fixture |
| A08 | High-reputation wallet copied despite known incomplete coverage | Source incompleteness | Completeness warning persists; CopyPolicy sizes independently | Hidden-hedge uncertainty fixture |
| A09 | Stale quote restored after network reconnect; old target executes immediately | Freshness boundary | Current observation + View/target revalidation required | Disconnect/reconnect replay |
| A10 | Switch active wallet/network after preview but before future authorization | Binding integrity | Preview/grant binds account/network/chain; mismatch invalidates | Account/network-switch test |
| A11 | Future wallet returns `AWAITING_MFA`; caller resubmits same economic action | Pending external state | Watch same external request; block equivalent fresh submission | MFA-pending replay test |
| A12 | External provider accepts order but local persistence errors | Reconciliation | Operation marked possibly committed; external truth queried before retry | Inject local write failure after submit |
| A13 | Revoke grant while transaction is already in flight | Revocation semantics | New work blocked; in-flight operation continues to reconciliation | Grant-revoke race test |
| A14 | User A requests audit feed and receives User B events | User isolation | Every private audit query scopes to requesting user/admin capability | Multi-user isolation test |
| A15 | Legacy `/api/audit` behavior copied into relaunch | Privacy migration risk | Classified as REMOVE/REPLACE; explicit negative migration test | Verified legacy endpoint returns global last-50 audit events |
| A16 | Environment flag changes `/paper-transfer` semantics into real transfer | Paper/real isolation | Separate paper and real intent types/routes/services; no semantic switch | Route contract test under all env flags |
| A17 | Paper order ID passed into future real execution API | Paper/real isolation | Type/namespace mismatch rejected; real intent created fresh | Cross-mode identifier test |
| A18 | Agent changes its own universe/risk settings then acts | Agent bounded scope | Envelope/risk policy immutable to agent; change requires external authority | Self-modification attempt |
| A19 | Model hallucinates successful fill and updates position narrative | Reconciled execution truth | Position derived only from canonical fill/events | Fake tool-output / model-output test |
| A20 | Two concurrent portfolio writers race and overwrite each other | Single portfolio authority | Serialized/versioned target generation with compare/revision semantics | Concurrency test |
| A21 | Two execution workers consume same target delta | Single execution authority | Claim/idempotency/operation identity prevents duplicate mutation | Parallel worker race |
| A22 | Backup restore reverts local state behind external venue | Temporal integrity | Reconciliation against external/paper operation identities on restore | Snapshot rollback test |
| A23 | Provider sends malformed observation with valid-looking price | Observation integrity | Schema/hash/provenance validation before critical use | Corrupted-observation fixture |
| A24 | User intentionally supplies huge target through manual View | Portfolio/risk authority | View may request; portfolio/risk clips/blocks by policy | Oversize manual request test |
| A25 | Strategy splits one oversized request into many small requests | Budget evasion | Sleeve/account budget aggregates exposure, not request count | Fragmentation attack |
| A26 | Copy source toggles positions quickly to induce churn | Copy transformation | CopyPolicy rate/turnover/liquidity constraints + target netting | High-frequency source churn fixture |
| A27 | Same news event appears through social, price, LLM narrative, wallet cohort | Evidence amplification | Shared lineage/dependency handling prevents naive multiplication | Multi-channel single-event fixture |
| A28 | Agent accumulates repeated runtime refusals and keeps retrying identical forbidden action | Refusal loop | Structured refusal + action identity + session policy prevents spam/replay | Repeated-refusal test |
| A29 | UI says Live is off but backend route still mutates real wallet | UI not authority | Backend capability/intent contract is canonical; real path separately gated | Headless API test without UI |
| A30 | UI says trade succeeded before durable execution truth exists | State honesty | UI renders pending/partial/unknown distinctly | End-to-end pending-state fixture |

## Verified legacy defect: global audit exposure

The V5 `server/auth.ts` endpoint:

```text
GET /api/audit
```

returns the globally sorted last 50 `db.auditEvents` without filtering by `req.userId`.

This is a concrete example of why relaunch user isolation must be tested per endpoint rather than inferred from middleware presence.

Migration status: **DO NOT REUSE AS-IS**.

## Verified legacy anti-replay/reconciliation patterns worth preserving

The V5 durable paper intent path already contains useful defenses:

- nonce index / replay detection;
- append-only order events;
- duplicate fill rejection;
- partial-fill state;
- `UNRESOLVED`;
- startup reconciliation of nonterminal intents;
- no automatic retry of unresolved startup state.

These should be adapted into the canonical relaunch execution domain rather than discarded.

## Adversarial test philosophy

The security suite must test two failure classes:

### Unsafe action

Can a component exceed its authority, double-submit, cross users, bypass freshness, or mutate real state from a paper path?

### Unsafe inactivity / false block

Can a noncritical uncertainty or malformed ownership boundary accidentally freeze valid paper participation forever?

A secure MetaEdge must resist both reckless mutation and authority-induced paralysis.