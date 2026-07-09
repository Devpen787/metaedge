# LLM Analyst — hook-in compatibility notes (NOT implemented)

Source: audit handoff, Research 4 (Gemini LLM Trading Strategies). Nothing here is
built. This records how existing code must stay shaped so the sidecar can be added
later without a rewrite — the same retcon discipline as `docs/observability_retcon.md`.

## The invariant that makes this safe

Research 4's gate is **suppress-only**: it may DECLINE a trade the deterministic
strategy proposed. It may never originate, resize, or force one. That is exactly
the fail-safe invariant `server/killguard.ts` already obeys (its only permitted
mutation is `autopilot = false`).

State it once, here, so it cannot drift: **advisory components may only reduce
activity.** Anything that could increase exposure is not advisory and needs its own
research card and operator approval.

## Line references have MOVED

Research 4 cites `autotrader.ts:152-153` and `declined.ts:17-31`. Both files changed
after the audit was written. Re-locate by symbol, not line number:
- the hook point is between the strategy `decide*()` result and the balance/cap
  checks inside `tick()`.
- `DeclineReason` is a closed union near the top of `declined.ts`.

## Compatibility points

**1. `DeclineReason` is a closed vocabulary and already grew.**
It now carries 5 scanner reasons (`STALE_DATA`, `LIQUIDITY_FLOOR`, `NOT_IN_UNIVERSE`,
`NO_FUNDING_DATA`, `VENUE_UNSUPPORTED`) on top of the original 8. Research 4 wants 4
more (`LLM_NO_CACHE`, `LLM_SUPPRESSED_*`). Appending is fine — the type is a union,
`recordDeclined` takes it directly, and the daily counter file keys on the string.
**Do not free-text a reason.** The closed union is what makes declines countable.

**2. Confidence calibration is a KILL RULE. It belongs in `killrule.mjs`.**
Research 4 says: "if accuracy < 40% over 30+ trades, auto-disable `LLM_ANALYST_ENABLED`."
That is structurally identical to the survivor bar (`n >= 30`, then a performance
threshold) which now lives in `server/killrule.mjs` as one pure function, imported by
both the CLI and the in-process guard. **Do not hand-roll a second threshold.** Add an
`evaluateLlmCalibration()` beside `evaluateKill()` so both bars are defined once and
are testable without a server. The auto-disable action then belongs in `killguard.ts`,
which is already the only component allowed to switch something off by itself.

**3. The warmer is a fourth background task — follow the existing convention.**
`server.ts` starts `startAutotrader()`, `startRecorder()`, `startJanitor()`,
`startKillGuard()`. An `startLlmWarmer()` goes there. All existing timers call
`.unref()`; match that or the process will not exit. It must also survive the
`uncaughtException` → `process.exit(1)` path added in `29b20d1` (no cleanup hook needed
today, but do not add one that blocks exit).

**4. Reuse the `quant.ts` call pattern, not its error handling.**
Research 4 points at `quant.ts` as the reference for `ai.models.generateContent()`.
That call site's catch was changed (Q3) from silent to `console.warn`. Per
`docs/observability_retcon.md`, it becomes `logger.warn` and explicitly **not** a
Sentry event — an unavailable commentary is expected, not exceptional. The warmer
should classify the same way: a cache miss is normal, an auth failure is not.

**5. Cache staleness must be honest, not silent.**
"On failure: stale cache persists" is fine only if the staleness is *recorded*. The
carry trial already establishes the precedent: a recorder gap does not accrue, and
below 90% capture coverage the trial refuses a verdict rather than render a false one
(`server/opportunity/carry_trial.ts`). An LLM cache older than its TTL should decline
with `LLM_NO_CACHE`, never be reused as though fresh.

**6. Free-tier RPM is a shared budget.**
15 RPM on `gemini-2.5-flash`. The warmer batches all symbols into one call every 300s.
Nothing else may add per-symbol LLM calls — in particular the opportunity scanner
(`server/opportunity/scanner.ts`) must stay deterministic. Its scoring is percentile
normalization over declared units; introducing an LLM score there would reintroduce the
"one generic AI score" that `opportunity-screener-v1` explicitly forbids.

**7. `GEMINI_API_KEY` has no fallback and must not acquire one.**
`.env.example` declares it. Consistent with `29b20d1`: absent key → the feature is off,
never a default credential. `LLM_ANALYST_ENABLED` should default to **false**, unlike
`KILL_GUARD_ENFORCE` which defaults on — because the kill guard only ever reduces risk,
whereas an untested analyst gate changes which trades fire.

## What this must never become

A path where the LLM's opinion causes a trade that the deterministic strategy did not
propose. If that is ever wanted, it is a new strategy, and it needs a research card,
a data contract, a WHERE/WHEN selector, and forward paper — not a prompt template.
