# Fast-perp research batch operations

## Safety boundary

This workflow is paper-only. Keep `LIVE_EXECUTION_ENABLED=false`. The research
node may receive immutable evidence exports and return immutable proposals only.
Never copy or synchronize `data/opportunity-factory-v3/economics`, `operator`,
`live-review`, decisions, outcomes, authorizations, heartbeats, or pauses between
nodes.

The serving node runs with:

```text
OPPORTUNITY_FACTORY_DISABLED=true
FAST_PERP_OPERATION_ENABLED=false
FAST_PERP_RESEARCH_ENABLED=false
LIVE_EXECUTION_ENABLED=false
```

The continuous-paper node owns recorder, signal, resolver, lifecycle, and all
canonical imports. The research node owns no canonical ledger.

## One research tick

On the continuous-paper node, publish a bounded evidence artifact:

```bash
LIVE_EXECUTION_ENABLED=false npm run fast-perp:export
```

Transfer only the printed immutable evidence directory to the research node.
Use a temporary destination and rename the complete directory atomically. The
directory contains `manifest.json` plus bounded JSONL chunks; every chunk and the
complete payload are verified before computation.

On the research node:

```bash
LIVE_EXECUTION_ENABLED=false \
FAST_PERP_RESEARCH_BRIDGE_ROOT=/var/lib/metaedge/research-bridge \
FAST_PERP_RESEARCH_WORK_ROOT=/var/tmp/metaedge-research \
npm run fast-perp:research-batch -- /absolute/path/to/evidence_bundle_directory
```

The parent creates a persisted attempt, starts one disposable child, and kills it
after five minutes. Exit zero produces one immutable proposal; timeout/failure
produces no proposal and a terminal attempt record. Schedule this command every
six hours with cron/systemd/launchd and an external overlap lock. Do not schedule
`fast_perp_clock_daemon.ts challenger_research`; that entry point fails closed.

Transfer only the printed proposal JSON to the continuous-paper node's proposal
staging area, then atomically rename it into the configured research bridge.
Import on the continuous-paper node:

```bash
LIVE_EXECUTION_ENABLED=false npm run fast-perp:import -- PROPOSAL_ID
```

Import rejects unlocked, corrupt, expired, schema-incompatible, or stale-authority
proposals. The import lock permits one writer, append-only IDs make retries safe,
and the import receipt is written last. A repeated import returns
`already_imported`.

## Operator interpretation

`/api/opportunity-factory/health` reports `researchBatch` separately with
`affectsContinuousOperation: false`. A failed/timed-out research batch means no
new challenger was admitted; it must not pause current recording, paper decisions,
resolution, or lifecycle processing. No contract is a valid result. Research
status never authorizes live capital.

## Recovery checks

- An overdue `running` attempt becomes `abandoned` before the next attempt starts.
- `.staging`, `.tmp`, and `.lock` artifacts must be absent after a completed tick.
- Proposal authority must still match canonical research-run and contract IDs.
- Import receipts, research runs, contracts, and lifecycle event IDs must be unique.
- Serving and continuous nodes must keep `LIVE_EXECUTION_ENABLED=false`.
