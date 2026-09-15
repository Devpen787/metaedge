# MetaEdge Product & UX Foundation

Status: **ACTIVE PHASE AUTHORITY — human approval required to advance gates**

Updated: 2026-09-15

## Why this document exists

The relaunch accumulated useful archaeology, platform research and technical hypotheses faster than the product experience was being made concrete. This document resets the active method.

MetaEdge will follow a product/UX-first progression similar to the successful ChopDot relaunch method: understand the user and complete experience first, make journeys concrete and reviewable, then derive architecture from approved product truth.

Technical work already produced is preserved. It is not discarded. Until the relevant journeys are approved, it is **supporting hypothesis / constraint material**, not the authority that determines the product experience.

## Canonical progression

```text
P0  Product/UX operating system
 ↓
P1  V1 wedge + primary user
 ↓
P2  User jobs / JTBD
 ↓
P3  Master experience loop
 ↓
P4  Journey registry + connection map
 ↓
P5  UX laws + design principles
 ↓
P6  Information architecture / primary surfaces
 ↓
P7  Detailed end-to-end journey specifications
 ↓
P8  Product review + UX breaker + connection validation
 ↓
P9  Golden journeys
 ↓
P10 Domain / state / security / technical derivation
 ↓
P11 Legacy REUSE / ADAPT / REPLACE / REMOVE / DEFER map
 ↓
P12 Implementation → QA / breaker
```

No phase may silently pull authority backward from a later phase.

## Product authority order

When artifacts conflict, use this order:

1. Product Constitution for non-negotiable product laws.
2. Human-approved V1 wedge, primary user, jobs and master experience loop.
3. Golden user journeys.
4. Approved UX laws, design principles and information architecture.
5. Approved product capability contracts.
6. Domain/state/security contracts **derived from the above**.
7. Architecture and migration decisions.
8. Research, platform reviews, archaeology and historical implementation as evidence only.

## Current phase

**P1 — V1 Wedge + Primary User: DRAFTING**

The repository may contain later-stage drafts, but P10+ work is paused until the UX gates above are satisfied.

## Gate definitions

### P1 — V1 wedge + primary user

Must answer:

- Who is the first person MetaEdge is for?
- What problem are they already experiencing?
- What is the smallest product experience that proves MetaEdge is meaningfully better?
- What is intentionally not in V1?

Exit criterion: one human-approved wedge statement and primary-user definition.

### P2 — User jobs / JTBD

Must describe jobs in user language, independent of current screens or backend objects.

Exit criterion: prioritized job map with primary/secondary jobs and clear success conditions.

### P3 — Master experience loop

Must explain the repeatable user loop from attention → understanding → decision → safe participation → management → learning → return.

Exit criterion: one approved master loop that all V1 journeys connect to.

### P4 — Journey registry

Every journey receives a stable ID, user job, entry point, exit point, dependencies and status.

Exit criterion: no orphan core journeys; connections are visible.

### P5 — UX laws + design principles

Define what must always be true about clarity, trust, uncertainty, automation, paper/real separation, recovery and progressive disclosure.

Exit criterion: approved laws that journey reviewers can use as a breaker checklist.

### P6 — Information architecture

Only after the previous gates do we decide the primary product surfaces/navigation. Old tabs have no presumption of survival.

### P7 — Detailed journey specifications

Specify what the user sees, understands, decides and experiences at every step, including empty/loading/error/unknown/recovery/back/refresh/restart states.

### P8 — UX breaker

Challenge each journey for ambiguity, dead ends, inconsistent language, excessive cognitive load, accidental authority, unsafe defaults, missing recovery and broken connections.

### P9 — Golden journeys

A journey becomes Golden only after human approval following breaker review. Downstream technical work must conform to Golden journeys. Changes require an explicit product decision and re-review.

### P10+ — technical derivation

Only here do `EvidenceProfile`, `View`, portfolio state, execution states, security transitions, data contracts and implementation seams become candidates for freeze.

## Current handling of existing relaunch artifacts

### Product/research inputs — preserve and use

- repository archaeology and failure history;
- current MetaMask capability research;
- external framework/copy/agent research;
- Trading in the Zone mapping;
- product constitution and product-model hypotheses;
- anti-paralysis, copy/source, paper/real and progressive-authority principles.

### Journey inventory — useful, not Golden

Existing `docs/02-journeys/J01–J14` material is requirements inventory and prior reasoning. It must be rewritten/reviewed from the user's point of view before becoming product authority.

### Technical hypotheses — paused, not deleted

Existing domain models, state machines, EvidenceProfile schema, portfolio aggregation, security matrices, contract replays and migration maps are retained as hypotheses/constraints for P10. They must not force UX decisions during P1–P9.

## Stop rules

Until P9 is reached:

- no application implementation;
- no deployment changes;
- no real execution;
- no architecture freeze;
- no assumption that an old UI surface survives;
- no strategy-specific trading rule becomes a platform UX law;
- no technical object is allowed to become a screen merely because it exists in a draft model.

## Method

Move one gate at a time. Supporting research may run in parallel, but only the active product gate may create canonical product truth.
