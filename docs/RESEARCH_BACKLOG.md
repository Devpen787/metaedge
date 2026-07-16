# Research backlog — ranked by "could this actually make money"

Date: 2026-07-16. Companion to [EDGE_PORTFOLIO_OS.md](EDGE_PORTFOLIO_OS.md)
(the lifecycle) and
[the framework evaluation](decision_records/2026-07-16-external-framework-evaluation.md)
(what we already assessed and rejected).

**The ranking principle.** Our registry says 99.05% of 29,718 hypotheses asked one
question — "which way will price move?" — the most competitive question in finance.
Of the five other ways small operators actually profit, we have run **zero**
experiments. So a NEW EDGE CATEGORY outranks a better tool for the old one, every
time. Sorted accordingly, not by effort.

---

## Tier 1 — untested edge categories (where the money plausibly is)

**1. Cross-venue prediction-market spread — DO THIS FIRST**
The same event is priced on Polymarket, Kalshi, Betfair, Smarkets
(venue list courtesy of CloddsBot). If one says 70% and another 64%, the gap is
*arithmetic, not a forecast*. No prediction, no wallet, no exchange integration —
Kalshi has a public API and we already record Polymarket odds + resolutions
(`server/scouts.ts`). Hits two untested categories at once (stale odds,
cross-venue discrepancy) and fits the "too small for big firms to care" profile
that is our only structural advantage.
*Next step:* add a Kalshi odds scout; join on event; log the spread over time.

**2. Prediction-market calibration**
When the crowd says 70%, does it happen 70% of the time? A systematic bias in any
slice (long-dated, low-liquidity, specific categories) is an edge that needs no
price forecast. Data is accruing now; needs resolved markets to mature.

**3. Market making / spread capture**
The Hummingbot category (Avellaneda–Stoikov, 40+ connectors). Profit source is the
spread, not direction. Strongest evidence base of any untested category; also the
biggest build (real connectors, inventory risk, adverse selection).

**4. Cross-chain / cross-venue price gaps**
Blocked on executable quotes (needs wallet/venue access). Do not model it from
candles — an arbitrage that disappears after gas, slippage and latency is not an
arbitrage.

**5. Funding / basis** — CLOSED. Per-coin timed and cross-sectional both killed on
2y data (~3% APR on capital vs a 5% floor). Re-open only on a regime change: the
`funding_carry` plugin wakes at ≥20% APR, well above the 10–14% that killed it.

---

## Tier 2 — take the human out of the loop

**6. Nightly unattended sweeps.** Devin should not be the scheduler. New coins and
new data should produce new candidates without anyone asking.

**7. Auto-retirement.** The kill rule exists in code (`server/killrule.mjs`) but
nothing wires it to stop a dead forward trial. Promotion is automatic; retirement
is not. That asymmetry accumulates zombies.

**8. Auto-widen the universe.** The universe is criterion-derived
(`scripts/lib/universe.mjs`), but nothing re-runs it as new liquid names appear.
The hardcoded-coin-list disease was fixed in four places; this is where it regrows.

*(Done 2026-07-16: auto-promotion — the sweep writes `data/edgeops/survivors.jsonl`
and `forward_paper.mjs` queries it, so survivors arm their own trials. Previously
the last step was a human reading a markdown bullet and retyping params: ~30k
hypotheses screened, zero ever reached a trial unattended.)*

---

## Tier 3 — borrow, do not migrate

**9. News/sentiment analysts upstream of the gate.** TradingAgents' one good idea:
independently prompted analysts emitting *claims with source IDs and falsifiers*.
They may never produce the number or override the numeric gate — they are
non-deterministic, and a frozen strategy version cannot be.

**10. LEAN** — only if equities/options become serious. They are not: the 25-name
stock sweep found zero survivors.

**11. Stable-Baselines3 / RL** — only after a realistic simulator and a stable
reward/cost model exist. Both absent.

---

## Tier 4 — hygiene and known debt

**12. Deploy properly.** Build on the Mac, ship the artifact. The e2-micro cannot
compile the front-end (bus error / OOM) and must never run the research engines
(see [[metaedge-vm-capacity]]): they starve the web server to 48s responses.

**13. Replace growing JSONL scans** with a partitioned analytical store — research
re-reads whole ledgers per query (Codex's finding).

**14. Sampled-OHLC seam.** `server/recorder.ts` samples every 60s, so its
highs/lows are approximations; exchange candles have true extremes. Strategies
using highs/lows (ZEC, PAXG) must be judged on forward paper from a single
consistent source — never assume kline-backtest fills reproduce.

**15. One integration boundary** between the `metaedge-gemini` research factory
and the Python MetaEdge product. Currently two unconnected systems.

---

## Live forward trials (state as of 2026-07-16)

| Trial | Screened bar it must reproduce | Status |
|---|---|---|
| DOT `rsi_meanrev` | n=41, PF 2.13, +0.79%/trade | armed, no signal yet |
| ZEC `meanrev_stab` | n=68, PF 2.14, +2.93%/trade | armed, no signal yet |
| PAXG `vol_squeeze` | n=37, PF 2.15, +0.52%/trade | armed, no signal yet |

`npm run forward:paper` — armed automatically from the survivor ledger.
Caveat on record: DOT passes the sweep's post-train windows (t≥2) but fails the
validator's full-history run (t=1.25, n=54) — a **regime-dependence warning**, not
a bug. Forward evidence is the only thing that settles it.
