# Backtest Validation Rules

Preconditions: research card exists (template-conformant) AND data contract
exists for every dataset touched. No exceptions.

## Mandatory design

- Walk-forward: params selected on TRAIN only, judged on unseen TEST only;
  embargo gap ≥ max holding period between windows.
- Causality: features at bar i use bars ≤ i; entries at next bar open;
  conservative intrabar sequencing (stop checked before target).
- Costs: never below our measured live floor (4.5–13bps/side); default 10bps/
  side paper-equivalent; carry episodes 40bps per 4-leg round trip.
- Benchmarks required: cash/no-trade, buy-and-hold (where relevant), a
  random-entry control with identical exits, the pool's simple benchmark, and
  the prior version if this is a revision.
- Units check (mandatory, from the 2026-07-08 funding bug): before the first
  run, print one sample row of every input with units annotated and compare
  against the data contract. Two independent implementations (or one
  implementation + an independent sanity computation) for any new dataset.

## Registry & multiple-testing

- EVERY evaluation (train and test, every fold, every config) appends to
  `data/edgeops/hypothesis-registry.jsonl` — survivors and corpses alike.
- Grids are bounded and pre-declared on the card. Post-hoc tuning after
  peeking = the survivor bar rises AND the snooping is logged on the card.
- One revision per card without penalty ONLY if it tests a pre-named untested
  assumption (e.g. selector window); otherwise it is a new hypothesis.

## Survivor bar (minimum, may rise with grid size)

OOS only: n ≥ 30 · PF ≥ 1.1 · ≥55% positive folds · t-stat ≥ 2 · beats all
required benchmarks · no unmodeled margin stress. Passing = FORWARD-PAPER
CANDIDATE, never "edge". n=30–50 earns observation, not belief.

## Honest-limits section (required in every report)

State: universe survivorship, regime coverage (how many macro regimes the
sample spans), feed mismatch vs live, long/short coverage, and everything the
dataset cannot conclude (from its contract).
