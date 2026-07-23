# Price-feed outlier clamp: freeze on a persistent >25% move — FIXED

Date: 2026-07-23
Status: DECIDED — fixed via persistence-based accept, proven by a flip probe
(`scripts/prices_outlier_probe.ts`: FACT_OPEN → FACT_CLOSED).

## The fact (probe, no product change)

`server/prices.ts` guarded the feed with a static clamp: reject any single update that
jumps >25% from the last accepted price (a feed blip). But it compared each update to the
last *accepted* value with no concept of TIME — so a GENUINE, PERSISTENT >25% move (a real
breakout / cascade liquidation) was rejected on every poll. The feed froze at the pre-move
price indefinitely, and because `lastGoodFetch` only advances on an accepted update, it also
went stale at 120s while still showing the wrong price — blind exactly when it matters.

Isolation seam: mock global `fetch` (drive the real refresh path with scripted prices) +
pin `Math.random` (kill the ±0.03% jitter); observe only via `getSpotPrice` /
`getPriceFeedState`. No logic re-created.

Pre-fix ledger (`npx tsx scripts/prices_outlier_probe.ts`):
```
class FACT_OPEN | baseline 100 → injected persistent 130 → feed frozen at 100,
observedAt never advanced (→ stale-at-120s while wrong). Blip guard + within-band control OK.
```

Why it bites our strategies specifically: the Volume-Confirmed Golden Cross fires on ≥3×
volume, and moves of that size routinely exceed 25% in a short window — the exact breakout
the system is meant to trade is the one the feed would go blind to.

## The fix — persistence-based accept

Keep rejecting the FIRST sighting of a >25% jump (blip protection), but if the move persists
in the SAME DIRECTION for `OUTLIER_CONFIRM_POLLS` (default 3, env-tunable) consecutive polls,
accept it as the new reality. A within-band update disarms any pending spike counter.

Chosen over the alternatives on purpose: multi-venue cross-confirm adds a dependency that can
fail exactly during a flash event; a volatility-adaptive envelope needs a rolling vol estimate
that itself must survive the freeze and adds per-tick compute. Persistence fixes the actual
logical flaw (no concept of time) with the smallest surface and a deterministic re-proof.

## Re-proof (same probe, `--expect-closed`)

```
class FACT_CLOSED | firstPollRejected_blipGuard: true | persistentMoveAccepted_freezeFixed: true
everFrozenAtPreMovePrice: false | feedClockAdvanced: true | withinBandControlUpdates: true
```

Tick 1 (+30% → rejected as possible blip) → Tick 2 (→ rejected) → Tick 3 (→ ACCEPTED). Full
`tsc --noEmit` clean. Scope: `server/prices.ts` (the `applyPrice` guard) only; the 120s
staleness semantics and the 12s refetch cadence are unchanged.

## Not in scope (logged, not done)

- Paradox 3 (autotrader checks stops on a 90s tick, not event-driven) — real, separate slice.
- Golden-cross entry + trailing-stop are not yet ported into `server/` — must be built in the
  paper decision runtime before execution constraints can be tuned for them.
