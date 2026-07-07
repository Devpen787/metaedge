# EdgeOps Operating Loop

Date: 2026-07-07

## Goal

Create a repeatable loop that lets MetaEdge learn from paper trading. The loop
should preserve the useful parts of the old portfolio cockpit idea while
avoiding the failure mode: stale dashboards that look organized but do not
change decisions.

## Loop Shape

```text
Question -> Source -> Research Card -> Paper Test -> Trade Thesis -> Post-Trade Review -> Weekly Edge Report -> Updated Card
```

## Loop 1: Source Intake

Purpose: convert outside research and user-provided notes into durable,
findable source material.

Inputs:

- user research response
- source batch
- paper/PDF/forum/thread
- existing MetaEdge behavior

Steps:

1. Save or summarize the response under `docs/edgeops/source-notes/`.
2. Extract durable URLs into a source ledger.
3. Grade each source: official, academic, working paper, reputable media,
   framework docs, issue thread, practitioner, vendor, forum, or low-value.
4. Update the research brief only when the source changes a decision, field, or
   research card.

Pass condition:

- the source is findable by filename and `rg`
- it is linked from README or the research brief
- unsupported claims are still caveated

## Loop 2: Research Card

Purpose: turn broad ideas like "CVD works" or "sentiment is dangerous" into one
falsifiable paper experiment.

Steps:

1. Copy `EDGEOPS_CARD_TEMPLATE.md`.
2. Name one card, for example `liquidity-first-disqualifier-v1`.
3. Fill in hypothesis, scope, source refs, falsifier, benchmark, and pass/fail
   threshold.
4. Declare missing data explicitly.

Pass condition:

- card has a falsifier
- benchmark exists
- scope is narrow enough for a paper-forward test
- allowed product claim is conservative

## Loop 3: Paper Test

Purpose: compare the card against reality without pretending the result is alpha.

Minimum paper test:

- asset universe
- entry trigger
- exit logic
- regime filter
- liquidity/disqualifier check
- planned R or risk unit
- benchmark family
- sample size target

Benchmarks:

- current Autopilot baseline
- buy/hold
- random entry
- simple HTF momentum
- relative strength where applicable

Pass condition:

- result survives costs where applicable
- result is compared to at least one benchmark
- weak sample size is labeled weak

## Loop 4: Trade Thesis

Purpose: make each paper trade explainable before and after it happens.

Every EdgeOps-complete paper trade should capture:

- setup
- trigger
- exit thesis
- regime
- catalyst and event stage
- sentiment/manipulation state
- liquidity/execution assumption
- order-flow state or honest unavailable marker
- invalidation
- planned R
- holding window
- benchmark family
- approval requirement for autonomous actions

Pass condition:

- no high-confidence trade without invalidation
- no sentiment-only high-confidence trade
- no paper trade counted in EdgeOps reports if core thesis fields are missing

## Loop 5: Post-Trade Review

Purpose: separate signal failure from execution failure, regime shift, or plan
violation.

Review fields:

- realized P&L
- realized R
- MAE/MFE
- thesis followed
- invalidation hit
- plan adherence
- primary outcome driver
- lesson
- next decision: keep testing, modify, kill, or promote paper-only

Pass condition:

- review updates the research card
- repeated mistakes are clustered, not treated as isolated anecdotes

## Loop 6: Weekly Edge Report

Purpose: keep the system fresh and decision-driving.

Weekly report should include:

- number of paper trades
- trades with complete thesis
- trades missing thesis
- expectancy by signal family
- win rate by signal family
- realized R by signal family when available
- regime distribution
- catalyst/sentiment trades
- disqualified setups
- killed cards
- promoted paper-only cards
- stale notes/cards/reports
- exactly one recommended next card

Pass condition:

- report has artifact paths
- incomplete data is named
- old artifacts are marked stale
- no profitability or live-readiness claim

## Learning Rule

Do not ask "did we make money?" first. Ask:

1. Did the thesis fire under the conditions we defined?
2. Did the trade follow the plan?
3. Did the signal beat the benchmark?
4. Did the failure come from signal, execution, regime, liquidity, or behavior?
5. What should be killed, narrowed, or tested again?

## Anti-Staleness Rules

- Every report names its data window.
- Every source note has a capture date.
- Every card has a status.
- Every weekly report marks stale artifacts.
- Every next step names exactly one card or implementation cut.
- Dashboards are read models only. Source truth stays in Markdown, ledgers,
  trade records, and generated reports.

## First Implementation Loop

Start with `edgeops-paper-trade-thesis-v1` from
`EDGEOPS_PRODUCT_SPEC.md`.

Smallest code cut:

1. Add server-side thesis storage.
2. Accept optional thesis payloads on `/api/trades` and `/api/copilot/execute`.
3. Add a compact Trading Desk thesis panel.
4. Add `edgeops_complete` versus `thesis_missing` tagging.
5. Run existing paper-trade smoke tests.
6. Add one EdgeOps report script only after thesis data exists.
