# MetaEdge Flywheel v3 Operating Loop

## Goal

Continuously turn point-in-time multi-market evidence into accountable paper hypotheses, reject weak or unsafe ideas quickly, learn from untouched forward outcomes, and improve the next research cycle without allowing narrative agents to override numerical evidence or unlock live capital.

## Product boundary

- Mode: paper research and paper execution only.
- Live execution: locked in configuration, ledgers, APIs, and operator output.
- Scope: stocks, spot crypto, perpetuals, memecoins, prediction markets, cross-chain arbitrage, and cross-market quantitative strategies.
- A lane is operational only when its data, validation, paper ledger, risk budget, attribution, kill rule, and correlation record exist. Otherwise its blockers remain visible.

## Evidence-to-decision topology

1. Poll and quarantine source evidence.
2. Freeze a content-addressed dataset and as-of universe view.
3. Generate declared transforms, events, relationships, and strategy trials.
4. Run deterministic leakage, multiple-testing, regime, factor, cost, and lockbox verification.
5. Let the evidence-bound decision council challenge surviving candidates:
   - specialist evidence analysts;
   - bullish and bearish adversarial reviewers;
   - typed research synthesis and paper-trade proposal;
   - aggressive, neutral, and conservative risk dissent;
   - deterministic portfolio/risk adjudication;
   - final paper-only manager decision.
6. Form a constrained target paper portfolio and simulate it in fast next-period weight mode.
7. When implementation is part of the edge, convert proposals into explicit paper orders, fills, cash, positions, margin, and NAV; assign randomized maker, taker, delayed, and no-trade cohorts.
8. Resolve untouched forward outcomes and execution shortfall.
9. Attribute what held, drifted, failed, or was never testable.
10. Kill, quarantine, or reopen research with a new declared lineage; never rewrite the old result.

## Governed loops

The machine-readable authority is `config/research/flywheel-v3-control.json`.

| Loop | Purpose | Current automation level |
| --- | --- | --- |
| `market_data_health` | Poll sources and audit freshness, gaps, anomalies, and coverage | L3 deterministic, operational |
| `evidence_gap_acquisition` | Rank the smallest valuable missing adapter | L1 report, operational |
| `signal_discovery` | Generate accountable hypotheses and trials | L2 assisted boundary, deterministic stages operational |
| `numerical_verification` | Enforce research, regime, lockbox, and cost gates | L3 deterministic, operational |
| `forward_quarantine` | Resolve only genuinely new authoritative outcomes | L3 deterministic, operational; no admitted v3 candidate today |
| `execution_calibration` | Learn fills, impact, decay, and shortfall | L3 deterministic, operational; empirical cohorts admission-blocked |
| `portfolio_risk` | Build the target paper portfolio under hard risk limits | L3 deterministic, operational; target withheld by validation |
| `attribution_research` | Attribute outcomes and trigger kill or re-research | L3 deterministic, operational; current result blocked/empty |
| `research_governance` | Audit budgets, drift, blockers, and the human inbox | L1 report, operational |

## Cadence and early exits

- The production server launches the governed runner every six hours.
- Each loop has its own cadence. A changed raw file does not bypass the research cadence.
- Timestamp-only rewrites do not count as evidence; manifests hash file contents.
- Identical research evidence returns `NO_NEW_EVIDENCE`.
- Changed evidence inside the declared interval returns `CADENCE_NOT_DUE`.
- Repeated failures on the same evidence trip `NO_PROGRESS_CIRCUIT_BREAKER`.
- Budget exhaustion changes the loop to report-only, paused, or escalated mode before research begins.

## State and recovery

- Append-only runs: `data/opportunity-factory-v3/control/run-log.jsonl`
- Append-only escalations: `data/opportunity-factory-v3/control/escalations.jsonl`
- Atomic current state: `data/opportunity-factory-v3/control/state.json`
- Collision locks: `data/opportunity-factory-v3/control/locks/`
- Paper research ledger: `data/opportunity-factory-v2/`
- A graph, model, prompt, policy, dataset, universe, or trial change creates a new identity; it may not resume or overwrite incompatible work.

## Human gates

Human approval is required for paid or credentialed data, historical repairs, new mechanism families, threshold or risk-limit changes, ambiguous settlement, venue access, strategy resurrection, and every transition toward live execution. No seed phrase, private key, wallet secret, or unattended order path is permitted.

## Completion condition

The loop is complete only when all nine governed loops are implemented and verified, every market lane is backed by working paper evidence or explicit blockers, the decision council is evidence-bound and replayable, forward and execution attribution produce durable results, all audits pass, the running API exposes honest current state, and live execution remains locked.
