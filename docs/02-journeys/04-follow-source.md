# J04 — Follow Source

Status: **Detailed draft for human review**

## USER JOB

> Keep track of this source for me and surface meaningful changes without taking any trading action.

## PURPOSE

Follow separates **attention subscription** from exposure.

Following a wallet/trader/strategy/agent/cohort never authorizes paper or real trading.

## PRECONDITIONS

- Source is resolved as a `CopySource` or equivalent trackable entity.
- User has an application identity/session.

## AUTHORITATIVE STATE

Candidate concepts:

- `FollowRelationship`
- `CopySource`
- `FollowPolicy`
- `SourceObservation`
- `NotificationEvent`

`FollowRelationship` is informational only.

## USER-VISIBLE STATES

- Following / healthy
- Following / quiet
- Following / significant update
- Data degraded
- Source unavailable
- Paused
- Unfollowed

## HAPPY PATH

1. User chooses Follow.
2. MetaEdge creates a durable relationship to the source.
3. User optionally configures meaningful-update filters.
4. New source observations are evaluated for relevance.
5. User receives feed/notification updates with evidence and timestamps.
6. No exposure is created.
7. From an update, user may Investigate, Shadow or Paper Copy.

## MEANINGFUL-UPDATE EXAMPLES

Depending on source type:

- wallet opens/closes/scales a material position;
- trader changes risk/leverage materially;
- strategy publishes/version changes;
- agent changes target exposure;
- cohort positioning flips;
- source reputation/track record materially changes.

Avoid noisy alerting on every insignificant tick.

## EMPTY STATE

The source has produced no new qualifying observations since follow began.

## FAILURE

- source adapter unavailable;
- notification delivery failure;
- source identity disappears/changes;
- provider coverage lost.

Follow remains durable even if current observation delivery is degraded.

## UNKNOWN

The user may follow a source whose completeness is unknown. Updates must preserve that caveat.

## RETRY

Notification delivery may retry idempotently. Source-observation retries cannot duplicate semantic events.

## PARTIAL

Some source feeds may remain available while others fail. Show the coverage change.

## CANCEL

Unfollow stops future subscription activity but does not delete historical observations or any separate Shadow/Copy relationship.

## BACK / REFRESH / RESTART

Follow state is server/durable-state owned, not browser-local.

## OWNER / AUTHORITY

Follow service owns subscription state. It has **zero portfolio/execution authority**.

## PRIVACY

Follow lists and notification preferences are private unless the user deliberately shares them.

## RECOVERY

On restart, resume from durable follow relationships and observation cursors. If events may have been missed, reconcile current source state before generating a “change” claim.

## NEXT JOURNEY

- J03 Investigate Source
- J07 Shadow
- J10 Paper Copy
- remain Follow-only.