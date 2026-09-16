# Current State — MetaEdge Relaunch

Updated: 2026-09-16

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Active phase: **P4 — Journey Registry**
- Implementation: **NOT AUTHORIZED**
- Real execution: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Relaunch method

MetaEdge follows a product/UX-first sequence:

**Wedge → User/JTBD → Master Experience Loop → Journey Registry → UX Laws → Information Architecture → Detailed Journeys → UX Breaker → Golden Journeys → Technical Derivation → Migration → Build/QA.**

See `docs/01-product/PRODUCT_UX_FOUNDATION.md` and `docs/10-ops/WORKBOARD.md`.

## P1 — APPROVED

Approved wedge:

> **MetaEdge is an agent-native trading workspace for wallet-capable agents that can trade fast, smart, and disciplined.**

Approved primary operator:

> **Active crypto trader / agent operator.**

Approved first wow moment:

> **“My agent saw something I would have missed, acted in time within the exact limits I gave it, and then managed the position without becoming reckless or frozen.”**

The operator must not become the agent's manual execution loop.

## P2 — APPROVED

`docs/01-product/USER_JOBS.md` is product authority.

### Human role

The human remains in the loop by owning:

- mission / objective;
- wallet or paper capital;
- allowed markets;
- adjustable risk and authority guardrails;
- supervision;
- intervention;
- pause/stop/revoke/promotion decisions;
- judgment of whether the agent deserves more trust.

**Human-in-the-loop does not mean human-in-every-click.**

### Agent role

Inside explicitly granted authority, the agent does the heavy lifting:

- senses relevant markets/sources;
- reasons under uncertainty;
- decides;
- executes when allowed;
- manages positions continuously;
- protects capital and exits when the trade stops deserving its risk;
- reconciles ambiguity;
- explains material decisions;
- learns without silently widening authority.

### Operator attention model

```text
ordinary in-envelope action
→ agent acts + records

material decision / unusual risk / degraded capability
→ surface / notify

outside authority / authority expansion / later real-money escalation
→ explicit human action under the authority model then in force
```

The operator should normally see **state + material decisions + exceptions**, not every internal action.

### Competence / trust model

Trust is not PnL alone. The operator judges reasoning, opportunity capture, risk taken relative to reward, capital preserved, position management, recognition of deterioration, exit/reduction quality, discipline, speed, execution quality, misses/over-conservatism and realized outcomes over time.

A losing trade can be well judged. A profitable trade can be reckless. Preserving capital can be success. Failing to take justified bounded risk can be a process failure.

**Discipline does not mean conservatism.** Sometimes the right action is to take meaningful bounded risk because the potential reward warrants it.

## P3 — APPROVED

`docs/01-product/MASTER_EXPERIENCE_LOOP.md` is now product authority.

### Operator control / trust loop

**Delegate → Bound → Launch → Supervise / Intervene → Review → Evolve Authority / Agent → Repeat**

Meaning:

- **Delegate** — define the job.
- **Bound** — define wallet/capital, scope, risk and authority.
- **Launch** — deliberately put the agent on duty.
- **Supervise** — observe state/material decisions/exceptions without babysitting.
- **Intervene** — retain immediate human control.
- **Review** — judge competence beyond PnL.
- **Evolve** — keep, tighten, widen, change, pause, retire, or later promote authority.

### Agent operating loop

**Sense → Understand → Decide → Act → Manage → Reconcile → Learn → Repeat**

The agent loop runs faster than the human trust loop. MetaEdge must connect them without forcing the operator into every agent cycle and without letting the agent escape human-defined authority.

### Three product timescales

- **Fast:** market/agent operation — seconds/minutes/hours.
- **Medium:** operator supervision/intervention — minutes/hours/days.
- **Slow:** trust/authority evolution — days/weeks/many decisions.

Long-term trust must not be inferred from one fast-loop outcome.

## Current exact task — P4

Review/re-partition:

`docs/02-journeys/JOURNEY_REGISTRY.md`

P4 must translate the approved two-loop model into coherent product journeys and connections before UX laws, information architecture, or screens are designed.

It must answer:

1. what the actual operator journeys are;
2. which agent-loop behaviors live inside those journeys rather than becoming separate screens;
3. where first-session and returning-user flows begin/end;
4. valid entry, exit, return and intervention paths;
5. which legacy J01–J14 concepts merge, survive, change or defer;
6. what the first complete Golden-journey candidate should be;
7. whether every approved job has a journey home;
8. whether the map contains dead ends/orphaned states.

## Journey status

No journey is Golden.

Legacy J01–J14 remain **INVENTORY** only. They may inform P4 but are not approved UX truth and must not dictate the new journey partition.

## Product authority

Current authority order:

1. Product Constitution.
2. Approved P1 V1 wedge.
3. Approved P2 Human + Agent Jobs.
4. Approved P3 Master Experience Loop.
5. Golden journeys.
6. Approved UX laws/design principles/information architecture.
7. Approved product capability contracts.
8. Technical/domain/security derivations.
9. Architecture/migration decisions.
10. Research/archaeology/historical implementation as evidence.

## Open items carried forward

These remain explicitly unresolved:

- exact agent creation/improvement timing;
- V1 market scope: spot vs spot + paper perps;
- exact notification thresholds/channels;
- quantitative competence metrics / authority-promotion thresholds;
- exact pause/stop handling of existing exposure;
- operator home/command-center emphasis;
- exact review cadence/presentation;
- discovery/source intelligence placement;
- Arena timing;
- future wallet-authority implementation substrate.

Do not silently resolve them from technical convenience.

## Parked technical hypotheses

Preserved but paused until P10:

- canonical domain/state models;
- EvidenceProfile field schema;
- portfolio aggregation formula;
- source-reputation technical model;
- security/temporal matrices;
- scenario/contract replay results;
- production seam and migration maps.

## Decision capture rule

`docs/10-ops/DECISION_CAPTURE.md` is an active operating rule.

Approved decisions must be written into the repo and synchronized across the decision ledger, authoritative product artifact, and control state before later work treats them as settled.

## Paused work

Do not continue until later gates:

- Contract Replay 02;
- portfolio-formula freeze;
- implementation migration planning;
- new application code;
- technical screen derivation from domain objects.

## Next step after P4

After explicit human approval of the journey registry/connection map:

1. record the decision;
2. update `CURRENT_STATE.md` and `WORKBOARD.md`;
3. activate P5 UX Laws / Design Principles;
4. do not jump directly to information architecture, screen design or technical architecture.
