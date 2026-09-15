# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **V1 journeys + domain/decision contracts drafted**
- Implementation: **NOT AUTHORIZED**
- Real execution: **NOT AUTHORIZED**
- Deployment changes: **NOT AUTHORIZED**

## Product thesis

MetaEdge helps users and agents discover possible edges, understand evidence and uncertainty, test ideas safely, manage exposure as conditions change, learn from both action and inaction, and eventually move approved strategy logic into a separately governed execution path.

## V1 candidate scope

Paper-first product covering onboarding, discovery, source investigation/following, strategy creation/copying, backtesting, shadowing, paper portfolios, paper trading/copying, position management, Paper Agent operation, review/learning, and strategy/source lifecycle management.

## Canonical drafts now present

- `docs/00-constitution/PRODUCT_CONSTITUTION.md`
- `docs/01-product/PRODUCT_MODEL.md`
- `docs/01-product/COPY_AND_SOURCE_MODEL.md`
- `docs/01-product/RISK_AND_EXPLORATION.md`
- `docs/01-product/AGENT_MODEL.md`
- `docs/01-product/PAPER_TO_REAL.md`
- `docs/01-product/SOURCE_REPUTATION.md`
- `docs/02-journeys/` (J01–J14)
- `docs/03-domain/DOMAIN_MODEL.md`
- `docs/03-domain/AUTHORITY_MODEL.md`
- `docs/03-domain/STATE_MACHINES.md`
- `docs/03-domain/REAL_EXECUTION_STATE_MODEL.md`
- `docs/04-decision-system/EVIDENCE_PROFILE.md`
- `docs/04-decision-system/PORTFOLIO_AGGREGATION.md`
- `docs/06-platform/` MetaMask capability/authority/plugin research
- `docs/07-research/` external-system archaeology
- `docs/09-decisions/DECISION_LOG.md`

## Key working decisions

- No universal scalar confidence gate.
- Evidence is represented as a multidimensional profile with contradictions and unknowns.
- Weak but valid evidence may map to observation, scout-sized experimentation or reduced exposure rather than permanent inactivity.
- Producers emit Views; one portfolio authority resolves aggregate targets; one execution authority owns state mutation.
- Initial aggregation candidate: deterministic budgeted sleeves + lineage-aware netting + portfolio constraints.
- Source reputation is decomposable and objective-specific, not a universal leaderboard score.
- Paper and future real execution share strategy/evidence logic but not mutable execution authority.
- Pending/unknown external outcomes reconcile before equivalent retry.
- MetaMask is an adapter/authority substrate beneath MetaEdge domain contracts, not the product's source of truth.

## Next work

1. Review/freeze Constitution, Product Contract and domain drafts.
2. Stress-test the EvidenceProfile on representative market-move scenarios and historical false negatives.
3. Replay/simulate portfolio aggregation candidates before freezing numeric rules.
4. Turn source-reputation dimensions into concrete discovery views and filters.
5. Derive security/temporal transition matrices from the state machines.
6. Produce the legacy production seam/migration map: REUSE / ADAPT / REPLACE / REMOVE / DEFER / NEEDS PROOF.
7. Only after those gates, produce an implementation plan and request explicit build approval.

## Still open

V1 persona, spot vs paper perps, discovery ordering, Arena timing, exploration-budget defaults, strategy-specific evidence-to-exposure mappings, final aggregation formula, source-ranking presentation, canonical data providers, and future wallet-authority substrate.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted by relaunch contracts.