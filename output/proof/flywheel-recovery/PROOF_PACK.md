# MetaEdge Gemini Flywheel Recovery Proof Pack

Status: **IN PROGRESS — AVAILABILITY ARCHITECTURE REPLACED; TWO-HOUR BURN-IN RUNNING**

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
| Full discovery, decision, Python parity, TypeScript, production build, strict capability, and product smoke commands | Fresh post-burn-in logs under `command-logs/` | **PENDING** — checkpoint commands passed; final fresh matrix follows the burn-in |
| Cached operator UI and API truth | `output/playwright/flywheel-recovery/browser-proof.json`; desktop/mobile screenshots | PASS pre-soak; final API truth must match post-soak persisted truth |
| Desktop and mobile screenshots | `output/playwright/flywheel-recovery/research-fleet-desktop.png`; `research-fleet-mobile.png` | PASS pre-soak |
| Bounded hourly compression, manifest durability, retention/orphan integrity | `soak-availability-split-1784363625767/summary.json`; partition manifest; independent orphan/hash check | **RUNNING** — two-hour burn-in crosses UTC partitions with two-file maintenance cap |
| Continuous-paper availability after removing challenger from liveness | `availability-split-proof.json`; real attempt/proposal/import records; two-hour burn-in | Finite 20-cycle/fault proof PASS; real 712 MB batch PASS after one safely preserved timeout; burn-in **RUNNING** |
| Persisted decision/outcome/lifecycle/authorization uniqueness, causality, reconciliation, archive integrity, and current two-key live lock after burn-in | Fresh `persisted-state-verification.json` with `runtimeRequired: true` | **PENDING** — runs after the burn-in summary |
| Invalid runs remain visibly excluded | Each invalid run's `INVALIDATED.json` | PASS for preserved invalidated runs; recheck final index post-soak |
| Economic claim boundary | Final operator snapshot and proof conclusion | Current result is `no_promoted_alpha`; no profitability, HFT, or live-readiness claim is authorized |

## Availability-split evidence

- Recovery checkpoint: `3b10d00`.
- Deterministic fault proof: `availability-split-proof.json`, 20 cycles twice,
  semantic hash `38fb4a85777b8bec7c504a4482f1f0d49d4d9e2e5108e16ee4dc1b3b05efdf66`.
- Exercised: partial research-run import, partial contract import, duplicate import,
  killed/abandoned attempt, kill-during-publication, concurrent import, stale,
  corrupt and expired bundles, and challenger exclusion
  from continuous health. Synthetic fixtures produced two paper contracts solely to
  exercise lifecycle/import plumbing.
- Real export: `fast_perp_evidence_export_781c79941eee70962d9111e9`, payload SHA-256
  `db149273b69857737580f863f48edec563325ae26110f1fd19bb610ec4693612`,
  atomically published as a manifest plus bounded per-chunk hashes.
- First real attempt `fast_perp_attempt_e2d811045fd1d49c4aa196f1` timed out at the
  fixed five-minute deadline before publication. This is preserved failure evidence.
- Optimized retry `fast_perp_attempt_ce8ae515b9f22aaa82f87c0b` completed in about
  two minutes and published `fast_perp_research_proposal_d29ba4cf8b163e6b8afc8713`.
- Sole-writer import persisted `fast_perp_research_7a25be6616811b8ac90a`: 300
  evaluations, zero contracts/lifecycle events, blocker
  `AUTHORITATIVE_LIQUIDATION_FLAG_MISSING`, live locked.
- Active burn-in: `soak-availability-split-1784363625767`; server PID 10496;
  continuous clock PIDs 10578/10579/10580. Research is disabled on this node and
  reported separately with `affectsContinuousOperation: false`.

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
- Corrected failure sequence: at the first bad sample endpoints were still about 17 ms, recorder evidence was 254 ms old, storage was healthy, and the 12-core Mac was not proven starved. Challenger's running heartbeat reached 74,085 ms, exceeded its 60-second watchdog, and made operator health false; the monitor then wrote the global fail-closed pause, which stopped recorder and dependent clocks. The preserved 475-row series contains nine non-operational samples and can never be relabeled valid.

## Remaining completion sequence

1. Require the two-hour monitor to write a full-duration `summary.json` with every gate true and no violations.
2. Independently read persisted state and partition manifests; do not trust the API summary as the verifier's source.
3. Persist fresh command logs for discovery, decision, Python parity, truth mutations, lint, build, strict capability matrix, and product browser smoke.
4. Hash the final summary, series, verifier, replay, mutation proof, command logs, browser proof, screenshots, archive manifests, and lifecycle traces into a final manifest.
5. Compare API/UI truth with persisted truth and retain `no_promoted_alpha` or `no_trade` when evidence has not promoted a strategy.
6. Only after every row above passes may this recovery goal be marked complete. The obsolete 24-hour co-located-daemon acceptance is not waived; it is superseded by the implemented three-role boundary, finite batch/fault proof, and two-hour continuous-only burn-in defined in the corrected decision record. Do not start the canonical port or enable live execution as part of this goal.
