# V5 batch 5: bounded paper discovery and standard strategy adapter

Date: 2026-07-30
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

MetaEdge no longer treats “not yet forward-confirmed” as “may never execute a
paper experiment.”

Validation status and execution permission are now separate:

- `observe_only`: record the opportunity, but create no order;
- `paper_discovery`: permit a small, capped, explicitly unconfirmed paper
  experiment;
- `paper_confirmed`: preserve the stricter matching forward-validation path.

An unvalidated or inconclusive signal remains a research hypothesis. It does
not become confirmed merely because it is allowed to spend a discovery
information budget.

## Frozen experiment population

The V5 registry creates immutable, content-addressed experiment identities
from frozen strategy specs. The initial population includes:

- RSI mean reversion;
- 24-hour momentum;
- 24-hour mean reversion;
- grid deviation;
- funding carry as `observe_only` until an atomic delta-neutral multi-leg
  adapter exists;
- Golden Cross strict;
- Golden Cross participate.

Golden Cross is therefore two labeled specialists in the population, not the
architecture or the privileged definition of trading.

Registry-managed V5 paper agents provide isolated positions and attribution
without requiring an operator to create an ad hoc agent for every experiment.
They are not autopilot user agents and they cannot reach live capital.

## Standard evaluation and execution path

Each population member now uses the same sequence:

1. frozen strategy spec;
2. V5 feature packet and layered gates;
3. durable `opportunity-observation.v5`;
4. lifecycle, eligibility, health, permission, cost, data, and live-lock
   checks;
5. capped budget reservation;
6. durable `order-intent.v5`;
7. canonical risk check;
8. conservative V5 paper broker;
9. fill and trade ledger with experiment attribution.

Every evaluation creates an opportunity observation, including no-signal,
ineligible, dormant, declined, and admitted cases. The observation records the
experiment, strategy hash, label, symbol, action, regime, eligibility,
permission, disposition, reasons, and hashed feature evidence.

## Discovery information budgets

The initial frozen budget per executable experiment is:

- maximum admitted entry notional: $2,000;
- maximum admitted entries: 8;
- maximum concurrent intents: 1;
- ordinary requested entry: $250;
- reduced-state entry: half the ordinary size.

The population also has a $10,000 shared open-plus-pending paper-notional cap.
It includes experiment positions and durable nonterminal reservations before a
new entry can be admitted.

Reservations are durable and fail conservatively. A failed order admission
releases its reservation; an accepted intent consumes the information budget.
Exits do not consume a new entry budget.

These are experiment information limits, not evidence that the strategy has
an edge.

## Golden Cross integration

`golden_cross_strict` and `golden_cross_participate` are separate V5 plugins,
specs, experiment IDs, labels, budgets, observations, and positions.

Both use versioned daily SMA and volume features and route through the same
intent, risk, broker, fill, and audit ledgers as other families. The pre-V5
direct Golden Cross writer remains disabled and historical fills remain
read-only.

## Product visibility

The existing Research Fleet strategy list now includes registered experiments
even before they trade. Each row shows:

- the human-readable strategy label;
- lifecycle state;
- paper permission;
- eligibility and health;
- admitted versus maximum notional;
- admitted versus maximum entries;
- lifecycle reason;
- realized trade results when available.

Recent trades show the experiment label and `paper_discovery` or
`paper_confirmed` attribution. No additional Golden Cross panel was added.

## Verification

- `npm run test:decision`: 48/48 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Focused proof covers an unvalidated valid signal creating a capped discovery
intent, durable budget consumption, opportunity and order lineage, separate
Golden Cross identities, Golden Cross use of the canonical broker ledger, and
the disabled direct legacy scanner.

## Remaining boundary

This is local, file-backed, undeployed, and not forward-tested. It does not
claim profitability. V5-07 must calculate outcomes, controls, trial counts,
counterfactuals, and multiplicity-aware evidence. V5-08 must replace the
current coarse shared-notional cap with a portfolio allocator for symbol,
family, factor, correlation, liquidity, leverage, and daily-loss risk. Funding
carry remains observation-only until both legs can be admitted and reconciled
atomically.
