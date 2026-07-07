# MetaEdge EdgeOps

Date: 2026-07-07

## What This Is

EdgeOps is the research and evidence layer for MetaEdge paper trading. Its job
is to turn paper trades into falsifiable learning loops instead of agent theater,
dashboard noise, or stale research notes.

MetaEdge remains paper-first. EdgeOps does not claim live trading readiness,
profitability, alpha, or real-money execution.

## Start Here

1. Read [EDGEOPS_RESEARCH_BRIEF.md](./EDGEOPS_RESEARCH_BRIEF.md) for the current
   thesis, source-backed lessons, and first research-card candidates.
2. Use [EDGEOPS_CARD_TEMPLATE.md](./EDGEOPS_CARD_TEMPLATE.md) to create one
   bounded signal or disqualifier card.
3. Use [EDGEOPS_PROMPT_PACK.md](./EDGEOPS_PROMPT_PACK.md) when asking an agent
   to research, critique, classify, or review a paper trade.
4. Use [EDGEOPS_PRODUCT_SPEC.md](./EDGEOPS_PRODUCT_SPEC.md) before changing the
   app or trade ledger.
5. Run the loop in [EDGEOPS_OPERATING_LOOP.md](./EDGEOPS_OPERATING_LOOP.md).
6. Check findability and freshness in
   [EDGEOPS_ARTIFACT_REGISTRY.md](./EDGEOPS_ARTIFACT_REGISTRY.md).

## Current Source Notes

- [RESEARCH_RESPONSE_1_BOT_HEURISTICS.md](./source-notes/RESEARCH_RESPONSE_1_BOT_HEURISTICS.md)
- [SOURCE_LEDGER_BATCH_1.md](./source-notes/SOURCE_LEDGER_BATCH_1.md)
- [RESEARCH_RESPONSE_2_ALPHA_ARCHITECTURE.md](./source-notes/RESEARCH_RESPONSE_2_ALPHA_ARCHITECTURE.md)
- [SOURCE_LEDGER_BATCH_2.md](./source-notes/SOURCE_LEDGER_BATCH_2.md)

## Operating Rule

No signal becomes a product claim until it has:

- a research card
- a falsifier
- source provenance
- a benchmark
- a paper-forward test
- a post-trade review path

## Test

Run:

```bash
npm run edgeops:check
```

This verifies that the EdgeOps docs, source ledgers, prompts, first cards, and
product-spec fields are present.

## Staleness Rule

Any EdgeOps source note, signal card, or weekly report older than 14 days is
treated as stale unless it has been refreshed, intentionally archived, or marked
as background-only. Research sources can remain useful, but operating claims must
show freshness.

- [FLEET_CONTROL_CONTRARIAN_REVIEW_2026_07_07.md](FLEET_CONTROL_CONTRARIAN_REVIEW_2026_07_07.md): red-team pressure test — how this system could manufacture false confidence; drove the paper-fill cost-realism change.
- [FLEET_CONTROL_SOURCE_LEDGER.md](FLEET_CONTROL_SOURCE_LEDGER.md): negative-evidence sources (Barber-Odean, day-trader studies, false-discovery stats, CFTC advisory).
