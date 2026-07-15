# Layered Decision Runtime - Bounded Change Pack

Date: 2026-07-14
Status: APPROVED BY ACTIVE GOAL
Mode: live-market inputs, continuous paper decisions, real-money execution locked

## Change

Turn the existing read-only opportunity scanner into a reusable decision spine
that can evaluate different strategy mechanisms through the same auditable
layers, persist its canonical decisions, compile immutable strategy versions,
validate them reproducibly, and route eligible decisions to paper execution.

## Truth to preserve

- MetaEdge is paper-first. No scanner or decision candidate may call a live
  wallet or bypass the existing live allowlist and global lock.
- A generic blended score is not an edge. Funding, directional, relative-value,
  and future mechanisms keep separate signal logic.
- Missing or stale data produces a named decline; it is never filled, guessed,
  or silently converted to zero.
- The product catalog is not the research universe.
- All mutations derive ownership from the server session. The autonomous
  runtime may route only to an existing, owner-created, opted-in paper agent.

## In scope

1. A versioned feature envelope with source, unit, observation time, quality,
   and implementation version.
2. A common decision context and ordered gates for data quality, universe,
   liquidity, regime, cost, risk, and portfolio state.
3. A strategy-plugin contract with deterministic feature requirements, signal,
   entry, exit, invalidation, benchmark, and falsifier declarations.
4. Explicit outcomes: `decline`, `research_hypothesis`, and
   `paper_trade_candidate`.
5. Persistent candidate queue, decision audit, immutable strategy specs, and
   validation records in the canonical local database, with bounded history.
6. A continuous runtime that evaluates live-market state and routes only
   qualified candidates for existing opted-in paper agents.
7. One implementation of each feature used both by historical validation and
   live decisions, with parity fixtures.
8. A criterion-derived research universe accepted by download and validation
   tools; no scattered default coin lists in the research path.
9. Read-only status endpoints and runtime proof artifacts.

## Out of scope

- Unlocking or exercising real-money execution.
- Automatically creating a user, wallet, funded account, or live agent.
- LLM-authored mutable live rules.
- Building the full multi-leg accounting ledger before a qualifying mechanism
  requires it.
- Replacing the existing UI or visual system.

## Requirements

### R1 - Versioned evidence

The runtime SHALL attach a stable feature ID, version, source, unit,
`observedAt`, and quality state to every value used in a decision.

### R2 - Ordered veto-capable gates

The runtime SHALL evaluate data quality, universe, liquidity, regime, cost,
risk, and portfolio layers in a stable order. Any layer may veto; risk and
portfolio layers may reduce or decline but never increase exposure.

### R3 - Mechanism-specific plugins

The runtime SHALL use a common plugin contract while keeping each strategy's
mechanism and rules explicit. It SHALL NOT trade a generic composite score.

### R4 - Explicit outcomes

Every evaluation SHALL persist exactly one terminal outcome: decline with
reason, research hypothesis with missing proof, or paper candidate with a
frozen strategy version and complete thesis.

### R5 - Immutable compilation and validation

An approved hypothesis SHALL compile into a content-addressed frozen strategy
spec. Validation SHALL reference the spec hash, dataset/provenance, folds,
costs, benchmark, and exact promotion or rejection reasons.

### R6 - Paper-only routing

Only a validated `paper_trade_candidate` matching an active, opted-in,
owner-created paper agent MAY reach `placePaperTrade`. Live execution SHALL
remain locked and absent from this runtime's imports.

### R7 - Persistent and bounded state

Candidate state, strategy specs, validation records, and the recent decision
audit SHALL survive restart in `data/db.json`. Audit history SHALL be bounded.

### R8 - Universe authority

Research download, validation, and live selection SHALL accept an explicit
criterion-derived symbol set. Convenience defaults SHALL NOT define membership.

### R9 - Continuous operation and observability

The runtime SHALL run on a bounded interval, prevent overlapping cycles, expose
its last-cycle state read-only, and record enough evidence to reproduce each
decision.

## Acceptance scenarios

### S1 - Honest decline

GIVEN a symbol lacks required recorded history
WHEN a plugin is evaluated
THEN the data-quality gate persists `decline/INSUFFICIENT_HISTORY`
AND no candidate or paper trade is created.

### S2 - Layered candidate

GIVEN fresh versioned features, universe membership, adequate liquidity, an
eligible regime, acceptable modeled cost, risk headroom, and a plugin signal
WHEN the engine evaluates the context
THEN every gate and its evidence are persisted in order
AND the outcome is a paper candidate referencing a frozen spec hash.

### S3 - Portfolio veto

GIVEN an otherwise valid signal but an existing position at its cap
WHEN the portfolio gate runs
THEN the decision declines with `POSITION_CAP`
AND the signal cannot bypass the veto.

### S4 - Research hypothesis

GIVEN an economically named plugin signal whose strategy version has no passing
validation record
WHEN the engine evaluates it
THEN it emits `research_hypothesis`, not a paper candidate.

### S5 - Safe paper route

GIVEN a validated paper candidate matching an active opted-in paper agent
WHEN the router handles it
THEN the normal paper intent/risk/ledger path is used
AND the fill carries the decision ID, spec hash, and complete thesis.

### S6 - No owner, no mutation

GIVEN a candidate with no matching opted-in owner-created agent
WHEN routing runs
THEN it remains queued or expires with an explicit reason
AND no user, agent, or trade is fabricated.

### S7 - Offline/online parity

GIVEN the same timestamped input fixture
WHEN a feature is calculated in historical and live adapters
THEN values, units, quality, and version match exactly.

### S8 - Restart continuity

GIVEN persisted specs, validations, and queued decisions
WHEN the server restarts
THEN the runtime reads the same canonical state and continues without duplicate
execution.

## Proof map

- Unit tests: feature parity, gate ordering/vetoes, plugin determinism, spec
  hashing, candidate transitions, queue bounds, and idempotent paper routing.
- Integration tests: live-shaped snapshot to persisted outcome; validated
  candidate through the existing paper ledger; restart continuity.
- Static proof: no decision-runtime import of MetaMask/live execution modules;
  no default research-universe coin list.
- Runtime proof: two bounded cycles on port 3000 showing a declined decision and
  a queued/routed paper candidate, with database and API evidence.
- Regression proof: `npm run lint`, `npm run build`, existing journey smokes,
  capability matrix strictness, and EdgeOps checks.

