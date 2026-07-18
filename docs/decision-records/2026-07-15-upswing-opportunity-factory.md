# Upswing Opportunity Discovery Factory — math and runtime contract

Status: implementation contract. Execution scope: **paper research only; live money locked**.

## Outcome contract

The factory asks one precise question: after a condition was observable, did the
asset produce a positive benchmark-relative move large enough to survive modeled
round-trip costs before its downside barrier or horizon expired?

`net_relative_bps = ((exit/entry - 1) - (benchmark_exit/benchmark_entry - 1)) * 10,000 - round_trip_cost_bps`

The path is close-to-close. Public daily/hourly bars cannot prove whether an
intrabar high preceded an intrabar low, so the implementation never invents that
ordering. Units are USD price ratios converted to basis points. Costs are basis
points per completed round trip. The upper barrier is positive and the lower
barrier negative. Any incomplete forward horizon is `unresolved`, never a loss,
win, or zero.

For a sample of net relative returns, the promotion statistic is:

`EdgeLCB = mean(net_relative_bps) - z(1 - alpha / trials) * sample_std / sqrt(n)`

This is a one-sided Bonferroni family-wise confidence bound. A research result
cannot become a forward-paper candidate unless validation and untouched holdout
EdgeLCB are both positive, at least two of three expanding-window walk-forward
folds have positive test EdgeLCB, the minimum sample size is met, and the result
remains positive under the precommitted cost stress. Fold boundaries are
deterministic fractions of chronological event order. A score or correlation alone never
authorizes a trade.

## Seven layers

1. Labels: post-cost, benchmark-relative triple-barrier outcomes.
2. Ontology: point-in-time observations record occurred, available, and feature
   cutoff times plus source provenance.
3. Discovery: event-conditioned catalyst studies and lagged cross-market
   relationships run separately.
4. Confidence: train/validation/holdout evidence, Bonferroni correction, and
   explicit cost sensitivity.
5. Meme gates: liquidity, exit capacity, holder concentration, abnormal turnover,
   volume acceleration, and trade-count acceleration. Missing concentration is a
   blocker rather than an invented safe value.
6. Agent stages: observer, miner, compiler, skeptic, validator, paper operator,
   and research memory each append a status to the immutable card.
7. Experiments: stock event drift, established-crypto momentum plus attention,
   and meme participation plus manipulation-risk are bounded and independent.

## Invariants

- Feature timestamps never exceed event availability time.
- Persistent hourly conditions emit only on a false-to-true transition and use
  a full-lookback cooldown. Confidence statistics collapse simultaneous events
  into 24-hour crypto blocks or 14-day stock blocks to avoid pseudo-replication.
- Benchmark and asset bars align by timestamp before labeling.
- No hidden asset lists: runtime universes are explicit in the run artifact.
- NaN and infinity never enter stored cards.
- Missing evidence declines; it is not coerced to zero.
- Card identifiers are hashes of canonical content and existing cards are never
  edited in place.
- The runtime may produce declines, hypotheses, or forward-paper candidates. It
  cannot create a live-money instruction.
- Scheduled research runs execute in a child process, keeping CPU and synchronous
  file work outside the latency-sensitive Express process.

## Reference and parity

The TypeScript product implementation is `server/discovery/math.ts`. The
independent Python reference is `scripts/reference/opportunity_math.py`. Both are
checked against `tests/fixtures/opportunity_math_golden.json` at `3e-8` absolute
tolerance (less than one millionth of a basis point). Sensitivity tests stress costs, incomplete horizons, sample size, and
multiple-testing trial count.
