# UX Laws & Design Principles

Status: **P5 WORKING DRAFT — breaker criteria, not yet approved**

Updated: 2026-09-15

## Purpose

Define the experience rules that should hold across MetaEdge regardless of screen, source type, strategy, agent or execution provider.

These are UX/product laws. They are not trading strategies.

## UX laws

### UX-01 — One primary user decision at a time

Each surface should make the next meaningful decision obvious.

A screen may contain rich evidence, but it should not force the user to solve five unrelated workflows simultaneously.

### UX-02 — Explain why something deserves attention

Anything surfaced prominently must expose why it appeared.

Ranking without reason is not enough.

### UX-03 — Observed, inferred and unknown must not blur together

The user should be able to tell what MetaEdge directly observed, what it inferred and what remains unknown.

This is especially important for wallets/traders with potentially hidden exposure.

### UX-04 — Evidence includes contradiction

Do not present only supporting evidence. Material disagreement, incompleteness and stale data must remain visible without turning the interface into a fear dashboard.

### UX-05 — Uncertainty is communicated, not converted into fake precision

Do not use a single confidence percentage as a substitute for explanation or authority.

If a numeric score exists for a specific objective, its meaning must be explicit and it cannot silently become “permission to act.”

### UX-06 — Commitment levels must feel distinct

The user must understand the difference between:

```text
Watch / Save
Follow
Shadow
Backtest
Paper Try
Paper Copy
Paper Agent
Future Real
```

Moving between them is an explicit product transition.

### UX-07 — Paper and real can never be visually or behaviorally ambiguous

Paper/shadow/backtest modes need persistent, unmistakable cues.

A paper control must never become real merely because a hidden environment flag changed.

### UX-08 — Agents explain changes, not chain-of-thought

For material agent behavior, show concise decision evidence such as:

- what changed;
- what action was taken or proposed;
- why;
- what risk/constraint mattered;
- what is being watched next.

Do not require private model reasoning to make the product auditable.

### UX-09 — The product remains useful after entry

A position is not the end of the journey.

Management must explain additions, holds, reductions, exits and reversals in the context of what changed.

### UX-10 — No-action must be understandable

The user should be able to distinguish:

- nothing qualified;
- user intentionally stayed out;
- portfolio/risk blocked exposure;
- execution/data was unavailable;
- the system failed to participate when it should have.

“NO_TRADE” alone is not acceptable UX.

### UX-11 — Risk is shown in user terms before commitment

Before meaningful paper/real authority, the user should understand the downside/limits/assumptions without translating backend risk objects.

### UX-12 — Progressive disclosure over terminal-density

Default views should answer the user's question first. Advanced evidence, assumptions and lineage should be inspectable without dominating every surface.

### UX-13 — History preserves the original decision context

Later outcomes must not rewrite what was known or believed at decision time.

Review should make hindsight distinguishable from decision-time evidence.

### UX-14 — Recovery is part of the journey

Back, refresh, restart, network/data interruption, partial execution and resumed sessions must lead to understandable states.

The user should not need to guess whether something happened.

### UX-15 — No dead ends

Every meaningful state should provide a valid next action or explain why none exists.

### UX-16 — Source identity and completeness are visible where they matter

A high-performing source is not automatically a trustworthy/copyable source. Coverage, horizon, leverage, concentration and incompleteness should be inspectable.

### UX-17 — Automation earns trust progressively

The product should make it easy to increase or decrease authority intentionally.

A user should always know what an agent is allowed to do now.

### UX-18 — Technical objects do not automatically become product concepts

`EvidenceProfile`, `View`, `PortfolioTarget`, `ExecutionGrant`, etc. are implementation/domain language unless the user benefits from seeing them directly.

The UX may translate them into simpler concepts.

## Design principles

### Calm over sensational

MetaEdge should surface urgency without using casino-style pressure, artificial excitement or manipulative FOMO.

### Dense when requested, simple by default

The product can support expert depth, but the first layer should orient the user quickly.

### Comparison before commitment

Where possible, users should be able to compare sources, ideas or modes before granting more authority.

### Show the cost of finding out

For a test/action, make the experiment boundaries understandable instead of pretending uncertainty can be eliminated.

### Preserve continuity

Following, testing, managing and reviewing should feel like one evolving thread rather than disconnected modules.

### Trust comes from inspectability + consistency

The user should trust MetaEdge because it preserves evidence, behaves consistently, shows constraints and admits uncertainty — not because it claims to be intelligent.

## Breaker questions

During UX review, ask:

- What is the one decision this screen helps the user make?
- Can the user tell why they are here?
- Can they distinguish fact/inference/unknown?
- Can they distinguish paper/shadow/real?
- Can they understand the next commitment level?
- Can they recover after interruption?
- Is there a dead end?
- Is technical complexity leaking into the UX unnecessarily?
- Is the product quietly making a strategy decision on the user's behalf?
- Would a user know why nothing happened?

## P5 exit criterion

Approve, revise or reject these laws after P1–P4 are stable, then use them as mandatory review criteria for every Golden journey.
