# J05 — Create or Copy a Strategy

Status: **Detailed draft for human review**

## USER JOB

Turn an idea—or something observed from a wallet, trader, strategy or agent—into explicit rules that can be tested, versioned and improved.

## PURPOSE

A strategy is a durable hypothesis, not a chat response and not an order. MetaEdge supports both original strategies and strategies derived from observed source behavior.

Copying a strategy means adopting or reconstructing logic. It is different from following a live source action-by-action.

## AUTHORITATIVE STATE

Candidate concepts: `Strategy`, `StrategyVersion`, `StrategyRule`, `EvidenceRequirement`, `StrategySourceLink`, `StrategyValidation`.

Every testable strategy uses an immutable `StrategyVersion`.

## HAPPY PATH — USER IDEA

1. User describes the thesis.
2. MetaEdge structures market/universe, evidence/features, desired-exposure logic, scale-up/scale-down rules, invalidation/exit logic, horizon and cadence.
3. User reviews the structured version.
4. MetaEdge validates required data/features.
5. An immutable Strategy Version is created.
6. Strategy proceeds to backtest, shadow or paper testing depending on its type.

## HAPPY PATH — DERIVED STRATEGY

1. User selects a source such as a wallet, trader or agent.
2. MetaEdge separates observed behavior from inferred rules.
3. Inferred rules are shown as hypotheses, not facts.
4. User chooses what to adopt.
5. MetaEdge creates a follower-owned Strategy Version with source lineage.
6. The derived strategy is tested independently.

## ANTI-FICTION LAW

Do not claim to know a trader's hidden strategy from wallet observations alone. Preserve what was observed, what was inferred and what remains unknown.

## ANTI-PARALYSIS LAW

A strategy does not need to prove historical profitability before it can produce a bounded paper scout, provided mechanics/data are valid and the paper portfolio allows exploration.

## FAILURE / UNKNOWN

Invalid or contradictory rules, unavailable required data, unsupported mechanics or incomplete source history must be visible. Unknown rules remain unknown rather than being invented automatically.

## VERSIONING / RECOVERY

Editing a draft updates the draft. Once versioned, changes create a new Strategy Version. Durable strategy state is independent of model/chat context.

## OWNER / AUTHORITY

User owns strategy intent and activation. Strategy domain owns versions/rules/lineage. Strategy never owns execution authority directly.

## NEXT JOURNEY

J06 Backtest, J07 Shadow, J08 Paper Portfolio, J09 Paper Trade or J14 Paper Agent Operation.
