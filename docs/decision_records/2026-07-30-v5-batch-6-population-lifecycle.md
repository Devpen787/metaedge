# V5 batch 6: conditional-specialist population lifecycle

Date: 2026-07-30
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

Strategy failure, regime eligibility, operational health, and permanent
retirement are no longer one undifferentiated decision.

The V5 population supports:

- `draft`;
- `research-only`;
- `discovery`;
- `confirmed`;
- `dormant`;
- `probation`;
- `reduced`;
- `retired`;
- `live-review-locked`.

Eligibility and health are stored separately. A strategy can be healthy but
currently ineligible, or eligible while operationally degraded.

## Conditional lifecycle

The active universe is evaluated as a cohort for each experiment:

- when no universe member is regime-eligible, the experiment becomes dormant;
- dormant evaluations remain recorded as shadow observations;
- a return of eligibility must satisfy the frozen dwell rule before probation;
- probation requires repeated eligible successes before returning to
  discovery or confirmed;
- one eligible loss is recorded but cannot retire the strategy;
- repeated eligible failures first reduce size and can retire only after both
  the failure threshold and minimum eligible-outcome count are met;
- health failure reduces the experiment rather than silently continuing;
- retirement sets the execution permission to `observe_only`.

The initial lifecycle policy is frozen with each experiment:

- 6-hour minimum dormant dwell;
- reduction after 2 consecutive eligible failures;
- retirement after 5 consecutive eligible failures and at least 5 eligible
  outcomes;
- 2 eligible successes to leave probation.

These thresholds are operating defaults, not evidence-optimized claims.

## Immutability and agency boundary

Active experiment specs cannot be overwritten. A changed strategy hash creates
a new challenger with:

- a new experiment ID and spec hash;
- an incremented version;
- a parent experiment link;
- an explicit challenger reason;
- a fresh discovery budget and draft state.

The parent remains byte-for-byte unchanged. An execution agent cannot mutate
an active experiment, promote itself to confirmed, or retire itself. Matching
forward validation can create a system lifecycle promotion with recorded
evidence; operator retirement requires an operator event.

## Evidence and visibility

Lifecycle events are durable V5 records linked to opportunity observations or
decisions. The Research Fleet shows the current state, permission, health,
eligibility, budget, and state reason for every registered experiment.

`/api/experiments-v5`, `/api/research-fleet`, and `/api/v5/status` expose the
population without presenting live execution or profitability as active.

## Verification

- `npm run test:decision`: 48/48 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Adversarial proof covers one-loss non-retirement, dormant shadow behavior,
dwell before probation, repeated eligible failure retirement, immutable
challenger creation, agent self-promotion rejection, and lifecycle/operator
visibility.

## Remaining boundary

Lifecycle transitions currently consume observations and explicit outcome
events, but V5-07 must produce the canonical post-cost outcome events and
control comparisons that drive those transitions. V5-08 must provide
portfolio-level reservations and correlated exposure limits. No lifecycle
state authorizes live capital; `live-review-locked` remains locked pending
later independent gates and explicit human approval.
