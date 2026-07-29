# Risk-OS trailing stop: persisted high-water mark — ADDED

Date: 2026-07-23
Status: DECIDED — extended the event-driven Risk-OS with a restart-safe trailing stop;
proven by a flip probe (`scripts/trailing_stop_probe.ts`: FACT_OPEN → FACT_CLOSED).

## Context

The Risk-OS (`server/decision/risk_loop.ts`, added 2026-07-23) enforced only a STATIC hard
stop (`price <= avgEntry*(1-stopLossPct)`). The Volume-Confirmed Golden Cross's edge depends
on a 15% TRAILING stop — a give-back from the running peak, not from entry. This is a
universe-agnostic risk primitive worth building before the (blocked) golden-cross entry, since
running that edge is gated on a broad live price feed that does not exist yet.

## The fact (probe, no product change)

`scripts/trailing_stop_probe.ts` seeds an open position at entry 100 in an isolated DB, then:
entry 100 → rally 120 → give back to 101.
- Static hard stop = 97; 101 > 97 → NOT triggered. The entire +20% run is handed back and the
  position stays OPEN.
- No trailing peak is tracked or persisted.

Pre-fix ledger: `class FACT_OPEN | hwmOnDiskAfterRise 100 | positionSizeAfterGiveBack 1`.

## The fix

- `db.trailingState` (new persisted top-level map, keyed `${agentId}:${symbol}` — type in
  src/types.ts, default + migration backfill in server/storage.ts). Survives process restarts,
  so the trailing peak is never reset to the current price.
- `checkStopsOnce()` now: a position with a `db.trailingState` entry uses a TRAILING stop
  (ratchet `highWaterMark = max(price, hwm)`, flatten on `price <= hwm*(1-trailPct/100)`);
  otherwise the static hard stop as before. The golden-cross entry will write the trailing
  entry on its BUY fill; `trailPct` is a percent (15) to match `stopLossPct`.
- Race-safe ordering against placePaperTrade's own read-modify-write: (A) persist peak ratchets
  + stale-key cleanup in one write, no trades; (B) flatten (each trade owns its write);
  (C) clear the now-flat positions' trailing state on a fresh read. No lost updates.

## Re-proof (same probe, `--expect-closed`)

```
class FACT_CLOSED | peakRatchetsAndPersistsAcrossRestart: true (hwm 120 read off disk)
trailingStopFlattensWhereHardStopWouldNot: true (pos 1 → 0 at 101) | trailingStateClearedAfterExit: true
[risk-os] trailing_stop flatten probe BTC @ 101 (stop 102.00)
```
Hard-stop path regression (stop_latency_probe) still FACT_CLOSED; `tsc --noEmit` clean;
`npm run test:decision` 15/15.

## Not in scope (logged)

- The golden-cross ENTRY plugin is still blocked on data — the live runtime prices only 11
  majors and holds ~16 days of hourly closes; the edge needs a broad live feed + 200d daily.
  This slice builds the EXIT socket only. Nothing writes db.trailingState in production yet.
