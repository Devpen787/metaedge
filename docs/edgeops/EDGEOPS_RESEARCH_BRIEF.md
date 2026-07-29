# MetaEdge EdgeOps Research Brief

Date: 2026-07-07

## Boundary

MetaEdge is a paper-first trading room. This brief is not trading advice and
does not claim profitability, alpha, or live-readiness. It defines how MetaEdge
should learn from paper trades without confusing polished agent behavior,
backtests, or dashboards with proven edge.

## Current MetaEdge Truth

- The arena is explicitly paper-only on hosted production: simulated fills, real
  market prices, and live execution globally disabled. Source:
  `docs/AGENTS.md`.
- The paper trade path is real product infrastructure. `server/trades.ts`
  validates ownership, uses server-side prices when available, runs risk checks,
  writes trades, records audit events, and computes realized P&L from cost basis.
- Autopilot is real paper execution infrastructure, but its strategy brain is
  deliberately simple. `server/autotrader.ts` reacts mostly to 24h percentage
  change; `custom_ai` includes random exploration.
- Quant Engine has real indicator math and a real backtest endpoint. It uses 100
  daily Binance candles, parameter optimization on the first 70%, out-of-sample
  judgment on the last 30%, and per-fill fee/slippage cost.
- Quant Engine alternative-data toggles are not live feeds. `server/quant.ts`
  labels them simulated and prevents them from affecting the score.
- The current UI has a cosmetic "Deploy to Agent" button in
  `src/components/QuantEngine.tsx`; it changes button text/classes but does not
  write a strategy to an agent.

## What Prior Research Says

### Backtests are a weak claim unless aggressively disciplined.

Bailey, Borwein, Lopez de Prado, and Zhu's "The Probability of Backtest
Overfitting" argues that common holdout methods are unreliable for investment
simulations and proposes PBO/CSCV to estimate overfitting risk.

Source: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253

The Deflated Sharpe Ratio exists because selection bias, multiple testing, and
non-normal returns can inflate Sharpe. MetaEdge should never treat "high Sharpe
on the best parameter sweep" as a strategy claim without reporting how many
trials were tested and how the result survived out-of-sample or walk-forward
validation.

Source: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551

### Trading agents need reproducible tasks, baselines, and friction.

The FinRL benchmark work says financial RL is challenged by non-stationarity,
low signal-to-noise, and market frictions, and that standardized task
definitions, datasets, environments, and baselines are required for reproducible
comparison.

Source: https://arxiv.org/html/2504.02281v3

MetaEdge implication: agent competitions should include benchmark agents,
random-entry baselines, costs, and regime tags. Leaderboard rank alone is not
edge evidence.

### Sentiment matters, but it is adversarial.

Crypto sentiment and social attention can move prices, but Twitter/X and
Telegram/Discord data are also manipulation surfaces. Research on crypto
pump-and-dumps documents thousands of pumps across Discord and Telegram, and
research on Twitter promotion around pump events finds that social promotion can
attract attention before the dump and leave delayed sellers with losses.

Sources:
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3303365
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4703467

MetaEdge implication: sentiment is not a buy signal. It is an attention signal
that needs source reputation, timing, liquidity confirmation, and manipulation
disqualifiers.

### Fake volume and liquidity distort signal quality.

Recent wash-trading research finds volatility and public sentiment can be
significant determinants of wash trading and that exchanges may capitalize on
volatile conditions to increase fake volume.

Source: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4971590

Order-book liquidity research shows intraday liquidity and order-book variation
directly affect trading P&L and can inform timing through liquidity-dependent
cost minimization.

Source: https://www.mdpi.com/1911-8074/18/3/124

MetaEdge implication: volume spikes should be tagged suspicious until confirmed
by spread, depth, exchange quality, and independent catalyst evidence.

### Microstructure signals are useful but regime-dependent.

Crypto microstructure research highlights order-flow imbalance, spreads, and
VWAP deviations as predictive features, while warning that wide-spread regimes
can make maker/taker decisions and adverse selection dominate outcomes.

Source: https://arxiv.org/abs/2602.00776

MetaEdge implication: EdgeOps should treat spread/depth/imbalance as risk gates
before treating technical indicators as entry triggers.

### Catalyst studies need event-study discipline.

Crypto event-study work emphasizes expected-return models, abnormal returns, and
asset-specific volatility. Token unlock studies and event research suggest some
catalysts can be studied, but the effect is conditional and should not be
converted into universal rules.

Sources:
- https://www.brattle.com/wp-content/uploads/2023/07/How-Event-Studies-Can-Be-Applied-to-Crypto-Markets.pdf
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6632838

MetaEdge implication: catalysts should become tagged events with before/after
windows and benchmark returns, not free-text justifications after the trade.

### Forum failure stories are useful as warnings, not proof.

Experienced bot builders repeatedly cite the same failure modes: hidden
backtest assumptions, regime instability, perfect-fill assumptions, live/offline
parity gaps, partial fills, latency, and over-optimized parameter searches.

Sources:
- https://www.reddit.com/r/algotrading/comments/1q4gpu1/is_overfitting_the_1_reason_most_backtested/
- https://www.reddit.com/r/algotrading/comments/1sd9hlj/followup_tested_every_suggestion_from_my_last/

MetaEdge implication: Reddit/X/forum material should create research questions
and disqualifiers. It should not become product truth unless corroborated by
paper-forward results or stronger sources.

## Signal Families Worth Testing First

1. Regime filter: trend/range/high-vol/low-vol using realized volatility,
   moving-average slope, ATR, and drawdown state.
2. Technical trigger: SMA/EMA cross, RSI reclaim/rejection, MACD histogram
   transition, Bollinger Band width expansion, ADX trend strength.
3. Liquidity gate: spread, depth, volume z-score, exchange quality, slippage
   estimate, VWAP deviation.
4. Catalyst tag: listing, unlock, governance, exploit, macro/FOMC/CPI, ETF flow,
   major protocol upgrade.
5. Sentiment/attention tag: source reputation, velocity, organic vs coordinated
   promotion, bot/influencer concentration.
6. Manipulation disqualifier: low-liquidity pump, suspicious volume spike,
   wide-spread regime, unlock overhang, hacked/social-shill pattern, exchange
   outage, spoof/wash-trade suspicion.

## Claims Not Allowed Yet

- "AI found alpha."
- "This agent is profitable."
- "This signal works."
- "Sentiment feed validates the trade."
- "Deploy to agent" if no backend strategy update happens.
- "Live trading ready."
- Any claim based only on in-sample optimization, a single backtest, or
  leaderboard rank.

## First Research Cards

1. `regime-first-rsi-reclaim-v1`: RSI reclaim only allowed when regime,
   volatility, and liquidity gates agree.
2. `volume-spike-fraud-filter-v1`: test whether volume spikes without catalyst
   or depth confirmation underperform after entry.
3. `unlock-risk-disqualifier-v1`: tag token unlock windows and test whether
   they should block long entries or reduce confidence.
4. `sentiment-attention-vs-entry-v1`: classify attention spikes as catalyst,
   manipulation, or noise before any paper trade.
5. `autopilot-24h-change-baseline-v1`: keep the current simple Autopilot as a
   baseline, then compare any improved strategy against it.
6. `exit-logic-dominates-entry-v1`: test exits as first-class hypotheses, since
   bot-builder postmortems repeatedly show high win rates can still produce
   negative expectancy when exits, fees, funding, and trend breaks are weak.
7. `htf-momentum-baseline-v1`: test higher-timeframe momentum as a boring,
   structural baseline before building fragile indicator stacks.
8. `funding-oi-crowding-filter-v1`: use funding plus open interest as a
   crowding and squeeze-risk filter, not as a standalone reversal trigger.
9. `liquidity-first-disqualifier-v1`: block or downgrade setups with poor
   spread/depth, suspicious volume, or paper-only fill assumptions that would be
   unrealistic live.
10. `cvd-order-flow-divergence-v1`: test whether CVD/order-flow divergence adds
    value beyond price-only indicators once a reliable feed is available.
11. `sell-the-news-exit-liquidity-v1`: classify positive catalysts by event
    stage, crowding, and liquidity to detect when good news is more likely to
    become exit liquidity than continuation.
12. `agent-exposure-cap-human-approval-v1`: preserve hard caps and approval
    boundaries for any autonomous agent action, especially future wallet or DeFi
    surfaces.
13. `r-multiple-plan-adherence-journal-v1`: normalize paper-trade outcomes by
    planned risk and plan adherence instead of raw P&L alone.

## Research Response 1 Addendum

User-provided Research Response 1 reinforces the same direction and adds a
clear bot-failure taxonomy: mechanical exchange/API failures versus economic
strategy failures. Its most useful MetaEdge lessons are that exit logic deserves
the same treatment as entry logic, liquidity and spread should be disqualifiers
before triggers are scored, and funding/open interest should be treated as
crowding context rather than a precise timing signal.

The source note is preserved at
`docs/edgeops/source-notes/RESEARCH_RESPONSE_1_BOT_HEURISTICS.md`. Its pasted
citations are transient `turn...` references, so the note is useful for product
direction but should not be used as a public bibliography until source URLs are
recovered.

Source batch 1 now adds a durable URL ledger for many of those claims at
`docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_1.md`.

## Research Response 2 Addendum

User-provided Research Response 2 extends the EdgeOps model in four important
ways: autonomous agents need mechanical exposure caps and human approval gates;
speed-optimized DeFi/MEV systems can be adversarially exploited; CVD/order-flow
should be treated as a priority signal family once data exists; and sentiment
must distinguish credible catalysts from sell-the-news or exit-liquidity events.

The source note is preserved at
`docs/edgeops/source-notes/RESEARCH_RESPONSE_2_ALPHA_ARCHITECTURE.md`. Unlike
the first attachment, several examples were spot-checked with public links, but
the note still needs durable primary citations before any public-facing claim.

Source batch 2 now adds a durable URL ledger for many Research Response 2 claims
at `docs/edgeops/source-notes/SOURCE_LEDGER_BATCH_2.md`.

## Practical Conclusion

MetaEdge has enough infrastructure to start gathering evidence, but not enough
research instrumentation to know whether it has edge. The next product move is a
paper-trade thesis and research-card layer that makes every trade falsifiable.
