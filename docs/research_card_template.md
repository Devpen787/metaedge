# Research Card Template

Rule: **No strategy code may be written until a card exists using this
template.** Cards live in `docs/edgeops/cards/<slug>-vN.md`. A card missing any
section is invalid. Unknowns are marked `UNKNOWN`, never guessed.

```markdown
# Research Card: <slug>-vN

Status: DRAFT | COLLECT-DATA | TESTING | KILLED | FORWARD-PAPER | LIVE-CANDIDATE
Created: YYYY-MM-DD · Pool: <opportunity pool> · Instrument: <per taxonomy>

## Participant map (Market Researcher)
Who trades this; who is forced/levered/hedging/emotional/constrained;
WHO PAYS US AND WHY. Why might the opportunity persist after costs?

## Core sentence
Because [participant] is forced/incentivized/constrained to [behavior] during
[regime], and because this appears in [data signature], we participate via
[execution rule], exit via [invalidation/target/time], and expect positive
expectancy after [all costs and tail risks]. False if [falsifier].

## Data (Data Engineer)
- Required: …
- Available: … (cite files/contracts)
- Missing: …
- Dangerous to fake: …
Data contract: <link into docs/data_requirements_and_contracts.md> — REQUIRED
before any backtest.

## WHERE/WHEN selector
When is this market worth trading? (liquidity, vol regime, participation,
cost, funding/basis regime, expiry/event window, session.)

## Entry / exit concept (HOW)
Entry · invalidation · stop · target · time stop · regime-change exit ·
no-trade rules.

## Cost model (Execution/Risk Officer)
Fees, spread, slippage, funding/borrow, latency; per-trade cost estimate.

## Risk model
Max loss per trade, liquidation distance, margin stress, tail scenario,
operational break modes, kill rule.

## Benchmark & null/control
What must this beat? (cash/no-trade, buy-hold, random-entry control, simple
pool benchmark, prior version if revision.)

## Falsifier (pre-committed)
Exact numeric kill conditions.

## Expected trade frequency & failure mode
How often it should fire; how it most likely dies.

## Safety classification (Product Safety Officer)
paper-only | operator-live-only | user-eligible | competition-eligible —
with rationale.

## Sign-offs
MR ☐ · DE ☐ · QR ☐ · XR ☐ · PS ☐  (all five required before TESTING)

## Decision log
YYYY-MM-DD: kill / collect data / test / forward-paper — evidence link.
```
