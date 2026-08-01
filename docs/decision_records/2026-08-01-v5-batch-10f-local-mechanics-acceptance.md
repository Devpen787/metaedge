# V5 batch 10F — local mechanics acceptance

Date: 2026-08-01
Status: `go_local_paper_operation` earned in an isolated packet; not deployed
Database: `/tmp/metaedge-v5-resilience.zft5L2/db.json`
Money boundary: paper only; live execution locked

## Five changes in this batch

1. Added a canonical portfolio-cap scenario: an accepted $1,800 reservation
   consumed BTC-symbol capacity, then the allocator denied a separate $300
   challenger with `PORTFOLIO_SYMBOL_CAP` and zero authorized notional.
2. Added a hashed portfolio-veto assurance record that binds the decision,
   reservation, risk snapshot, frozen policy, and every veto reason.
3. Hardened the acceptance gate so an arbitrary rejected allocator row cannot
   count as a veto without that exact linked assurance record.
4. Hardened lifecycle reactivation so the same experiment must move from
   `regime_ineligible`/dormant to `regime_eligible`/probation after its declared
   six-hour dwell, with both event IDs bound by assurance.
5. Added one bounded command, `npm run v5:local-acceptance`, that runs all seven
   cross-process assurance scenarios, ten continuous cycles, UI/ledger parity,
   and the final machine assessment against a fresh isolated database.

## Exact new evidence

Portfolio veto:

- assurance: `population_assurance_v5_bb8c471aa3a21966b5916e5e`;
- decision: `portfolio_decision_v5_fbb4a72d6b0505f06498ef63`;
- reservation: `portfolio_res_v5_73594a8b65d60ecd7738f016`;
- snapshot: `17d6f54a3c829574ae7d64cff7abd309a96dcd5c7d8498a402dc25806105b230`;
- policy: `54734e73f22f23a46b81762506b13ac8eefc741997f1f6327cb22da2d82c4595`;
- reason: `PORTFOLIO_SYMBOL_CAP`.

Lifecycle reactivation:

- assurance: `population_assurance_v5_d56ab8342e1303394a02525f`;
- experiment: `exp_v5_fa722d6f0fb1ccecb112`;
- ineligible event: `lifecycle_v5_resilience_ineligible`;
- later eligible event: `lifecycle_v5_resilience_eligible`.

## Acceptance result

- verdict: `go_local_paper_operation`;
- 7/7 linked resilience scenarios;
- 7 valid assurance records;
- 10/10 distinct clean cycles;
- 5,418 strategy/symbol evaluations;
- 14 registered and visible V5 families;
- exact 2/2 assurance-fixture trade/UI parity;
- all eleven acceptance evidence fields true;
- zero acceptance reasons;
- live execution locked.

## Boundary

This is a GO for isolated local paper mechanics only. It is not evidence of a
profitable strategy, organic market execution, production scheduling,
deployment readiness, public reachability, or live-money authorization. The
two trades are controlled assurance fixtures and the ten market cycles routed
zero organic intents in this window.

## Fresh regression proof

- `npm run v5:local-acceptance` — exit 0, local mechanics GO;
- `npm run test:decision` — 72/72 passed;
- `npm run test:discovery` — 158/158 passed;
- `npm run lint` — exit 0;
- `npm run build` — exit 0, with only the existing large-chunk advisory;
- `git diff --check` — exit 0.
