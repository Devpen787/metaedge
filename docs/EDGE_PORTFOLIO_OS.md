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

## The five lanes — honest status (2026-07-14)

Each lane keeps its OWN mechanism and proof standard. A lane is not "real" until
it records its own data, validates on its own terms, and routes to its own paper
ledger. Data has lead time; strategy code does not — so recorders start long
before strategies.

| Lane | Status today | First result comes from |
|---|---|---|
| **1. Spot / tokens** | **Live, has candidates.** 3 survivors from the 37-coin sweep. | Encode + validate + route the 3 survivors. Days. |
| **2. Perps** | Data live (232 mkts). No tenant — carry killed twice. | A NEW perp hypothesis that clears the bar. Not yet. |
| **3. Predictions** | Feed exists (Polymarket), **not recorded**. | Start the odds recorder now → calibration scan in weeks. |
| **4. Cross-chain arb** | Quote path exists, **nothing recorded**. | Start the quote recorder now → net-of-cost scan in weeks. |
| **5. Quant / meta** | Embryonic (registry + sweep). | Downstream — needs ≥2 lanes producing candidates. |

The trap to avoid is building five platforms. We build five **minimal vertical
slices**, and only Lane 1 can produce a trading result soon. Lanes 3–4 produce
their first result only after their recorders have run for weeks — which is
exactly why they start recording **now**, in parallel, even though their
strategies come later.

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
