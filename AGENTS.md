# MetaEdge Relaunch Agent Instructions

This branch is in **product-foundation / documentation mode**.

## Start here

Read `docs/START_HERE.md` and `docs/CURRENT_STATE.md` before doing any work.

## Current authority

The relaunch documentation hierarchy is authoritative for this branch:

1. Product Constitution
2. approved product contracts
3. approved user journeys
4. domain/state/security contracts
5. architecture/migration decisions
6. research and archaeology as evidence only

Historical implementation, old handoffs, screenshots, V3/V5 research, and prior UI structure are not automatically product authority.

## Hard boundaries

Until explicit human approval changes `docs/CURRENT_STATE.md`:

- DO NOT implement or refactor product features.
- DO NOT enable real trading.
- DO NOT sign transactions, move funds, add secrets, or deploy.
- DO NOT delete legacy code or historical evidence.
- DO NOT preserve old UI/tabs merely because they exist.
- DO NOT let one scalar confidence threshold become the permission to trade in future designs.

## Required behavior for product/design work

- Define user journeys before UI implementation.
- Separate hard safety/integrity blockers from weak/uncertain evidence.
- Preserve the anti-paralysis principle: weak evidence normally reduces size rather than forcing permanent inactivity.
- Treat strategy/source outputs as views/desired exposure, not direct broker commands.
- Preserve one portfolio authority and one execution authority.
- Keep paper and real authority separate.
- Treat copying as follower-specific transformation under policy and risk.
- Record meaningful product/architecture changes in `docs/09-decisions/DECISION_LOG.md`.

## Durable memory

Git/repo-owned approved artifacts are project memory. Conversational memory is not product authority.
