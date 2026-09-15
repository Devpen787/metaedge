# Contract Replay Results — Tranche 01

Status: **Architecture validation — no implementation authority**

## Purpose

Run synthetic, strategy-neutral state transitions through the relaunch contracts.

These are not backtests and do not test whether a trading edge is profitable.

Each replay starts from the assumption that a `StrategyVersion` or other authorized producer has already made its own market decision and emitted a structurally valid `View`.

We are testing MetaEdge's operating system.

## Replay conventions

- `R` is an abstract risk/exposure unit supplied by portfolio policy; exact numeric meaning remains open.
- Strategy examples use requested exposure only to exercise plumbing.
- Market-signal logic is out of scope.
- `PASS` means the current contracts can express the required behavior.
- `GAP` means the architecture needs an explicit field/object/reason taxonomy before implementation.

---

# R01 — Eligible exploratory View under incomplete evidence

## Input

```text
StrategyVersion: strat_v12
View:
  instrument: ETH
  requested_target: +0.25R
  horizon: intraday
  evidence_profile: ep_101
  expiry: +30m
  invalidator: inv_1

EvidenceProfile:
  contradictions: present
  unknowns: present
  critical freshness: valid

Portfolio:
  current_position: 0R
  sleeve_capacity: available

Risk:
  account capacity: available
  hard blockers: none
```

## Expected pipeline

```text
View +0.25R
→ normalize within sleeve
→ PortfolioTarget requested +0.25R
→ RiskDecision ALLOW +0.25R
→ PaperOrderIntent delta +0.25R
```

## Result

`PASS` conceptually.

Nothing in EvidenceProfile requires a universal confidence gate. Unknowns remain attached to evidence but do not automatically block the target.

## Important assertion

If target remains zero, the reason must identify **which authority chose zero**:

- producer requested zero;
- portfolio netting produced zero;
- risk clipped/blocked to zero;
- execution unavailable;
- system defect/unknown.

## GAP-01

Define a shared machine-readable **DecisionDisposition / ZeroTargetReason taxonomy** so zero exposure cannot become an opaque outcome.

---

# R02 — Two opposing strategies consume the same evidence

## Input

```text
MomentumStrategy View:     +0.40R
MeanReversion View:        -0.20R
same instrument: ETH
same EvidenceProfile allowed
separate StrategyVersion lineage
```

## Expected pipeline

Both Views remain valid historical facts.

Portfolio creates normalized `ViewContribution`s and nets them according to sleeve budgets.

Illustrative aggregate:

```text
+0.40R
-0.20R
------
+0.20R requested aggregate
```

Risk may later clip it.

## Result

`PASS`.

The System/Strategy boundary supports genuine disagreement without declaring one thesis wrong.

## GAP-02

`PortfolioTarget` should reference an explicit **AggregationPolicyVersion / aggregation_run_id** so replay can prove exactly which netting rules produced the target.

---

# R03 — Duplicate lineage across multiple bullish Views

## Input

```text
View A: direct Wallet X copy          +0.20R
View B: SmartMoney cohort containing X +0.20R
View C: independent momentum strategy  +0.20R
```

A and B partially share source lineage.

## Expected pipeline

- preserve all three Views;
- identify A/B as dependent contributions;
- apply deterministic cluster/source cap;
- do not delete evidence;
- produce target from capped contributions.

## Result

`PASS` at contract level.

## GAP-03

Make dependency explicit with a durable **LineageCluster / DependencyGroup** reference rather than relying on ad-hoc aggregation logic.

Suggested minimum:

```text
ViewContribution
  view_id
  normalized_target
  lineage_cluster_ids[]
  dependency_cap_applied
  cap_reason
```

---

# R04 — Portfolio requests +0.60R; risk clips to +0.35R

## Input

```text
PortfolioTarget requested: +0.60R
Current reconciled position: +0.10R
RiskPolicy max permitted ETH exposure: +0.35R
```

## Expected pipeline

```text
requested target  +0.60R
permitted target  +0.35R
current position  +0.10R
required delta    +0.25R
```

Original Views remain unchanged.

## Result

`PASS`.

## GAP-04

`RiskDecision` should carry:

- `risk_policy_version`;
- input `PortfolioTarget` id/version;
- requested target;
- permitted target;
- structured clip/block reasons;
- risk-state snapshot/reference;
- decision timestamp/expiry if relevant.

This makes later attribution able to distinguish strategy under-sizing from risk clipping.

---

# R05 — Critical market state becomes stale after target generation

## Input

```text
View active
PortfolioTarget valid
RiskDecision valid
critical execution quote becomes stale before PaperOrderIntent submit/fill
```

## Expected pipeline

Mutation blocks at the execution integrity boundary.

Research/evidence process remains alive.

When fresh market state returns:

1. do not blindly execute old delta;
2. re-check View expiry/current PortfolioTarget/current position;
3. generate or revalidate current execution intent.

## Result

`PASS` conceptually.

The legacy V5 paper broker already demonstrates quote-integrity, observed-provenance and max-age checks worth adapting.

## GAP-05

Create a shared **HardBlockReason taxonomy** separate from thesis evidence. Examples:

- `CRITICAL_DATA_STALE`
- `DATA_INTEGRITY_FAILED`
- `RISK_BUDGET_EXHAUSTED`
- `EXECUTION_UNRESOLVED`
- `INSTRUMENT_UNAVAILABLE`
- `POLICY_PROHIBITED`
- `ACCOUNT_BINDING_MISMATCH`

This prevents operational blockers from being mislabeled as weak confidence.

---

# R06 — Partial paper fill

## Input

```text
permitted target: +0.40R
current position: 0R
PaperOrderIntent requests equivalent +0.40R
broker capacity fills +0.15R
```

## Expected pipeline

```text
PaperFill: +0.15R
Position: +0.15R
Intent: PARTIALLY_FILLED
remaining intent quantity: equivalent +0.25R
```

Next portfolio/execution decision starts from actual reconciled +0.15R exposure.

## Result

`PASS`, with strong legacy implementation evidence.

V5 already records partial fills, remaining size, consumed observation hashes, duplicate-fill protection and restart reconciliation.

## No architecture change required

Adapt the mechanics behind the new `PaperOrderIntent` lineage.

---

# R07 — Three recent losses, current View remains eligible

## Input

```text
Last 3 strategy outcomes: losses
Current View: +0.25R
Current EvidenceProfile: independently valid
Current account drawdown: inside policy
Risk capacity: still available
```

## Expected pipeline

The producer's current evidence does not become weaker merely because prior outcomes lost.

If RiskPolicy mechanically reduces available budget based on drawdown, it may clip the requested target.

Example:

```text
View requested: +0.25R
risk permitted after drawdown policy: +0.15R
```

That is valid.

Invalid behavior:

```text
three losses → secretly require more evidence → no View/no target
```

unless StrategyVersion explicitly defines such regime/performance behavior.

## Result

`PASS` conceptually.

## GAP-06

Outcome-dependent risk adjustments must reference **RiskState / policy**, not mutate EvidenceProfile or StrategyVersion implicitly.

---

# R08 — Eligible View results in zero exposure accidentally

## Input

```text
Strategy requested +0.20R
no dependency conflict
risk permitted +0.20R
fresh data
no execution blocker
actual PortfolioTarget/Position remains 0R
```

## Expected behavior

This cannot disappear as “nothing happened.”

Generate a `MissedOpportunityRecord` or system defect record referencing:

- View;
- first eligible timestamp;
- requested/permitted target;
- reason actual target/exposure stayed zero;
- counterfactual baseline;
- subsequent outcome observation window.

## Result

`PASS` in product intent, but needs stronger trigger semantics.

## GAP-07

Define when missed-opportunity tracking is mandatory:

```text
producer_requested_nonzero
AND no hard block
AND risk_permitted_nonzero
AND actual exposure materially below permitted target
→ counterfactual eligibility = true
```

Portfolio netting to zero due to legitimate opposing Views is a different classification and should not automatically count as paralysis.

---

# R09 — Restart with nonterminal paper intent

## Input

```text
PaperOrderIntent = BROKER_PENDING
process stops unexpectedly
```

## Expected recovery

1. load durable intent/events/fills/trades;
2. validate lineage;
3. recover EXECUTED/PARTIALLY_FILLED if durable evidence exists;
4. expire if TIF definitively elapsed and no fill exists;
5. otherwise preserve unresolved state according to broker semantics;
6. do not create a fresh equivalent intent until state is reconciled.

## Result

`PASS`, again with strong legacy V5 pattern support.

The old reconciliation behavior is a high-value migration candidate.

---

# R10 — Future real wallet returns pending/MFA

## Input

```text
RealTradeIntent authorized
ExecutionOperation submitted
wallet returns external request/polling id
state = AWAITING_MFA
```

## Expected behavior

```text
Operation remains pending
external id persisted
same operation watched/reconciled
fresh equivalent submission blocked
```

If user rejects/timeout occurs, final failure is recorded only when external semantics prove the operation cannot still execute.

## Result

`PASS` at future-state-model level.

Current MetaMask Agent Wallet research independently supports this architecture.

---

# R11 — Paper identifier presented to future real path

## Input

```text
paper_intent_id = p_123
caller attempts to use it as real execution authority
```

## Expected behavior

Hard type/namespace rejection.

A new current `RealTradeIntent` must be created from current portfolio/real position/account/authority state.

## Result

`PASS` by paper/real isolation contract.

---

# R12 — Cross-user audit access

## Input

```text
User A authenticated
requests audit data
store contains A + B events
```

## Expected behavior

Only User A's permitted events returned unless separate explicit admin authority exists.

## Legacy comparison

V5 `/api/audit` returns global last 50 audit events without user filtering.

## Result

Current relaunch invariant: `PASS`.

Legacy migration seam: `FAIL / REPLACE`.

---

# Findings summary

The current architecture survives the first synthetic replay without requiring a house trading strategy.

Seven contract refinements should be made explicit before implementation:

1. `DecisionDisposition / ZeroTargetReason` taxonomy.
2. `AggregationPolicyVersion / aggregation_run_id` on PortfolioTarget.
3. Durable `LineageCluster / DependencyGroup` references.
4. Rich `RiskDecision` lineage + policy/risk-state references.
5. Shared `HardBlockReason` taxonomy separate from EvidenceProfile.
6. Explicit `RiskState` separation from evidence/strategy interpretation.
7. Mandatory `MissedOpportunityRecord` trigger semantics.

None of these require choosing whether breakout, wallet, momentum, mean-reversion, narrative, or another trading strategy is “correct.”

They are operating-system refinements.

## Next replay tranche

After these contract refinements are drafted, run:

- target reversal with existing position;
- multi-horizon disagreement;
- copy-source churn;
- strategy version change during open position;
- policy version change during pending intent;
- concurrent target writers;
- concurrent execution workers;
- stale → fresh recovery;
- storage `possibly_committed` fault;
- source coverage degradation;
- agent pause/stop with open position;
- future grant revocation during in-flight real operation.

Then use historical MetaEdge false-negative windows to test whether old gating would have been visible as `MissedOpportunityRecord`s under the new model.