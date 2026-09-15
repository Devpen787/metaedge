# MetaEdge Product / UX Workboard

Updated: 2026-09-15

## Current phase

**P2 — Human + Agent Jobs-to-be-Done**

Current task: review and approve `docs/01-product/USER_JOBS.md`.

## Gate board

| Phase | Artifact | Status | Promotion condition |
|---|---|---|---|
| P0 Product/UX OS | `PRODUCT_UX_FOUNDATION.md`, workflow, workboard | IN PLACE | operating method documented |
| P1 V1 Wedge + Primary User | `V1_PRODUCT_WEDGE.md` | **APPROVED** | approved 2026-09-15 |
| P2 Human + Agent Jobs / JTBD | `USER_JOBS.md` | **ACTIVE REVIEW** | human approval of core jobs + attention/trust model |
| P3 Master Experience Loop | `MASTER_EXPERIENCE_LOOP.md` | WORKING DRAFT / BLOCKED | P2 approved + loop review |
| P4 Journey Registry | `JOURNEY_REGISTRY.md` | INVENTORY / BLOCKED | P1–P3 approved + connections reviewed |
| P5 UX Laws / Design Principles | `UX_LAWS_AND_DESIGN_PRINCIPLES.md` | WORKING DRAFT / BLOCKED | P1–P4 approved + breaker criteria approved |
| P6 Information Architecture | future artifact | BLOCKED | P1–P5 approved |
| P7 Detailed Journey Specs | `JOURNEY_TEMPLATE.md` + journey docs | BLOCKED | P6 ready; existing J01–J14 remain inventory |
| P8 UX Breaker / Connection Review | review artifacts | BLOCKED | at least one P7 journey in PRODUCT_REVIEW |
| P9 Golden Journeys | Golden registry | BLOCKED | breaker resolved + human approval |
| P10 Technical Derivation | domain/state/security | PAUSED / HYPOTHESIS ONLY | relevant Golden journey exists |
| P11 Legacy Migration | seam map | PAUSED / HYPOTHESIS ONLY | P10 derived architecture ready |
| P12 Build + QA | implementation | NOT AUTHORIZED | explicit implementation approval |

## P1 approved foundation

MetaEdge's wedge is:

> **Wallet-capable trading agents that can trade fast, smart, and disciplined.**

Primary human operator:

> **Active crypto trader / agent operator** who wants agents to monitor and trade continuously under explicit limits without becoming the agent's manual execution loop.

Core proof:

```text
operator gives mandate + paper wallet/capital + boundaries
→ agent senses
→ reasons under uncertainty
→ acts inside envelope
→ manages continuously
→ operator supervises / intervenes when needed
→ review determines whether trust/authority should change
```

## What is active now

Only work that helps answer P2 questions may create new canonical product decisions.

P2 questions:

1. What is the primary human JTBD: delegation or discovery?
2. Which operator jobs are truly primary in V1?
3. Which trading-agent jobs are required to prove fast/smart/disciplined behavior?
4. What should the operator see while an agent is running?
5. What deserves interruption vs autonomous handling?
6. What must the operator understand/control before trust can increase?
7. Is agent creation/improvement a first-session primary job or supporting/next-loop job?

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

## Next exact handoff

After P2 approval:

> Promote `USER_JOBS.md` to approved, update this board and `CURRENT_STATE.md`, then rewrite/review `MASTER_EXPERIENCE_LOOP.md` around the operator + wallet-capable agent relationship. Do not jump to navigation, screen design, or technical architecture.
