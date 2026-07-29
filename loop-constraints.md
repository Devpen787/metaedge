# Flywheel v3 Constraints

These constraints are binding. The runtime copy lives in `config/research/flywheel-v3-control.json` and the control audit must fail when the documented and configured invariants drift.

1. Live execution and live capital remain locked.
2. Numerical research, portfolio, execution, and forward verdicts are non-overridable.
3. Failed, blocked, declined, expired, and killed evidence is append-only.
4. Every transform, filter, parameter, horizon, cost, regime, manual choice, and automated choice consumes a declared trial.
5. A lockbox dataset version is evaluated once per candidate-family version.
6. Forward evidence must not have existed when the research version was sealed.
7. No new research-ready evidence means no research run.
8. Changed raw data inside a loop cadence is buffered, not recomputed immediately.
9. Agents must cite evidence IDs and may return `insufficient_evidence`; they may not invent missing values.
10. Dissent is preserved. A manager summary may not erase bull, bear, or risk objections.
11. Resource write scopes require a lock; overlapping loops may not write concurrently.
12. New paid sources, credentials, historical repairs, mechanism families, thresholds, risk limits, ambiguous settlements, venues, strategy resurrection, and live-state changes require a human gate.
13. Private keys, seed phrases, wallet tokens, and deployment secrets are prohibited.
14. A blocked market lane may not be described as operational alpha.
15. Planning and prose do not count as implementation or result proof.
