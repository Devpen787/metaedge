# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **V1 journeys + domain contracts drafted / security, temporal and migration validation underway**
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
- `docs/03-domain/SYSTEM_STRATEGY_BOUNDARY.md`
- `docs/04-decision-system/EVIDENCE_PROFILE.md`
- `docs/04-decision-system/PORTFOLIO_AGGREGATION.md`
- `docs/04-decision-system/SCENARIO_STRESS_TESTS.md`
- `docs/05-security/SECURITY_INVARIANTS.md`
- `docs/05-security/TEMPORAL_STATE_MATRIX.md`
- `docs/05-security/ATTACK_SEQUENCE_MATRIX.md`
- `docs/05-security/PAPER_REAL_ISOLATION.md`
- `docs/06-platform/` MetaMask capability/authority/plugin research
- `docs/07-research/` external-system archaeology + Trading in the Zone mapping
- `docs/08-architecture/PRODUCTION_SEAM_MAP.md`
- `docs/08-architecture/MIGRATION_MAP.md`
- `docs/09-decisions/DECISION_LOG.md`
- `docs/09-decisions/ADR-029-system-strategy-boundary.md`

## Key working decisions

- No universal scalar confidence gate.
- Evidence is represented as a multidimensional profile with contradictions and unknowns.
- **Strategy decides opportunity/exposure; MetaEdge governs validity, coordination, risk, execution and recovery.**
- Stress-test market examples are fixtures, not canonical MetaEdge trading rules.
- Weak but valid evidence may map to observation, scout-sized experimentation or reduced exposure rather than permanent inactivity when the strategy permits it.
- Producers emit Views; one portfolio authority resolves aggregate targets; one execution authority owns state mutation.
- Initial aggregation candidate: deterministic budgeted sleeves + lineage-aware netting + portfolio constraints.
- Source reputation is decomposable and objective-specific, not a universal leaderboard score.
- Paper and future real execution share strategy/evidence logic but not mutable execution authority.
- Paper routes/objects must remain paper-only regardless of environment flags.
- Pending/unknown external outcomes reconcile before equivalent retry.
- MetaMask is an adapter/authority substrate beneath MetaEdge domain contracts, not the product's source of truth.
- Decision quality, outcome quality and strategy quality remain distinct.
- Rules/authority are rigid; market expectations stay flexible.

## Scenario validation suite

`docs/04-decision-system/SCENARIO_STRESS_TESTS.md` defines pass/fail scenarios for historical opportunity paralysis, false breakouts, recent-loss hesitation, winning-streak overconfidence, liquidation/reversal, source copying, duplicate lineage, stale data, risk exhaustion, partial fills, missed opportunity, and future pending/MFA execution.

The suite tests **liveness as well as safety**. A system that rejects invalid actions but cannot reach bounded participation from an eligible StrategyVersion/View under ordinary uncertainty fails the relaunch objective.

## Security / temporal tranche

New security contracts now explicitly cover:

- user isolation;
- monotonic authority;
- no direct signal → order mutation;
- paper/real isolation;
- idempotency and duplicate protection;
- `UNKNOWN != FAILED`;
- partial-fill and restart reconciliation;
- account/network changes between preview and execution;
- grant revocation while operations are in flight;
- stale data recovery;
- agent self-expansion attempts;
- duplicate evidence/source amplification;
- audit/privacy isolation.

Verified legacy defect: V5 `/api/audit` returns the global last 50 audit events without user filtering. This is classified as **REPLACE / do not migrate**.

## Legacy migration archaeology

The first production seam map is complete for the highest-value legacy components.

Strong mechanics to adapt include:

- durable paper intents/events and anti-replay;
- partial fills and `UNRESOLVED` reconciliation;
- next-observation paper broker mechanics;
- market observation provenance/integrity;
- Postgres revision/commit-ambiguity patterns;
- selected auth/session DoS hardening;
- selected per-user MetaMask adapter isolation patterns.

Seams to replace include:

- stale `@metamask/agentic-cli@5.2.1` integration;
- shared routes whose semantics switch between simulated and real mutation;
- direct agent/copilot → trade execution bypassing portfolio aggregation;
- global audit feed;
- legacy UI tabs treated as product authority.

## Next work

1. Run the scenario suite as deterministic contract replays — first at EvidenceProfile/View/PortfolioTarget/Risk level, without inventing canonical trading strategies.
2. Replay historical MetaEdge false-negative windows to identify where old gates caused under-participation.
3. Compare portfolio aggregation candidates before freezing numeric rules.
4. Turn source-reputation dimensions into concrete discovery views and filters.
5. Expand migration archaeology only where a specific new domain needs a legacy implementation candidate.
6. Review/freeze Constitution, Product Contract, System/Strategy boundary, domain and security drafts after replay findings.
7. Only after those gates, produce the implementation plan and request explicit build approval.

## Still open

V1 persona, spot vs paper perps, discovery ordering, Arena timing, exploration-budget defaults, strategy-specific EvidenceProfile→View mappings, final aggregation formula, source-ranking presentation, canonical data providers, and future wallet-authority substrate.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted by relaunch contracts.