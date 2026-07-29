# MetaEdge Flywheel v3 Completion Audit

> Historical record only. Superseded on 2026-07-16 by
> `2026-07-16-fast-perp-flywheel-recovery.md`. This report is preserved as
> evidence of the prior assessment; its operational/completion claims are no
> longer current.

Date: 2026-07-15 Europe/Zurich
Mode: Paper research
Live execution: Locked

## Outcome

Flywheel v3 is implemented and running as a paper-first multi-market research operation. The operation is healthy; an economic edge is not proven. The current deterministic verdict is `no_promoted_alpha` and `no_trade`.

This distinction is binding. Completion means the research, rejection, paper-learning, governance, and operator system is operational. It does not mean a profitable strategy exists, and it does not unlock live capital.

## Requirement matrix

| Requirement | Authoritative implementation/evidence | Result |
| --- | --- | --- |
| Point-in-time, versioned datasets | Content-addressed immutable dataset/file records and `availableAt` world events; late evidence rejected | Implemented and tested |
| Survivorship-safe universe versioning | Effective/known-at memberships, immutable universe versions, historical versus prospective selection semantics | Implemented; current real source has zero historical memberships, so retrospective promotion is blocked |
| Data quarantine | Invalid files/rows become append-only quarantine records | Operational; 4 empty funding histories are quarantined |
| Historical/paper world parity | One versioned world contract, deterministic ordering, seeded randomness, next-bar execution, identical trace hashes | Pass on 2,050-event audited corpus |
| Signal method | Causal residualization, z/robust normalization, EMA smoothing, frozen training calibration, event studies, information horizons, traffic transitions and explicit orientation | Implemented and tested |
| Robust discovery | Full parameter surfaces, near-best plateau/adjacency checks, non-overlapping events and lower-confidence edge | Implemented; current AAPL/AAVE surfaces are not robust |
| Complete trial accounting | Parameter, normalization, residualization, calibration, horizon and orientation choices are charged; actor records support automated and manual-precommit choices | 34 charged trials per current family; 68 active total |
| Sealed validation | Immutable dataset/universe/world/policy lockboxes, one evaluation, budgets, lineage, regime K-of-N, factors and degradation | Implemented; only newest lockbox per family is active and older evaluations remain superseded history |
| Untouched forward quarantine | Only passing evaluations enroll after the evidence cutoff; every observation requires post-cutoff source-event lineage | Implemented; 0 current enrollments because 0 evaluations passed |
| Portfolio construction | Sample, diagonal-shrinkage, factor and blended covariance; inverse-covariance targets; gross/position/capacity/scenario/tail/drawdown gates | Implemented and tested; current portfolio is withheld by admission |
| Weight simulation | Targets execute only on a later frame; holdings/cash/costs/borrow/funding and NAV identity are explicit | Implemented and tested; current run withheld |
| Order simulation | Market/limit/stop/stop-limit, conservative same-bar ambiguity, volume participation, partial fills, fill-time risk, margin, borrow/funding, cash/positions/NAV | Implemented and tested; current run withheld |
| Execution cohorts | Deterministic maker/taker/delayed/no-trade assignment with fill, impact, adverse selection, alpha decay and shortfall metrics plus minimum sample gates | Implemented and tested; empirical current estimate withheld because no forward decisions exist |
| Forward attribution | Raw, benchmark, factors, signed costs, execution drag and no-trade counterfactual reconcile to reported net paper edge | Implemented with immutable reconciliation gate |
| Drift and lifecycle | PSI, mean shift, variance ratio, missingness, version/source drift, decay, hard kill and new-lockbox re-research | Implemented and tested; current audit contains no fabricated drift result |
| Nine durable loops | Data health, gap ranking, discovery, numerical verification, forward quarantine, portfolio, execution, attribution and governance | 9/9 have successful governed completion records |
| State, budgets and circuit breakers | Atomic state, append-only runs/escalations, per-loop cadence, no-new-evidence exits, attempt/runtime/token/action/trial budgets and three-failure breaker | Implemented and tested |
| Locks and least privilege | Declared write scopes acquire collision locks; the scheduled runtime invokes a fixed local script allow-list; live/private-key paths are absent | Operational; zero active locks |
| Human gates | Evidence-bound expiring human approvals are required for declared gated actions, consumed before mutation and cannot be replayed | Implemented and tested; no approval is currently active or needed |
| Numerical non-override | Council debate preserves bull/bear/risk dissent, but only deterministic gates can permit paper observation | Implemented; 0/7 current gates pass |
| Multi-market coverage | Stocks, spot, perps, memecoins, predictions, cross-chain and cross-market quant appear together in structured operator state | 7/7 represented; 6 research-only, cross-chain no-trade |
| Operator visibility | Unified `/api/opportunity-factory/v3` plus individual stage APIs, current/history separation, buffered-evidence disclosure and blunt economic verdict | Running on port 3000 |
| Live-capital safety | All configs, ledgers, decisions, APIs and runtime output state live execution is locked | Pass across every integrity surface |

## Current real evidence

- Latest audited dataset before the next research cadence: 97 files and 857,788 records; 93 valid files and 4 quarantined empty funding histories.
- World audit: 2,050 events; historical and paper parity hashes match.
- Historical research remains ineligible because real historical membership and point-in-time stock corporate-action provenance are unavailable.
- New raw evidence is currently buffered for the next declared research cadence rather than silently attached to the older parity audit.
- Seven streams: 0 forward candidates, 6 research-only, 1 no-trade.
- Council: 0 paper-observe, 0/7 numerical gates passed.
- Active validation: 2 newest evaluations, 68 charged trials, 2 blocked, 0 forward candidates; 2 older same-policy evaluations are superseded history.
- Portfolio/order/cohort result: withheld, not zero-filled or simulated from rejected evidence.
- Forward-learning result: 0 admitted observations, 0 attributions, 0 drift claims, 0 promotions, 0 re-research items.
- Baseline comparison: 3 research cards became 250 accountable candidate contracts; represented market lanes widened from 3 to 6 in the legacy flywheel plus the separate cross-market quant stream; promoted alpha stayed at 0.

## Fresh verification

| Command/check | Result |
| --- | --- |
| `npm run test:discovery` | 70/70 pass |
| `npm run test:decision` | 15/15 pass |
| `npm run discovery:reference` | 4/4 independent Python vectors pass |
| `npm run lint` | Pass |
| `npm run build` | Pass; production client and server bundle |
| `npm run discovery:control-audit` | Pass; 9/9 loops completed, 0 locks, 0 escalations, no duplicate records, live locked |
| Real data/world/signal/lane/council/validation/portfolio/forward audits | Pass with the explicit blockers above |
| Production `GET /api/opportunity-factory/v3` | HTTP 200; operation operational, no promoted alpha, live locked, no critical integrity failures |
| Production scheduler | Child cycle logged governed loop outcomes with 0 exceptions and live locked |

The production build emits an existing Vite large-chunk warning. It does not fail the build or affect the research/runtime integrity contract.

## Intentionally unavailable evidence

- No historical constituent source exists in the current local evidence, so no retrospective survivorship-safe claim is made.
- No candidate cleared validation, so no target portfolio, fill cohort, forward attribution or empirical capacity result is manufactured.
- Cross-chain lacks synchronized executable quotes and gas/bridge/finality/inventory evidence, so it remains hard no-trade.
- Prediction settlements remain unresolved or independently unaudited, so probabilities are not relabeled as outcomes.
- Live execution, live pooling, secrets, wallets and real capital remain outside the running system.

These are economic/data blockers exposed by the completed operation, not hidden implementation claims.
