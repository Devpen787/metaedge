# V5 batch 8: shared portfolio allocator

Date: 2026-07-31
Scope: local implementation on `codex/flywheel-availability-split`
Capital boundary: paper money; live execution locked
Deployment state: not deployed

## Outcome

MetaEdge now has one durable V5 portfolio authority in front of every
registry-managed experiment order. A strategy may propose an order, but it
cannot create a canonical experiment intent unless the allocator first issues
an exact, unexpired, policy-bound reservation.

This replaces the former population-wide notional check. The experiment
budget remains separate: it limits how much information one experiment may
purchase, while the portfolio allocator protects the shared paper account
across experiments, symbols, mechanism families, factors, regimes, and
liquidity buckets.

## Frozen allocator policy

`portfolio-allocator-policy.v5` is content-hashed and immutable. The local
paper policy currently enforces:

- $10,000 maximum gross exposure;
- $6,000 maximum absolute net exposure;
- $2,000 maximum symbol gross exposure;
- $3,000 maximum family gross exposure;
- $4,000 maximum mechanism-factor gross exposure;
- $5,000 maximum regime-bucket gross exposure;
- $1,000 maximum thin-liquidity gross exposure;
- $5,000 maximum perp gross exposure;
- four unresolved experiment orders;
- 40 total information units and 12 per family, with one unit per started
  $250 allocation tranche for each experiment-symbol lineage;
- maximum order participation of 0.01% of observed daily volume;
- $500 aggregate and $200 family rolling-24-hour post-cost realized-loss
  limits;
- a 60-second lease for reservations that have not yet bound an intent;
- live execution locked.

Changing either the stored values or the stored policy hash fails closed with
`PORTFOLIO_ALLOCATOR_POLICY_IMMUTABLE`.

## Reservation and intent authority

Every attempted allocation creates an append-only
`portfolio-allocation-decision.v5` and a durable
`portfolio-reservation.v5`, including denied requests. The reservation binds:

- experiment and strategy identity;
- opportunity observation;
- system owner and execution agent;
- exact symbol, side, size, and notional;
- increase or reduction effect;
- family, factor, regime, and liquidity classification;
- information units;
- the frozen policy hash and pre-allocation risk snapshot;
- the reasons for admission or denial.

Order-intent creation validates this lineage inside the same canonical write
that binds the reservation to the new intent. A managed experiment agent
cannot omit its experiment identity, omit the reservation, substitute another
reservation, alter size or side, or reuse an expired reservation.

Reservation states are `reserved`, `bound`, `converted`, `released`, and
`denied`. Full execution converts the reservation atomically with the order
ledger update. Rejection and expiry release it. Partial fills retain only the
unfilled pending notional. An `UNRESOLVED` order remains bound and continues to
consume pending exposure until explicit reconciliation; uncertainty never
creates free capacity.

## Exposure and information accounting

The allocator reconstructs signed positions from canonical V5 experiment
trades and combines them with durable same-cycle and broker-pending
reservations. The risk snapshot exposes:

- open, pending, gross, and signed net exposure;
- symbol, family, factor, regime, liquidity, and instrument totals;
- unresolved-order count;
- total and family information units;
- rolling-24-hour post-cost realized PnL;
- every underlying position and pending exposure line.

Gross exposure is retained even when different strategies offset one another
in the shared symbol book. Net BTC exposure may be zero while long and short
strategy exposures remain separately visible and separately attributable by
experiment and strategy hash.

## Reduction priority

Decision-cycle candidates are sorted so genuine position reductions route
before new entries. The allocator authorizes reductions even when the book is
already above an entry cap or a rolling-loss limit. The order risk engine still
requires a real position and prevents a reduction from exceeding it.

This distinction prevents risk limits from trapping exposure while ensuring a
strategy cannot label a new position as a reduction to evade the shared gate.

## Product and operator visibility

- `/api/v5/status` now inventories the frozen allocator policy, durable
  reservation store, writer authority, risk snapshot, decision counts, and
  reconciler clock.
- `/api/portfolio-allocator-v5` exposes the complete paper allocator snapshot.
- `/api/research-fleet` includes the portfolio snapshot and attaches each
  experiment's gross, net, and pending exposure plus recent allocation reasons
  to its existing family record.

The visible Research Fleet layout itself remains the V5-09 batch. No new panel
was introduced in this batch.

## Verification

- `npm run test:decision`: 63/63 passed.
- `npm run test:discovery`: 158/158 passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

Adversarial coverage proves that later same-cycle orders see earlier pending
risk, correlated trend strategies cannot exceed their factor cap, a valid
standalone signal can be vetoed by shared risk, reductions remain available
over cap, information units cannot be evaded with small positions, netting
does not erase attribution, managed experiment intents cannot bypass or alter
reservations, unresolved orders retain risk, and aggregate/family rolling
losses stop new entries.

## Remaining boundary

This is local, file-backed, uncommitted, undeployed, and not forward-tested.
The limits are conservative operating policy, not evidence that any strategy
has an edge. Factor and regime buckets are low-dimensional declared
concentration proxies; they are not a learned covariance model.

V5-09 must render lifecycle, allocation, order, lineage, and outcome detail in
the existing responsive Research Fleet list without adding another panel or
mixing legacy evidence into V5 metrics.
