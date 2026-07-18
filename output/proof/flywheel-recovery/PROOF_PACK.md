# MetaEdge Gemini Flywheel Recovery Proof Pack

Status: **INCOMPLETE — REPAIR STAGE PASSED; REPLACEMENT 24-HOUR SOAK NOT YET COMPLETE**

This file is an evidence index, not a completion certificate. A row marked
`PENDING` prevents certification. Historical replay, canary data, and invalidated
soaks are plumbing evidence only and contribute zero promotable economic evidence.
Live execution must remain locked throughout.

## Acceptance evidence

| Requirement | Authoritative evidence | Current status |
| --- | --- | --- |
| Legacy containment, 14,312-contract quarantine, archive hashes, recursive read-only state | `persisted-state-verification.json`; `data/archive/flywheel-recovery-preacceptance-1784201556251/manifest.json` | PASS in latest pre-soak independent verification; must be reverified post-soak |
| Cutover separates `historical_replay` from `paper_forward` | `persisted-state-verification.json`; `data/opportunity-factory-v3/fast-perp-cutover.json` | PASS in latest pre-soak independent verification; must be reverified post-soak |
| Deterministic 10x canary replay, decision-before-outcome, restart/recovery paths, zero promotable evidence | `deterministic-replay.json` | PASS: 265 decisions / 265 outcomes twice; identical hash `0393afde65e236d5a91a01c89aee9b7a7b8b7d7adb16b8bd1a953c12d7d62ba2`; zero promotable |
| Deliberate lies are rejected | `truth-mutation-proof.json` | PASS: clean control plus nine rejected mutations |
| Full discovery, decision, Python parity, TypeScript, production build, strict capability, and product smoke commands | Fresh post-soak logs under `command-logs/` | **PENDING** — prior fresh commands passed, but self-contained post-soak logs are required |
| Cached operator UI and API truth | `output/playwright/flywheel-recovery/browser-proof.json`; desktop/mobile screenshots | PASS pre-soak; final API truth must match post-soak persisted truth |
| Desktop and mobile screenshots | `output/playwright/flywheel-recovery/research-fleet-desktop.png`; `research-fleet-mobile.png` | PASS pre-soak |
| Bounded hourly compression, manifest durability, retention/orphan integrity | Replacement final-soak series and partition manifest; post-soak independent orphan/hash check | First invalid run's initial maintenance hour passed, but cannot satisfy final acceptance; replacement check **PENDING** |
| Complete 24-hour uptime, endpoint latency, CPU, final-six-hour RSS, raw/derived storage, queue, PID, decision-lag, unresolved, no-raw-contract, no-pause, and live-lock gates | New final-soak series and eventual `summary.json` | **PENDING** — detached run `soak-final-1784284906426` failed operational/no-pause gates and is permanently excluded; no current acceptance soak exists |
| Persisted decision/outcome/lifecycle/authorization uniqueness, causality, reconciliation, archive integrity, and current two-key live lock after the soak | Fresh `persisted-state-verification.json` with `runtimeRequired: true` | **PENDING** — must run after a passing summary |
| Invalid runs remain visibly excluded | Each invalid run's `INVALIDATED.json` | PASS for preserved invalidated runs; recheck final index post-soak |
| Economic claim boundary | Final operator snapshot and proof conclusion | Current result is `no_promoted_alpha`; no profitability, HFT, or live-readiness claim is authorized |

## Invalid first final soak

- Evidence directory: `soak-final-1784219319422/`
- Started: `2026-07-16T16:28:39.422Z`
- Expected server PID at start: `49565`
- Expected clock PIDs at start: signal `49619`, resolver `49620`, challenger `49621`, lifecycle `49622`
- Both live keys were explicitly false at launch.
- Permanent exclusion marker: `soak-final-1784219319422/INVALIDATED.json`
- Failure: scheduled challenger research exceeded the 60-second running-heartbeat budget, produced non-operational samples, and drove CPU p95 above the fixed 70% gate.
- The preserved partial series and post-invalidation shutdown record are diagnostic evidence only. They can never satisfy acceptance or be relabeled valid.
- A repaired challenger completed once against the real corpus in 19.955 seconds, followed by the passing compiled all-clock boundary below. The replacement 24-hour soak may now begin.

## Passed repair boundary

- Evidence directory: `soak-challenger-settled-1784228991059/`
- Full scheduled challenger: policy v7, 1,820 global trials, 260 evaluations, 20.110 seconds.
- Monitor: 600,000 ms / 120 samples, every declared gate true, zero violations, CPU p95 39.4%, live locked.
- Independent persisted-state verification passed with runtime heartbeats required.
- This stage proves the repaired boundary only. It does not replace the mandatory 24-hour final soak or authorize an economic claim.

## Invalid second final soak

- Evidence directory: `soak-final-1784229832302/`
- Started: `2026-07-16T19:23:52.302Z`
- Permanent exclusion marker: `soak-final-1784229832302/INVALIDATED.json`; exact pause: `PAUSE_RECORD.json`.
- Failure: a momentary WebSocket reconnect set the transport `connected` bit false while evidence remained only 142 ms old. The old health expression degraded immediately instead of applying the fixed 30-second evidence-freshness boundary; the guard correctly paused on the resulting false health value.
- Preserved series: 3,177 rows, SHA-256 `917b81f8de850fbee67abea725ac765ab5fcaf42dfb9d83ae3799dbfee4342af`. Live stayed locked; the run can never be relabeled valid.
- Test-first repair keeps connection state visible but bases operator eligibility on recorder-running plus current trade/book evidence. The unchanged store freshness gate fails after 30 seconds, and the unchanged soak policy still pauses on false operator health.

## Invalid PTY-supervised final soak

- Evidence directory: `soak-final-1784281383326/`
- Started: `2026-07-17T09:43:03.326Z`; expected completion no earlier than `2026-07-18T09:43:03.326Z`.
- Permanent exclusion marker: `soak-final-1784281383326/INVALIDATED.json`.
- Failure: PTY-backed server and monitor disappeared together after 0.555 measured hours despite every partial sample being green and no application error, pause, or graceful shutdown record. The run is preserved and cannot be relabeled valid.

## Invalid detached replacement final soak

- Evidence directory: `soak-final-1784284906426/`.
- Started: `2026-07-17T10:41:46.426Z`; invalidated at `2026-07-17T12:38:30.089Z`.
- Expected server PID: `27288`; clock PIDs: signal `27289`, resolver `27290`, challenger `27291`, lifecycle `27292`.
- Monitor PID: `27980`.
- Durable supervision: detached screen sessions `27286.metaedge_final_server` and `27978.metaedge_final_monitor`, independent of individual Codex tool sessions.
- Permanent exclusion marker: `soak-final-1784284906426/INVALIDATED.json`; original `RUNNING.json` remains preserved as launch evidence.
- Failure: challenger research saturated CPU/memory and spawned an additional child; its heartbeat became stale, the recorder stopped, evidence passed 30 seconds, and signal/resolver/lifecycle paused fail-closed. The preserved 475-row series contains nine non-operational samples and can never be relabeled valid.

## Required completion sequence

1. Require the monitor to write a full-duration `summary.json` with every gate true and no violations.
2. Independently read persisted state and partition manifests; do not trust the API summary as the verifier's source.
3. Persist fresh command logs for discovery, decision, Python parity, truth mutations, lint, build, strict capability matrix, and product browser smoke.
4. Hash the final summary, series, verifier, replay, mutation proof, command logs, browser proof, screenshots, archive manifests, and lifecycle traces into a final manifest.
5. Compare API/UI truth with persisted truth and retain `no_promoted_alpha` or `no_trade` when evidence has not promoted a strategy.
6. Only after every row above passes may the recovery goal be marked complete. Do not start the canonical port or enable live execution as part of this goal.
