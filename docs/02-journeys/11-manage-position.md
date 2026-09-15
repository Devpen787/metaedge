# J11 — Manage Position

Status: **Detailed draft for human review**

## USER JOB

> Keep adapting my position as market evidence, copied-source behavior, strategy state and risk change — do not treat the entry decision as the end of the strategy.

## PURPOSE

Position Management is central to MetaEdge's anti-paralysis design.

Instead of repeatedly deciding `BUY / SELL / NO TRADE` from scratch, loops produce revised desired exposure. The system manages the delta between **current exposure** and **current target**.

## PRECONDITIONS

- Paper position exists or aggregate target may change away from flat.
- Portfolio/risk systems are available.

## AUTHORITATIVE STATE

Candidate concepts:

- `Position`
- `PositionLot`
- `View`
- `PortfolioTarget`
- `RiskDecision`
- `PositionManagementDecision`
- `PaperOrderIntent`
- `ThesisState`
- `Invalidation`

## USER-VISIBLE ACTIONS / STATES

Target may imply:

- hold current size;
- scale in;
- scale out;
- take partial profit;
- tighten/release risk according to declared strategy policy;
- hedge where supported;
- close;
- reverse, if strategy/policy explicitly permits.

Position UI should explain **why target changed**, not merely show an order.

## HAPPY PATH

1. Position is open.
2. Parallel evidence/source/strategy loops continue producing views.
3. Portfolio authority computes new aggregate desired exposure.
4. Compare current canonical exposure to target.
5. If delta is insignificant, hold with attributable reason.
6. If target changes materially, Risk validates/clips the delta.
7. Paper broker executes the required increase/reduction.
8. Position state and thesis/evidence lineage update.
9. Repeat until closed/strategy paused.

## SCALE-UP EXAMPLE

Initial breakout evidence → `+0.25R scout`.

Later:

- volume accelerates;
- wallet inflows broaden;
- funding remains non-crowded;
- thesis remains valid.

Strategy view becomes `+0.50R`.

Risk permits only `+0.45R` total because of correlated exposure.

Executor trades the `+0.20R` delta from current `+0.25R`.

## SCALE-DOWN EXAMPLE

Price still rising, but:

- funding becomes extreme;
- sophisticated wallets distribute;
- liquidity deteriorates.

View may reduce from `+0.75R` to `+0.30R` before full invalidation.

MetaEdge should not force a false choice between “fully confident hold” and “exit everything.”

## RISK-REDUCTION PRIORITY

Risk-reducing actions must not be rejected by entry-style capital checks that make sense only for increasing exposure.

Reduction/close semantics are distinct from opening/increasing risk.

## HOLD LAW

`Hold` / unchanged target is a valid decision when supported by state.

It is not a safe default when the reason is simply “uncertain.”

Record why the target remained unchanged and whether exploration capacity existed.

## EMPTY STATE

Portfolio is flat and aggregate target is zero. No Position Management action exists.

## FAILURE

- current position cannot be reconciled;
- stale critical market data;
- pending order state unknown;
- risk engine unavailable;
- target aggregation internally inconsistent.

Do not create fresh exposure while canonical position/execution truth is unknown.

## UNKNOWN

If a pending execution outcome is unknown, position target may exist but new conflicting execution is blocked until reconciliation.

## RETRY

Recompute from canonical current position and latest valid target rather than resending the last imperative order blindly.

## PARTIAL

Partial fills mean current exposure may be between old and new target. Next action works from reconciled actual exposure.

## CANCEL

Cancelling an outstanding order does not erase the target. The portfolio/execution layer decides whether a replacement is still needed.

## BACK / REFRESH / RESTART

UI changes have no execution semantics. Restart reconciles current positions and pending intents before resuming target management.

## OWNER / AUTHORITY

- Proposers own views.
- Portfolio owns desired aggregate exposure.
- Risk owns limits.
- Execution owns mutation.
- Reconciler owns canonical observed outcome.

## PRIVACY

Position, strategy/source attribution and user risk policy are private by default.

## RECOVERY

After restart/outage:

1. establish canonical current exposure;
2. reconcile pending intents/fills;
3. refresh evidence;
4. recompute current target;
5. trade only the newly required delta.

## NEXT JOURNEY

Continuous loop back to itself until:

- J12 Review and Learn;
- J13 Improve/Pause/Retire;
- position closed.