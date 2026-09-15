# J10 — Paper Copy

Status: **Detailed draft for human review**

## USER JOB

> Reproduce useful behavior from a wallet/trader/strategy/agent/source in my paper portfolio, but transform it to fit my capital, risk and constraints rather than blindly cloning it.

## PURPOSE

Paper Copy operationalizes the CopySource model safely.

The core path is:

**Source Observation → Copy Interpretation → Copy Policy → Copy View → Portfolio Target → Risk → Paper Execution → Attribution**

The source never owns the follower broker.

## PRECONDITIONS

- User has a Paper Portfolio.
- Source is followable/observable.
- `CopyPolicy` is declared and versioned.
- Source/instrument mapping is supported.
- Source data is sufficiently fresh for the policy.

## AUTHORITATIVE STATE

Candidate concepts:

- `CopySource`
- `SourceObservation`
- `CopyRelationship`
- `CopyPolicy`
- `CopyView`
- `PortfolioTarget`
- `PaperOrderIntent`
- `CopyAttribution`
- `SourceCompleteness`

## USER-VISIBLE STATES

Relationship:

- configured
- active
- paused
- source stale/degraded
- policy blocked
- stopped

Copy action:

- source change observed
- ignored by policy
- transformed to target
- clipped by portfolio/risk
- pending paper execution
- partially filled
- executed
- unable to map/reconcile

## HAPPY PATH

1. User selects Paper Copy from an investigated/followed/shadowed source.
2. MetaEdge shows source limitations and asks for/loads Copy Policy.
3. User sees how source behavior will be transformed (notional/leverage/asset filters).
4. Relationship becomes active.
5. Source changes position or emits qualifying action.
6. MetaEdge records `SourceObservation`.
7. Copy engine derives follower-specific desired exposure.
8. Portfolio combines this copy view with the user's other strategy/source views.
9. Risk clips or hard-blocks as required.
10. Paper execution moves toward resulting aggregate target.
11. MetaEdge attributes resulting performance/cost to the Copy relationship/source.
12. Future source changes scale/reduce/exit through J11.

## TRANSFORMATION LAW

Do not replay source order size literally.

Potential sizing bases include:

- source percent-equity → follower percent-equity;
- risk-unit normalization;
- volatility scaling;
- fixed follower sleeve;
- capped hybrid.

Exact default methodology remains an open decision.

Source leverage is evidence, not permission. Follower leverage comes from follower policy.

## SOURCE-COMPLETENESS LAW

Before/while copying a wallet/trader, MetaEdge must preserve the possibility that visible activity is incomplete.

Examples:

- hedge in another wallet/venue;
- spot/perp offset;
- options/off-chain exposure;
- deposit/withdrawal distorting apparent performance.

This affects interpretation and potentially sizing, but should not be hidden.

## STREAM + RECONCILIATION LAW

Source event streaming can be missed or duplicated.

Copy state therefore requires periodic source-state reconciliation where authoritative snapshots are available.

The desired follower target is derived from canonical current source state/policy where possible, not from trusting every WebSocket message blindly.

## EMPTY STATE

- source has not changed materially;
- source action filtered by policy;
- portfolio already matches target;
- aggregate portfolio target nets the copy view against another strategy.

## FAILURE

- source disconnected;
- source/instrument mapping unsupported;
- transformation invalid;
- follower target cannot be priced;
- paper broker failure;
- reconciliation detects unresolvable source gap.

## UNKNOWN

If source intent/completeness is unknown, show it. Do not infer “smart money” from a public wallet label alone.

## RETRY

Source events and CopyViews require stable idempotency identity. Repeated source notifications cannot duplicate follower financial effects.

## PARTIAL

Follower paper fills can be partial. Source and follower positions may intentionally diverge due to policy/risk.

## CANCEL

Pausing/stopping CopyRelationship stops new copy views. It does **not** automatically liquidate current follower positions unless the user/policy explicitly selects a close behavior.

That choice must be visible.

## BACK / REFRESH / RESTART

Restart restores relationship/policy and reconciles source state before creating new targets.

## OWNER / AUTHORITY

- Source adapter: observed source state.
- Copy engine: follower transformation.
- Portfolio: aggregate target.
- Risk: permitted target.
- Paper broker: paper financial mutation.

## PRIVACY

Copy policies, source lists and paper results are private unless explicitly shared.

## RECOVERY

After outage:

1. determine observation gap;
2. fetch authoritative current source state where possible;
3. compare current follower paper target;
4. create one reconciled target change rather than replaying all unknown intermediate actions as if observed.

## NEXT JOURNEY

- J11 Manage Position
- J12 Review and Learn
- modify Copy Policy / pause source
- future Live Copy only through a separately authorized Real relationship.