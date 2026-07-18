# MetaEdge Flywheel v3 - Quant Method plus Operational Loop

## Goal

Implement and verify the complete paper-first Flywheel v3 by combining the Max Dama quantitative research method with a durable Loop Engineering control plane. The system must improve how signals are discovered, prevent research self-deception, learn execution and portfolio behavior from forward paper evidence, run continuously with explicit budgets and circuit breakers, expose honest operator results, and keep live capital locked.

## 2026-07-16 Recovery Goal (active)

The July 15 fast-perps extension failed its completion audit in production shape: monolithic synchronous JSONL scans exhausted the server, rolling evidence created 14,312 short-lived contracts, and the runtime produced zero lifecycle events, shadow decisions, or shadow outcomes. Recover by preserving raw evidence as historical replay, quarantining all legacy derived state, implementing a bounded partitioned evidence store, recording decisions before outcomes exist, accumulating evidence on stable strategy versions, and proving the repaired paper-only path before any canonical integration.

## 2026-07-16 Adversarial second audit (completed; recovery acceptance failed)

Re-audit the exact recovery build while its measured soak runs. Treat the audit as read-only: verify persisted/runtime truth, map every requested acceptance rule to code and evidence, trace storage/lifecycle/statistical/operator/wallet failure modes, and rank anything missed as a code defect, proof defect, or still-open time gate. Do not run CPU-heavy verification during the soak and do not repair findings without a separate implementation request.

## 2026-07-18 Availability-split completion (active)

Finish the recovery by replacing the fast-perp challenger's continuous liveness contract with a disposable one-shot research job and an immutable proposal bridge. Serving, continuous-paper, and research roles must have separate failure domains. The continuous-paper node is the sole writer of canonical decisions, outcomes, lifecycle events, and authorizations. Completion uses finite adversarial proof rather than a monolithic 24-hour soak: repeated real-corpus batches, killed/timeout/corrupt/stale/duplicate/concurrent bundle cases, and a two-hour partition-boundary burn-in. Live execution remains locked and profitability remains unproven.

### Recovery phases

1. **Completed - Preserve and contain:** recovery branch, immutable archive, cutover manifest, startup disabled by default, corrected current-state documentation.
2. **Completed - Red tests:** storage, forward timing, stable lineage, trial budget, lifecycle restart, cost reconciliation, operator health, and wallet concurrency.
3. **Completed - Bounded runtime:** partitioned evidence, lock-and-merge materialized summary, persistent worker clocks, stable contracts, online decision writer, later resolver.
4. **Completed - Honest economics and safety:** global trials, repeated-look accounting, risk reservations, wallet atomicity and no bypass.
5. **Completed - reproducible green checkpoint:** recovery baseline preserved in `3b10d00` without raw data, secrets, or bulky soak series.
6. **Completed - availability split implementation:** three continuous clocks; deadline-bound research attempt ledger; immutable chunked evidence exports and proposals; hash/schema/expiry/authority validation; locked idempotent import; serving-node discovery disabled.
7. **In progress - finite availability proof:** deterministic 20-cycle proof passed twice; real 712 MB export, bounded batch, and canonical no-contract import passed; two-hour continuous-paper burn-in is running across hourly partition maintenance.
8. **Pending - final verification and commit:** rerun discovery/decision/integration/recovery/performance tests, independent verifier, lint, build, smoke, and strict capability matrix; finalize the compact proof pack and commit. Canonical Python integration remains a later goal.

### Recovery invariants

- Cutover: `2026-07-16T11:02:54+0200`.
- All archived evidence is `historical_replay`; it cannot enter untouched-forward or funded-paper counts.
- Canary evidence proves plumbing only and cannot enter economic promotion.
- Only events received after cutover may create `paper_forward` decisions.
- Fast-perps startup remains disabled by default until recovery verification passes.
- Live execution remains globally locked; no real wallet call is part of recovery proof.
- Research batch failure may mark research degraded, but it must never make current recorder/signal/resolver/lifecycle health false when those continuous components remain healthy.
- A batch job replaces a continuous heartbeat with a persisted attempt lease, hard deadline, and terminal result; overdue attempts publish no proposal and are safely superseded by a later scheduled attempt.
- Evidence exports and research proposals are immutable bundles. Canonical decisions, outcomes, lifecycle events, pauses, and authorizations never cross the bridge as writable state.

## Completion contract

- Preserve and reproduce the Flywheel v2 live baseline and all unrelated worktree changes.
- Use point-in-time, survivorship-aware, versioned evidence and deterministic world adapters.
- Audit and quarantine invalid data rather than silently fabricating or consuming it.
- Generate accountable feature transforms, calibrated signals, event studies, information horizons, and parameter surfaces.
- Count all automated and manual research choices; enforce budgets, write-once lockboxes, regime gates, factor attribution, and untouched forward quarantine.
- Produce target paper portfolios with correlation/factor/scenario/tail/drawdown/capacity controls.
- Maintain two deterministic simulation paths over the same strategy/world contract: a fast next-period target-weight engine for portfolio research and a stateful order/fill ledger when implementation is part of the edge. Reconcile both through cash + marked positions = NAV invariants.
- Add a structured multi-agent decision council after deterministic evidence generation: specialist analyst packets, explicit bull/bear dissent, a synthesis proposal, independent numerical risk review, and a final paper-only manager gate with complete provenance.
- Learn maker/taker/delayed/no-trade execution outcomes, impact, fill, adverse selection, alpha decay, and shortfall from paper cohorts.
- Run forward attribution, drift, decay, kill, and re-research without rewriting failed strategies.
- Operate through durable loop configuration, state, constraints, run logs, budgets, circuit breakers, collision locks, numerical verification, and human gates.
- Cover six market lanes plus cross-market quant strategies through working evidence or explicit blockers.
- Pass fresh targeted tests, decision tests, independent math references, typecheck, production build, running API proof, scheduled-cycle proof, ledger integrity, loop readiness/drift audits, and baseline comparisons.

## Hard invariants

1. Live execution and capital remain locked.
2. Agents may propose and explain; deterministic numerical gates alone decide research promotion.
3. Failed evidence is append-only. No deletion, relabeling, or threshold weakening after results.
4. Any parameter, transform, filter, cost, risk, or manual tuning choice consumes a declared trial.
5. A lockbox dataset version is evaluated once per candidate family; later changes require a new version and trial lineage.
6. Forward quarantine uses observations that did not exist when research began.
7. No new evidence means no new research cycle; repeated failures trip a circuit breaker.
8. Planning files organize work but never count as implementation proof.
9. LLM debate may challenge assumptions and propose tests, but it may not manufacture evidence, override numerical validation, change a sealed trial, or approve live execution.
10. Every council run is bound to immutable evidence, universe, model/prompt, graph-shape, and decision-policy versions so a changed agent topology cannot silently resume or overwrite an earlier run.
11. Signal returns are never portfolio returns by assumption. Target weights must become holdings/trades, and orders must become fills before cash, positions, exposure, margin, costs, and NAV are calculated.
12. Same-bar order ambiguity uses a documented conservative convention or higher-frequency evidence; it may not choose the favorable path after observing the bar.

## Phases

1. **Completed - Baseline and contracts:** inventory dirty worktree, v2 runtime, current ledgers, tests, service, Loop Engineering readiness, and exact v3 schemas.
2. **Completed - Operational control plane:** LOOP/state/constraints/budget/run-log artifacts plus runtime-enforced budgets, attempts, circuit breakers, locks, escalation, audit and drift checks.
3. **Completed with explicit evidence blockers - Data and world integrity:** versioned datasets/universes, survivorship membership enforcement, publication-time alignment, anomaly quarantine, deterministic clock/randomness, and shared historical/paper event engine with next-bar semantics. Historical membership and stock corporate-action provenance remain unavailable, so retrospective promotion is mechanically blocked while the recorded current universe is valid prospectively.
4. **Completed with lane blockers - Discovery method and decision council:** transformation registry, normalization/residualization/smoothing, calibration, traffic analysis, event studies, information horizons, parameter plateau scoring, structured seven-stream packets, specialist reports, adversarial bull/bear review, typed synthesis, deterministic risk adjudication, and paper-manager decisions. Missing lane evidence remains visible and non-promotable.
5. **Completed - Validation and lockbox:** complete trial accounting, research budgets, sealed versions, one-evaluation write-once lockbox, regime K-of-N, beta/factor attribution, degradation gates, numerical verifier evidence, and untouched-forward admission rules.
6. **Completed with admission blockers - Portfolio and execution learning:** fast weight-mode accounting, stateful order/fill mode, target portfolio with shrunk/factor covariance and scenario/tail/drawdown/capacity gates, contract/margin/borrow/funding semantics, deterministic execution cohorts, empirical fill/impact/decay/shortfall contracts, and cash-plus-marked-position NAV reconciliation. The current sealed validation policy has zero forward candidates, so the operator audit correctly withholds target weights, orders, and cohort outcomes instead of contaminating untouched-forward evidence.
7. **Completed with admission blockers - Forward learning and lanes:** post-cutoff lineage, raw/benchmark/factor/cost/execution/counterfactual attribution reconciliation, dataset/source drift, alpha decay, hard kill, and automatic new-lockbox re-research are append-only and numerically non-overridable. The real audit has two blocked evaluations and no admitted observations, so it correctly emits no attribution or drift claim.
8. **Completed - Runtime and operator surface:** the scheduled v3 cycle now governs all nine loops, preserves independent cadences/early exits/circuit breakers/locks, runs every v3 audit stage, exposes each ledger through APIs, and reports current-vs-history with live capital locked.
9. **Completed - Full verification:** targeted and broad tests, independent references, build, service/scheduler proof, ledger audits, loop readiness/sync, baseline measurements, unified operator verdict, enforced human gates, and requirement-by-requirement completion audit.

## Source requirements retained

- Max Dama: signal encoding, normalization, information horizons, event studies, parameter plateaus, point-in-time simulation, portfolio covariance/factors, empirical sizing, execution impact/alpha loss/shortfall/capacity.
- Loop Engineering: scheduling, durable state, skills/constraints, numerical maker-checker, worktrees and locks, least privilege, phased autonomy, budgets/run logs, circuit breakers, drift/readiness audits, human gates, and quant-specific forward quarantine lessons.
- TradingAgents: role-specialized evidence review, typed shared state, bounded bull/bear and risk debate, model-tier routing, graph-shape-aware recovery, deterministic instrument identity, verified as-of snapshots, vendor provenance, structured decision outputs, persistent outcome reflection, and multi-market context. Its narrow backtest is not accepted as proof; these mechanisms sit downstream of MetaEdge's quantitative and forward gates.
- QuantJourney Backtester v0.10.1: explicit weight versus order simulation modes, next-bar timing, fill-level costs, cash/position/NAV ledger identity, contract-aware margin/exposure, conservative same-bar ambiguity, pre-submit and fill-time risk, walk-forward refits, purge/embargo, deflated Sharpe, and trial-rank PBO. Its engine does not solve point-in-time universe membership, publication lags, borrow/financing/funding, or data provenance for us.

## Boundaries

- Do not overwrite unrelated user or Claude work.
- Do not install third-party loop scaffolding blindly; implement MetaEdge-native equivalents and verify their enforcement.
- Do not present a data-blocked lane as operational alpha.
- Do not introduce live keys, wallets, order placement, auto-merge, or unattended external writes.
