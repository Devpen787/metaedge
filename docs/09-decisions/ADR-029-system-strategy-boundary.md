# ADR-029 — Strategy decides opportunity; MetaEdge governs action

Status: `DECIDED`

Date: 2026-09-15

## Context

While stress-testing anti-paralysis behavior, realistic examples such as breakouts, wallet accumulation, liquidation cascades, funding crowding, and scout sizing began appearing in the product documents.

Those examples are useful fixtures, but allowing them to harden into platform rules would create a hidden MetaEdge house strategy and blur the boundary between market thesis and trading infrastructure.

## Decision

A `StrategyVersion`, CopyPolicy, manual thesis, or agent strategy decides:

- what constitutes an opportunity;
- which evidence matters;
- desired exposure;
- horizon;
- invalidation;
- scaling/reduction/exit/reversal logic.

MetaEdge decides:

- whether observations/evidence are valid;
- whether the View is structurally valid and authorized;
- how multiple Views aggregate;
- whether requested exposure fits portfolio/risk constraints;
- the canonical execution delta;
- idempotency, execution, reconciliation, attribution, and recovery.

Scenario market examples are **fixtures**, not canonical signal definitions.

## Consequences

1. Two strategies may consume the same EvidenceProfile and disagree.
2. Risk cannot demand its own market confirmation; it constrains exposure and integrity.
3. Portfolio aggregation does not declare which thesis is correct.
4. Strategies cannot invoke broker/wallet state directly.
5. Replacing a StrategyVersion should not require rewriting the execution subsystem.
6. Platform validation must test ability to act on an eligible View without proving that the example strategy itself has an edge.

## Non-goal

Do not build a universal MetaEdge signal/confidence model that silently converts every evidence family into one master market opinion.

See `docs/03-domain/SYSTEM_STRATEGY_BOUNDARY.md`.