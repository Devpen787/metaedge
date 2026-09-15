# Product / UX Operating Workflow

Status: **ACTIVE OPERATING METHOD**

Updated: 2026-09-15

## Purpose

Keep MetaEdge moving methodically without allowing research, architecture or implementation to outrun product truth.

## Core loop

```text
RESEARCH / EVIDENCE
      ↓
PRODUCT + UX SPEC
      ↓
UX BREAKER / CONNECTION REVIEW
      ↓
HUMAN APPROVAL
      ↓
GOLDEN ARTIFACT
      ↓
TECHNICAL DERIVATION
      ↓
BUILD
      ↓
QA / BREAKER
```

The same loop repeats at different levels: wedge, journey, information architecture, technical seam and implementation slice.

## Role boundaries

### Research / Evidence

Job:

- inspect external systems, user history, platform docs and legacy implementation;
- gather evidence and alternatives;
- identify constraints and failure lessons.

May not:

- silently decide product behavior;
- promote a competitor's implementation into MetaEdge product truth;
- freeze architecture.

Output:

- research note;
- source citations;
- implications/questions;
- explicit fact vs inference vs recommendation.

### Product / UX Spec

Job:

- translate approved product intent into user-language flows;
- define jobs, decisions, states, transitions and terminology;
- resolve what belongs in/out of the experience.

May not:

- use backend convenience as the main reason for UX behavior;
- invent strategy-specific trading rules as platform laws;
- declare its own work Golden.

Output:

- product/wedge spec;
- journey draft;
- UX/design decision proposal;
- explicit open questions.

### UX Breaker

Job:

Challenge the spec for:

- unclear user job;
- overloaded screens;
- dead ends;
- mode confusion;
- fact/inference/unknown confusion;
- hidden authority;
- missing empty/error/recovery states;
- inconsistent terminology;
- broken adjacent-journey links;
- unexplained no-action;
- accidental strategy decisions;
- unnecessary technical leakage.

Output:

- blocker / major / minor findings;
- exact journey step or law affected;
- proposed repair or question.

Breaker does not redesign everything by itself.

### Human Product Approval

Human approval promotes an artifact to `APPROVED` or `GOLDEN`.

No agent may self-promote a journey to Golden.

### Technical Derivation

Starts only from Golden product/UX truth.

Job:

- derive domain objects;
- state machines;
- contracts;
- security invariants;
- data/provider requirements;
- architecture seams;
- migration decisions.

Output must trace back to the Golden journey(s) that require it.

### Build

Implements an approved technical slice.

No implementation task may invent a new user journey or visible product rule to unblock itself.

### QA / Breaker

Validates:

- behavior against Golden journey;
- edge states;
- visual/interaction consistency;
- security/recovery requirements;
- no unapproved product expansion.

## Concurrency rules

### One canonical product lane

Only one active core product gate/journey should own canonical UX decisions at a time.

### Parallel research is allowed

Research may run in parallel when it supports an open question, but it cannot advance the product phase independently.

### Technical work stays parked

Technical hypotheses may be researched or documented when necessary for feasibility, but they remain non-authoritative until the relevant Golden journey reaches technical derivation.

### No implementation concurrency before build gate

Do not have multiple agents independently implementing alternate interpretations of an unresolved journey.

## Task packet

Every substantial task should include:

```text
TASK ID
PHASE / GATE
OBJECTIVE
WHY NOW
AUTHORITATIVE INPUTS
SUPPORTING EVIDENCE
OUT OF SCOPE
EXPECTED OUTPUT
DECISIONS ALREADY LOCKED
OPEN QUESTIONS
DONE CRITERIA
NEXT OWNER / HANDOFF
```

## Handoff packet

A handoff must state:

```text
WHAT CHANGED
WHAT DID NOT CHANGE
ARTIFACTS CREATED / UPDATED
DECISIONS MADE
OPEN QUESTIONS
BREAKER FINDINGS
BLOCKERS
NEXT EXACT TASK
WHAT THE NEXT OWNER MUST READ FIRST
```

Avoid vague handoffs such as “continue the architecture.”

## Checkpoint rule

At the end of each gate, update:

- `docs/CURRENT_STATE.md`;
- `docs/10-ops/WORKBOARD.md`;
- decision log when a decision changed;
- relevant registry/status artifact.

A new chat/agent should be able to answer within minutes:

1. What phase are we in?
2. What is approved?
3. What is only a hypothesis?
4. What is explicitly blocked?
5. What is the next task?

## Decision statuses

Continue using:

- `PROPOSED`
- `RESEARCHING`
- `DECIDED`
- `SUPERSEDED`
- `REJECTED`

Journey status is separate and lives in `JOURNEY_REGISTRY.md`.

## Phase promotion

Promotion requires a visible human approval point.

Examples:

- P1 → P2: wedge approved.
- P4 → P5: journey inventory/connections approved.
- P8 → P9: breaker findings resolved and human approves journey.
- P9 → P10: at least the relevant Golden journey exists.
- P11 → P12: implementation plan approved explicitly.

## Anti-drift rule

When work feels productive but the user cannot explain what phase it belongs to, stop and check `WORKBOARD.md`.

If the work belongs to a later phase, park it as evidence/hypothesis and return to the active gate.
