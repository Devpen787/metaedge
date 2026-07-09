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

## Kill guard — the one autonomous actor (added 2026-07-09)

`server/killguard.ts` runs hourly IN-PROCESS and is the only component permitted to
change agent behavior without a human. It exists because the kill rule previously
lived in a document and `grid` bled 542 trades at −$0.48 before a human noticed.

Bounded by construction:
- **The only mutation it may make is `autopilot = false`.** It can stop a strategy.
  It can never start one, resize one, place a trade, or touch a wallet.
- Fail-safe direction: every action it takes strictly REDUCES activity and risk.
- Scope: paper autopilot only (autopilot is paper-only by architecture).
- Trigger: the shared rule in `server/killrule.mjs` (n ≥ 30 AND (avg PnL < 0 OR
  PF < 1.1)). Same code path as `scripts/kill_check.mjs` — the rule exists once.
- Every kill writes a `CARD_KILLED` audit event naming the family and the reason.
- Idempotent: an already-disabled agent is not re-killed and triggers no write.
- Escape hatch: `KILL_GUARD_ENFORCE=false` downgrades it to warn-only.

Why in-process and not cron: enforcement read-modify-writes `data/db.json`. Node's
single thread makes a synchronous read→write atomic within one process; a cron
script doing the same from a second process would clobber concurrent server writes.
The CLI (`npm run edgeops:killcheck`) is therefore READ-ONLY and exits 1 on violation.

## Competition rules

- Paper competitions: standings real, funds simulated; faucet-capped.
- ACTION ITEM (raised 2026-07-08, reaffirmed 2026-07-09): Arena must not rank by
  raw PnL alone — raw-PnL ranking rewards reckless variance and is a hard
  anti-pattern. Trigger: BEFORE the next competition cycle (NOT mid-flight during
  the Jul 6–12 MetaMask window — changing rules mid-competition is itself unsafe).
  Target scoring: risk-adjusted / expectancy-aware (e.g. penalize drawdown and
  variance, reward hit-rate × payoff). Owner: product-safety role on next card.

## Real-money research rules (from practice, now policy)

- Measurement trades precede strategy trades; every real trade pre-committed
  (thesis, stop, size) and operator-approved; batches supervised; loops never
  hold positions between batches; equity floors armed; fail-closed on any
  anomaly (no blind retries).
