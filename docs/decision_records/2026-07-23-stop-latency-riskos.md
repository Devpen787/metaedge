# Stop-loss latency: exits gated to the 5-min decision cycle — FIXED with an event-driven Risk-OS

Date: 2026-07-23
Status: DECIDED — added a minimal event-driven hard-stop loop; proven by a flip probe
(`scripts/stop_latency_probe.ts`: FACT_OPEN → FACT_CLOSED).

## Premise correction (verified, cited)

The concern was raised as "the autotrader checks stops on a 90s tick." Against the code that
is wrong on specifics but real (and worse) in substance:
- The legacy 90s autotrader is DISABLED by default — `server/autotrader.ts:199` returns early
  under `LAYERED_RUNTIME_ENABLED` (default true).
- The real exit path is the layered decision runtime. `server/decision/runtime.ts:32`
  `CYCLE_MS = max(60_000, DECISION_RUNTIME_INTERVAL_MS || 5*60_000)` → **default 300s**. Exits
  are evaluated only inside `runDecisionCycle()`, scheduled only by
  `setTimeout(run,15_000)` then `setInterval(run, CYCLE_MS)` (`:235-236`).
- No event-driven stop existed: the only websocket handler is `fast_perp_recorder` (research
  plane); `killguard` runs hourly and only DISABLES autopilot, never flattens on price.

So a hard-stop breach that lands just after a cycle bled unactioned for up to ~5 minutes.

## The fact (probe, no product change)

`scripts/stop_latency_probe.ts`, driving the REAL stop evaluator:
- The exit is INSTANT when evaluated — `rsiMeanReversionV1.generateSignal` returns
  `sell`/`stop loss` on a breach, `hold` otherwise. Latency is only in WHEN it runs.
- Cadence coupling — with the real `CYCLE_MS`, a breach just after a cycle is not signalled
  until the next cycle: exposure = `CYCLE_MS` (297s measured).

## The fix — minimal event-driven Risk-OS

`server/decision/risk_loop.ts`: a loop that runs BETWEEN decision cycles and owns only the one
exit that cannot wait — the HARD STOP. It is deliberately zero-feature-compute (mechanical
`price <= entry*(1-stopPct)`, no RSI/SMA/universe work) so it can run on every tick without the
vCPU thrash that took down the e2-micro. Nuanced exits (RSI, profit target, time stop) stay on
the decision cycle. Paper only (routes through `placePaperTrade`, no live order path). Wired in
`server.ts` next to `startDecisionRuntime()`. Chosen over "full exit eval on a fast interval"
(re-introduces feature-recompute load) and "just lower CYCLE_MS" (still up to 60s exposed, 5x
cycle load). This is also the socket where the Volume-Confirmed Golden Cross's 15% TRAILING
stop plugs in at integration time.

## Re-proof (same probe, `--expect-closed`)

Seeds a breaching open position in an isolated DB and invokes `checkStopsOnce()`:
```
class FACT_CLOSED | exitFiresInstantlyWhenEvaluated: true | cadenceCoupling…: true
riskOsFlattensBetweenCycleBreach: true | posBefore 1 → posAfter 0, flattened [a_probe]
[risk-os] hard-stop flatten probe BTC @ 96 (stop 97.09)
```
Full `tsc --noEmit` clean; `npm run test:decision` 15/15 pass.

## Not in scope (logged, not done)

- Time-stop stays on the decision cycle (48h horizon — 5-min latency is immaterial).
- Trailing-stop logic (for the golden cross) is not built yet — this is its future socket.
- Live order path remains locked; this hardens the paper risk engine only.
