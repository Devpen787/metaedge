# V5 batch 7: trial accounting, controls, and post-cost outcomes

Date: 2026-07-31
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

MetaEdge now has a canonical answer to “what did this paper experiment actually
teach us?”

Every registered experiment receives a frozen V5 trial declaration before an
opportunity can route to the broker. Completed paper positions are reconciled
into durable episode outcomes with execution lineage, costs, controls,
clustering, and a numerical promotion classification.

An accepted paper order is still only an experiment. A profitable fill is
still only one observation. Neither becomes `paper_confirmed` merely because
it exists or made money.

## Frozen trial declarations

Each `experiment-trial.v5` binds:

- experiment and strategy hashes;
- family and variant identity;
- family trial sequence;
- declaration time and forward evidence cutoff;
- learning policy version;
- mandatory no-trade and continuous buy-and-hold controls;
- immutable, live-locked authority.

The decision runtime seals these declarations after population registration
and before evaluating or routing that cycle. Removing a control or altering a
trial after outcomes exist breaks the trial hash and fails reconciliation.

Every registered variant counts toward the family trial total, including
draft, dormant, reduced, retired, failed, and superseded challengers. A losing
or discarded idea therefore cannot disappear from the multiple-testing bill.

## Episode and independence accounting

Trades are reconstructed by experiment and asset from signed fills:

- an episode begins when a flat experiment position opens;
- increases and partial fills remain in that episode;
- the episode resolves only when the signed position returns to flat;
- incomplete positions create no resolved outcome;
- all entry, reduction, and exit trade IDs remain attached.

Independent evidence is counted by frozen family, asset, and 24-hour episode
cluster. Multiple trades from the same family and asset inside one cluster can
produce multiple operational outcomes but only one independent statistical
observation.

## Execution and cost attribution

Each `experiment-episode-outcome.v5` records:

- entry and exit reference prices;
- reference-price gross PnL;
- actual fill-price gross PnL;
- signed implementation shortfall;
- conservative implementation drag;
- entry and exit fees;
- spread and slippage diagnostics;
- funding and borrow;
- actual post-cost PnL;
- conservative evidence PnL;
- 1.5x cost-stressed PnL;
- no-trade and buy-and-hold controls;
- normalized basis-point returns;
- reconciliation error;
- every intent, fill, trade, and source-observation identifier.

Favorable execution may improve actual paper PnL, but it cannot improve the
evidence score above the reference-price result. Adverse implementation
shortfall and explicit costs reduce evidence. Cost stress can only reduce it
again. Spread and slippage are visible diagnostics but are not double-counted
after they have already entered the fill-price shortfall.

## Controls

Two controls are mandatory and cannot be removed after observing results:

- **No trade:** zero exposure and zero PnL for each independent episode.
- **Continuous buy-and-hold:** for each asset, hold the first eligible
  episode’s reference notional continuously from its first open to its latest
  resolved episode.

The continuous control matters because comparing a long trade with buy-and-
hold over that identical entry and exit would make post-cost outperformance
mathematically impossible. The trial-level control tests whether the strategy’s
timing across active and inactive periods added value.

## Historical and invalid evidence

- Episodes opened before the frozen trial cutoff remain visible as
  quarantined history.
- Historical episodes do not enter forward statistics and do not poison later
  valid evidence.
- Missing or mismatched intents, fills, strategy hashes, observation hashes,
  broker policy, costs, or reconciliation make an outcome operationally
  invalid.
- An operationally invalid outcome blocks promotion until the integrity issue
  is explicitly resolved; it cannot be silently discarded.

## Multiplicity-aware assessment

`experiment-learning-policy-v5` currently requires:

- at least 20 independent episode clusters;
- positive mean conservative post-cost edge versus no trade;
- positive 1.5x cost-stressed edge;
- positive cumulative result versus continuous buy-and-hold;
- a positive one-sided lower confidence bound versus no trade;
- Bonferroni adjustment using every declared family trial;
- zero operationally invalid outcomes.

Assessments are classified as `collecting`, `blocked`, `declined`, or
`review_candidate`. A review candidate is evidence eligible for a later
promotion decision; it is not an automatic strategy promotion and never
authorizes live money.

## Lifecycle reconciliation

Only valid, post-cutoff, evidence-eligible outcomes can produce lifecycle win
or loss evidence. Application is idempotent across restarts. Quarantined and
operationally invalid outcomes cannot change experiment state.

## Product visibility

The existing Research Fleet strategy rows now show:

- assessment disposition and promotability;
- eligible, quarantined, and operationally invalid outcomes;
- independent episode count;
- declared family trial count;
- mean conservative net edge;
- continuous buy-and-hold-relative result;
- multiplicity-adjusted no-trade lower confidence bound;
- explicit blocking reasons.

The full ledger is available through `/api/experiment-outcomes-v5`; counts,
policy, and reconciler health are included in `/api/v5/status`. No separate
strategy panel was added.

## Verification

- `npm run test:decision`: 55/55 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Adversarial tests cover control deletion, trial-hash mutation, favorable-fill
evidence inflation, cost monotonicity, episode clustering, pre-cutoff
quarantine, operationally invalid outcomes, retired/discarded trial counting,
multiplicity adjustment, durable reconciliation, and exactly-once lifecycle
application.

## Remaining boundary

This batch is local, file-backed, undeployed, and has no accumulated forward
sample yet. It establishes honest accounting; it does not prove that any
strategy makes money.

V5-08 must replace the coarse shared-notional ceiling with portfolio-level
symbol, family, factor, correlation, liquidity, leverage, pending-reservation,
and daily-loss authority while preserving this outcome attribution.
