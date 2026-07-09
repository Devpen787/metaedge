# Decision Record: Operating-Model Comprehension Gate — 2026-07-09

Source: Devin's comprehension gate (prove understanding by making correct
decisions under constraints, then enforce it in durable artifacts). This record
is the durable output; the gate prompt is not retained as a standing prompt.

## A. Old failure modes to stop repeating

1. Testing what was convenient (families on hand) instead of the highest-priority question.
2. Building HOW (entry logic) before WHERE/WHEN (tradability selector).
3. Defaulting to 1h candles instead of choosing timeframe from cost + signal half-life.
4. Treating indicators (RSI, breakout, ATR) as strategies rather than features.
5. Calling funding "yield" before modeling hedge/basis/liquidation/counterparty/reversal risk.
6. Producing reports, dashboards, and infrastructure before research artifacts (cards/contracts).
7. Asking "want me to build X?" when the priority is already known.
8. Treating backtest survivors as edges instead of forward-paper candidates.
9. Ranking strategies/competition agents by raw PnL alone.
10. Freezing an 11-token convenience universe and one-asset-per-agent triggering instead of scan-and-select.

## B. Scenario decisions (do / refuse)

- **A (run another RSI/breakout/momentum sweep now):** REFUSE. These families are
  killed OOS and re-sweeping is the "test what's convenient" failure. Do instead:
  work the WHERE/WHEN selector that gates all HOW.
- **B (funding/basis top pool but history missing):** DO write the card + data
  contract and backfill the specific missing series first; REFUSE to backtest or
  claim carry numbers until the contract's fields/units exist. (For our case the
  history already exists — 17,519 rows, 7 coins.)
- **C (OOS PF>2, n=40, no forward paper):** Mark FORWARD-PAPER CANDIDATE and start
  forward paper. REFUSE to promote to live or call it an edge — high PF on low n
  is not a live shortcut.
- **D (vol/volume spike, no thesis, no cost/liquidity check):** Log it as a
  TRADABILITY observation only. REFUSE to trade or card it as edge until a
  participant map + cost/liquidity check exist. Energy ≠ edge.
- **E (positive funding called "yield"):** REFUSE the label. Funding is a payment
  for a hedged balance-sheet service; without spot hedge + basis + liquidation +
  counterparty modeling it is a directional bet in a yield costume (variant A,
  killed). Do: require the full risk model before the word "yield" is used.
- **F (dashboards/reports/scripts but no inventory/contract/card):** STOP building
  infrastructure. DO produce instrument inventory, data contracts, and the card
  template first — research artifacts precede tooling.
- **G (leaderboard ranks by raw PnL):** Flag as a safety anti-pattern; schedule
  risk-adjusted scoring BEFORE the next cycle. REFUSE to change rules mid-flight
  during the live Jul 6–12 window (mid-competition rule changes are their own harm).
- **H (options untradable but expiry/OI affect spot/perp):** Use options data as
  SIGNAL ONLY. REFUSE to ignore it; REFUSE to execute options. Expiry calendar is
  free → expiry-effect cards are testable from price alone.

## C. Correct order of operations

See `docs/trading_research_operating_model.md` (12 gates, each forbidding the
next until complete): 1 instrument mechanics · 2 participant map · 3 opportunity
pool · 4 research card · 5 data contract · 6 WHERE/WHEN selector · 7 HOW
entry/exit · 8 HOW MUCH sizing · 9 backtest · 10 forward paper · 11 tiny live ·
12 scale or kill.

## D. Ranked next actions (by source-of-edge, missing-data, safety, user impact, falsifiability, order-of-ops — NOT ease)

1. **Energy/liquidity/regime selector (WHERE/WHEN).** Directly fixes the #1
   repeated violation (HOW before WHERE/WHEN); step 6 gates every future HOW;
   needs no missing data (vol/volume/funding in hand); highly falsifiable
   (does regime-gating beat always-on OOS/forward?). Highest on 4 of 6 criteria.
2. **Competition scoring + agent safety (raw-PnL reform).** High platform safety
   + user impact, but it is a PRODUCT decision (not a source-of-edge), low
   falsifiability, and correctly scheduled for BEFORE the next cycle (not mid
   Jul 6–12). Runs in parallel; does not gate research.
3. **4h/1d timeframe comparison.** Remediates the 1h-default failure mode; data
   derivable. But it is a HOW-refinement of mostly-killed families — worth doing
   only once a selector says a family is worth re-timing.
4. **Funding/basis backfill.** Largely DONE (17,519 rows); low marginal value.
5. **Short-side strategy family.** A new HOW with no participant map/selector yet
   — premature; would repeat "HOW before WHERE/WHEN".
6. **Strategy taxonomy & data-contract docs.** Being updated by this very gate;
   not a standalone next action.
7. **Another directional indicator sweep.** FORBIDDEN (hard-fail; killed families,
   "test what's convenient"). Ranked last.

## E. Chosen next action and why

**Write the WHERE/WHEN energy/liquidity/regime selector as a research CARD**
(`docs/edgeops/cards/regime-selector-v1.md`) — no code yet, because no-card-no-code
cuts both ways. It is order-of-operations-correct (step 6 gates all downstream
HOW), needs no missing data, is falsifiable against an always-on null, and
remediates the exact failure modes this gate tests (HOW-before-WHERE/WHEN,
volume/vol-as-edge, convenience universe). Chosen over competition scoring
because that is a product-safety task, correctly deferred to before the next
cycle, and separable from the research pipeline.

## ADDENDUM (2026-07-09, later same day): opportunity-screener review

Devin supplied an advisor review arguing the fixed-watchlist/agent-pinned
architecture — not any single strategy — is the next system-level task. Verdict:
ADOPTED with corrections (deep review, not blind).

- ADOPT: screener/selection layer outranks wiring funding-basis B as a bolt-on;
  the review is right that a standalone accrual report would preserve the exact
  architecture I criticized. Cards/contracts before code is honored (its Tasks
  1–4 precede the skeleton in Task 5).
- TRIM: its 9-component build is over-scoped ("infrastructure outruns research").
  Reduced to the minimal five: UniverseProvider · SnapshotStore · Scorer ·
  TriggerEngine · DeclineLogger. AgentAllocator/CandidateQueue deferred until a
  scored candidate needs routing.
- FIX (units): its scoring formulas sum percent + percentile + penalties — the
  funding-units bug class. Hard rule added to scanner contracts: per-term
  normalization declared before any summation.
- FIX (falsifier): "materially better candidate selection" is not measurable.
  Replaced with: scanned selection must beat the fixed-universe always-on baseline
  AND a random-mask control on post-cost forward expectancy; more candidates at
  equal/worse expectancy is a FAIL.
- RECONCILE: the review's "OpportunityScorer" duplicates regime-selector-v1.
  Split: regime-selector = per-asset WHERE/WHEN brain; screener = universe/scan/
  rank/route plumbing that consumes it. No second scorer.
- CONSTRAINT: "scan 40 coins" needs data we don't capture (live funding =
  ETH/BTC/SOL only). Tiers 1–3 defined, unpopulated until capture plumbing lands.
- REFINE: funding-basis B $100 forward accrual is NOT blocked — it must write to
  the shared funding_scanner_snapshot contract, becoming the scanner's first
  consumer instead of a private file.

Artifacts this addendum: opportunity-screener-v1 card, universe_policy.md, four
scanner contracts. Deferred to next increment (NOT batched): architecture doc
(trimmed component set) → read-only skeleton → fixed-vs-scanner comparison report.

## ADDENDUM 2 (2026-07-09): screener built, and it immediately caught a units bug

Third advisor review consumed. Verdict: it was written against an earlier state —
its Tasks 1–3 (card, universe policy, contracts) were already complete. Genuine
catches adopted: the missing 5th contract (`candidate_decline_record`, reconciled
to REUSE `server/declined.ts` rather than spawn a parallel store) and the signal to
stop deferring the skeleton. Held ground on: our measurable falsifier (post-cost
forward expectancy vs baseline + random-mask) over its unmeasurable "materially
better selection quality"; and the 5-active/4-deferred component trim over its 9.

Built: `server/opportunity/{types,universe,snapshot,scorer,scanner}.ts` — read-only,
no execution, nothing becomes a trade. Five-role sign-off recorded on the card,
scoped to the read-only skeleton only.

**Second units defect caught, by running the thing:** Hyperliquid `openInterest` is
in BASE-COIN units, not USD. The scorer percentile-ranked coin counts and placed BTC
(≈$2.38B OI) LAST, behind SOL (≈$412M). Fixed to USD notional (coin × markPx);
ranking inverted back to BTC > ETH > SOL. Contract updated with the trap; rows
lacking markPx now DECLINE instead of scoring absence as low. Evidence:
`docs/edgeops/reports/opportunity-screener-v1-first-read.md`.

**Measured, not assumed:** funding is captured for 3 of 11 symbols; 8 of 8 declines
are NO_FUNDING_DATA. Tier 2 is structurally 8 symbols short. The scanner does NOT
yet beat the fixed watchlist (same universe, falsifier untested) — no victory claimed.

## ADDENDUM 3 (2026-07-09): universe decoupled from the product catalog

Corrected my own sequencing error: I had named "expand funding capture" as next.
Wrong order — that would spend per-coin API budget capturing data for a list we had
just agreed was arbitrary. Universe SELECTION is upstream of data CAPTURE.

**Root cause of the 11-token universe, found:** `server/prices.ts` is the PRODUCT
CATALOG (name/description/marketCap/supply, rendered by TokenMarketChart,
AgentWorkshop, TradingHub). The recorder, autotrader, AND my own new scanner all read
`Object.keys(serverPrices)`. Adding a coin for research required writing marketing
copy, so nobody ever did. Fixed: `server/opportunity/feed.ts` supplies a research feed
(price/volume/range only), criterion-selected, owing nothing to the catalog.

**Criterion set from live data, not assumption** (contract updated): volume floor $50M
+ structural stablecoin test + wash-adjacency (vol/mcap > 0.5) + broken-feed test.
Evidence: SHEB reported $19.6B volume on a $212k market cap (92,283× turnover);
legitimate majors sit at 0.01–0.13×.

**Three defects caught by building and running it:**
1. Hyperliquid `openInterest` is base-coin units, not USD — the scorer ranked BTC
   (≈$2.38B OI) LAST. Fixed to USD notional. Second units bug in this project.
2. A hand-maintained stablecoin denylist missed USDG. Replaced with a structural
   peg+zero-range test, which caught 12 including RLUSD/USDCX/USDCV.
3. A top-40 rank cutoff silently excluded **DOT — our only directional survivor** —
   at rank 52 despite clearing the liquidity floor. Rank is now a fetch bound only.
   MATIC (dead, $0 volume) is correctly dropped while still sitting in the catalog.

**Result:** universe 11 → 41. And the scanner's honest verdict on itself: selection is
fixed, CAPTURE is not. 38/41 decline NO_FUNDING_DATA (funding hardcoded to ETH/BTC/SOL)
and the 30 new coins have zero recorded ticks (recorder still records the catalog), so
they decline INSUFFICIENT_HISTORY permanently. Widening the universe is cosmetic until
capture follows. Evidence: `docs/edgeops/reports/opportunity-screener-v1-first-read.md`.

Scanner still routes no edge; falsifier untested; no victory claimed. Pinned agents stay.

## ADDENDUM 4 (2026-07-09): a cost-model error of my own, corrected

I repeatedly asserted "Hyperliquid funding is per-coin → linear cost," and used it to
justify sequencing and to caution against widening capture. **It is false for the
endpoint that matters.**

- `metaAndAssetCtxs` (LIVE, the call the recorder already makes hourly): ONE request
  returns **all 231 perps** with funding + openInterest + markPx. `recorder.ts:47`
  filters to `['ETH','BTC','SOL']` and discards 228 coins we already fetched.
  Widening live funding capture costs **zero** extra API calls.
- `fundingHistory` (HISTORICAL backfill): genuinely per-coin and paginated. THAT is
  where linear cost lives.

I took a fact about the backfill and applied it to live capture. Corrected in the
funding_scanner_snapshot + metaedge-universe contracts, the screener card, and the
first-read report. Lesson, generalized: **a cost claim must name the endpoint.** An
unexamined cost model produces the same class of wrong decision as an unexamined
timeframe or an unexamined universe — it makes a cheap action look expensive and
silently defers it.

Consequence: the next task (point the recorder at Tier 1) is far cheaper than stated.
The funding half closes 38 of 41 NO_FUNDING_DATA declines by deleting an `if`.

## ADDENDUM 5 (2026-07-09): constraints moved out of documents and into code

Diagnosis: every defect this project has produced is ONE defect repeated — a rule
that lived in a document and therefore constrained nothing.

| What broke | Where the rule lived |
|---|---|
| funding fraction vs percent | markdown |
| open interest coin vs USD | markdown |
| grid/custom_ai ran past the kill bar (~$464 paper loss) | markdown |
| 11-token universe | a hand-typed object |
| 1h timeframe · top-40 rank cutoff | nowhere — assumptions |
| "no backtest without a contract" | markdown |

Also established: MetaEdge's "knowledge graph" (`server/graph.ts`) is a UI
projection of users/rooms/agents. Its 256 events are logins and metamask_checks.
It holds ZERO trading knowledge — no hypotheses, contracts, or kill rules. The
real KG lives in AutoBots and governs the agent fleet, not trading research.

**Fixed this turn (money-protecting, in priority order):**
1. `server/units.mjs` — single source of truth for unit conversions. The funding
   annualization was re-derived in FOUR places (snapshot.ts, funding_watch.mjs,
   funding_study.mjs ×2); now ONE. Plain `.mjs` so the TS server (allowJs) and the
   `.mjs` scripts share one implementation. Verified: both runtimes agree (10.9%
   APR), and the scanner's output is unchanged (BTC $2.38B > ETH > SOL).
2. `scripts/kill_check.mjs` — the survivor bar as an executable, exit-1-on-violation
   check with a pure `evaluateKill()` and a `--selftest` that replays grid (n=542)
   and custom_ai (n=268) and asserts KILL. It fires. 5/5 cases pass.

**Not yet done, stated plainly:** kill_check exists but nothing RUNS it — it is not
wired into cron or the deploy gate. An unenforced enforcer is the same bug one level
up. Also unbuilt: the "no backtest without a contract" preflight.

**Sequenced next, not now:** a knowledge graph linking card → contract → dataset →
result → kill decision, enabling "which hypotheses does this contract change
invalidate?" Real value, but third — a graph over unenforced rules would only let us
traverse our violations more elegantly.

## ADDENDUM 6 (2026-07-09): the enforcer is now enforced

Addendum 5 closed with an honest gap: `kill_check.mjs` existed but nothing ran it —
"an unenforced enforcer is the same bug one level up." Closed.

- `server/killrule.mjs` — the survivor bar, defined ONCE. Imported by both the CLI
  report and the in-process guard. Neither re-implements it (verified: `MIN_PROFIT_FACTOR`
  is declared in exactly one file).
- `server/killguard.ts` — hourly in-process guard, wired into `server.ts` startup.
- `npm run edgeops:killcheck` (read-only, exit 1) · `edgeops:killrule:selftest`.

**Design decision — why in-process, not cron.** Enforcement must read-modify-write
`db.json`. Node's single thread makes that atomic within ONE process; a cron script
doing it from a second process would clobber concurrent server writes. So the CLI is
read-only and only the server mutates. This is the concurrency invariant from the
data review, respected rather than violated.

**Fail-safe invariant:** the guard's only permitted mutation is `autopilot = false`.
It can stop a strategy; it can never start one, resize one, trade, or touch a wallet.
Every action strictly reduces risk. Logged in the safety policy as the system's ONLY
autonomous actor.

**Verified by driving it, not by typechecking it** (scratch DB, prod untouched):
- bleeding family (n=40, −$0.50/trade) → autopilot disabled, `CARD_KILLED` audit written
- healthy family (n=40, PF 1.5) → untouched
- open position (no realized pnl) → correctly ignored
- second run → `disabled: 0`, no duplicate audit, no write (idempotent)
- `KILL_GUARD_ENFORCE=false` → violation logged, nothing disabled
- full server boot → `[killguard] armed`, violation caught on the first tick

Remaining gap, stated plainly: the "no backtest without a data contract" preflight is
still unbuilt. And the guard has never run against the PRODUCTION database.

## F. Mandatory from this date (unchanged, reaffirmed)

No strategy code without a card. No backtest without a data contract. Timeframe
and universe are decisions, not defaults. Survivor ≠ edge ≠ live. Every research
response ends with the required six-line footer.
