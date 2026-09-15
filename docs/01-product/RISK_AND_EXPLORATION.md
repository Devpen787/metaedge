# Risk and Exploration Contract

Status: **Draft for human approval**

## Problem this contract solves

The previous MetaEdge accumulated enough evidence gates and caution that the system could remain inactive while markets moved materially. This contract prevents risk management from becoming permanent indecision.

## Core rule

> **Weak evidence should usually reduce position size, not eliminate participation.**

A system that cannot act until a thesis is already obvious will consistently enter late or miss the move entirely.

## Separate two questions

### 1. Is this action safe and valid enough to attempt?

This is a deterministic safety / integrity question.

Possible outcomes:

- `ALLOW`
- `BLOCK`

### 2. How much evidence supports the thesis?

This is an evidence-quality question.

Possible effects:

- shadow only;
- scout allocation;
- normal paper allocation;
- larger bounded paper allocation;
- reduce existing exposure;
- hold;
- exit.

Evidence quality must not silently become a hard execution gate.

## Hard blockers

Only objective safety, authority, integrity, or feasibility conditions should create a hard block. Candidate examples:

- missing/invalid/stale canonical market data;
- unsupported or unresolvable instrument;
- impossible or inadequate liquidity;
- exhausted portfolio/risk budget;
- replay/duplicate intent;
- unresolved prior execution where another action could duplicate risk;
- invalid account/network/wallet context;
- explicit user restriction;
- execution venue unavailable;
- required authority expired/revoked;
- corrupted or irreconcilable state.

This list must remain explicit and reviewable.

## Evidence profile — not scalar confidence

MetaEdge should avoid using a single value such as `confidence = 0.72` as the permission to trade.

An opportunity should instead carry an evidence profile. Example dimensions:

- price momentum / velocity;
- volume acceleration;
- order flow / imbalance;
- liquidity;
- open interest;
- funding;
- wallet inflows/outflows;
- large buyer/seller behavior;
- on-chain activity;
- catalyst / narrative evidence;
- attention / social velocity;
- behavioral/psychology state;
- regime;
- cross-market confirmation;
- copied-source quality;
- contradictions / counter-evidence;
- data freshness and completeness.

The profile should preserve disagreement rather than compress it prematurely into one percentage.

## Progressive participation

Candidate participation ladder:

- `observe` — no exposure;
- `shadow` — counterfactual only;
- `scout` — small bounded paper exposure;
- `normal` — standard paper risk;
- `scaled` — larger paper exposure after stronger evidence;
- `reduce` — evidence deteriorating;
- `exit` — thesis invalidated or risk condition triggered.

Exact risk-unit values are a later product decision.

Illustrative only:

- scout: `0.25R`
- normal: `0.50R`
- high-evidence paper: `1.00R`

## Exploration budget

A paper portfolio should reserve explicit capacity for learning.

Exploration risk exists so the system can obtain forward evidence without first proving the hypothesis it is attempting to test.

The exploration budget must be:

- bounded;
- portfolio-aware;
- attributable to an exact strategy/source/version;
- visible to the user/operator;
- separable from core/confirmed allocation;
- subject to loss and concentration limits.

## Position management

MetaEdge should manage **target exposure**, not only entry orders.

As evidence evolves, the desired position may change:

`0 → +0.25R → +0.50R → +0.75R → +0.30R → 0`

The system should be able to scale up and down without treating every observation as a fresh unrelated trade decision.

Price appreciation itself is not automatically evidence to add. The system must distinguish continuation from exhaustion using the current evidence profile.

## Fast path vs research path

### Fast opportunity path

Used for rapidly changing conditions such as:

- breakout/volume acceleration;
- liquidation cascades;
- sudden wallet accumulation/distribution;
- order-flow shifts;
- funding/OI dislocations;
- catalyst/news moves;
- attention/narrative acceleration.

The fast path may authorize a small paper scout when the event is real enough to investigate and no hard blocker exists.

### Research path

Used for slower ideas such as:

- moving-average systems;
- mean reversion;
- carry;
- systematic factor hypotheses;
- long-horizon source following;
- strategy-family evaluation.

The research path may use deeper validation without blocking the fast path from bounded learning.

## No-trade accountability

A no-trade decision is recorded with:

- opportunity id;
- detected time;
- evidence profile;
- hard-block status;
- available risk at decision time;
- whether a scout was permissible;
- explicit no-trade reason.

The opportunity remains under observation for a defined counterfactual window.

MetaEdge should later classify outcomes such as:

- good abstention;
- avoided loss;
- false negative / missed opportunity;
- late entry caused by excessive thresholding;
- legitimately untradeable;
- indeterminate.

## Anti-paralysis metrics

Candidate metrics:

- eligible opportunities observed;
- scout actions taken;
- normal/scaled actions taken;
- hard blocks;
- voluntary skips;
- profitable skipped opportunities;
- losses avoided by abstaining;
- counterfactual PnL of skipped scouts;
- capital utilization;
- time since last bounded experiment;
- percentage of eligible opportunities blocked without risk-budget pressure;
- entry delay after initial valid evidence.

These metrics diagnose both over-conservatism and reckless over-activity.

## Liveness invariant

A core testable invariant:

> Given fresh valid market data, an eligible instrument, available exploration risk, and a valid opportunity with no hard blocker, there must exist a bounded path that can produce a paper scout intent.

Testing must prove not only that unsafe actions are rejected, but that legitimate bounded actions can occur.
