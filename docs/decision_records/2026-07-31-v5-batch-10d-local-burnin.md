# V5 batch 10D — isolated local burn-in

Date: 2026-07-31
Status: completed with an honest `no_go` verdict
Database: `/tmp/metaedge-v5-burnin.UpOiNm/db.json`
Money boundary: paper only; live execution locked

## Run

The bounded runner executed ten decision cycles against a fresh temporary
database while the paper broker, portfolio allocator, outcome reconciler, and
risk-exit clock were armed. It did not touch the repository's normal database.

## Results

- 10/10 distinct cycles were operationally clean after the timer-starvation
  correction;
- 5,460 strategy/symbol evaluations;
- 0 paper intents routed under the market evidence available to this run;
- 0 fills and 0 partial fills;
- 14 registered experiments and 14 visible V5 Research Fleet families;
- 0 V5 ledger trades and 0 V5 UI metric trades, an exact parity result;
- the server reopened the database with `legacy_specs=0`, proving authority was
  established before active V5 strategy registration;
- live execution stayed locked.

## Verdict

`no_go` for claiming a proper operating V5 population. The run did not yet
produce execution, partial-fill, portfolio-veto, lifecycle-reactivation,
restart-reconciliation, or resolved-control evidence, and did not perform the
declared stale-data or durable-write fault injections within this packet.

An earlier intermediate run produced routed intents and fills, but it had
registered the frozen strategy hashes before creating the authority cutoff.
Review caught that ordering error. That run is invalidated and excluded from
the acceptance evidence; the runner now initializes authority first, and the
operation gate rejects a missing cutoff or any active strategy hash captured
as legacy.

This is an operational result, not a failed-strategy verdict. The population
evaluated current evidence and correctly emitted no trades; the release gate
is withholding the stronger claim until executions and all missing resilience
scenarios are demonstrated.

## Regression proof

After the authority-order correction, the full local verification passed:
71/71 decision tests, 158/158 discovery tests, TypeScript, production build,
and `git diff --check`. The build emitted only the repository's existing large
chunk advisory.
