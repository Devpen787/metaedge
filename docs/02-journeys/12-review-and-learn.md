# J12 — Review and Learn

Status: **Detailed draft for human review**

## USER JOB

> Tell me what actually happened, why, whether our decision process was good, what execution cost us, what we missed by not acting, and what should change next.

## PURPOSE

Review turns trading activity and inaction into evidence.

PnL alone is not learning.

MetaEdge must distinguish whether an outcome was driven by:

- thesis/signal quality;
- regime;
- sizing;
- portfolio interaction;
- execution quality;
- liquidity/cost;
- source behavior/completeness;
- behavioral assumptions;
- policy/risk constraints;
- plain uncertainty/noise.

## PRECONDITIONS

At least one of the following exists:

- completed/ongoing paper position;
- Shadow outcome;
- Copy outcome;
- eligible no-trade observation with counterfactual tracking;
- strategy/agent decision episode.

## AUTHORITATIVE STATE

Candidate concepts:

- `Outcome`
- `Attribution`
- `DecisionEpisode`
- `MissedOpportunityOutcome`
- `ExecutionShortfall`
- `StrategyVersion`
- `CopyRelationshipVersion`
- `EvidenceProfile`
- `Lesson`

## USER-VISIBLE REVIEW LENSES

### Outcome

- realized/unrealized PnL;
- return;
- drawdown;
- exposure path;
- fees/spread/slippage/funding/borrow where modeled.

### Decision quality

- what was known at decision time;
- what was inferred;
- what was unknown;
- target exposure chosen;
- why it changed.

Do not grade the decision using information that arrived later as if it were known earlier.

### Execution quality

- reference price vs fill;
- latency;
- partial fills;
- implementation shortfall;
- paper-model assumptions.

### Source/copy quality

- source action;
- follower transformation;
- divergence caused by policy/risk;
- source completeness caveats.

### Inaction / missed opportunity

For otherwise eligible opportunities where target stayed zero:

- hard blocked or voluntarily skipped?
- risk capacity available?
- smallest permissible scout size?
- counterfactual outcome over declared horizon;
- would the skipped scout have improved or harmed portfolio outcome?

## HAPPY PATH

1. User opens Review for portfolio/strategy/source/agent/time window.
2. MetaEdge reconstructs decision-time evidence and target changes.
3. Shows trade/position path and costs.
4. Separates thesis, risk and execution effects.
5. Includes counterfactual no-trade outcomes where valid.
6. Generates concise evidence-backed lessons.
7. User decides:
   - keep testing;
   - scale paper allocation;
   - reduce allocation;
   - modify strategy/copy policy through a new version;
   - pause/retire;
   - continue collecting evidence.
8. Historical record remains immutable.

## COUNTERFACTUAL LAW

Missed-opportunity analysis must avoid hindsight fiction.

A counterfactual is eligible only when:

- the opportunity was recorded at the time;
- instrument/data was valid then;
- a declared hypothetical scout/target policy exists;
- future price/outcome is measured after the fact without rewriting the original decision.

The purpose is to measure systematic over-conservatism/false negatives, not shame every skipped winner.

## DECISION QUALITY VS OUTCOME QUALITY

Good decision / bad outcome and bad decision / good outcome must both be representable.

Example:

- valid scout under declared risk;
- thesis reasonably supported;
- stop hit due to normal variance.

This is not automatically a process failure.

## EMPTY STATE

Not enough completed or forward outcomes exist yet. Show evidence collection status rather than pretending a score is meaningful.

## FAILURE

- missing lineage;
- inconsistent fill/outcome records;
- counterfactual horizon unavailable;
- source history gap;
- attribution cannot separate causes.

Mark attribution unknown/partial rather than inventing certainty.

## UNKNOWN

Some outcomes will remain causally ambiguous. Preserve multiple plausible explanations with evidence rather than assigning one narrative.

## RETRY

Review recomputation must be deterministic from immutable evidence/policy versions where possible.

## PARTIAL

A review can be partial while positions remain open. Clearly distinguish interim vs final outcome.

## CANCEL

Review has no execution effect. Leaving it does not mutate strategy or risk policy.

## BACK / REFRESH / RESTART

New outcomes may extend an existing evidence assessment while preserving earlier assessment timestamps/version.

## OWNER / AUTHORITY

Learning/attribution services may recommend changes but cannot silently mutate active strategy, Copy Policy, risk limits or execution authority.

## PRIVACY

Private strategy/source performance and lessons remain private unless deliberately shared/entered into a public Arena.

## RECOVERY

Rebuild review from durable decision/evidence/execution/outcome lineage. If lineage is incomplete, surface that as a quality issue.

## NEXT JOURNEY

- J13 Improve/Pause/Retire
- J03 Investigate updated source
- J09/J10 continue paper operation under unchanged policy.