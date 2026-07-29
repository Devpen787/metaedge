# External framework evaluation — read this before proposing another one

Date: 2026-07-16
Status: DECIDED. Do not re-evaluate these without new evidence.
Scope: TradingAgents, QuantAgent, CloddsBot, Freqtrade, Hummingbot, LEAN,
Stable-Baselines3, Gajesh ai-trading-agent.

Each was read directly (repo/docs/paper), not via summary. This record exists so
the same eight projects are not re-litigated every few weeks.

## Verdicts

| Project | Verdict | The deciding fact |
|---|---|---|
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | **Reject as runtime; borrow one idea** | "Two runs of the same ticker and date can differ." Non-deterministic → **cannot be a frozen strategy version**, which our whole lifecycle rests on. Stocks + directional. |
| [QuantAgent](https://arxiv.org/abs/2509.09995) | **Reject** | Reports **predictive accuracy, not post-cost profit; transaction costs never mentioned.** Our power analysis showed accuracy without costs is meaningless (20bps cost wall). Calls itself HFT while running at 1h/4h. |
| [CloddsBot](https://github.com/alsk1992/CloddsBot) | **Reject as code; ADOPT AS A MAP** | Built in **12 days**, "118+ strategies" but ~5 named, **no tests, no reliability or profitability evidence**. BUT its venue list is the most actionable artifact we found — see below. |
| [Freqtrade](https://www.freqtrade.io/) | **Do not migrate** | Mature (backtest/hyperopt/dry-run/FreqAI) but **"no mention of market-making or arbitrage"** — it is a *directional* framework, i.e. a better version of the category we have already exhausted. Its one lesson (exchange-native OHLCV) is already taken (`server/candles.ts`). |
| [Hummingbot](https://hummingbot.org/) | **Adopt later, for ONE thing** | 40+ CEX/DEX connectors, Avellaneda–Stoikov market making. **Profit source is the spread, not prediction** — the only tool here aimed at a category we have never tested. |
| [LEAN](https://github.com/QuantConnect/Lean) | **Defer** | Apache-2.0, multi-asset, event-driven, live brokerage. Correct substrate *if* equities/options become serious. They are not: our 25-name stock sweep (2026-07-15) found **zero survivors**. |
| [Stable-Baselines3](https://stable-baselines3.readthedocs.io/) | **Premature** | Needs a simulator + stable reward/cost model; we have neither. Docs warn reproducibility is not guaranteed across versions/hardware — disqualifying for a system built on deterministic replay. |
| [Gajesh ai-trading-agent](https://github.com/Gajesh2007/ai-trading-agent) | **Reference only** | README: "has not been audited." No backtesting, no paper mode, no risk controls. 3 live agents on $100–200. |

## The finding that actually matters

Our own registry (2026-07-16): **29,718 hypotheses tested.**

```
momentum_breakout 11,009 | rsi_meanrev 5,743 | trend_atr 3,784
vol_squeeze 3,170 | volume_surge 3,168 | meanrev_stab 2,188 | relstrength 373
  = 99.05% directional price prediction
funding_carry 283 (0.95%) — non-predictive — KILLED
```

**99% of thirty thousand experiments asked the single most competitive question in
finance.** Of the ways small operators actually profit — market-making spreads and
rebates, stale prediction-market odds, cross-venue/cross-chain discrepancies,
funding/basis, niche event information — we have meaningfully tested **one**, and
killed it. Five categories: **zero experiments**.

Speed was never the constraint. We were mining one exhausted seam 30,000 times.
Every framework above except Hummingbot is *also* in that seam, which is why
"adopt a framework" would not have helped.

## What the map is worth (CloddsBot)

CloddsBot has no evidence of profitability, but it proves venue access. It lists
**10 prediction-market platforms**: Polymarket, Kalshi, Betfair, Smarkets, Drift,
Opinion.xyz, Predict.fun (trading) + Manifold, Metaculus, PredictIt (data).

That means **the same real-world event is priced simultaneously on several venues**.
If Polymarket says 70% and Kalshi says 64% on the same question, the gap is
**arithmetic, not a forecast** — no prediction required. That single fact hits two
of our five untested categories at once (stale odds, cross-venue discrepancy) and
matches the "too small for big firms to care" profile that is our only real edge.
We already record Polymarket odds and resolutions (`server/scouts.ts`).

## Rules this record sets

1. Do not propose migrating to a directional framework. That category is exhausted
   for us; a better tool for it does not change the answer.
2. Do not adopt anything reporting accuracy without post-cost P&L.
3. Do not adopt anything non-deterministic into the decision path. LLM analysts
   may produce *claims with source IDs* upstream of the numeric gate; they may
   never produce the number or override it.
4. Prefer a new EDGE CATEGORY over a better tool for the old one.
