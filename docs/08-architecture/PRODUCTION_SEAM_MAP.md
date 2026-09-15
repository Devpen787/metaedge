# Production Seam Map

Status: **Initial verified migration archaeology — no implementation authority**

Source baseline: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`.

## Purpose

Classify the old implementation by architectural value rather than by how much code exists.

Classification vocabulary:

- `REUSE PATTERN` — concept/mechanic is strong and should survive.
- `ADAPT` — useful code/mechanic but must be reshaped around relaunch domain contracts.
- `REPLACE` — seam conflicts with relaunch architecture or current platform reality.
- `REMOVE` — should not exist in V1 product surface.
- `DEFER` — potentially useful later, not required for V1.
- `NEEDS PROOF` — economically/product useful only after evidence/replay validates it.

## Verified seams

| Legacy area | Verified useful behavior | Classification | Relaunch treatment |
|---|---|---|---|
| `src/secure-core/trading/intents.ts` | Durable paper intent lifecycle, nonce anti-replay, append-only events, partial fills, duplicate-fill protection, `UNRESOLVED`, startup reconciliation | `ADAPT` / strong reuse pattern | Map into canonical `PaperOrderIntent` / `PaperOrderEvent` / reconciliation domain. Remove V5-specific authority/version coupling and direct agent assumptions. |
| `server/v5/paper_broker.ts` | Next-observation fills, same-observation forbidden, quote age, fees, spread, slippage, liquidity participation, TIF, partial fills, limit/stop handling | `ADAPT` / strong reuse pattern | Keep mechanics as paper broker candidate. Make policy version explicit and test against new paper execution contract. Do not treat current parameters as final product economics. |
| `server/market_data_v5.ts` | Content-addressed observations, provider/venue/dataset timestamps, provenance, integrity hash, universe versioning, `do_not_fill` gap policy, preserve cross-venue differences | `ADAPT` / strong reuse pattern | Promote to canonical Observation contract. Expand beyond current spot fields/evidence families while preserving immutable provenance. |
| `server/storage.ts` + Postgres sync/cache | Production Postgres requirement, revisions, segment hashes, transactional write semantics, explicit possibly-committed errors, cache integrity, corruption recovery | `ADAPT` | Preserve durability/revision/commit-state ideas. Replace monolithic legacy `DatabaseState` as product schema with relaunch domains/events. |
| `server/v5/authority.ts` | Explicit authority version, active/shadow/disabled states, legacy read-only adapters, legacy writers disabled by default | `ADAPT` | Preserve explicit routability and read-only legacy cutover pattern. Replace version-5-centric authority model with canonical domain authority/envelopes/policies. |
| `server/trades.ts` paper path | One shared paper execution path, current observed price requirement, worst-price risk reservation, durable intent before broker, honest cost-basis accounting | `ADAPT` | Keep one canonical paper mutation service. Replace direct `TradingAgent` ownership and direct side/size order API with PortfolioTarget delta lineage. |
| `server/auth.ts` session mechanics | httpOnly session cookie, SameSite=Lax, secure in production, random hashed token, bounded ephemeral sessions, persistence on first mutation, user-scoped dashboard data | `ADAPT` | Preserve session-hardening/DoS patterns if architecture remains cookie-based. Redefine identity/domain storage cleanly. |
| `server/auth.ts` `/api/audit` | Returns global last 50 audit events without user scoping | `REPLACE` / security defect | Do not migrate. Audit access must be user-scoped or separately admin-authorized. Add regression test. |
| `server/metamask.ts` per-user profile isolation | Separate CLI HOME per user, wallet-selection lock, subprocess concurrency cap, short TTL read cache, canonical-wallet mismatch guard | `REUSE PATTERN` selectively | Useful adapter engineering patterns if CLI subprocess model is retained. Reverify against current `@metamask/agent-wallet`. |
| `server/metamask.ts` package/command grammar | Pinned `@metamask/agentic-cli@5.2.1` and old command flags | `REPLACE` | Current platform uses `@metamask/agent-wallet`; build a fresh adapter from current official contract. |
| `server/metamask.ts` shared paper/live routes | Same route can return simulated paper fill when live is off and invoke real wallet action when live is on | `REPLACE` / prohibited seam | Split paper and future real execution contracts. No environment flag may change a route from simulated to real financial mutation. |
| Legacy UI mode switch / Live labels | Product surfaces could expose Paper/Live as one mode continuum | `REPLACE` | Paper and future Real are distinct products/authority paths. Strategy may graduate; paper order never does. |
| Existing research/experiment runtime | Rich experiment, allocator, trials, outcomes/evidence machinery exists | `NEEDS PROOF` + selective `ADAPT` | Mine mechanics after product/domain fit is proven. Do not re-import research factory complexity into V1 by default. |
| Arena/leagues/badges/social rooms/vault clubs | Broad gamification/social product surface | `DEFER` / some `REMOVE` from V1 | Keep historical code as reference. Arena can return after core journey/product authority is stable. Vault/real pooling behavior outside V1. |
| Swarm Copilot / Intent Solver direct paper execution | Natural-language suggestions can create/execute a paper trade vehicle | `REPLACE` at seam | Reasoning should emit `View`; it should not bypass canonical portfolio aggregation by becoming its own direct execution vehicle. |
| Gemini-specific reasoning integration | LLM used for interpretation/assistant behaviors | `ADAPT` as replaceable provider only | MetaEdge domain cannot depend on one model vendor; reasoning provider behind provider-neutral contract. |
| `.agentMemory`, old handoffs/state docs | Rich historical operating context | `DEFER` as archaeology | Historical evidence only. New authority starts at `docs/START_HERE.md` / `CURRENT_STATE.md` and canonical contracts. |

## High-value old mechanics

The relaunch should **not** throw away the following because they directly support the new architecture:

### Durable intent + event lineage

The old paper execution path already demonstrates:

```text
intent persisted
→ risk accepted/rejected
→ broker pending
→ partial/executed/expired/rejected/unresolved
→ append-only events
→ restart reconciliation
```

This is close to the relaunch paper execution state machine and should be extracted rather than reinvented casually.

### Conservative paper fill mechanics

The old broker's next-observation rule is especially valuable because it prevents same-tick lookahead fills.

The exact fee/slippage/liquidity constants remain research parameters, not product law.

### Market observation provenance

The old V5 observation hash/provider/venue/timestamp model is a good foundation for the new `MarketObservation` and broader evidence provenance system.

### Commit ambiguity

The storage layer already distinguishes `not_committed` from `possibly_committed`. That concept should survive anywhere financial mutation can cross a durability boundary.

## High-risk seams not to carry forward

### Direct agent → trade execution

The old product frequently models an agent as both reasoning object and execution vehicle.

The relaunch requires:

```text
Agent/Strategy → View → PortfolioTarget → Risk → Paper execution
```

### Shared paper/live semantics

The historical MetaMask route pattern is explicitly incompatible with the new paper/real isolation contract.

### Product surface as authority

Old tabs and route names are not reasons for a feature/domain to survive.

### V5 version number as authority

The relaunch authority comes from durable domain contracts and policy objects, not merely from an `authorityVersion` integer.

## Privacy defect to retire

Verified V5 behavior:

```text
GET /api/audit
→ sorts db.auditEvents globally
→ returns last 50
```

No user filter is applied.

This must be included in migration negative tests so it cannot reappear.

## Evidence confidence

This map currently has high confidence for the explicitly inspected files above.

Other old subsystems should remain `NEEDS PROOF` until their code is inspected against a concrete relaunch domain need.

Do not promote a subsystem to `REUSE` because it is large, polished, or already wired into the UI.