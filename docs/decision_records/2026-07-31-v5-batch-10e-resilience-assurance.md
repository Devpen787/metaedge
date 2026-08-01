# V5 batch 10E — five cross-process resilience assurances

Date: 2026-07-31
Status: locally completed in one isolated evidence packet; not deployed
Database: `/tmp/metaedge-v5-resilience.z8vRFy/db.json`
Money boundary: paper only; live execution locked

## Decision

Convert five previously test-only resilience claims into executable,
cross-process assurance scenarios. A scenario may append its V5 assurance
record only after every assertion succeeds. The harness refuses any database
outside a specially named temporary directory and refuses to overwrite an
existing database.

## Five completed scenarios

1. Intent restart recovery persisted a trade while its intent remained
   `RISK_ACCEPTED`, restarted the process, reconciled it to `EXECUTED`, and
   bound the resulting intent, trade, and audit IDs.
2. Partial-fill restart recovery persisted the first fill, restarted,
   preserved `PARTIALLY_FILLED`, then completed on a different observation
   without duplicating the first fill.
3. Outcome restart recovery persisted a complete closed episode, restarted,
   produced exactly one controlled outcome and lifecycle application, then
   proved a second reconciliation was idempotent.
4. Stale-data rejection sent a different but over-age observation through the
   real paper broker and proved a durable `BROKER_REJECTED` event with
   `STALE_MARKET_OBSERVATION`.
5. Write-failure injection forced a canonical serialization failure, proved
   the database bytes and cache remained unchanged, proved no staging file was
   left behind, then completed a new file-and-directory-synced write.

## Assurance records

- `population_assurance_v5_3aa54c52c80986cc9144263d` — intent restart;
- `population_assurance_v5_39b56e1412634cfe52df0cdc` — partial-fill restart;
- `population_assurance_v5_6ede6aa5ace1e32ac1578b6f` — outcome restart;
- `population_assurance_v5_df38ce19a33ebfa1aff24dcb` — stale-data rejection;
- `population_assurance_v5_57aeee547f5af7704159accb` — write-failure recovery.

Each record is V5-scoped, content hashed, deduplicated, and linked to the
scenario's canonical artifact IDs.

## Combined packet result

The same isolated database then ran ten continuous population cycles:

- 10/10 distinct clean cycles;
- 5,460 evaluations and zero organically routed intents under current market
  evidence;
- 14 registered and visible V5 families;
- exact Research Fleet parity for the two assurance-fixture trades;
- all five new assurances true;
- partial fill, reconciliation, controlled outcome, lifecycle reactivation,
  and UI parity true;
- live execution locked.

This packet originally remained `no_go` for one reason only:
`PORTFOLIO_VETO_OBSERVED_NOT_PROVEN`. Batch 10F subsequently added a linked,
canonical portfolio-cap veto and earned `go_local_paper_operation` in a fresh
combined packet. See
`2026-08-01-v5-batch-10f-local-mechanics-acceptance.md`.

The two trades and controlled outcome in this packet are deliberately isolated
assurance fixtures. They prove restart/outcome mechanics, not a profitable
market edge and not organic strategy execution.

## Regression proof

After the combined packet, the complete local verification passed: 72/72
decision tests, 158/158 discovery tests, TypeScript, production build, and
`git diff --check`. The build emitted only the existing large-chunk advisory.
