# V5 batch 10H — reproducible acceptance bundle

Date: 2026-08-01
Status: locally implemented; not deployed

## Decision

The one-command isolated acceptance run now emits and persists a
content-addressed `local-acceptance-bundle.v5`. It binds:

- the immutable population policy hash;
- valid assurance record IDs, kinds, and evidence hashes;
- the ten clean cycle IDs;
- decision-diagnostic hashes;
- forward-checkpoint hashes;
- the exact mechanics, economic, deployment, and capital boundaries.

Only assurance records whose evidence hash recomputes correctly enter the
bundle. An optional `METAEDGE_ACCEPTANCE_BUNDLE_PATH` writes a new JSON file
with create-only semantics so an earlier packet is never silently overwritten.

## Boundary

Every bundle is fixed to `isolated_local_mechanics_only`,
`economicEdgeProven: false`, `deploymentAuthorized: false`, and
`liveExecution: locked`.

## Fresh isolated evidence

- database: `/tmp/metaedge-v5-resilience.ddGpfA/db.json`;
- exported bundle: `/tmp/metaedge-v5-resilience.ddGpfA/acceptance-bundle.json`;
- bundle: `local_acceptance_v5_11cf793ca5480799ff48687b`;
- bundle hash:
  `11cf793ca5480799ff48687ba7e6470f01c7551aaa8c080d5fb09ac38b061d16`;
- 7 valid assurance hashes, 10 clean cycle IDs, 10 diagnostic hashes, and
  10 checkpoint hashes;
- mechanics GO, economic edge false, deployment unauthorized, live locked.

The outcome-restart fixture now carries complete trade and fill linkage and is
passed through the real startup order reconciler before outcome acceptance.
Post-packet replay inspected five intents, marked none unresolved, and
recomputed the existing outcome without an immutability violation.
