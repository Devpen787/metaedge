# Flywheel availability: split the workload (corrected per Codex 2026-07-16)

Date: 2026-07-16
Status: IMPLEMENTED LOCALLY on `codex/flywheel-availability-split`; finite proof
passed, real-corpus proposal/import passed, and the two-hour continuous-paper
burn-in is running. Live execution remains locked. Canonical Python port deferred.
Author: Claude (v1), corrected after Codex's review.

## Correction notice (read first)

v1 of this document diagnosed the incident wrong, and I'm recording the correction
rather than quietly editing, because a wrong cause left in a committed doc becomes
a "fact" nobody re-checks.

- **v1 said:** the e2-micro ran out of CPU (280% on 1 core = hardware mismatch)
  and starved recording. **Wrong.** I assumed the incident matched the 2026-07-15
  *site* outage without checking where it ran.
- **Actual incident (Codex):** the soak ran on the **12-core Mac**, where 280% CPU
  is ~23% of capacity. At first failure endpoints were ~17 ms and recorded evidence
  was 254 ms old — **nothing was starved.** The failure was a **74-second
  `challenger_research` heartbeat exceeding a 60-second watchdog**, which correctly
  triggered a global fail-closed pause.
- **Failing component (Codex):** the separate fast-perp `challenger_research` clock
  in `scripts/fast_perp_clock_daemon.ts` — NOT the legacy multi-market
  `flywheel_v3_cycle.ts` batch child in `runtime.ts`. So
  `OPPORTUNITY_FACTORY_DISABLED=true` disables the wrong component; it does not
  touch what failed.

## Why the batch direction is still right — but for the REAL reason

The architectural split survives the corrected diagnosis, and actually fits it
better. The real failure was a **continuous clocked daemon holding a liveness
heartbeat contract it could not keep**: one challenger computation ran 74 s without
a heartbeat and tripped the 60 s watchdog.

A **batch job replaces the wrong liveness contract**, and not by adding CPU. It
does not become magically free of liveness: the continuous heartbeat is replaced
by a persisted attempt, fixed deadline, and terminal completed/failed/timed-out/
abandoned result. A research timeout is visible but cannot make recorder, signal,
resolver, or lifecycle health false. Converting `challenger_research` from a
clocked daemon into that disposable capped batch removes the exact defect Codex
observed — the CPU framing in v1 was wrong, the batch remedy is right.

The split's *other* benefit still holds independently: heavy research off the
serving box means a research stall can never pause the continuous paper node's
recording — blast-radius containment, separate from the heartbeat fix.

## The principle

**Separate continuous-light RECORDING from batch-heavy RESEARCH, and connect them
by a data bridge — never by a shared CPU.**

The good news: the flywheel is *already* built as a batch child
(`startOpportunityFactory` → `execFile('scripts/flywheel_v3_cycle.ts', {timeout:
5min})`, with an overlap guard). It starts, runs one cycle, and exits. The fix is
mostly about WHERE that trigger lives, not rewriting the engine.

## Role split

### The e2-micro — serve + record (light, continuous)
Runs and is proven to run fine here:
- the web server / product
- `startFastPerpRecorder()` — WebSocket market ingest, but only on a serving node
  after its bounded recorder profile is measured independently
- the read-only scouts by cron: `kalshi_scout.mjs` (every 5m, flock-guarded, exits),
  the Polymarket scout
- `startFastPerpOperatorSummary()` — cheap state read for the UI

**Turn the heavy flywheel OFF here:** set `OPPORTUNITY_FACTORY_DISABLED=true` in
`.env.production` (the exact flag used to save the site on 07-15). The micro never
spawns `flywheel_v3_cycle.ts` again.

### The research node — the flywheel (heavy, batch)
The Mac now; a dedicated always-on node later. Runs `flywheel_v3_cycle.ts` as a
**scheduled batch job** (cron/launchd), NOT a daemon:
- each run does ONE cycle, writes its artifacts, and EXITS — releasing all CPU and
  memory. A `flock` lockfile replaces the in-process overlap guard.
- run it capped, as defense-in-depth (see below), so even a runaway cycle cannot
  take the whole node.

### The data bridge — CORRECTED (v1 was unsafe; Codex's contract governs)

v1 said "rsync `data/opportunity-factory-v3/**` back to the micro." **That is
unsafe and must not be built.** That directory holds multiple independently-written
authorities — decisions, outcomes, lifecycle state, heartbeats, pauses, operator
summaries, possibly authorization state. Rsyncing it between machines can clobber
newer state or import partial files. The research node must **never push canonical
decisions or promotions.**

The correct contract (Codex, and it owns the detail):
- **research node PROPOSES; the continuous node ACCEPTS.** The research node emits
  immutable *research-proposal* bundles (candidate specs + evidence). The
  continuous node validates and, only there, creates the canonical lifecycle
  events. Canonical decisions/promotions are written in exactly one place.
- evidence flows the other way as immutable *evidence-export* bundles.
- every bundle carries: schema version, dataset manifest, content hashes,
  provenance, and an idempotent bundle ID.
- import is **staging + atomic**: rejected if stale, corrupt, or schema-incompatible;
  never deletes or overwrites a canonical ledger; a given bundle imports **exactly
  once**.

### Killed jobs must be safe, not just "retried" — CORRECTED

v1's "cron reruns next tick" is insufficient. A killed batch job is safe only if,
with tests to prove each:
- partial output never becomes visible (write-temp + atomic rename, or staging);
- the next run detects and reconciles an abandoned attempt;
- trial budgets are not double-spent;
- lifecycle samples are not duplicated;
- the same bundle imports exactly once even under a concurrent attempt.

These are explicit implementation requirements, not properties that fall out of
cron. Codex owns them.

## Defense-in-depth caps (even on the research node)
Match a workload to hardware, then still cage it so one bad cycle is survivable:
- `systemd`/`launchd` (or `nice -n 19`, `ionice -c idle`, `ulimit -v`) with a hard
  `MemoryMax` and `CPUQuota` on the flywheel job.
- keep every fail-closed freshness gate Codex built — those are CORRECT and stay.
- the 5-minute child timeout stays; a cycle that overruns is killed and retried
  next tick.

## What this does to Codex's eight risks
1. Flywheel stops under heavy research → **gone.** It is not on the serving box,
   and on the research node the flywheel *is* the heavy work, running alone.
2. Recording stops during research → **gone.** Recording (micro) and research
   (node) never share a CPU.
3. Paper decisions missed/unresolved → **reduced to a retry.** A batch cycle
   completes or the next cron tick reruns; no continuous loop to wedge.
4. Clocks stop until manual intervention → **gone.** cron is the clock; a crashed
   job just means the next tick runs.
5. CPU/memory contention degrades the product → **gone.** Separated.
6. Restart/recovery gaps → **reduced.** Batch jobs are restart-by-default; Codex's
   store-recovery logic still applies to the artifacts.
7. Compression/reconnect/maintenance/challenger surviving a full day together →
   **mostly dissolved.** These were continuous-daemon concerns; a job that exits
   has no "full day" to survive.
8. Stable memory over the final six hours → **dissolved.** A batch job releases
   memory on exit; there is no six-hour continuous window to prove.

## The proof that replaces the 24-hour soak — CORRECTED (Codex's contract)

Still far cheaper than a 24h soak, but v1's "one clean cycle" is too weak. The
finite proof is:
- **10–20 consecutive** real-corpus batch cycles;
- fault injection: **timeout during computation**, **kill during bundle
  publication**, corrupt-bundle rejection, stale-bundle rejection, **duplicate
  import**, **concurrent import**;
- recovery on the next scheduled tick after each fault;
- website and recorder remain healthy throughout (blast-radius containment shown);
- a **two-hour paper burn-in crossing an hourly partition boundary.**

Deterministic and hours at most — not a full-day soak of a continuous daemon.

## Codex's corrected node model (adopted)

```text
Serving node        web/API · cached operator view · bounded recording only if
                    measured safe · NO heavy discovery
Continuous paper    recorder · signal evaluator · outcome resolver · lifecycle
  node              evaluator   (the ONLY writer of canonical lifecycle events)
Research node       legacy multi-market flywheel batch · fast-perp challenger
                    batch · disposable, capped jobs
Bridge              immutable evidence bundles -> ; <- immutable research
                    proposals ; atomic validated import
```

Note this is THREE roles, not two: v1 collapsed "serving" and "continuous paper"
together. Codex correctly separates them — the recorder / evaluator / resolver /
lifecycle loop is its own continuous node and the sole writer of canonical events;
the serving node only serves and (maybe) does bounded recording.

## Former blocker — closed

The recovery tree was preserved and verified in checkpoint commit `3b10d00` before
the split was implemented. No raw evidence, secrets, bulky soak series, or unrelated
concurrent Arena work entered that checkpoint.

## Implemented contract and measured result (2026-07-18)

- `FAST_PERP_CLOCKS` contains only signal, resolver, and lifecycle. Server startup
  cannot spawn challenger research as a persistent clock.
- Evidence publication uses an atomic directory with a small manifest and bounded,
  individually hashed JSONL chunks. The first real-data attempt exposed and fixed
  Node single-string limits; the accepted artifact was 712 MB uncompressed.
- The research child reads the verified artifact without duplicating it into a
  second raw store. A deliberately preserved first real attempt timed out at the
  five-minute cap; the optimized retry completed in about two minutes.
- The parent uses a persisted `running -> committing -> completed` protocol.
  Proposals may be published while `committing`, but canonical import requires a
  completed attempt tied to the exact local evidence-export ID and payload hash;
  a parent crash on either side of publication reconciles without a false completed
  record or an importable abandoned proposal.
- The continuous importer validates schema, full payload hash, per-chunk hashes,
  live lock, expiry, evidence provenance, and full-content authority digest. Import
  is locked and idempotent; partial research-run/contract writes resume safely
  because append-only IDs are stable.
- The real proposal `fast_perp_research_proposal_d29ba4cf8b163e6b8afc8713`
  imported run `fast_perp_research_7a25be6616811b8ac90a`: 300 evaluations, zero
  contracts, explicit `AUTHORITATIVE_LIQUIDATION_FLAG_MISSING`, live locked. This is
  a valid no-edge/no-contract result, not a profitability claim.
- The deterministic fault proof ran 20 cycles twice with semantic hash
  `38fb4a85777b8bec7c504a4482f1f0d49d4d9e2e5108e16ee4dc1b3b05efdf66`.
  It exercised partial run and contract imports, duplicates, killed attempts,
  kill-during-publication, concurrent import, stale/corrupt/expired bundles, and
  challenger exclusion from continuous health. It produced two synthetic paper
  contracts solely as test fixtures.

## Non-goals
- Not a rewrite of the flywheel engine — it already batches correctly.
- Not a new datastore. Files + the existing sync channel are enough at 6h cadence.
- Live execution stays locked throughout; this changes only WHERE compute runs.
