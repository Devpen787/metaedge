# Flywheel availability: split the box, don't soak the box

Date: 2026-07-16
Status: PROPOSED (for Codex — this is the "another way" past the 24h soak)
Author: Claude, at Devin's request, after Codex reported the availability wall.

## The problem, stated honestly

Codex ran the flywheel under continuous operation and observed: **183% CPU,
peaks >280%, ~2.3 GB memory, a 74s heartbeat stall, recording stopped, evidence
went stale, dependent processing paused fail-closed.** Its conclusion: safety and
truthfulness are strong; **availability is unproven and unreliable**; profitability
unproven.

The safety system behaved correctly. But the proposed remedy — a clean 24-hour
soak — **cannot pass, because it is not a bug, it is a hardware mismatch.** The
production host is a GCP e2-micro: **1 vCPU, ~1 GB RAM.** A workload that wants
280% CPU wants ~3 cores. You cannot soak-certify a 3-core workload onto a 1-core
box; there is no run long enough to make one core into three. The soak is trying
to prove that physics is negotiable.

This is the same wall that took the whole site down on 2026-07-15 (heavy research
starved the web server to 48-second responses; see the VM-capacity memory). It is
also exactly what the review-pack deployment profiles prescribed: a **lean hosted
app** and a **research node** are two machines, not one.

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
- `startFastPerpRecorder()` — WebSocket market ingest (light; it only "stopped"
  because the flywheel starved its CPU — remove the flywheel and it is fine)
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

### The data bridge
The micro is the source of truth for RECORDED MARKET DATA (recorders run there).
The research node is the source of truth for RESEARCH ARTIFACTS (candidates,
decisions, validations, promotions).

Per flywheel cycle (6h cadence, so eventual consistency is fine):
1. research node **pulls** recent recorded evidence from the micro
   (`data/market/**`) over the existing gcloud-ssh/rsync channel;
2. runs one `flywheel_v3_cycle.ts`;
3. **pushes** the canonical artifacts back
   (`data/opportunity-factory-v3/**`, the decision/candidate ledgers) so the
   product on the micro can read and display them.

No shared database is required at this scale. Do NOT reach for Postgres/Timescale
(review-pack Profile C) until measured load demands it.

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

## The proof that replaces the 24-hour soak
Availability certification becomes cheap and finite:
- **one** `flywheel_v3_cycle.ts` run completes correctly and exits clean, under the
  cap, within the timeout;
- the pull → run → push bridge round-trips (recorded evidence in, artifacts out)
  and the micro's product reads the new artifacts;
- a killed/timed-out cycle leaves recoverable state and the next cron tick proceeds.

That is minutes to verify, deterministically — not a day of soaking a box that was
never the right home for this workload.

## Non-goals
- Not a rewrite of the flywheel engine — it already batches correctly.
- Not a new datastore. Files + the existing sync channel are enough at 6h cadence.
- Live execution stays locked throughout; this changes only WHERE compute runs.
