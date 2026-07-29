# Observability Retcon — lines to update when pino/Sentry land

Source: audit handoff, Research 7 (Monitoring). This file records error handlers
written BEFORE pino/Sentry existed, so they can be migrated mechanically rather
than rediscovered. Nothing here is rework — all of it functions correctly today.

Ordering constraint: `logger` must be constructed in `server.ts` before any module
that imports it runs. The `.mjs` shared modules (`units.mjs`, `killrule.mjs`) are
imported by BOTH the server and standalone scripts, so they must stay
logger-free — a script has no pino instance. Keep them pure.

## Handlers written this session (Tier 0 + Tier 1 so far)

| File:line | Current | On pino/Sentry arrival |
|---|---|---|
| `server.ts:171` | `console.error` in `uncaughtException`, then `exit(1)` | `logger.fatal({ err })` + `Sentry.captureException(err)` + **flush before exit** — a bare `process.exit(1)` drops buffered Sentry events. Use `Sentry.close(2000).then(() => process.exit(1))`. |
| `server.ts:178` | `console.error` in `startServer().catch`, then `exit(1)` | same as above; same flush hazard |
| `server.ts:163` | `console.error` in `unhandledRejection` | `logger.error({ reason })`; do NOT exit (deliberate) |
| `server.ts:128` | `console.error` route error handler | `logger.error` + Sentry (catalog row `server.ts:108`, now shifted by the Tier-0 edit) |
| `server/quant.ts:243` | `console.warn` — AI commentary unavailable | `logger.warn({ err }, ...)`; NOT Sentry (expected, non-fatal) |
| `server/quant.ts:271` | `console.error` — engine failure | `logger.error` + `Sentry.captureException` |
| `server/recorder.ts:~46` | `if (!res.ok) return;` — silent skip on venue error | `logger.warn({ status: res.status }, 'funding fetch failed')`. This is a NEW silent surface added today; the catalog's recorder rows (26, 52, 62, 95) predate it. |
| `server/declined.ts` catch | `catch {}` — accounting never breaks trading | `logger.warn`; keep swallowing |
| `server/killguard.ts:35,50,55,61,63` | `console.warn` | `logger.warn({ family, reason })`. **Line 35 (KILL-RULE VIOLATION) and 50 (autopilot disabled) should also be Sentry breadcrumbs or events** — an autonomous actor disabling a strategy is exactly the event you want alerting on. Not in the catalog; it did not exist when the audit ran. |
| `server/opportunity/*` (8 sites) | `catch { /* recording never breaks anything */ }` | `logger.warn`. Whole module postdates the audit; absent from the catalog. |
| `src/lib/api.ts` `safeJson` catch | swallows non-JSON body | Client-side — pino is server-only. If Sentry **browser** SDK is added, capture a breadcrumb with `res.status` and the URL, not the body. |

## Catalog rows already satisfied or shifted

- `server.ts:108` → now `server.ts:128` (Tier-0 edits inserted 20 lines).
- `recorder.ts` gains one row (the new `!res.ok` guard).
- `killguard.ts`, `killrule.mjs`, `units.mjs`, `opportunity/*` are **new files** the
  catalog does not cover. Add them when instrumenting.

## Research 5 (prediction markets) — bearing on the fix queue

`server/predictionMarkets.ts` does not exist, which is why audit item **P2** was
skipped as mis-scoped. Research 5 clarifies why: the intended module is a *future*
`server/market-proxy.ts` (Polymarket → Kalshi → local `db.json`). The malformed
`outcomePrices` parsing P2 describes belongs in `normalizePolymarket()` when that
proxy is built — it cannot be fixed today because the code does not exist.

`src/components/PredictionMarkets.tsx:26-31` already guards `res.ok` and branches on
`data.source === 'polymarket'`, so the client is proxy-ready. **P1** (its empty catch)
must therefore set an error state that is source-agnostic — do not hardcode a
"local markets" message, or it will lie once the proxy serves Polymarket data.
