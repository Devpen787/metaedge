# V5 batch 10B — continuous operation and supervision

Date: 2026-07-31
Status: locally implemented and exercised; not deployed
Money boundary: paper only; live execution locked

## Decision

Operational health is a separate claim from strategy performance. A cycle is
clean only when the decision runtime, paper broker, portfolio reconciler,
outcome reconciler, and risk-exit loop are all present, enabled, and fresh.

## Implemented

- `server/v5/population.ts` defines an immutable V5 operation policy, records
  distinct-cycle samples, checks population range/diversity, clock health,
  unresolved-order SLA, V5-only agents/writers, and live lock.
- The operation snapshot and burn-in assessment are available through the V5
  status and research APIs.
- The server starts a population supervisor after the decision runtime.
- `scripts/v5_population_burnin.ts` runs bounded isolated paper cycles and
  reports operational, execution, parity, and acceptance evidence.
- Repeated samples of one decision cycle do not count as multiple cycles.

## Failure discovered and corrected

The first isolated ten-cycle run produced only 2 clean cycles. Long decision
work starved the timer-driven portfolio and outcome reconcilers, whose clocks
became stale. The burn-in therefore failed rather than masking the defect.

The runtime now exposes explicit once-per-cycle portfolio and outcome
reconciliation functions. The burn-in calls them after every decision cycle;
the ordinary interval workers remain active for server operation. A later
fresh, authority-corrected run completed 10/10 distinct clean cycles.

## Boundary

Ten clean cycles establish local orchestration health only. They do not prove
profitability, long-horizon reliability, production scheduling, or all
resilience scenarios.
