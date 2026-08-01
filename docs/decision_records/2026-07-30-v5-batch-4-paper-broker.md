# V5 batch 4: paper broker lifecycle

Date: 2026-07-30
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

Active paper orders no longer become immediate full fills at a caller-provided
price.

The canonical V5 path is now:

1. validate ownership, V5 agent authority, order shape, and current observed
   quote;
2. durably create an idempotent intent;
3. durably record risk acceptance;
4. durably submit the intent to the V5 paper broker;
5. wait for a different market observation received after submission;
6. evaluate expiry, quote freshness, stop/limit conditions, modeled liquidity,
   spread, slippage, fees, and fill-time risk;
7. atomically commit each fill, trade, cash mutation, broker event, audit event,
   and graph event;
8. remain partially filled, reach a terminal state, or become explicitly
   unresolved for reconciliation.

## Versioned policy

`paper-broker-conservative-v5` exposes:

- `next_observation` execution timing;
- same-observation fills forbidden;
- a declared `volume_participation_proxy` liquidity model;
- quote-age and time-in-force limits;
- fee, half-spread, base-slippage, and maximum-slippage assumptions;
- volume participation and minimum executable notional;
- conservative daily perp funding and short-borrow assumptions;
- `liveExecution: locked`.

The policy is included in `/api/v5/status`. `/api/trades` now returns the
owner's V5 orders and broker fills alongside completed trades.

## Durable lifecycle

New active states and events include:

- `BROKER_PENDING`;
- `PARTIALLY_FILLED`;
- `EXPIRED`;
- `SUBMITTED_TO_BROKER`;
- `PARTIALLY_FILLED`;
- `BROKER_REJECTED`;
- durable `paper-fill.v5` records.

Restart reconciliation preserves legitimate broker-pending and partial orders,
reconstructs their fill totals, expires elapsed orders, and quarantines
lineage mismatches.

## Product behavior

Manual and Copilot requests now report that the paper order was accepted and
is waiting for a fresh observation. They do not claim a fill or balance change
at submission. The user-entered/displayed price is reference context only and
cannot become the canonical fill price.

## Risk and accounting

- valid zero-cash risk reductions remain allowed;
- balance is checked again at fill time;
- partial fills apply cash and positions incrementally;
- signed perp positions support short open and close;
- closing P&L includes fill fee plus conservative funding and short-borrow
  costs;
- repeat risk-exit submissions deduplicate while an earlier exit remains
  nonterminal;
- stop state remains armed until an exit actually fills.

## Verification

- `npm run test:decision`: 43/43 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.

Adversarial coverage includes next-observation timing, caller-price
non-authority, stale quote rejection, partial fills across distinct
observations, restart continuation, conservative limit and stop execution,
expiry without a trade, zero-cash exits, fill-time accounting, and perp short
fees/funding/borrow.

## Remaining boundary

This is a locally verified, file-backed paper broker. It is not deployed,
forward-tested, economically validated, or a Postgres production migration.
The liquidity model is an explicit 24-hour-volume participation proxy, not
claimed L2 depth. V5-05 still must add bounded `paper_discovery`, experiment
identity, portfolio information budgets, observations/outcomes, and multiple
strategy-family adapters.
