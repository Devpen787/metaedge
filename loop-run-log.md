# Flywheel v3 Human-Readable Run Log

Canonical machine runs are append-only in `data/opportunity-factory-v3/control/run-log.jsonl`. This file records milestones and defects; it is not a substitute for the ledger.

## 2026-07-15

- Installed the nine-loop control registry, budgets, cadence rules, circuit breaker, atomic state, append-only run and escalation stores, and resource locks.
- First governed acquisition completed with 3,763 baseline observations.
- First governed discovery completed with 250 current candidate contracts and live execution locked.
- The first repeat exposed a false-evidence defect: modification times changed when identical source files were rewritten. Replaced modification-time identity with recursive content hashing and added a regression test.
- A later repeat exposed missing cadence enforcement while active collectors appended real rows. Added per-loop cadence gates so raw evidence accumulates without retriggering the six-hour research cycle.
- Final repeat completed in 1.3 seconds with acquisition `no_op / CADENCE_NOT_DUE` and discovery `no_op / CADENCE_NOT_DUE`; no locks remained and both integrity surfaces were clean.
- Current money result remains zero promoted alpha and no-trade. The control-plane improvement is operational, but it does not manufacture a profitable result.
- Data/world audit sealed 97 files and 856,818 records into dataset `dataset_1f22a52805bf6d6d57e7`; 93 files passed and four empty funding histories were quarantined.
- Deterministic parity audit persisted contract `world_contract_899121384fc973245a12` over 194 real stock/spot events. Historical and paper traces produced the same parity hash with clean append-only integrity and live execution locked.
- Historical promotion remains numerically blocked because the universe version is a current snapshot and stock corporate-action provenance is not point-in-time. That snapshot is valid only for prospective paper-forward evidence after its recorded `knownAt`.
- Signal research evaluated 27 fully counted transform/threshold choices each for AAPL/SPY and AAVE/BTC. Neither produced a robust plateau or adequate holdout event support; every finite holdout lower-confidence edge was non-positive, so both remain blocked and no-trade.
- Seven-stream lane audit produced zero forward candidates. The evidence-bound council preserved bull/bear dissent but all seven non-overridable numerical gates failed; manager output remained six research-only and one no-trade, with no paper position and live execution locked.
- Current validation policy sealed and charged 34 research choices each for AAPL and AAVE. Both passed 0/3 required regimes; AAPL degraded out of sample and AAVE had non-positive mean strategy return. Zero lockboxes entered untouched forward quarantine.
- Portfolio/order execution audit passed against the current sealed policy. Target-portfolio, weight-ledger, order-ledger, and execution-cohort kernels are implemented, but all result fields remain intentionally empty because zero evaluations cleared untouched-forward admission. The stored audit is blocked, integrity-clean, and live locked.
- Refreshed lane/council evidence remains 0 forward candidates, 6 research-only streams, 1 no-trade stream, and 0/7 numerical gates passed. Phase 7 begins from that honest state; no retrospective outcome will be relabeled as untouched forward evidence.
- Forward-learning audit is operational with post-cutoff lineage, reconciled raw/benchmark/factor/cost/execution/counterfactual attribution, dataset/source drift, decay, kill, and new-lockbox re-research. Current result is 2 blocked evaluations and zero admitted observations or derived claims.
- The first integrated attribution run exposed a timestamp/idempotency collision and failed closed. Evidence-watermark timestamps corrected it; repeated audits are now idempotent, the controlled retry completed, and the failed record remains append-only.
- All nine governed loops now have at least one successful completion. The latest governance run is clean with four legacy-version warnings, zero current integrity failures, zero active locks, zero open escalations, and live execution locked.
- Completion verification added evidence-bound, expiring, one-use human gate approvals and a unified v3 operator API. Final current-state checks pass 70 discovery tests, 15 decision tests, 4 independent math vectors, TypeScript, production build, control audit, live API and scheduler proof.
- Final operator verdict is intentionally split: operation `operational`; economic result `no_promoted_alpha`; capital `live_locked`. New raw data is visibly buffered until the next research cadence rather than being conflated with the last parity-audited world.
