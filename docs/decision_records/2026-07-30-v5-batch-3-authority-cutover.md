# V5 batch 3: authority cutover and legacy containment

Date: 2026-07-30
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

MetaEdge now has one machine-enforced active trading authority:

- active artifacts must declare `authorityVersion: 5` and a `.v5` schema;
- current mutable agents are migrated once at startup;
- historical trades, decisions, specifications, revoked agents, and V3
  opportunity-factory evidence are not rewritten;
- the pre-V5 cutoff records legacy IDs and a snapshot hash;
- legacy adapters are deep-frozen, read-only, and explicitly non-routable;
- active strategy plugins, features, decisions, agents, product labels, cards,
  stores, policies, and writer inventory use the V5 contract;
- the old autonomous autotrader, direct Golden Cross entry writer, opportunity
  factory writer, fast-perp recorder, and fast-perp clocks are disabled by
  default behind `V5_LEGACY_WRITERS_ENABLED=false`;
- direct calls to the legacy Golden Cross and opportunity-factory entry paths
  also fail closed, so startup gating cannot be bypassed;
- `/api/v5/status` is the canonical authority, flag, clock, writer, inventory,
  commit, and data-freshness surface;
- `/api/opportunity-factory/v5` is the active operator envelope;
- `/api/opportunity-factory/v3` remains available only as a V5-wrapped,
  read-only, non-routable historical response.

## Rollback boundary

`V5_LEGACY_WRITERS_ENABLED=true` is an explicit rollback switch. When enabled,
the V5 status surface reports legacy writers as rollback-enabled and fails its
healthy status. It is not a normal operating mode.

`LIVE_EXECUTION_ENABLED` remains false. This batch does not authorize,
configure, or deploy live-money execution.

## Verification

- `npm run test:decision`: 35/35 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.

The production build emitted only the existing large-chunk advisory. No
deployment or production-state claim is made by this local proof.
