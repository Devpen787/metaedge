# Fast-Perp Flywheel Recovery Decision

Date: 2026-07-16 Europe/Zurich
Cutover: `2026-07-16T11:02:54+0200`
Mode: Paper only
Live execution: Locked

## Decision

The 2026-07-15 fast-perp completion claim is superseded. The implementation
created retrospective decisions after outcomes were already available,
generated new contracts from evidence arrival, repeatedly scanned monolithic
JSONL files, and allowed request-time operator reads to parse the expanding raw
corpus. Those properties invalidate the derived state as forward lifecycle
evidence and made the runtime unbounded.

The selected recovery policy is archive and rebuild. The ordinary paper product
may continue to start, but both fast-perp loops are fail-closed and require
separate explicit opt-in flags after recovery checks.

## Preserved evidence

The prior raw and derived files are hashed and archived read-only under
`data/archive/flywheel-v3-runaway-2026-07-16/`. The inventory and SHA-256 values
are in `data/archive/flywheel-v3-runaway-2026-07-16-manifest.md`.

- Raw trades, books, contexts, sessions, and gaps may be replayed only with
  `EvidenceMode=historical_replay` or `EvidenceMode=canary`.
- All 37 research runs and 14,312 paper contracts are quarantined with reason
  `LEGACY_RETROSPECTIVE_FAST_PIPELINE`.
- No archived decision, outcome, contract, or research result may enter the
  promotable forward ledger.
- Only source evidence first received after the cutover may be classified as
  `paper_forward`.

## Exit gates

Recovery is not complete until bounded storage, pre-outcome decision commits,
independent resolver/lifecycle clocks, stable strategy versions, reconciled
cost/risk accounting, cached operator truth, and wallet concurrency protections
pass their automated and deterministic replay tests. Canonical Python porting is
blocked until the repaired Gemini runtime also passes the declared 24-hour
paper soak and an independent persisted-state verification.

No profitable return, HFT capability, live-capital readiness, or MetaMask
viability is claimed by this recovery work. `no_trade` is a valid result.
