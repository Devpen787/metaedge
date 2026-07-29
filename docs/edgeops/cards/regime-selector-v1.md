# Research Card: regime-selector-v1

Status: DRAFT (WHERE/WHEN layer — step 6). No code until MR/DE sign-off.
Created: 2026-07-09 · Pool: cross-cutting tradability gate · Instrument: spot + perp (per taxonomy)
Purpose: build the missing WHERE/WHEN layer so triggering becomes scan-and-select,
not one-asset-per-agent. This card gates HOW for every future directional card.

## Participant map (Market Researcher)
This card claims NO edge of its own — it is a tradability gate, and that
distinction is the whole point. It answers "is this market worth acting in now?"
so that a downstream edge card (who-pays-us already established) only fires where
its counterparty is actually present. Rationale it should help: edges decay in
dead tape (no energy → no counterparty flow to capture) and in illiquid tape
(cost/impact eats the edge). Selector's job: keep the edge OFF where those hold.

## Core sentence
Because directional edges only pay when there is participant flow to capture and
enough liquidity to transact cheaply, and because flow/liquidity/regime appear in
realized volatility, traded volume, funding/basis state, and session, we gate
entries to assets/times where a tradability score clears a threshold, and expect
the SAME downstream edge to show higher post-cost expectancy gated than always-on.
False if gating does not beat always-on out-of-sample AND in forward paper.

## Data (Data Engineer)
- Required: realized vol (ATR/σ from klines), traded volume (klines v/qv/trades),
  funding/basis state (funding-hist), session (timestamp), live equivalents from
  the recorder for forward use.
- Available: all of the above — binance-klines-1h, hyperliquid-funding-history,
  metaedge-recorder-live contracts. No missing data for a first pass on majors.
- Missing: liquidation intensity (would sharpen the dislocation regime) — logged,
  not required for v1.
- Dangerous to fake: intrabar liquidity/spread — selector uses realized bar stats
  only, never assumed depth.
Data contract: the three named contracts + metaedge-universe (before any universe
change) in `docs/data_requirements_and_contracts.md`.

## WHERE/WHEN selector (this IS the deliverable)
Candidate tradability score per asset per bar (bounded, pre-declared, tuned on
TRAIN only): percentile-rank of realized vol (energy floor AND ceiling — avoid
dead tape and un-tradeable chaos), percentile-rank of quote volume (liquidity),
funding/basis regime flag, session flag. Output: TRADE-ELIGIBLE / DECLINE per
asset per bar. It never generates entries; it only permits them.

## Entry / exit concept (HOW)
N/A by design — this card produces no entries. It is consumed by downstream HOW
cards as a precondition. (Filling this section here would itself be the
HOW-before-WHERE/WHEN failure mode.)

## Cost model (Execution/Risk Officer)
The selector's cost is opportunity cost (trades declined). Measured by comparing
gated vs always-on expectancy on an already-carded edge; no direct fees.

## Risk model
Failure mode: the selector overfits regime labels and declines exactly the
profitable tape (curve-fit to noise). Guard: bounded pre-declared thresholds,
walk-forward, and the always-on null must be beaten on unseen data.

## Benchmark & null/control
Null = the same downstream edge run ALWAYS-ON (no gate). Control = random
eligibility mask at the same trade-frequency. The selector must beat both OOS.

## Falsifier (pre-committed)
On the first downstream edge it gates: if gated post-cost expectancy ≤ always-on
OOS, OR ≤ random-mask control at equal frequency, the selector is KILLED for that
edge. If it fails on two independent edges, the selector concept is killed.

## Expected trade frequency & failure mode
Reduces trade count vs always-on (that is the intent). Dies by curve-fitting
regime boundaries to noise — visible as OOS underperformance vs the always-on null.

## Safety classification (Product Safety Officer)
paper-only until it has gated a forward-paper survivor. It changes WHICH trades
fire, so it inherits the strictest gate of any edge it touches; never
competition-eligible on its own.

## Sign-offs
MR ☐ · DE ☐ · QR ☐ · XR ☐ · PS ☐  (all five required before TESTING)

## Decision log
2026-07-09: DRAFT created as the chosen next action from the comprehension-gate
decision record. Next: MR + DE sign-off, then a bounded pre-declared threshold
grid tested as a gate on the existing rsi_meanrev DOT candidate (the one carded
directional survivor) — always-on vs gated vs random-mask, walk-forward.
