# Journey Registry

Status: **P4 INVENTORY — canonical status registry, no Golden journeys yet**

Updated: 2026-09-15

## Purpose

Track every MetaEdge user journey, its user job, connections and approval state. Existing journey documents are preserved as source material but are not automatically product authority.

## Status model

```text
INVENTORY
  ↓
DRAFT
  ↓
PRODUCT_REVIEW
  ↓
UX_BREAKER
  ↓
APPROVED
  ↓
GOLDEN
  ↓
SUPERSEDED (if later replaced)
```

Definitions:

- **INVENTORY** — we know this journey/job exists; current notes may contain useful requirements.
- **DRAFT** — rewritten from the user's point of view using `JOURNEY_TEMPLATE.md`.
- **PRODUCT_REVIEW** — coherent enough for human review; open decisions clearly marked.
- **UX_BREAKER** — actively challenged against UX laws, edge states and adjacent journeys.
- **APPROVED** — human-approved content after breaker fixes.
- **GOLDEN** — approved, connected, fingerprinted product truth from which technical derivation may proceed.
- **SUPERSEDED** — retained for history but no longer active.

No journey currently has `GOLDEN` status.

## Existing journey inventory

The current J01–J14 files were created before the product/UX-first reset. Their technical/state content may be valuable, but each must be rewritten/reviewed as a user journey before promotion.

| ID | Working name | User job | Current status | Existing source material |
|---|---|---|---|---|
| J01 | Enter / Onboarding | Understand MetaEdge and start safely | INVENTORY | prior draft/inventory |
| J02 | Discover | Find what deserves attention | INVENTORY | `02-discover.md` |
| J03 | Investigate Source / Opportunity | Understand what happened and why it may matter | INVENTORY | `03-investigate-source.md` |
| J04 | Follow Source | Save a relationship and return to meaningful updates | INVENTORY | `04-follow-source.md` |
| J05 | Create / Copy Strategy | Turn an idea/source into something explicit enough to test | INVENTORY | prior draft/inventory |
| J06 | Backtest | Test a strategy historically with honest assumptions | INVENTORY | prior draft/inventory |
| J07 | Shadow | Observe counterfactual behavior without paper exposure | INVENTORY | `07-shadow.md` |
| J08 | Paper Portfolio / Policy | Establish a safe paper environment | INVENTORY | prior draft/inventory |
| J09 | Paper Try / Trade | Safely test bounded paper participation | INVENTORY | `09-paper-trade.md` |
| J10 | Paper Copy | Safely test follower-specific copying | INVENTORY | `10-paper-copy.md` |
| J11 | Manage Position | Understand and respond after exposure exists | INVENTORY | `11-manage-position.md` |
| J12 | Review & Learn | Understand outcome vs decision quality | INVENTORY | `12-review-and-learn.md` |
| J13 | Improve / Pause / Retire | Decide what changes next without rewriting history | INVENTORY | prior draft/inventory |
| J14 | Paper Agent Operation | Delegate bounded paper work and understand what the agent is doing | INVENTORY | `14-agent-operation.md` |

## Provisional master connections

This is a working connection map, not final information architecture:

```text
J01 Enter
 ↓
J02 Discover
 ↓
J03 Understand
 ├─→ J04 Follow ───────────────┐
 ├─→ J07 Shadow ───────────────┤
 ├─→ J05 Create/Adapt → J06 Test
 ├─→ J09 Paper Try ────────────┤
 └─→ J10 Paper Copy ───────────┤
                               ↓
                         J11 Manage
                               ↓
                         J12 Review
                               ↓
                    J13 Improve/Pause/Retire
                               ↺
                         J02 / J03

J14 Paper Agent can participate across approved paper parts of this loop;
it is not a separate product universe.
```

## First Golden-journey candidate

The first end-to-end experience we should make concrete is likely:

> **Discover something worth attention → understand it → choose a safe way to engage → paper/shadow it → manage → review.**

This is intentionally broader than one existing J-file. During P4/P7 we may consolidate or split IDs if that creates a clearer user experience.

Do not preserve the J01–J14 partition merely because files already exist.

## Connection requirements

Before any journey becomes Golden it must declare:

- valid entry points;
- previous journeys/states;
- next journeys/actions;
- cancellation/dismiss path;
- return path;
- back/refresh/restart behavior;
- what persists after the user leaves;
- what changes if an agent is participating;
- what mode/commitment level the user is in.

## Registry rules

1. A journey cannot become Golden with unresolved critical UX questions.
2. A Golden journey cannot point to a missing/nonexistent next journey.
3. Technical implementation cannot invent a new user-visible transition that bypasses the registry.
4. Research may propose new journeys but cannot silently add them as canonical.
5. A Golden change requires a decision-log entry and re-run of relevant UX breaker checks.

## P4 exit criterion

After P1–P3 are approved:

- confirm journey inventory;
- consolidate/split journeys around user mental models rather than backend domains;
- identify the first complete Golden-journey candidate;
- verify every V1 job has a journey home;
- verify the master loop has no dead ends.
