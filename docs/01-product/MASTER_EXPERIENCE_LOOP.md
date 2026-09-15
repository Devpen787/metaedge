# Master Experience Loop

Status: **P3 WORKING DRAFT — pending P1/P2 approval**

Updated: 2026-09-15

## Purpose

Define the repeatable user experience that makes MetaEdge feel like one coherent product rather than a collection of trading tools.

This is a user-experience loop, not a backend state machine.

## Working loop

```text
NOTICE
  ↓
UNDERSTAND
  ↓
CHOOSE
  ↓
TEST / PARTICIPATE
  ↓
MANAGE
  ↓
REVIEW
  ↓
EVOLVE
  ↺
```

It aligns with the existing product cycle:

**Discover → Understand → Test → Act → Manage → Learn → Scale**

but uses language closer to what the user is actually doing.

## 1 — Notice

The user encounters something potentially worth attention.

Examples:

- a market move;
- a wallet/trader action;
- a strategy/agent result;
- a source they already follow;
- a catalyst/narrative;
- a change in an existing position.

User question:

> “Why is this worth my attention now?”

The product should answer enough to invite inspection without pretending the opportunity is already proven.

## 2 — Understand

The user opens the item and forms a usable mental model.

User questions:

- What happened?
- Why might it matter?
- What supports the idea?
- What conflicts with it?
- What is unknown?
- How fresh/complete is the information?
- What are relevant sources/agents doing?

The user should not need to understand MetaEdge's internal domain model to answer these.

## 3 — Choose

The user decides how deeply to engage.

Possible relationships/actions include:

```text
Ignore / dismiss
Save / follow
Compare
Shadow
Backtest
Create / adapt
Paper try
Delegate bounded paper monitoring/action
```

The UX must make these choices understandable as different levels of commitment and trust.

## 4 — Test / Participate

The user or an already-authorized Paper Agent runs the chosen experiment.

The experience must make clear:

- this is paper/shadow/backtest;
- what idea/source is being tested;
- what exposure/assumptions apply;
- what would make the experiment change or stop;
- what the agent is allowed to do.

The product must not imply certainty is required before a bounded experiment can exist.

## 5 — Manage

MetaEdge stays useful after entry.

The user should be able to answer:

- What changed?
- Is the original reason still valid?
- Has risk changed?
- Did the agent add, hold, reduce or exit?
- Why?
- What is being watched next?

Management is part of the journey, not a separate professional-only tool.

## 6 — Review

The user sees what happened and why.

Review should distinguish:

- what the user/agent knew at decision time;
- what happened later;
- whether the process was followed;
- whether execution assumptions mattered;
- whether abstention or under-participation mattered;
- whether the result was skill, luck, regime or source behavior.

## 7 — Evolve

The user decides what changes next.

Examples:

- keep following;
- stop following;
- change a strategy/copy policy;
- repeat the experiment;
- widen/narrow paper authority;
- promote a source/strategy to a more trusted role;
- retire the idea;
- return to discovery.

No change silently rewrites history.

## Loop law

Every primary V1 surface/journey should answer one or more of these questions and connect back into this loop.

If a proposed feature cannot explain where it sits in the loop, it is probably peripheral or premature.

## Entry points

The loop may begin from:

- home/discovery;
- a saved/followed source update;
- an agent alert;
- an active position change;
- a user-created idea;
- a review/history item.

We should not assume all users start on a universal dashboard.

## Exit points

A user may leave the loop after:

- dismissing an item;
- following it for later;
- stopping/retiring an experiment;
- completing review;
- returning to passive monitoring.

The product should preserve continuity so a later return does not require rebuilding context.

## P3 exit criterion

After P1/P2 are approved:

- confirm the loop language;
- confirm every primary job maps into it;
- identify any missing step;
- confirm no V1 journey is orphaned from the loop.
