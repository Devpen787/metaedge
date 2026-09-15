# Decision State Contracts

Status: **Draft refinement from Contract Replay 01**

## Purpose

Make every non-action, clip, block, and under-participation outcome explainable by machine-readable state.

The system must never collapse all flat outcomes into `NO_TRADE`.

## 1. DecisionDisposition

Recommended cross-domain classification:

```text
DecisionDisposition
  PRODUCER_NONZERO_REQUEST
  PRODUCER_ZERO_TARGET
  PRODUCER_SHADOW_ONLY
  PORTFOLIO_NETTED_NONZERO
  PORTFOLIO_NETTED_ZERO
  PORTFOLIO_CLIPPED
  RISK_ALLOWED
  RISK_CLIPPED
  RISK_BLOCKED
  EXECUTION_READY
  EXECUTION_BLOCKED
  EXECUTION_PARTIAL
  EXECUTION_COMPLETE
  EXECUTION_UNRESOLVED
  UNDER_PARTICIPATED
```

These are not all one object's state machine. They are a shared vocabulary for explaining where a decision changed.

## 2. ZeroTargetReason

A zero final target must state why.

Candidate values:

```text
PRODUCER_EXPLICITLY_FLAT
PRODUCER_NO_ELIGIBLE_OPPORTUNITY
PRODUCER_SHADOW_ONLY
OPPOSING_VIEWS_NETTED_TO_ZERO
DEPENDENCY_CAP_NETTED_TO_ZERO
PORTFOLIO_POLICY_FORCED_FLAT
RISK_POLICY_FORCED_FLAT
CRITICAL_EXECUTION_BLOCK
EXISTING_POSITION_ALREADY_AT_TARGET
EXPIRED_BEFORE_ACTION
SYSTEM_UNDER_PARTICIPATION
UNKNOWN_SYSTEM_STATE
```

A zero target is not automatically a missed opportunity.

## 3. HardBlockReason

Hard blockers are operational/authority constraints, not thesis confidence.

Canonical initial taxonomy:

```text
CRITICAL_DATA_UNAVAILABLE
CRITICAL_DATA_STALE
DATA_INTEGRITY_FAILED
INSTRUMENT_UNAVAILABLE
VENUE_UNAVAILABLE
ACCOUNT_BINDING_MISMATCH
NETWORK_BINDING_MISMATCH
POLICY_PROHIBITED
UNIVERSE_PROHIBITED
RISK_BUDGET_EXHAUSTED
LOSS_BUDGET_EXHAUSTED
LIQUIDITY_CAPACITY_UNAVAILABLE
EXECUTION_UNRESOLVED
DUPLICATE_OPERATION
AUTHORITY_EXPIRED
AUTHORITY_REVOKED
AGENT_ENVELOPE_VIOLATION
COPY_POLICY_VIOLATION
STORAGE_DURABILITY_UNRESOLVED
```

`WEAK_EVIDENCE` and `LOW_CONFIDENCE` are intentionally absent.

A StrategyVersion may decide weak evidence implies zero requested target, but that is producer logic—not a platform hard block.

## 4. AggregationRun

PortfolioTarget must be reproducible from an explicit aggregation event.

```text
AggregationRun
  aggregation_run_id
  portfolio_id
  aggregation_policy_id
  aggregation_policy_version
  started_at
  completed_at
  input_view_ids[]
  input_position_snapshot_id
  input_risk_state_id?       # only if pre-risk portfolio caps depend on account state
  dependency_snapshot_id
  output_target_ids[]
  deterministic_input_hash
```

The target then references `aggregation_run_id`.

This lets replay answer:

> Which Views and rules created this target at that time?

## 5. LineageCluster / DependencyGroup

Use explicit dependency objects to avoid repeated evidence/source amplification.

```text
LineageCluster
  cluster_id
  cluster_type
  member_refs[]
  basis
  observed_at
  expires_at?
  confidence_in_linkage     # linkage quality, not trade confidence
  provenance_refs[]
```

Candidate cluster types:

```text
COMMON_SOURCE_ENTITY
COMMON_WALLET_OWNER
COHORT_CONTAINS_SOURCE
COMMON_NEWS_EVENT
COMMON_DATA_FEED
COMMON_STRATEGY_FEATURE
DERIVED_FROM_SAME_VIEW
MANUAL_LINK
```

`ViewContribution` should record which clusters affected its cap/normalization.

## 6. RiskState

Keep account risk state separate from market evidence.

```text
RiskState
  risk_state_id
  portfolio_id
  risk_policy_id
  risk_policy_version
  as_of
  equity
  current_gross_exposure
  current_net_exposure
  instrument_exposures
  drawdown_state
  realized_loss_budget
  unrealized_loss_budget
  exploration_budget_remaining
  leverage_state
  concentration_state
  liquidity_capacity_state
  pending_execution_reservations
  hard_blocks[]
```

A losing streak may legitimately alter `RiskState` if the policy says so.

It must not silently alter EvidenceProfile.

## 7. RiskDecision

```text
RiskDecision
  risk_decision_id
  portfolio_target_id
  risk_state_id
  risk_policy_id
  risk_policy_version
  requested_target
  permitted_target
  action          # ALLOW | CLIP | BLOCK | REDUCE
  reasons[]
  hard_block_reasons[]
  created_at
  expires_at?
  supersedes?
```

The original PortfolioTarget and contributing Views remain immutable historical inputs.

## 8. ExecutionBlock

An execution block is distinct from risk and thesis.

```text
ExecutionBlock
  block_id
  intent_or_target_ref
  reason
  first_seen_at
  last_seen_at
  recoverable
  recovery_requirement
  related_external_operation_id?
```

Examples:

- stale quote;
- venue unavailable;
- unresolved earlier operation;
- account/network changed;
- storage durability uncertain.

## 9. MissedOpportunity eligibility

Create/maintain a counterfactual record when all are true:

```text
producer_requested_nonzero
AND portfolio_requested_nonzero after valid netting/dependency logic
AND risk_permitted_nonzero
AND no hard execution blocker at the decision point
AND actual exposure remained materially below permitted target
```

This becomes:

```text
MissedOpportunityRecord
  record_id
  opportunity_id
  view_ids[]
  portfolio_target_id
  risk_decision_id
  first_eligible_at
  permitted_target
  actual_target
  actual_exposure
  under_participation_source
  reason
  counterfactual_policy_id
  evaluation_windows[]
  outcome_classification
```

Candidate `under_participation_source`:

```text
PRODUCER
PORTFOLIO
RISK
EXECUTION
AGENT_RUNTIME
DATA_PIPELINE
SYSTEM_DEFECT
UNKNOWN
```

## 10. Legitimate zero vs paralysis

Examples:

### Legitimate zero

```text
Momentum +0.20R
MeanReversion -0.20R
→ portfolio net zero
```

No missed-opportunity flag merely because price later moved.

### Legitimate risk block

```text
Strategy requested +0.20R
exploration budget = 0
→ RISK_BUDGET_EXHAUSTED
```

Track counterfactual for analysis if desired, but do not classify as accidental paralysis.

### System under-participation

```text
Strategy requested +0.20R
portfolio target +0.20R
risk permitted +0.20R
execution available
actual exposure remains 0R
```

This **must** become visible as under-participation / system defect candidate.

## 11. Required invariant

For every decision cycle, MetaEdge should be able to answer:

```text
What did producers want?
What did portfolio request?
What did risk permit?
What could execution do?
What exposure actually existed?
Why were any of those different?
```

If the system cannot answer all six, the decision pipeline is not sufficiently observable to diagnose paralysis, overtrading, or authority leakage.