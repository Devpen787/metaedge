# MetaEdge EdgeOps Prompt Pack

Date: 2026-07-07

Use these prompts for MetaEdge research and paper-trade work. They intentionally
follow the AgentOps/ChopDot style: one named card, current truth to preserve,
scope boundaries, falsifiers, and proof mapping.

## 1. Signal Research Card Prompt

```md
You are working in `/Users/devinsonpena/Documents/metaedge-gemini`.

Task: create or review an EdgeOps research card for `<signal-name>`.

Current truth to preserve:
- MetaEdge is paper-first.
- Existing paper trades are real ledger events, not live execution.
- Quant alternative-data feeds are simulated unless code proves otherwise.
- A signal is a hypothesis until it survives out-of-sample and paper-forward testing.

Scope in:
- Define the signal family.
- State the hypothesis.
- Identify required data fields.
- Define the benchmark.
- Define the falsifier.
- Define paper-forward test windows.
- Identify manipulation/noise disqualifiers.

Scope out:
- No live-trading claim.
- No profitability claim.
- No strategy promotion from a single backtest.
- No use of social/forum claims as proof without corroboration.

SHALL requirements:
- The card SHALL include a falsifier.
- The card SHALL include at least one benchmark.
- The card SHALL name all data sources and their freshness.
- The card SHALL separate technical trigger, regime filter, catalyst, sentiment,
  liquidity, and manipulation risk.
- The card SHALL state what result would make us stop testing this signal.

GIVEN / WHEN / THEN:
- GIVEN the signal fires in a low-liquidity or wide-spread regime
  WHEN liquidity confirmation is missing
  THEN the setup SHALL be blocked or tagged low-confidence.
- GIVEN the signal only works in the optimized in-sample window
  WHEN tested out-of-sample
  THEN the card SHALL fail unless the forward sample remains stable.

Proof required:
- Backtest or replay result with costs.
- Paper-forward ledger slice.
- Benchmark comparison.
- Failure cases.
- Source links.
```

## 2. Paper Trade Thesis Prompt

```md
Create a paper-trade thesis for a proposed MetaEdge trade.

Do not recommend real trading. Do not claim edge. Treat this as a research log.

Capture:
- asset
- side
- paper size / risk unit
- holding window
- setup
- trigger
- regime
- catalyst
- sentiment / attention state
- liquidity state
- manipulation risk
- invalidation
- benchmark expectation
- confidence and why
- source links or "no source"

Decision rule:
- Approve paper entry only if at least two independent signal families align and
  no hard disqualifier is active.
- If the signal is mostly social/sentiment, require catalyst or liquidity
  confirmation before entry.
- If the trigger is technical only, require regime classification before entry.

Output:
- `paper_trade_allowed: yes|no|low_confidence`
- `why`
- `falsifier`
- `what_to_review_after_exit`
```

## 3. Catalyst Review Prompt

```md
Review this catalyst for MetaEdge paper-trade relevance: `<catalyst>`.

Classify:
- event type: listing | unlock | governance | exploit | macro | ETF | protocol
  upgrade | legal/regulatory | other
- scheduled or surprise
- known before price move or discovered after
- likely asset-specific or market-wide
- expected window: pre-event | event | post-event
- evidence quality: official | credible media | onchain | social-only | rumor
- risk: already priced | low liquidity | manipulation bait | broad macro shock

Falsifier:
- What price/volume behavior would show this catalyst was noise?

Output:
- catalyst score: 0-5
- trade use: block | reduce confidence | allow as supporting evidence | strong
  paper-test candidate
- source links
```

## 4. Sentiment And Manipulation Review Prompt

```md
Review this social/sentiment signal for manipulation risk.

Inputs:
- asset
- source/channel
- timestamp
- message/claim summary
- price move before signal
- volume move before signal
- liquidity/spread condition
- known catalyst, if any

Checks:
- Is the source reputable?
- Is the attention organic or coordinated?
- Are accounts newly created, compromised, bot-like, or influencer-clustered?
- Did price/volume move before public attention?
- Is there exchange depth to support exits?
- Is there unlock, insider, listing, or exploit risk?

Output:
- sentiment classification: organic attention | catalyst follow-through |
  pump-risk | rumor | unusable
- manipulation risk: low | medium | high
- paper-trade use: block | tag only | supporting evidence | allowed trigger
- falsifier
```

## 5. Regime Classification Prompt

```md
Classify the current regime for `<asset>` before allowing a signal.

Use available data only. If data is missing, say missing.

Required checks:
- trend: up | down | sideways | mixed
- volatility: low | normal | high | extreme
- liquidity: healthy | thin | wide-spread | unknown
- BTC/market context: risk-on | risk-off | mixed | unknown
- drawdown state
- volume state

Decision:
- Which strategy families are allowed in this regime?
- Which are blocked?
- Which indicators are likely to produce false signals?

Falsifier:
- What regime transition would invalidate the current trade thesis?
```

## 6. Backtest Critique Prompt

```md
Critique this MetaEdge backtest result.

Inputs:
- strategy
- asset
- timeframe
- number of tested parameter combinations
- in-sample result
- out-of-sample result
- costs/slippage
- benchmark result
- trade count
- drawdown
- paper-forward result, if any

Checks:
- Was the test walk-forward or only one split?
- How many trials were searched?
- Is out-of-sample weaker than in-sample?
- Does performance survive costs?
- Does performance beat buy/hold, random entry, and current Autopilot baseline?
- Is the sample large enough to trust?
- Does the strategy depend on a single market regime?

Output:
- evidence grade: fail | weak | promising | strong-paper-only
- biggest weakness
- required next test
- allowed product claim
```

## 7. Post-Trade Review Prompt

```md
Review this closed paper trade.

Inputs:
- original thesis
- entry
- exit
- P&L
- max favorable excursion
- max adverse excursion
- holding time
- regime at entry and exit
- catalyst/sentiment updates
- execution notes

Questions:
- Did the original trigger work?
- Was the thesis invalidated before exit?
- Was outcome driven by signal, market beta, luck, or manipulation/noise?
- Did we follow the invalidation rule?
- Should this signal be promoted, kept testing, modified, or killed?

Output:
- lesson
- mistake tags
- signal score update
- next experiment
```

## 8. Weekly Edge Report Prompt

```md
Create a weekly MetaEdge EdgeOps report from the paper-trade ledger.

Report:
- number of paper trades
- trades with complete thesis
- trades missing thesis fields
- expectancy by signal family
- win rate by signal family
- average R / risk unit if available
- max adverse excursion by signal family
- regime distribution
- catalyst-tagged trades
- sentiment-tagged trades
- manipulation-disqualified setups
- best failure lesson
- top unresolved research question

Rules:
- Do not claim profitability.
- Separate backtest, paper-forward, and anecdotal evidence.
- Mark incomplete data as incomplete.
- Recommend one next research card only.
```
