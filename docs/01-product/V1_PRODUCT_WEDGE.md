# V1 Product Wedge

Status: **P1 DRAFT — current active decision**

Updated: 2026-09-15

## Working wedge statement

MetaEdge is a **paper-first crypto decision and agent workspace** for active self-directed participants who already discover ideas from market moves, wallets, traders, narratives, strategies and agents, but do not have one disciplined way to turn those ideas into understandable, testable and manageable decisions.

MetaEdge helps them:

**find something worth attention → understand why it may matter → choose how deeply to engage → test/participate safely → manage what happens → learn whether the process deserved trust.**

The product should reduce two opposite failure modes:

1. **blind action** — copying, trading or automating without enough context or control;
2. **analysis paralysis** — seeing a legitimate opportunity but adding conditions until participation becomes impossible or late.

## Working primary user hypothesis

The first MetaEdge user is an **active crypto participant / explorer** who:

- already follows markets and crypto narratives;
- may inspect wallets, traders, strategies, agents or social/on-chain signals;
- uses exchanges/wallets but does not necessarily have a formal quant workflow;
- wants better discipline without becoming a professional quant engineer;
- is interested in AI/agent assistance but does not want an opaque bot controlling capital;
- wants to test ideas and sources before trusting them;
- values a clear explanation of what is known, inferred and unknown.

This is a hypothesis for human review, not a frozen persona.

## Core problem

Today the user's workflow is fragmented:

```text
notice something on X / a chart / wallet tracker / Discord / research
      ↓
open several tools
      ↓
try to understand whether it matters
      ↓
maybe save it somewhere
      ↓
maybe trade manually
      ↓
lose the original reasoning / evidence
      ↓
rarely review whether the decision process was actually good
```

MetaEdge should make that one coherent loop.

## What V1 must prove

V1 succeeds if a user can repeatedly experience this:

1. MetaEdge surfaces or accepts something worth investigating.
2. The user can understand what happened, why it may matter, what supports it, what conflicts and what is unknown.
3. The user can choose a relationship/action without being forced directly into a trade: ignore, save/follow, shadow/test, create/adapt, paper try.
4. A paper action is clearly bounded and explainable.
5. MetaEdge continues helping after entry instead of treating the trade as finished.
6. The user can review what happened and distinguish outcome from decision quality.
7. The next decision is better informed by the history.

## Product promise

**MetaEdge helps you turn possible edges into disciplined experiments before you trust them with more authority.**

Alternative language to test during UX work:

- Find an edge. Understand it. Test it. Manage it. Learn from it.
- From signal to evidence to safe action.
- Develop agents you can trust because they earn authority through evidence.

No marketing line is frozen yet.

## V1 boundaries — working

V1 is paper-first.

Likely in scope:

- discovery across selected market/source types;
- opportunity/source investigation;
- follow/save/return workflows;
- shadow or historical testing where useful;
- paper portfolios and paper participation;
- paper copy under user-specific transformation;
- bounded Paper Agent behavior;
- continuous paper position management;
- review, attribution and missed-opportunity learning.

Not required to prove V1:

- unrestricted autonomous real trading;
- real copy trading;
- vault/pooling behavior;
- broad social-network mechanics;
- every old MetaEdge tab;
- every market/source/provider;
- a universal strategy marketplace;
- Arena unless the core journey is already strong.

## Wedge discipline

MetaEdge is not trying to be all of these at once on day one:

- Bloomberg terminal;
- wallet tracker;
- copy-trading exchange;
- strategy IDE;
- autonomous hedge fund;
- social trading network;
- generic AI chat assistant.

Those capabilities may exist later. V1 must feel like **one product with one repeatable job**.

## P1 questions to resolve before moving on

### Q1 — Primary user

Which person should the first experience optimize for?

A. Active crypto explorer who finds ideas across many sources and wants one disciplined workflow.
B. Wallet/trader follower who mainly wants to discover and safely test copying strong sources.
C. Strategy experimenter who mainly wants to turn ideas into repeatable paper agents.

Working recommendation: **A**, with B and C as strong jobs inside the experience rather than separate products.

### Q2 — What is the first “wow” moment?

Candidate:

> “I found something interesting, MetaEdge explained why it mattered and what was uncertain, and within minutes I was safely shadowing or paper-testing it with an agent watching what happened.”

We should approve or rewrite this before designing navigation.

### Q3 — Initial market scope

Does the first Golden journey need:

- spot only; or
- spot + paper perps?

This should be decided from the user journey and teaching value, not from existing code coverage.

### Q4 — Initial discovery breadth

Should the first journey begin with:

- markets/opportunities;
- wallets/traders;
- or a blended discovery feed?

Do not answer from architecture convenience.

## P1 exit criterion

Human approval of:

1. primary user;
2. core problem;
3. product promise;
4. V1 proof loop;
5. first wow moment;
6. major scope exclusions.

Only then move P2 User Jobs from draft to review.
