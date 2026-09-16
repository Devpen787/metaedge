# MetaEdge Product / UX Workboard

Updated: 2026-09-16

## Current phase

**P4 — Journey Registry**

Current task: review `docs/02-journeys/P4_JOURNEY_PARTITION_PROPOSAL.md` one decision at a time, then promote approved boundaries into `JOURNEY_REGISTRY.md`.

## Gate board

| Phase | Artifact | Status | Promotion condition |
|---|---|---|---|
| P0 Product/UX OS | `PRODUCT_UX_FOUNDATION.md`, workflow, workboard | IN PLACE | operating method documented |
| P1 V1 Wedge + Primary User | `V1_PRODUCT_WEDGE.md` | **APPROVED** | approved 2026-09-15 |
| P2 Human + Agent Jobs / JTBD | `USER_JOBS.md` | **APPROVED** | approved 2026-09-16 |
| P3 Master Experience Loop | `MASTER_EXPERIENCE_LOOP.md` | **APPROVED** | approved 2026-09-16 |
| P4 Journey Registry | `JOURNEY_REGISTRY.md` + `P4_JOURNEY_PARTITION_PROPOSAL.md` | **ACTIVE REVIEW** | journey inventory/partition + connection map approved |
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

## P4 candidate partition under review

The current proposal recommends six **core operator journeys**:

1. **ME-J01 — Put an Agent to Work** — Delegate + Bound + Launch as one user job.
2. **ME-J02 — Supervise Running Agents** — normal returning operating state.
3. **ME-J03 — Understand a Material Agent Decision** — what changed, what the agent did, why, and what happens next.
4. **ME-J04 — Intervene / Take Control** — pause/stop/tighten/change scope and intentionally handle existing exposure.
5. **ME-J05 — Review Agent Competence** — reasoning, risk/reward, preservation, management, exits and outcome over event/period views.
6. **ME-J06 — Evolve the Agent / Authority** — keep/tighten/widen/change/pause/retire and restart the loop.

Supporting candidate branches:

- S1 Research a Source / Market / Strategy Input;
- S2 Validate an Agent / Strategy Before More Authority;
- S3 Create / Adapt an Agent.

None of these boundaries are approved merely because they are proposed.

## What is active now — exact review order

Review P4 one decision at a time:

1. Should **Delegate + Bound + Launch** be one journey: **Put an Agent to Work**?
2. Do the six proposed core journeys match the operator mental model?
3. Is **Supervise Running Agents** the default returning path?
4. Is **Understand a Material Agent Decision** distinct enough to deserve its own journey?
5. Is **Intervene / Take Control** the right control journey, and later what should stop/pause mean for open exposure?
6. Should competence review remain one journey with event + periodic entry modes?
7. Is **Evolve Agent / Authority** the correct trust/lifecycle journey?
8. Should S1/S2/S3 remain supporting branches or join the V1 spine?
9. Which journey should become the first detailed/Golden candidate later? Current recommendation: ME-J01.

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
