# Current State — MetaEdge Relaunch

Updated: 2026-09-15

## Workspace

- Repository: `Devpen787/metaedge`
- Branch: `relaunch/product-foundation`
- Base: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`
- Phase: **V1 journeys + domain contracts drafted / security, migration and contract replay validation underway**
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
- `docs/03-domain/DECISION_STATE_CONTRACTS.md`
- `docs/04-decision-system/EVIDENCE_PROFILE.md`
- `docs/04-decision-system/PORTFOLIO_AGGREGATION.md`
- `docs/04-decision-system/SCENARIO_STRESS_TESTS.md`
- `docs/04-decision-system/CONTRACT_REPLAY_RESULTS_01.md`
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
- Paper routes/objects remain paper-only regardless of environment flags.
- Pending/unknown external outcomes reconcile before equivalent retry.
- MetaMask is an adapter/authority substrate beneath MetaEdge domain contracts, not the product's source of truth.
- Decision quality, outcome quality and strategy quality remain distinct.
- Rules/authority are rigid; market expectations stay flexible.

## Validation status

### Scenario suite

`SCENARIO_STRESS_TESTS.md` covers historical opportunity paralysis, false breakouts, recent-loss hesitation, winning-streak overconfidence, liquidation/reversal, source copying, duplicate lineage, stale data, risk exhaustion, partial fills, missed opportunity, and future pending/MFA execution.

The suite tests **liveness as well as safety**.

### Contract Replay 01

The first strategy-neutral replay walked valid Views through portfolio, risk, execution and recovery contracts.

Result: the architecture held conceptually, but exposed seven refinements now drafted in `DECISION_STATE_CONTRACTS.md`:

1. machine-readable decision/zero-target dispositions;
2. explicit aggregation run/policy lineage;
3. durable lineage/dependency clusters;
4. richer RiskDecision lineage;
5. hard-block reason taxonomy separate from evidence confidence;
6. explicit RiskState separate from EvidenceProfile;
7. mandatory missed-opportunity eligibility semantics.

This is important because MetaEdge must be able to explain **why exposure was zero or smaller than requested** at every decision cycle.

## Security / temporal tranche

Security contracts now cover user isolation, monotonic authority, direct signal→order prevention, paper/real isolation, idempotency, unknown/pending reconciliation, restart/partial fill behavior, stale data recovery, wallet/account changes, in-flight revocation, agent self-expansion, evidence amplification and audit privacy.

Verified legacy defect: V5 `/api/audit` returns the global last 50 audit events without user filtering. It is classified **REPLACE / do not migrate**.

## Legacy migration archaeology

Strong mechanics to adapt:

- durable paper intents/events + anti-replay;
- partial fills + `UNRESOLVED` reconciliation;
- next-observation paper broker mechanics;
- market observation provenance/integrity;
- Postgres revision/commit-ambiguity patterns;
- selected auth/session DoS hardening;
- selected per-user MetaMask adapter isolation patterns.

Seams to replace:

- stale `@metamask/agentic-cli@5.2.1` integration;
- shared routes whose semantics switch between simulated and real mutation;
- direct agent/copilot→trade execution bypassing portfolio aggregation;
- global audit feed;
- legacy UI tabs treated as product authority.

## Next work

1. Run Contract Replay 02 on reversal, multi-horizon conflict, strategy/policy changes during open/pending state, concurrent writers, storage ambiguity, source degradation and agent pause/stop.
2. Replay historical MetaEdge false-negative windows so old under-participation would become visible through the new decision/missed-opportunity contracts.
3. Compare portfolio aggregation candidates before freezing numeric rules.
4. Turn source-reputation dimensions into concrete discovery views and filters.
5. Expand migration archaeology only where a specific new domain needs a legacy implementation candidate.
6. Review/freeze Constitution, Product Contract, System/Strategy boundary, domain and security drafts after replay findings.
7. Only after those gates, produce the implementation plan and request explicit build approval.

## Still open

V1 persona, spot vs paper perps, discovery ordering, Arena timing, exploration-budget defaults, strategy-specific EvidenceProfile→View mappings, final aggregation formula, source-ranking presentation, canonical data providers, and future wallet-authority substrate.

## Historical truth

Pre-relaunch branches, V3/V5 research, old handoffs and the separate `meta-edge` repository remain reference evidence only unless explicitly adopted by relaunch contracts.