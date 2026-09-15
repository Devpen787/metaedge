# Scenario Stress Tests

Status: **Validation suite for human review — no implementation authority**

Purpose: attack the MetaEdge relaunch contracts with the situations most likely to recreate historical paralysis, recklessness, double-counting, or authority confusion.

This suite validates the current drafts for:

- `EVIDENCE_PROFILE.md`
- `PORTFOLIO_AGGREGATION.md`
- `RISK_AND_EXPLORATION.md`
- `SOURCE_REPUTATION.md`
- Paper Agent operation
- CopySource behavior
- Paper execution / position management
- missed-opportunity accounting

The test question is not merely **“does the system avoid unsafe trades?”** It is also **“can the system participate when a valid opportunity exists?”**

## Global pass criteria

A scenario passes only if MetaEdge:

1. separates observed facts, inference and unknowns;
2. never turns an EvidenceProfile into a hidden universal confidence score;
3. distinguishes hard blockers from thesis uncertainty;
4. can produce a bounded scout/partial target when evidence is incomplete but valid;
5. preserves one portfolio authority and one execution authority;
6. prevents duplicate lineage from masquerading as independent confirmation;
7. manages an existing position continuously as evidence changes;
8. records why exposure changed;
9. treats no-trade/under-participation as reviewable decisions;
10. does not let recent wins/losses silently distort current evidence interpretation;
11. does not reward PnL while ignoring process violations;
12. can recover/reconcile state without duplicate financial mutation.

A scenario fails if ordinary uncertainty causes indefinite inactivity despite valid data, eligible instruments, available paper risk and a strategy that explicitly permits exploratory participation.

---

# S01 — Historical failure: +5% → +10% → +25% trend while MetaEdge waits

## Setup

Asset breaks out from a multi-day range.

### T0

Observed:

- price structure breaks resistance;
- 5m/15m velocity rises materially;
- spot volume accelerates;
- liquidity remains healthy;
- catalyst cause is unknown;
- no wallet-flow confirmation yet.

EvidenceProfile:

- price/structure: strong bullish;
- volume: strong bullish;
- wallet/on-chain: unknown;
- catalyst: unknown;
- derivatives: incomplete;
- execution conditions: healthy;
- urgency: immediate/developing.

No hard blocker exists. Exploration capacity exists.

## Expected behavior

A strategy that supports breakout participation may emit a **scout-sized long View** now.

The system must not require wallet confirmation, news explanation, derivatives confirmation and social confirmation simultaneously unless that exact strategy version explicitly defines those as prerequisites.

### T1 — price +5%

New observations:

- breakout holds;
- volume remains elevated;
- OI rises moderately;
- funding still normal;
- several monitored wallets begin net accumulation.

Expected target evolution:

```text
0R → scout exposure → larger but still bounded target
```

### T2 — price +10%

New observations:

- momentum still positive;
- funding now elevated;
- crowding risk increases;
- liquidity thins slightly;
- wallet accumulation slows.

Expected behavior:

MetaEdge may hold, add less aggressively, or reduce depending on strategy rules. It must not interpret “price already moved” as automatic permission to chase, nor as automatic reason to exit.

### T3 — price +25%

New observations:

- vertical extension;
- funding/crowding extreme;
- distribution appears in some tracked wallets;
- volatility expands sharply.

Expected behavior:

Target should be reassessed toward profit capture/reduction or exit if continuation evidence deteriorates. The system should not still be waiting for initial confirmation.

## Failure modes

- no position at T0/T1 solely because confidence is “not high enough”;
- evidence requirements increase after price moves, causing permanent lateness;
- one late oversized entry at +25% to compensate for missing the earlier move;
- inability to distinguish early scout from late chase;
- no counterfactual record if eligible scout exposure remained zero.

## Metrics

- first-eligible timestamp;
- first-exposure timestamp;
- entry delay;
- exposure at +5/+10/+25%;
- evidence available at each step;
- missed-opportunity PnL for permitted scout target;
- profit give-back after extension.

---

# S02 — False breakout immediately reverses

## Setup

Same T0 evidence as S01, but after scout entry price fails the breakout and rapidly returns inside the prior range.

Observed after entry:

- breakout failure;
- aggressive buyers disappear;
- sell-side absorption increases;
- volume remains high but direction flips;
- no supportive wallet accumulation appears.

## Expected behavior

A valid scout can lose.

The correct response is not to classify the initial decision as bad merely because PnL is negative.

MetaEdge should:

1. recognize thesis invalidation;
2. reduce/exit according to strategy logic;
3. attribute outcome separately from decision quality;
4. retain the event for strategy-level evaluation across many comparable breakouts.

## Failure modes

- retroactively claiming the scout should never have happened;
- moving the invalidation point to avoid realizing loss;
- doubling down because the original thesis “must” be right;
- disabling future scouts after one valid loss.

---

# S03 — Three valid losses followed by the fourth valid opportunity

## Setup

Same strategy has taken three consecutive paper scouts. All three were executed correctly and stopped according to plan.

A fourth occurrence appears with the same approved eligibility conditions and current portfolio risk still available.

## Expected behavior

The fourth occurrence is assessed from current evidence.

Recent losses may affect account-level available risk only if the approved drawdown/risk policy says so. They must not silently create a higher evidence threshold or extra confirmation requirements.

If allowed risk has been mechanically reduced, target may be smaller. If the loss budget is exhausted, risk may hard-block.

## Failure modes

- “three losses means wait for extra confirmation” when strategy version did not specify that;
- agent asks for human reassurance despite unattended Paper Agent authority;
- under-participation caused by recent outcome contamination;
- classifying a valid sequence of losses as proof the next occurrence is worse.

## Review

Track whether post-loss entry delay or participation rate differs from baseline without an explicit policy reason.

---

# S04 — Three wins followed by a seductive weak signal

## Setup

Agent/strategy has three strong wins. A fourth opportunity appears, but evidence is materially weaker and requested exposure should be small or zero under normal rules.

## Expected behavior

Recent wins do not increase the EvidenceProfile's strength or reliability.

Risk capacity may be higher because portfolio equity increased, but the producer still maps current evidence through the same strategy version.

## Failure modes

- oversized target because “the agent is hot”;
- relaxed invalidation or leverage constraints;
- strategy bypasses portfolio caps because recent PnL is positive;
- winner's PnL used as evidence for an unrelated current setup.

---

# S05 — Liquidation cascade: price move is real, cause is temporary

## Setup

Asset drops 8% rapidly.

Observed:

- large long liquidations;
- OI collapses;
- funding resets sharply;
- spot sell volume initially heavy;
- price velocity extreme;
- later, spot buying and wallet inflows appear while derivatives leverage clears.

## Expected behavior

EvidenceProfile must allow the thesis to evolve.

Possible sequence:

```text
initial momentum/flow View: short
↓
liquidation exhaustion emerges
↓
short target reduced to 0
↓
reversal/mean-reversion strategy may propose small long
```

The system must not anchor to the first directional thesis.

## Failure modes

- one early short View remains authoritative after evidence reverses;
- risk engine becomes thesis owner and refuses reversal because realized loss occurred;
- current position prevents recognition of opposing evidence;
- reversal creates duplicated opposing orders instead of one new aggregate target.

---

# S06 — Whale/wallet accumulation with hidden-hedge uncertainty

## Setup

A high-reputation wallet visibly accumulates a large long position.

Observed:

- position increase is verifiable;
- timing is fresh;
- wallet track record is strong;
- source wallet may have undisclosed hedge/other accounts/options exposure.

## Expected behavior

EvidenceProfile records:

```text
OBSERVED: visible long exposure increased
INFERRED: source may be directionally bullish
UNKNOWN: completeness of source portfolio / external hedge
```

CopyPolicy transforms this observation into follower-specific exposure.

The follower must not clone source leverage/notional.

Source reputation may increase the permitted contribution inside its sleeve, but never eliminate completeness uncertainty.

## Failure modes

- “wallet is long” becomes “wallet believes price must rise” as fact;
- direct 1:1 leverage copying;
- reputation score suppresses the hedge uncertainty warning;
- copied position bypasses portfolio aggregation.

---

# S07 — Five wallets appear bullish, but four derive from the same entity/cohort

## Setup

Discovery sees five bullish wallet signals.

Investigation shows:

- Wallets A–D are controlled by, funded by, or closely linked to one entity;
- Wallet E is independent.

## Expected behavior

Lineage/dependency model must prevent A–D from counting as four independent confirmations.

Portfolio aggregation preserves all observations but applies a source/evidence-cluster cap.

## Failure modes

- naive vote count = “5 bullish sources”;
- reputation multiplied by wallet count;
- cohort signal plus constituent wallet signals are double-counted.

---

# S08 — Conflicting high-quality wallets

## Setup

Two independently strong sources disagree:

- Wallet A builds +ETH exposure;
- Wallet B builds -ETH exposure;
- both have long track records;
- both observations are fresh;
- both may have different horizons.

## Expected behavior

MetaEdge preserves both Views and their horizons.

Possible result:

- short-term sleeve net long;
- multi-day sleeve short;
- aggregate account target near flat or modestly directional depending on budgets.

The system should explain **why** net exposure is small rather than collapsing the disagreement into “low confidence.”

## Failure modes

- universal confidence decreases and blocks all action;
- one higher-PnL source overwrites the other;
- horizon mismatch is ignored;
- both copy loops trade independently and churn the same account.

---

# S09 — Duplicate evidence across momentum, social and agent interpretation

## Setup

A single breaking-news event causes:

- price breakout;
- social attention spike;
- LLM narrative agent detects same news;
- wallet cohort reacts to that news.

## Expected behavior

MetaEdge records multiple manifestations but identifies shared lineage where possible.

These may strengthen situational understanding without being treated as four statistically independent pieces of evidence.

## Failure modes

- raw sum of all bullish signals causes excessive target;
- one event gets multiplied through several agents;
- source attribution cannot reconstruct the common origin.

---

# S10 — Valid opportunity but critical market data is stale

## Setup

Thesis evidence appears bullish, but execution price/order-book data is stale or provider integrity fails.

## Expected behavior

This is a hard integrity blocker for new mutation.

MetaEdge may continue research/shadow/counterfactual tracking but does not create a new Paper Intent from invalid execution evidence if the simulator requires fresh executable observations.

Once fresh state is restored, the opportunity is reassessed from current evidence rather than blindly executing the old target.

## Failure modes

- “anti-paralysis” misused to bypass stale data;
- stale target executes automatically after recovery without revalidation;
- data failure gets mislabeled as weak thesis evidence.

---

# S11 — Opportunity valid, but exploration budget exhausted

## Setup

A weak-but-valid new thesis appears. Portfolio exploration sleeve has no remaining risk capacity.

## Expected behavior

Risk hard-blocks new exposure for the correct reason: no available exploration budget.

The opportunity remains observable/counterfactual.

If risk later becomes available while opportunity remains valid, the current evidence is re-evaluated.

## Failure modes

- block reason says “insufficient confidence” instead of “risk budget exhausted”;
- opportunity disappears from missed-opportunity analysis;
- the agent tries to relabel the trade as a different strategy to bypass the sleeve.

---

# S12 — Existing position should scale down, not binary exit

## Setup

Current target: `+0.60R`.

New evidence:

- trend remains bullish;
- wallet support weakens;
- funding becomes crowded;
- execution liquidity deteriorates;
- thesis is weakened but not invalidated.

## Expected behavior

Producer may request `+0.30R` rather than `0R`.

Portfolio computes required delta from reconciled exposure.

This validates that evidence quality can change size without forcing binary participation.

## Failure modes

- system only supports BUY/HOLD/SELL;
- any contradiction forces full exit;
- existing position is ignored when computing new action.

---

# S13 — Sudden thesis reversal while already positioned

## Setup

Current target: `+0.40R` long.

New high-quality evidence strongly invalidates bullish thesis and supports short thesis.

## Expected behavior

Target path may become:

```text
+0.40R → 0R → -0.20R
```

or directly produce a net negative required delta if execution/state rules safely support it.

The account must not temporarily hold both unmanaged long and short positions because two agents act independently.

## Failure modes

- sunk-cost logic delays exit;
- previous winning thesis remains privileged;
- short proposer places its own order without portfolio netting;
- reversal is blocked merely because it contradicts earlier agent reasoning.

---

# S14 — Source reputation vs current-regime mismatch

## Setup

A trader has excellent long-term performance, but most gains came in high-beta bull markets. Current regime is low-liquidity risk-off.

## Expected behavior

Source reputation remains high on historical performance dimensions but current-regime relevance/copyability can be lower.

MetaEdge should be able to say:

```text
strong historical source
weak current-regime match
```

without lowering everything into one score.

## Failure modes

- universal leaderboard rank causes automatic copying;
- old absolute PnL overwhelms regime/copyability dimensions;
- source quality and current evidence quality are conflated.

---

# S15 — Good decision loses; bad decision wins

## A. Good decision loses

- valid evidence;
- correct strategy version;
- correct size;
- no policy violation;
- timely execution;
- stop/invalidation handled correctly;
- outcome negative.

Expected review: **process-valid loss**.

## B. Bad decision wins

- stale evidence or unapproved size;
- policy/risk violation;
- lucky favorable move;
- outcome positive.

Expected review: **process-invalid win**.

## Failure mode

Any reward/training/evaluation system that marks B “better” than A solely because PnL is higher.

---

# S16 — No-trade was correct

## Setup

Opportunity looks interesting but spread/liquidity is poor, critical data conflicts, or price is already beyond strategy's valid chase boundary.

## Expected behavior

MetaEdge may stay flat for a clear reason and later show that abstention avoided loss/poor execution.

Anti-paralysis must not become forced activity.

## Failure modes

- exploration rule forces a trade despite explicit non-actionable conditions;
- system optimizes for participation rate rather than decision quality;
- every no-trade is labeled a missed opportunity.

---

# S17 — No-trade was wrong and must become visible

## Setup

Opportunity met strategy eligibility, no hard blocker existed, exploration capacity existed, but final target remained zero due to discretionary/agent hesitation or accidental aggregation behavior.

Market subsequently moves materially in predicted direction.

## Expected behavior

Create/retain a `MissedOpportunity` record with:

- first eligible time;
- available evidence;
- permitted scout target;
- actual target/exposure;
- reason for zero/under-participation;
- counterfactual outcome;
- whether the cause was producer, portfolio, risk, execution or system defect.

## Failure modes

- no record because “no trade happened”;
- review only analyzes executed trades;
- system cannot distinguish intentional abstention from accidental paralysis.

---

# S18 — Partial paper fill / execution friction

## Setup

Portfolio target requires +0.40R, but paper broker fills only part due to liquidity/participation assumptions.

## Expected behavior

- PaperIntent/Fill state records partial execution;
- reconciled position is authoritative;
- next target delta is calculated from actual exposure;
- strategy does not assume requested target was reached;
- attribution separates thesis from execution friction.

## Failure modes

- target treated as position;
- duplicate full-size retry;
- PnL attributed as if intended size was filled.

---

# S19 — Future real operation is pending / MFA waiting

Status: **future design validation only — no real implementation authorization**.

## Setup

RealTradeIntent is authorized and submitted through a wallet adapter. Adapter returns a pending operation / polling identifier / MFA-wait state.

## Expected behavior

- operation becomes durable `pending_external` / `awaiting_user`;
- intent is reserved against equivalent resubmission;
- account/network/wallet identifiers are preserved;
- timeout is not classified as financial failure unless reconciled as such;
- restart resumes reconciliation;
- fresh equivalent intent is blocked until prior operation reaches a terminal/reconciled state.

## Failure modes

- timeout → retry same financial action;
- UI says “failed” while external operation may still execute;
- agent gets fresh authority while earlier operation is unresolved.

---

# S20 — Paper strategy later used for Real proposal

Status: **future boundary validation only**.

## Setup

`StrategyVersion v12` has a paper track record. User later enables it to generate Real proposals.

## Expected behavior

Shared:

- StrategyVersion;
- evidence logic;
- View semantics;
- target logic;
- attribution identifiers.

Separate:

- PaperIntent vs RealTradeIntent;
- PaperBroker vs wallet/venue adapter;
- PaperPosition vs RealPosition;
- execution authority;
- external operation/reconciliation state.

## Failure mode

Any design that promotes a paper order/fill into a real order or lets paper state itself confer real authority.

---

# Cross-scenario invariants

## Safety invariant

No strategy, agent, copied wallet or source can directly mutate account financial state outside canonical portfolio/risk/execution authority.

## Liveness invariant

When all of the following are true:

- market/execution evidence is sufficiently fresh for the strategy;
- instrument is eligible;
- strategy/source occurrence is valid;
- no hard blocker exists;
- paper exploration/risk capacity is available;
- strategy permits exploratory participation;

there must be a reachable path to a bounded Paper Target/Intent.

## Uncertainty invariant

Unknown thesis variables do not automatically become hard blockers. Unknown execution/account truth may.

## Outcome invariant

PnL cannot overwrite process truth.

## Lineage invariant

Correlated/derived observations cannot be silently counted as independent evidence.

## Current-state invariant

Execution always calculates required mutation from reconciled current exposure, never from the assumption that the previous target was fully achieved.

---

# Validation outputs to capture

For each replay/scenario capture:

```text
ScenarioResult
  scenario_id
  timeline[]
  observations[]
  evidence_profiles[]
  producer_views[]
  portfolio_targets[]
  risk_decisions[]
  execution_events[]
  reconciled_positions[]
  missed_opportunities[]
  outcome_attribution[]
  invariant_violations[]
  verdict: PASS | FAIL | NEEDS_RULE
```

The purpose is not to prove a profitable strategy from synthetic scenarios. It is to prove that the **decision architecture behaves coherently** under uncertainty, conflict, changing evidence, wins, losses, incomplete source visibility and execution ambiguity.

# Freeze gate

Do not freeze numeric Evidence→Exposure mappings or final portfolio-aggregation formulas until this suite has been replayed using:

- synthetic deterministic fixtures;
- selected historical MetaEdge false-negative windows;
- selected crypto trend/reversal/liquidation windows;
- duplicate-source/copy fixtures;
- recent-outcome contamination fixtures.

A design that passes only safety tests but repeatedly fails the liveness scenarios is not acceptable.
