# MetaEdge Flywheel v3 State

Updated: 2026-07-16 Europe/Zurich

## Superseding recovery state

The 2026-07-15 completion claim is superseded by the recovery incident record at
`docs/decision-records/2026-07-16-fast-perp-flywheel-recovery.md`. The ordinary
paper product may run. Fast-perp recorder and operation remain disabled by
default, but are currently enabled by explicit staged flags for the measured
24-hour paper soak. Runtime health is operational; recovery acceptance is not
complete until that time-based gate passes.

- Cutover: `2026-07-16T11:02:54+0200`.
- The prior 1.6 GB fast-perp/economics state is archived read-only.
- All 14,312 legacy contracts and 37 legacy research runs are quarantined with
  reason `LEGACY_RETROSPECTIVE_FAST_PIPELINE`.
- Archived evidence is `historical_replay` only. It is never forward evidence.
- Deterministic canary replay is current and non-promotable: 265 decisions and
  outcomes, identical two-run hash
  `c8068de03db916b879bf69d01c319d2936cb24e5426171e1e0c556aa532182c8`.
- Active research has two records: one 260-evaluation epoch that issued zero
  contracts, and one report-only repeated look blocked by the 3,500-trial ceiling.
- Active economics has zero contracts, decisions, outcomes, P&L, or promotions.
- Four paper clocks and the recorder are running with bounded queues; the
  measured 24-hour soak is writing under `output/proof/flywheel-recovery/`.
- A rejected pre-acceptance run is archived read-only with reason
  `RECOVERY_PREACCEPTANCE_NONCANDIDATE_CONTRACTS`.
- Live execution remains globally locked.
- Current engineering verdict: `recovery_in_progress`; economic verdict:
  `no_promoted_alpha`; allowed action: `no_trade`.

## Historical 2026-07-15 snapshot (not current operational truth)

- The governed v3 scheduler and control ledger are operational.
- `market_data_health` and `signal_discovery` have completed controlled runs.
- An immediate repeat proved both cadence exits without taking locks or recomputing research.
- Current paper ledger: 250 candidate contracts; 224 declined, 26 blocked, 0 promoted.
- Current execution policy: 216 `no_trade` decisions; 0 paper portfolio approvals.
- Forward evidence: 155 pending, 3 expired, 0 resolved/attributed in the latest snapshot.
- Coverage: six lanes are represented, but only stocks and spot crypto have broad historical price trials; perpetuals and prediction markets are partial; memecoins and cross-chain remain blocked.
- Both flywheel and control integrity report `allLiveExecutionLocked=true`.

## Superseded completion claim

The text below described the state believed true on 2026-07-15. It is retained
for audit history. It must not be used to infer that the fast-perp operation is
currently enabled, healthy, or complete.

## Important negative result

The wider universe has not produced promoted alpha. This is the correct current result, not a failure to run: the validated action remains no-trade while the flywheel improves evidence quality and discovery breadth.

## Known blockers

- Historical as-of universe membership and survivorship records are not implemented yet.
- The current universe snapshot is valid for prospective paper observation from its recorded `knownAt`, but cannot support retrospective selection claims.
- Four empty funding-history files remain in first-class quarantine: ARB, CRV, LINK, and WLD.
- Current v2 lockboxes are write-once; two earlier unversioned validation-policy lockboxes are retained as legacy audit evidence and are ineligible for current-policy promotion.
- Price-signal transforms and the decision council are operational; non-price streams are represented through measured state plus explicit evidence blockers rather than fabricated alpha.
- The TradingAgents-inspired decision council is operational, but all seven current numerical gates fail; agent debate cannot override them.
- Portfolio and order engines are operational as gated kernels, but current evidence has not admitted a target portfolio or forward execution decision.
- Execution-cohort assignment and metrics are implemented, but zero eligible forward decisions means empirical cohort outcomes remain unavailable.
- Forward outcomes remain too sparse for attribution or promotion.

## Machine authorities

This file is an operator summary, not canonical runtime state. Read the control API or these files for current truth:

- `/api/opportunity-factory/control`
- `/api/opportunity-factory/flywheel`
- `/api/opportunity-factory/data-world`
- `/api/opportunity-factory/world`
- `/api/opportunity-factory/signals`
- `/api/opportunity-factory/lane-signals`
- `/api/opportunity-factory/council`
- `/api/opportunity-factory/validation`
- `/api/opportunity-factory/portfolio-execution`
- `/api/opportunity-factory/forward-learning`
- `/api/opportunity-factory/v3`
- `/api/opportunity-factory/health`
- `config/research/flywheel-v3-control.json`
- `data/opportunity-factory-v3/control/state.json`
- `data/opportunity-factory-v3/control/run-log.jsonl`
- `data/opportunity-factory-v3/data-world/`
- `data/opportunity-factory-v3/world/`
- `data/opportunity-factory-v3/validation/`
- `data/opportunity-factory-v3/portfolio-execution/`
- `data/opportunity-factory-v3/forward-learning/`
- `data/opportunity-factory-v2/`
