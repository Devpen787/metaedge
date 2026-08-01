# V5 batch 10C — resilience and evidence gate

Date: 2026-07-31
Status: five cross-process assurances earned locally; portfolio-veto evidence remains
Money boundary: paper only; live execution locked

## Decision

Do not infer resilience from green unit tests or quiet cycles. The local-paper
GO assessment requires independently recorded evidence for:

- intent restart recovery;
- partial-fill restart recovery;
- outcome restart recovery;
- stale-data rejection;
- durable write-failure injection;
- portfolio veto;
- reconciliation;
- dormancy-to-probation lifecycle movement;
- a controlled outcome;
- Research Fleet/ledger parity;
- ten distinct consecutive clean cycles.

Assurance records are typed, V5-scoped, deduplicated, and hash checked. Missing
or tampered evidence remains false. No public endpoint can self-award these
records.

## Existing local evidence

The decision suite already contains focused checks for stale broker evidence,
partial-fill persistence and reconciliation, startup quarantine/recovery,
durable write failure, allocator vetoes, immutable controls, outcomes, and
lifecycle transitions. The new population gate deliberately does not convert
those historical test names into operational proof automatically.

## Evidence update

The bounded cross-process harness now earns all five restart/fault assurance
records and has been combined with a ten-cycle isolated population run. That
packet also contains partial-fill, reconciliation, controlled-outcome,
lifecycle-reactivation, and UI-parity evidence. It remains `no_go` only because
no portfolio allocator veto occurred. See
`2026-07-31-v5-batch-10e-resilience-assurance.md`.
