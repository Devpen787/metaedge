# J07 — Shadow

Status: **Detailed draft for human review**

## USER JOB

> Show me what would have happened if I followed this wallet/trader/strategy/agent using my own rules, without changing my paper portfolio.

## PURPOSE

Shadow is a counterfactual laboratory between Follow and Paper Copy.

It is **not** merely replaying the source's raw PnL. It simulates the follower-specific transformation that would have occurred under a declared policy.

## PRECONDITIONS

- Trackable source or versioned strategy exists.
- Source observations are sufficiently timestamped for forward shadowing.
- A Shadow Policy can be defined.

A funded paper portfolio is not required; Shadow may use a declared virtual baseline.

## AUTHORITATIVE STATE

Candidate concepts:

- `ShadowRun`
- `ShadowPolicy`
- `SourceObservation`
- `CopyView`
- `CounterfactualTarget`
- `CounterfactualFill`
- `ShadowPosition`
- `ShadowOutcome`

Shadow state is isolated from `PaperPortfolio`.

## USER-VISIBLE STATES

- Configuring
- Running
- No qualifying source action yet
- Target changed
- Hypothetical partial fill
- Data gap / degraded
- Paused
- Completed
- Invalidated due to unusable source history

## HAPPY PATH

1. User chooses Shadow.
2. MetaEdge proposes or asks for a Shadow Policy:
   - baseline capital;
   - sizing method;
   - max source allocation;
   - leverage cap;
   - asset/venue filters;
   - staleness tolerance;
   - costs/slippage model.
3. New source observations arrive.
4. MetaEdge transforms source behavior into `CopyView` / desired follower exposure.
5. Counterfactual portfolio/risk rules transform the view into a target.
6. Shadow execution models fills without mutating the user's paper balance/positions.
7. MetaEdge continuously manages the shadow position as source/evidence changes.
8. Review shows source return vs transformed follower return and why they differ.
9. User may graduate the policy to Paper Copy through a **new** Paper relationship; the Shadow run itself is not converted into live/paper financial state.

## COPYING LAW

Shadow must answer:

> “What would **I** have done under my policy?”

not:

> “What did the source make?”

A $20M wallet at 15x leverage can produce a 1% unleveraged follower shadow target.

## EMPTY STATE

Source has not produced a qualifying change, or follower policy filtered all observed actions.

Show the reason rather than suggesting the shadow engine is broken.

## FAILURE

- source event missing required timing/instrument data;
- fill simulation cannot price instrument;
- source mapping changes;
- internal shadow ledger inconsistency.

## UNKNOWN

Shadow must carry source-completeness unknowns. A technically accurate copy of an incomplete wallet view is still an incomplete inference about the trader.

## RETRY

Counterfactual operations must be idempotent by source observation + policy/version. Reprocessing cannot duplicate shadow positions.

## PARTIAL

A source event may translate into a partially executable hypothetical target because of modeled liquidity/slippage.

## CANCEL

Pause or stop Shadow. Preserve historical results and policy version.

## BACK / REFRESH / RESTART

Restart reconstructs the Shadow run from durable source observations, policy, targets and simulated fills.

## OWNER / AUTHORITY

Shadow service owns counterfactual state only. It cannot mutate Paper or Real portfolios.

## PRIVACY

User-specific Shadow policies/results are private by default.

## RECOVERY

If source streaming disconnects, reconcile source current state, record the observation gap, and do not pretend missed intermediate fills were observed. Depending on policy, resume from current state or mark the run evidence-degraded.

## NEXT JOURNEY

- J12 Review and Learn
- J10 Paper Copy with a newly created Paper Copy relationship
- modify Shadow Policy and start a new version/run.