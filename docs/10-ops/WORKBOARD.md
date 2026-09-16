# MetaEdge Product / UX Workboard

Updated: 2026-09-16

## Current phase

**P4 — Journey Registry**

Current task: review and re-partition `docs/02-journeys/JOURNEY_REGISTRY.md` around the approved operator + wallet-capable trading-agent loops.

## Gate board

| Phase | Artifact | Status | Promotion condition |
|---|---|---|---|
| P0 Product/UX OS | `PRODUCT_UX_FOUNDATION.md`, workflow, workboard | IN PLACE | operating method documented |
| P1 V1 Wedge + Primary User | `V1_PRODUCT_WEDGE.md` | **APPROVED** | approved 2026-09-15 |
| P2 Human + Agent Jobs / JTBD | `USER_JOBS.md` | **APPROVED** | approved 2026-09-16 |
| P3 Master Experience Loop | `MASTER_EXPERIENCE_LOOP.md` | **APPROVED** | approved 2026-09-16 |
| P4 Journey Registry | `JOURNEY_REGISTRY.md` | **ACTIVE REVIEW** | journey inventory/partition + connection map approved |
| P5 UX Laws / Design Principles | `UX_LAWS_AND_DESIGN_PRINCIPLES.md` | WORKING DRAFT / BLOCKED | P4 approved + breaker criteria approved |
| P6 Information Architecture | future artifact | BLOCKED | P1–P5 approved |
| P7 Detailed Journey Specs | `JOURNEY_TEMPLATE.md` + journey docs | BLOCKED | P6 ready; legacy J01–J14 remain inventory |
| P8 UX Breaker / Connection Review | review artifacts | BLOCKED | at least one P7 journey in PRODUCT_REVIEW |
| P9 Golden Journeys | Golden registry | BLOCKED | breaker resolved + human approval |
| P10 Technical Derivation | domain/state/security | PAUSED / HYPOTHESIS ONLY | relevant Golden journey exists |
| P11 Legacy Migration | seam map | PAUSED / HYPOTHESIS ONLY | P10 derived architecture ready |
| P12 Build + QA | implementation | NOT AUTHORIZED | explicit implementation approval |

## Approved P1–P3 foundation

### P1 — Wedge

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

Primary operator: **active crypto trader / agent operator**.

### P2 — Human + Agent Jobs

```text
human defines mission + wallet/capital + adjustable guardrails
→ agent does the heavy lifting and may execute inside authority
→ operator sees state + material decisions + exceptions
→ operator can intervene / tighten / widen / pause / revoke
→ trust evolves from reasoning + risk/reward + preservation + management + outcomes
```

**Human-in-the-loop does not mean human-in-every-click.**

### P3 — Master Experience

Approved human/trust loop:

**Delegate → Bound → Launch → Supervise / Intervene → Review → Evolve → Repeat**

Approved agent operating loop:

**Sense → Understand → Decide → Act → Manage → Reconcile → Learn → Repeat**

The product connects the loops across three timescales: fast agent/market operation, medium operator supervision, and slow trust/authority evolution.

## What is active now — P4

P4 must answer, in product language:

1. What are the actual operator journeys implied by the approved two-loop model?
2. Which parts of the agent operating loop are user journeys versus behavior inside another journey?
3. Where does the first-session experience begin and end?
4. What are the valid entry, exit, return and intervention paths?
5. Which old J01–J14 concepts remain useful, which should merge, and which should be deferred?
6. What is the first complete end-to-end journey candidate that can later become Golden?
7. Does every approved P1/P2 job have a journey home?
8. Does the registry contain dead ends or orphaned states?

## P4 anti-drift rule

Do **not** preserve J01–J14 merely because files already exist.

Do **not** design screens/navigation yet.

Do **not** derive technical state machines yet.

P4 is about the experience map and journey boundaries.

## Open items carried forward

Still unresolved unless P4 provides enough user-context to decide them:

- agent creation/improvement timing;
- spot vs spot + paper perps;
- notification thresholds/channels;
- quantitative competence metrics / authority-promotion thresholds;
- exact pause/stop handling of existing exposure;
- operator home/command-center emphasis;
- exact review cadence/presentation;
- discovery/source intelligence placement;
- Arena timing;
- future wallet-authority implementation substrate.

## Parked but preserved

The following remain useful inputs, not current authority:

- legacy J01–J14 detailed drafts;
- domain/state models;
- EvidenceProfile implementation shape;
- portfolio aggregation formula;
- security/temporal matrices;
- contract replay results;
- migration maps.

They return at P10/P11 after Golden journeys exist.

## Decision discipline

Follow `docs/10-ops/DECISION_CAPTURE.md`.

Any approved P4 decision must be synchronized across:

1. `docs/09-decisions/DECISION_LOG.md`;
2. `docs/02-journeys/JOURNEY_REGISTRY.md`;
3. this workboard and `docs/CURRENT_STATE.md` when phase/control state changes.

## Next exact handoff

After P4 approval:

> Promote the journey registry/connection map to approved, update control state, then activate P5 UX Laws / Design Principles. Do not jump to navigation, detailed screens, architecture or implementation.
