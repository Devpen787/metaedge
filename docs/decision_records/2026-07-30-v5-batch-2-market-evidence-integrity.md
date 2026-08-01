# V5 Batch 2: Market Evidence Integrity

Date: 2026-07-30
Status: implemented and locally verified; not committed or deployed
Money boundary: paper only; live execution remains locked
Runtime boundary: production coverage and freshness acceptance remain unproven

## Batch decision

Universe selection, market recording, feature construction, and strategy
arming must use one provenance-bearing market-data authority.

This batch closes three coupled failures:

1. display-only price jitter could enter research history;
2. Tier-1 decisions could request symbols the recorder never captured;
3. missing feature coverage appeared repeatedly at runtime without one visible
   arming matrix.

## MarketObservationV5

Canonical price lookup now returns `market-observation.v5` objects containing:

- symbol and market values;
- provider, venue, and dataset;
- observed and received timestamps;
- observed-versus-seed provenance;
- a SHA-256 observation hash.

Long-tail prices retain the venue selected by the broad feed. Tier-1 feature
packets use the coherent CoinGecko universe row for price, change, volume,
high, and low rather than silently mixing one live venue price with unrelated
snapshot fields.

The paper broker may still choose a fresher canonical execution observation,
but that fill cannot rewrite the source cited by the research decision.

## Display separation

`serverPrices` and the observation registry are canonical market state.

The animated UI price projection now lives in a separate `displayPrices`
object. Jitter changes only the API display payload. It cannot mutate:

- canonical price;
- canonical high or low;
- observation hash;
- recorder input;
- decision features.

Seed values remain explicitly labeled `seed`; the recorder treats them as
missing evidence rather than an observed market tick.

## UniverseVersionV5 and recording

Every resolved Tier-1 membership becomes a persistent
`universe-version.v5` record with:

- sorted symbol membership and membership hash;
- source and observation time;
- `do_not_fill` gap policy;
- `preserve_and_flag` cross-venue policy.

The recorder captures only the active universe version. It writes the full
observation, its universe ID, and compatibility aliases to append-only daily
JSONL. Missing, seed-only, and stale observations produce explicit
`market-gap.v5` rows.

Repeated recorder ticks with an unchanged observation hash are not
pseudo-replicated.

On restart, hourly bars are reconstructed from persisted v5 rows. A row whose
payload no longer matches its observation hash is rejected.

## Settled daily evidence

The daily roll no longer updates only process memory. A completed UTC day is
written as `daily-bar.v5` with:

- close and 24-hour volume;
- source provider and venue;
- source observation hash;
- observed and received timestamps;
- explicit gap and cross-venue policies;
- its own SHA-256 bar hash.

Restart reconstruction merges valid persisted daily bars with the historical
bootstrap without filling missing days. Tampered daily rows are ignored rather
than repaired or rewritten.

## Coverage and arming

Each decision cycle persists a `market-coverage-matrix.v5` keyed by frozen
strategy hash and symbol.

The matrix lists:

- required features;
- good features;
- missing or stale features;
- explicit `armed` state;
- aggregate ready/total counts and coverage percentage.

An autopilot strategy-symbol pair with incomplete required evidence is not
armed for routing. The cycle remains operational, and the missing coverage is
visible through the existing research operator endpoint rather than becoming
an unexplained runtime failure.

Research evaluations still record their normal data-quality decline so the
absence remains part of the evidence history.

## Local proof

Focused tests prove:

- UI display projection cannot mutate canonical evidence;
- a long-tail observation cites its actual broad-feed venue;
- the recorder captures exactly the active universe;
- missing symbols generate explicit gap evidence;
- unchanged observations are not duplicated;
- restart reconstructs hourly evidence;
- a tampered observation is not reconstructed;
- incomplete required features produce `armed: false`;
- coverage matrices persist;
- settled daily bars persist provenance and reconstruct after memory reset.

Complete local verification:

- `npm run test:decision` — 31 passed, 0 failed;
- `npm run test:discovery` — 157 passed, 0 failed;
- `npm run lint` — passed;
- `npm run build` — passed.

The production build retains its pre-existing frontend chunk-size warning.

## Explicit remaining boundary

This batch does not prove:

- the production requirement that at least 99% of armed evaluations have all
  fresh required features;
- that the hosted recorder has accumulated 200 hourly or daily observations
  for every intended family and symbol;
- exchange-grade OHLC, bid/ask, depth, sequence numbers, or correction feeds;
- one-venue continuity across historical bootstrap and forward observation;
- Postgres-backed immutable market-event tables;
- signed position lots or realistic partial-fill brokerage;
- profitability, live-money readiness, deployment, or hosted adoption.

Those are runtime/evidence or later-batch gates, not inferred from passing
local tests.
