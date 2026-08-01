# V5 Batch 1: Durable Order Safety and Exact Exit Cleanup

Date: 2026-07-30
Status: implemented and locally verified; not committed or deployed
Money boundary: paper only; live execution remains locked
Storage boundary: canonical local database; this is not the planned Postgres migration

## Batch decision

This batch closes four coupled P0 failure modes before strategy breadth work:

1. durable v5 order intent, nonce, event, and audit authority;
2. fail-closed, commit-aware paper execution and startup reconciliation;
3. position-aware risk reductions that do not require new entry cash;
4. exact Golden Cross stop cleanup keyed by both agent and symbol.

The batch does not make Golden Cross the preferred trading strategy. It fixes a
shared execution/risk defect exposed by a multi-symbol strategy.

## Durable order lifecycle

Every accepted paper-order attempt now begins with a persisted
`order-intent.v5` record. Its idempotency key is scoped to the authenticated
user and caller nonce. The deterministic intent ID and durable nonce index
survive process restart.

The canonical lifecycle is:

`PENDING -> RISK_ACCEPTED -> EXECUTED`

or:

`PENDING -> REJECTED`

Any execution state whose durable outcome cannot be established becomes:

`UNRESOLVED`

Each transition appends an ordered `order-event.v5` record with a monotonic
per-intent sequence and content hash. Order lifecycle audit records are stored
in the persistent product audit ledger rather than the prior process-memory
order logger.

The final `EXECUTED` event, paper trade, balance mutation, strategy-agent
timestamp, product audit, and graph event share one canonical database write.
The API returns success only after that write acknowledges durability.

## Restart reconciliation

Before autonomous trading loops start, the server inspects all v5 intents:

- a nonterminal intent with a matching durable trade is recovered as
  `EXECUTED`;
- a nonterminal intent without a matching durable trade is marked
  `UNRESOLVED` and is not automatically retried;
- an `EXECUTED` intent whose trade is missing or has mismatched lineage is
  marked `UNRESOLVED`;
- terminal `REJECTED` and already `UNRESOLVED` records are preserved.

Server startup fails closed if this reconciliation cannot read or write the
canonical state.

## Exit-safe risk

Risk evaluation now receives the position effect and available position size
before applying entry-margin rules.

- increasing exposure still requires sufficient paper balance;
- reducing exposure does not require new entry cash;
- a reduction with no position is rejected;
- an over-reduction is rejected rather than silently opening or flipping.

This is the first V5-03 slice. It does not yet implement signed position lots,
short-lot accounting, funding, or a full flip lifecycle.

## Golden Cross cleanup

Risk-OS now records a successful stop exit as `agentId:symbol`. Cleanup removes
trailing state and applies cooldown only for that exact successful breach.

If BTC exits successfully while ETH fails for the same multi-symbol agent, the
ETH protective state remains in place.

The master plan's later lot identity remains stronger:

`experimentId + accountId + symbol + positionLotId`

That identity requires the signed-lot work and is not claimed by this batch.

## Verification

Focused regression proof:

- durable idempotency rejects the same nonce after a forced database reread;
- order events persist in the expected sequence;
- a zero-cash spot account can close an existing position;
- a reduction larger than the position is rejected;
- a failed canonical trade commit cannot return success;
- risk rejection and unresolved state survive;
- startup reconciliation recovers a durable trade and quarantines a stranded
  intent;
- cleanup distinguishes two symbols controlled by the same Golden Cross agent.

Final local verification:

- `npm run test:decision` — 26 passed, 0 failed;
- `npm run test:discovery` — 157 passed, 0 failed;
- `npm run lint` — passed;
- `npm run build` — passed.

The production build retains its pre-existing frontend chunk-size warning.

## Explicit remaining boundary

This batch does not provide:

- Postgres tables or database-enforced uniqueness under multiple processes;
- immutable event rows independent of the current whole-state JSON document;
- signed position lots, short/flip accounting, or per-lot P&L reconciliation;
- partial fills, venue rejects, cancellation, expiry, or realistic latency;
- continuous external-venue reconciliation;
- experiment/opportunity/outcome lineage on every order;
- deployment or hosted production verification;
- evidence of profitability or readiness for live money.

The next implementation batch should address one coherent remaining authority
boundary, beginning with market-evidence integrity or signed position lots,
without adding strategy-specific bypasses.
