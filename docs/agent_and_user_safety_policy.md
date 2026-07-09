# Agent & User Safety Policy

What each actor class may do on MetaEdge, and what gates stand between paper
and real money. This encodes the platform's live posture as of 2026-07-08.

## Actor classes & permissions

| Actor | Paper trading | Autonomous (autopilot) | Competitions | Live wallet execution |
|---|---|---|---|---|
| Anonymous visitor | ✅ (pruned after 48h idle) | ❌ (needs created agents) | view only | ❌ |
| Player (claimed profile) | ✅ | ✅ paper-only, capped | ✅ | ❌ globally locked |
| Connected (own wallet) | ✅ | ✅ paper-only, capped | ✅ scored | ❌ unless allowlisted |
| Operator (LIVE_ALLOWLIST wallet) | ✅ | paper-only | ✅ | ✅ with full gate stack |
| Research fleet account | ✅ auto-thesis tagged | ✅ (family cap 5) | not competing (no wallet) | ❌ |

## Live execution gate stack (operator path)

1. Global lock stays OFF; allowlist enables per authenticated wallet address
   only (address read from the user's own mm session — unspoofable via request).
2. Readiness checklist surfaced honestly per account.
3. Canonical-wallet guard: live actions blocked on wallet mismatch (409).
4. MetaMask guard-mode policy + phone approvals above policy limits.
5. Quote-before-execute on swaps/perps/predictions.
6. Every action audit-logged; declines counted.

## Autonomous agent rules

- Autopilot is PAPER-ONLY by architecture. Real autopilot requires per-run
  caps + operator approval and does not exist yet.
- Strategy brains: honest-decline over fabricated lookbacks
  (INSUFFICIENT_HISTORY); position caps (no pyramiding past $2.5k notional);
  balance floors; family concentration cap (5).
- No autonomous strategy mutation once any strategy is live. No leverage
  increases without operator approval.

## Competition rules

- Paper competitions: standings real, funds simulated; faucet-capped.
- QUEUED PRODUCT DECISION (2026-07-08): Arena must not rank by raw PnL alone —
  risk-adjusted/expectancy-aware scoring to be designed before the next
  competition cycle.

## Real-money research rules (from practice, now policy)

- Measurement trades precede strategy trades; every real trade pre-committed
  (thesis, stop, size) and operator-approved; batches supervised; loops never
  hold positions between batches; equity floors armed; fail-closed on any
  anomaly (no blind retries).
