# Edge Portfolio OS — the operating program

> Canonical. This document is the single source of truth for what the trading
> system is trying to become and how work advances. It exists to stop the loop
> Devin named on 2026-07-14 ("we already had these conversations"). Strategy is
> not re-litigated per conversation. Candidates move through a fixed lifecycle;
> the only thing that interrupts the lifecycle is evidence that the machinery
> itself is wrong.

## The one rule

Every trading idea, in every market, moves through the same six states and
nothing skips a state:

```
observed → hypothesis → historically screened → forward-paper candidate
        → paper active → promoted OR killed
```

- **observed** — a scanner/recorder saw a condition worth a hypothesis.
- **hypothesis** — a falsifiable mechanism with a pre-committed falsifier.
- **historically screened** — survived walk-forward out-of-sample + cost stress.
- **forward-paper candidate** — has a passing validation record; may be routed.
- **paper active** — an opted-in paper agent is trading it; P&L accrues.
- **promoted / killed** — kill rule fires, or it earns a larger risk budget.

Nothing gets real money for looking promising. Each idea earns each state on its
own evidence. "No trade" and "killed" are valid, expected outputs.

## The engine that runs it (already built)

`server/decision/` is the shared spine. Every 5 minutes it evaluates each
strategy plugin across the criterion-selected universe through ordered,
veto-capable gates (data quality → universe → liquidity → regime → cost → risk →
portfolio), and writes exactly one outcome per evaluation: `decline`,
`research_hypothesis`, or `paper_trade_candidate`. Only a candidate whose frozen
strategy spec has a **passing validation record** may route, and it may route
**only** to an existing, owner-created, opted-in paper agent. Live execution is
locked and not imported here. Status: `GET /api/decision-runtime`.

This is the factory. It runs now. What it needs is **tenants** (validated
strategies) and **somewhere to route** (paper agents). That is the work below.

## Parallel scouts — turn on every market at once (updated 2026-07-15)

The circle was caused by doing markets sequentially. The fix: a **data scout for
every market runs in parallel from now**, because data has lead time and nothing
can be researched until it is recorded. "Scouting a market" (recording its data)
is cheap and parallelizable today; "making money from it" (a validated strategy)
is earned per market and cannot be rushed. Do all the scouting now; let strategies
emerge from whichever scout's data proves an edge.

| Lane | Scout (recording) | Strategy status |
|---|---|---|
| **1. Crypto spot / memecoins** | ✅ live (recorder + 37-coin backfill) | 3 sweep candidates; need faithful encoding + forward paper |
| **2. Crypto perps** | ✅ live (232 HL markets: funding/OI) | No tenant — carry killed twice; awaiting a new hypothesis |
| **3. Stocks / ETFs** | ✅ live (Yahoo, 25 names × 10y daily) | Swept 2026-07-15 → **none survived** (efficient market; simple templates find nothing after costs) |
| **4. Prediction markets** | ✅ live (Polymarket hourly scout) | Needs weeks of odds history → calibration/mispricing study |
| **5. Cross-chain arbitrage** | ⏸ blocked: executable quotes need wallet/venue access | Deferred until a quote source exists (not a candle backtest) |
| **6. Options** | ⏸ blocked: no cheap quality feed (chains/IV/greeks) | Deferred — recording it would be theatre |
| **7. Quant / meta** | derived from lanes 1–4 | Downstream — needs ≥2 lanes producing candidates |

Honest calibration: five of seven lanes are recording or verdicted **today**.
Cross-chain and options are paused for a *stated data reason*, not neglect — the
moment a free/authorized quote or options feed exists, they follow the same
scout-then-strategy pattern. Stocks producing "no survivors" is itself a result:
we ran a new asset class at full rigor and it honestly said "no edge with these
tools yet," which is the machine working.

## The scoreboard (the machine is legible or it isn't)

One fixed set of counters, generated from the decision store + registry + paper
ledgers, never hand-maintained:

```
observed        hypotheses generated     candidates passing historical tests
active paper    post-cost paper P&L      max drawdown
killed          promoted                 cross-lane correlation
```

If a number can't be produced from stored state, that capability isn't real yet.

## Immediate execution queue

Ordered. Each item names its result.

1. **Remove `deterministic_composite`.** It trades a blended score (violates the
   decision record's R3) and duplicates `rsi_mean_reversion`'s exposure. Result:
   the engine only runs real mechanisms.
2. **Scoreboard.** `npm run scoreboard` + extend `/api/decision-runtime`. Result:
   progress becomes numbers, not vibes.
3. **Lane 1 tenants.** Encode `meanrev_stab` + `vol_squeeze` plugins; validate
   DOT/rsi, ZEC/meanrev_stab, PAXG/vol_squeeze on the backfill data. Result: 3
   strategies flip from hypothesis → validated candidate.
4. **Lane 1 paper agents.** Create 3 opted-in paper agents (one per survivor).
   Result: the runtime routes real paper trades; **P&L starts accruing.** This is
   the first "producing results" milestone. (Requires Devin's go — the runtime
   refuses to fabricate agents by design.)
5. **Lane 3 recorder.** Persist Polymarket odds hourly. Result: the calibration
   clock starts.
6. **Lane 4 recorder.** Persist synchronized swap quotes + net-of-cost check.
   Result: the arbitrage-executability clock starts.

Lanes 2 and 5 have no queued build — they wait for a tenant and for upstream
candidates respectively. That waiting is correct, not neglect.

## What "done" looks like

Four market-specific paper money-engines plus one cross-market quant engine, each
with its own spec / validation / paper ledger / risk budget / attribution / kill
rule / correlation record, all competing for paper capital through this one
spine, with the scoreboard showing what's alive, what it's made after costs, and
what's been killed. Some lanes may produce nothing and be shut — that is a result,
not a failure.
