# V5 Slice 01: Fail-Closed Durable Database Writes

Date: 2026-07-30
Status: implemented and locally verified; not committed or deployed
Money boundary: paper only; live execution unchanged and locked
Scope: canonical flat-file persistence only

## Decision

A canonical state mutation is successful only after:

1. the complete database state is serialized;
2. a unique staging file is written and `fsync`ed;
3. the staging file is atomically renamed over the canonical database;
4. the parent directory is `fsync`ed so the rename is durable.

`writeDatabase` now returns a `DatabaseCommitReceipt` only after all four
stages complete.

Any failure throws `DatabaseWriteError` with:

- `not_committed` when the canonical rename did not occur;
- `possibly_committed` when the rename occurred but final durability
  acknowledgement failed.

The write path no longer logs an error and returns normally.

## Cache invariant

`readDatabase` returns a cached mutable object. Callers normally mutate that
object immediately before writing it.

On any failed write, the cache is now invalidated. The next read must reload
the durable file, so an uncommitted mutation cannot remain visible merely
because it still exists in the old cached object.

The failed staging file is removed when it exists.

## Initialization invariant

Creating a missing canonical database now uses the same durable write path.

If initial creation fails, `readDatabase` throws the write error. It cannot
return a temporary in-memory product state that later appears persistent.

## Verification

New tests prove:

- a successful write returns file-and-directory durability acknowledgement;
- a serialization failure throws rather than returning success;
- the durable file is unchanged after a pre-rename failure;
- failed staging files are removed;
- cached uncommitted mutations disappear on the next read;
- `placePaperTrade` cannot report success when its canonical database commit
  fails;
- the paper balance and trade count remain at their durable values after that
  failed commit.

Verification commands:

- `npm run test:decision` — 20 passed, 0 failed
- `npm run test:discovery` — 157 passed, 0 failed
- `npm run lint` — passed
- `npm run build` — passed

The build retains its pre-existing frontend chunk-size warning.

## Explicit remaining boundary

This slice does not make order intents durable.

The failed-trade test intentionally shows the current secure-core audit
messages `CREATE_ORDER_INTENT` and `EXECUTE_ORDER_INTENT` before the canonical
database commit fails. Those intent and audit stores remain in memory.

Therefore the next v5 slice is:

- persistent idempotency keys;
- durable order intents and ordered events;
- a commit-aware intent state such as `unresolved`;
- restart reconciliation;
- one canonical audit lineage.

No production data, strategy behavior, paper balance, deployment, or live
execution setting was changed by this slice.
