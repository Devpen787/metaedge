# EdgeOps Artifact Registry

Date: 2026-07-07

## Purpose

This registry answers: "Is everything we researched, discussed, and documented
findable?"

Short answer: yes for the current EdgeOps materials, with one gap. The research
and source ledgers are now findable in `docs/edgeops/`, but the actual app does
not yet collect paper-trade theses. Until that implementation exists, EdgeOps is
organized research and product design, not a live learning system.

## Canonical Entry Points

| Artifact | Path | Purpose | Freshness |
| --- | --- | --- | --- |
| EdgeOps README | `docs/edgeops/README.md` | Start here and routing map. | current |
| Research brief | `docs/edgeops/EDGEOPS_RESEARCH_BRIEF.md` | Consolidated research conclusions and first cards. | current |
| Prompt pack | `docs/edgeops/EDGEOPS_PROMPT_PACK.md` | Reusable research/trade-review prompts. | current |
| Card template | `docs/edgeops/EDGEOPS_CARD_TEMPLATE.md` | Template for falsifiable signal cards. | current |
| Product spec | `docs/edgeops/EDGEOPS_PRODUCT_SPEC.md` | Implementation target for paper-trade thesis. | current |
| Operating loop | `docs/edgeops/EDGEOPS_OPERATING_LOOP.md` | How to intake, test, review, and learn. | current |

## Source Notes And Ledgers

| Artifact | Path | Purpose | Evidence Status |
| --- | --- | --- | --- |
| Research Response 1 | `docs/edgeops/source-notes/RESEARCH_RESPONSE_1_BOT_HEURISTICS.md` | Bot failures, disqualifiers, catalysts, journal fields. | source-ledger backed, not sentence-mapped |
| Source Ledger Batch 1 | `docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_1.md` | Durable URLs for Response 1. | grouped bibliography |
| Research Response 2 | `docs/edgeops/source-notes/RESEARCH_RESPONSE_2_ALPHA_ARCHITECTURE.md` | Agent guardrails, DeFi/MEV, CVD, sell-the-news, R-multiple. | source-ledger backed, not sentence-mapped |
| Source Ledger Batch 2 | `docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_2.md` | Durable URLs for Response 2. | grouped bibliography |

## First Research Cards To Create

These are named in the research brief but not yet materialized as separate card
files:

- `regime-first-rsi-reclaim-v1`
- `volume-spike-fraud-filter-v1`
- `unlock-risk-disqualifier-v1`
- `sentiment-attention-vs-entry-v1`
- `autopilot-24h-change-baseline-v1`
- `exit-logic-dominates-entry-v1`
- `htf-momentum-baseline-v1`
- `funding-oi-crowding-filter-v1`
- `liquidity-first-disqualifier-v1`
- `cvd-order-flow-divergence-v1`
- `sell-the-news-exit-liquidity-v1`
- `agent-exposure-cap-human-approval-v1`
- `r-multiple-plan-adherence-journal-v1`

Next findability improvement: create `docs/edgeops/cards/` and move the first
one or two cards into individual files.

## Current Testability

Run:

```bash
npm run edgeops:check
```

The check verifies:

- core docs exist
- source ledgers exist
- durable URLs are present
- required prompts exist
- first research-card names are present
- product-spec fields are present

## Known Gap

EdgeOps is not yet wired to paper trades. There is no canonical database table or
JSON collection for `EdgeOpsTradeThesis`, no UI thesis panel, and no weekly
report generator. That is the next implementation step.

## Anti-Stale Contract

An EdgeOps artifact is stale when:

- a weekly report is older than 14 days
- a source note changes product recommendations but is not reflected in the
  research brief
- a research card has no status
- a paper test has no data window
- a dashboard/report has no source artifact path

Stale artifacts are not deleted. They are marked background-only, refreshed, or
superseded.
