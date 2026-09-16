# Current State — MetaEdge Relaunch

Updated: 2026-09-16

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Active phase: **P3 — Master Experience Loop**
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

`docs/01-product/USER_JOBS.md` is now product authority.

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

### Approved operator attention model

```text
ordinary in-envelope action
→ agent acts + records

material decision / unusual risk / degraded capability
→ surface / notify

outside authority / authority expansion / later real-money escalation
→ explicit human action under the authority model then in force
```

The operator should normally see **state + material decisions + exceptions**, not every internal action.

### Approved competence / trust model

Trust is not PnL alone.

The operator should be able to judge the agent across:

- quality of reasoning at decision time;
- opportunity capture;
- risk taken relative to potential reward;
- capital preserved / downside avoided;
- position management;
- recognition of deterioration;
- exit/reduction quality;
- discipline/process adherence;
- speed/timeliness;
- execution quality;
- missed opportunities / over-conservatism;
- realized outcomes over time.

A losing trade can still be well judged. A profitable trade can still be reckless. Preserving capital can be a successful outcome. Failing to take justified bounded risk can also be a process failure.

**Discipline does not mean conservatism.** Sometimes the correct behavior is to take meaningful bounded risk because the reward justifies it.

## Current exact task — P3

Rewrite and review:

`docs/01-product/MASTER_EXPERIENCE_LOOP.md`

P3 must define the repeatable end-to-end relationship between the operator and wallet-capable agent before we partition that loop into journeys.

It should answer:

1. how an operator gets an agent from unconfigured to operating;
2. how the agent runs autonomously inside its guardrails;
3. how material decisions/exceptions return to the operator;
4. how pause/intervention/guardrail changes fit without breaking continuity;
5. how review changes trust/authority;
6. where the loop restarts.

## Product authority

Current authority order:

1. Product Constitution.
2. Approved P1 wedge and P2 Human + Agent Jobs.
3. P3 once approved.
4. Golden journeys.
5. Approved UX laws/design principles/information architecture.
6. Approved product capability contracts.
7. Technical/domain/security derivations.
8. Architecture/migration decisions.
9. Research/archaeology/historical implementation as evidence.

## Journey status

No journey is Golden.

Existing J01–J14 remain **INVENTORY** only. They may inform later work but are not approved UX truth.

## Open items carried forward

These remain explicitly unresolved:

- exact agent creation/improvement timing;
- V1 market scope: spot vs spot + paper perps;
- exact notification thresholds/channels;
- quantitative competence metrics / authority-promotion thresholds;
- discovery surface order;
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

## Next step after P3

After explicit human approval of the Master Experience Loop:

1. record the decision;
2. update `CURRENT_STATE.md` and `WORKBOARD.md`;
3. activate P4 Journey Registry;
4. do not jump directly to navigation, screen design or technical architecture.
