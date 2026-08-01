# V5 batch 9 — Research Fleet integration

Date: 2026-07-31
Status: locally implemented and component/API verified; not deployed
Money boundary: paper only; live execution locked

## Decision

Use the existing Research Fleet list as the operator surface for every strategy
family. Do not add another dashboard panel. V5 and historical rows remain
visible but their metrics are never combined.

## Implemented

- `server/research.ts` now builds V5 rows from the canonical experiment,
  observation, intent, fill, outcome, and portfolio ledgers.
- Every row carries version, lifecycle, permission, latest regime, order
  health, exposure, strategy/spec hashes, parent version, and lineage IDs.
- The existing row expands to recent outcomes and full lineage.
- `src/components/ResearchFleet.tsx` defaults to V5 and provides V5, legacy,
  and all-history filters. The all-history view explicitly labels totals as
  non-comparable.
- Golden Cross strict and participate are ordinary, separately labeled V5
  rows.
- Unresolved orders are surfaced as an alert in the list rather than hidden by
  viewport size.
- `verifyResearchFleetLedgerParityV5` checks registered-family coverage and V5
  trade-total parity without mutating state.

## Local proof

The focused Research Fleet and population tests cover all lifecycle states,
responsive wrapping, Golden Cross identity, unresolved visibility, legacy/V5
separation, and all 14 registered experiment rows. The authority-corrected
isolated burn-in verified exact ledger/UI parity at zero V5 trades. Rendered
desktop and constrained-width browser checks showed all 14 rows, the selected
V5 filter, no horizontal overflow, and no browser warnings or errors.

## Boundary

This proves local rendering contracts and ledger parity. It does not prove the
deployed site contains these changes; production remains on the earlier
deployed commit until separately approved and deployed.
