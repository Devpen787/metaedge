# MetaEdge Product / UX Workboard

Updated: 2026-09-16

## Current phase

**P3 — Master Experience Loop**

Current task: rewrite and review `docs/01-product/MASTER_EXPERIENCE_LOOP.md` around the approved operator + wallet-capable trading-agent relationship.

## Gate board

| Phase | Artifact | Status | Promotion condition |
|---|---|---|---|
| P0 Product/UX OS | `PRODUCT_UX_FOUNDATION.md`, workflow, workboard | IN PLACE | operating method documented |
| P1 V1 Wedge + Primary User | `V1_PRODUCT_WEDGE.md` | **APPROVED** | approved 2026-09-15 |
| P2 Human + Agent Jobs / JTBD | `USER_JOBS.md` | **APPROVED** | approved 2026-09-16 |
| P3 Master Experience Loop | `MASTER_EXPERIENCE_LOOP.md` | **ACTIVE REVIEW** | human approval of end-to-end operator/agent loop |
| P4 Journey Registry | `JOURNEY_REGISTRY.md` | INVENTORY / BLOCKED | P1–P3 approved + connections reviewed |
| P5 UX Laws / Design Principles | `UX_LAWS_AND_DESIGN_PRINCIPLES.md` | WORKING DRAFT / BLOCKED | P1–P4 approved + breaker criteria approved |
| P6 Information Architecture | future artifact | BLOCKED | P1–P5 approved |
| P7 Detailed Journey Specs | `JOURNEY_TEMPLATE.md` + journey docs | BLOCKED | P6 ready; existing J01–J14 remain inventory |
| P8 UX Breaker / Connection Review | review artifacts | BLOCKED | at least one P7 journey in PRODUCT_REVIEW |
| P9 Golden Journeys | Golden registry | BLOCKED | breaker resolved + human approval |
| P10 Technical Derivation | domain/state/security | PAUSED / HYPOTHESIS ONLY | relevant Golden journey exists |
| P11 Legacy Migration | seam map | PAUSED / HYPOTHESIS ONLY | P10 derived architecture ready |
| P12 Build + QA | implementation | NOT AUTHORIZED | explicit implementation approval |

## Approved foundation

### P1 — Wedge

MetaEdge is an **agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined**.

Primary operator: **active crypto trader / agent operator**.

### P2 — Human + Agent Jobs

Approved operating model:

```text
human defines mission + wallet/capital + adjustable guardrails
→ agent does the heavy lifting
→ agent may execute inside granted authority
→ operator sees state + material decisions + exceptions
→ operator can intervene / tighten / widen / pause / revoke
→ trust evolves from reasoning + risk/reward + preservation + management + outcomes
```

Approved principle:

> **Human-in-the-loop does not mean human-in-every-click.**

Approved trust principle:

> **A competent agent is judged by sound reasoning, opportunity capture, appropriate risk-taking, capital preservation, position management, exits and realized outcomes — not PnL alone.**

## What is active now

Only work needed to settle the **Master Experience Loop** may create new canonical product decisions.

P3 should answer, in user/product terms:

1. How does an operator get an agent from unconfigured to operating?
2. What does the agent's autonomous operating cycle look like from the operator's perspective?
3. How do material decisions and exceptions re-enter the human loop?
4. How does intervention change the loop without destroying continuity?
5. How does review lead to unchanged, tighter or wider authority?
6. Where does the loop restart?
7. Which steps are truly core versus supporting branches?

## P2 open items carried forward

These remain open and must not be silently invented:

- exact agent creation/improvement timing;
- exact V1 market scope: spot vs spot + paper perps;
- exact notification thresholds/channels;
- quantitative competence metrics and authority-promotion thresholds.

They may be resolved only when the relevant later journey/UX work provides enough context.

## Parked but preserved

The following are useful inputs, not current authority:

- J01–J14 technical/detailed drafts;
- domain/state models;
- EvidenceProfile implementation shape;
- portfolio aggregation formula;
- security/temporal matrices;
- contract replay results;
- migration maps.

They return at P10/P11 after Golden journeys exist.

## Decision discipline

Follow `docs/10-ops/DECISION_CAPTURE.md`.

Any approved P3 decision must be synchronized across:

1. `docs/09-decisions/DECISION_LOG.md`;
2. `MASTER_EXPERIENCE_LOOP.md`;
3. this workboard and `docs/CURRENT_STATE.md` when phase/control state changes.

## Next exact handoff

After P3 approval:

> Promote `MASTER_EXPERIENCE_LOOP.md` to approved, update control state, then activate P4 Journey Registry. Do not jump to navigation, screens, architecture or implementation.
