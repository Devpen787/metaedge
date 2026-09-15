# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **V1 journeys + domain contracts drafted / scenario validation underway**
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
- `docs/04-decision-system/SCENARIO_STRESS_TESTS.md`
- `docs/06-platform/` MetaMask capability/authority/plugin research
- `docs/07-research/` external-system archaeology + Trading in the Zone mapping
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
- Decision quality, outcome quality and strategy quality remain distinct.
- Rules/authority are rigid; market expectations stay flexible.

## Scenario validation suite

`docs/04-decision-system/SCENARIO_STRESS_TESTS.md` now defines explicit pass/fail scenarios for:

- historical +5% → +10% → +25% opportunity paralysis;
- false breakouts;
- consecutive-loss hesitation;
- winning-streak overconfidence;
- liquidation cascades and reversal;
- whale/wallet accumulation with hidden-hedge uncertainty;
- linked-wallet / duplicate-lineage signals;
- conflicting high-quality sources;
- duplicated news/social/agent evidence;
- stale critical data;
- exhausted exploration budgets;
- partial scaling and target reduction;
- thesis reversal while already positioned;
- source-regime mismatch;
- valid losses vs invalid wins;
- correct abstention vs missed opportunity;
- partial paper fills;
- future pending/MFA real execution;
- paper strategy → separate Real proposal path.

The suite tests **liveness as well as safety**. A system that rejects invalid actions but cannot reach bounded participation under ordinary uncertainty fails the relaunch objective.

## Next work

1. Replay the scenario suite using deterministic synthetic fixtures.
2. Select historical MetaEdge false-negative windows and crypto trend/reversal/liquidation windows for evidence replay.
3. Compare portfolio aggregation candidates before freezing numeric rules.
4. Turn source-reputation dimensions into concrete discovery views and filters.
5. Derive security/temporal transition matrices from the state machines.
6. Produce the legacy production seam/migration map: REUSE / ADAPT / REPLACE / REMOVE / DEFER / NEEDS PROOF.
7. Review/freeze Constitution, Product Contract and domain drafts after scenario findings.
8. Only after those gates, produce an implementation plan and request explicit build approval.

## Still open

V1 persona, spot vs paper perps, discovery ordering, Arena timing, exploration-budget defaults, strategy-specific evidence-to-exposure mappings, final aggregation formula, source-ranking presentation, canonical data providers, and future wallet-authority substrate.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted by relaunch contracts.