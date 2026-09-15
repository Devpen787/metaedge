# J13 — Improve / Pause / Retire

Status: **Detailed draft for human review**

## USER JOB

Use accumulated evidence to improve a strategy or source policy, pause it, or retire it without rewriting history.

## PURPOSE

Learning should create explicit lifecycle changes instead of silently mutating an existing version.

## AUTHORITATIVE STATE

Candidate concepts: `Strategy`, `StrategyVersion`, `CopyRelationship`, `AgentDefinition`, `LifecycleDecision`, `LifecycleReason`, `EvidenceSnapshot`.

## IMPROVE

1. Review evidence from historical tests, shadow runs, paper activity, position management and missed-opportunity analysis.
2. Identify which rule or assumption may need changing.
3. Show the proposed change with the evidence/reason that motivated it.
4. User approves a new version/policy.
5. Old version stays immutable and attributable.
6. New version returns to evaluation.

## PAUSE

Pausing stops new proposals. Existing simulated positions are handled through an explicit position-management policy rather than being silently abandoned. Resume requires an explicit state change.

## RETIRE

Retirement stops new proposals while preserving historical evidence and lineage. A future derivative creates a new version/lineage rather than rewriting the retired one.

## LEARNING LAW

Do not change a strategy because of one good or bad outcome. Separate signal quality, execution assumptions, market regime, sizing, behavior and randomness where possible.

## ANTI-PARALYSIS LAW

Do not treat every weak period as proof the thesis is dead. Lifecycle decisions should distinguish weak evidence, regime mismatch, execution issues, over-conservatism and actual thesis failure.

## UNKNOWN

If attribution is ambiguous, preserve the ambiguity. Do not invent a lesson just to justify a change.

## VERSIONING

Any material rule/configuration change that could change decisions creates a new durable version.

## OWNER / AUTHORITY

User owns final lifecycle changes to user-controlled strategies and policies. Automation may recommend changes or enforce already-approved lifecycle rules, but may not rewrite historical evidence.

## NEXT JOURNEY

Return the new version to Backtest, Shadow, Paper or Agent evaluation as appropriate.
