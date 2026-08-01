# V5 batch 10K — Research Fleet operator truth

Date: 2026-08-01
Status: locally implemented and browser verified; not deployed

## Decision

The existing Research Fleet response now includes the V5 operator-truth
snapshot. The existing view—not a separate product panel—shows a compact truth
strip containing:

- local mechanics GO/NO-GO and the explicit non-edge boundary;
- economic evidence status and organic outcome count;
- organic routes versus checks in the latest cycle;
- the exact zero-route explanation and top blocking reasons;
- forward checkpoints, zero-route streak, active incident count, and incident
  codes with their full message available as hover text;
- excluded assurance count and latest acceptance hash;
- deployment not authorized and live locked.

The existing V5/legacy family list, lineage, outcomes, and trade labels remain
unchanged below it.

## Proof

Server-rendered component tests cover the truth separation, zero-route text,
fixture exclusion, acceptance reference, deployment lock, and live lock.

An in-app browser pass verified the real local flow at desktop and narrow
viewport: the region rendered, stayed within the document width, exposed the
acceptance hash, exact blocker counts, current state, incident codes,
deployment boundary, and live lock. The browser console had no warnings or
errors. That pass used the first candidate packet and correctly exposed its
`EVIDENCE_PIPELINE_BLOCKED` and `CLOCK_STALE` state instead of inheriting its
earlier acceptance GO. The clock symptom led to the outcome-fixture lineage
fix recorded in batch 10H. The final replacement packet was then replayed
through startup order and outcome reconciliation with zero unresolved intents
and no outcome drift; it was not loaded into a second browser session.
