---
createdBy: opencode
tool: opencode
timestamp: 2026-07-09T18:00:00Z
type: handoff
status: proposed
schemaVersion: 2
scope: metaedge-gemini
confidence: high
privacy: repo-safe
---
# MetaEdge: Money-Making Paths — Complete Playbook

Companion to `.agentMemory/handoffs/2026-07-09--metaedge-prod-audit.md`. This document maps every retail-accessible automated money-making path, the blind spots that kill most traders, and the exact order to build and deploy each one.

## Table of Contents

1. [The Core Insight](#1-the-core-insight)
2. [Master Comparison: All 10 Paths](#2-master-comparison-all-10-paths)
3. [The 8 Blind Spots That Kill Trading Bots](#3-the-8-blind-spots-that-kill-trading-bots)
4. [Safety Architecture — MetaEdge's Advantage](#4-safety-architecture)
5. [Position Sizing — Kelly Criterion](#5-position-sizing--kelly-criterion)
6. [Tax & Regulatory](#6-tax--regulatory)
7. [Legal Structure](#7-legal-structure)
8. [Key Management at Scale](#8-key-management-at-scale)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Operational Readiness Checklist](#10-operational-readiness-checklist)
11. [Infrastructure Watchdog](#11-infrastructure-watchdog)

---

## 1. The Core Insight

MetaEdge already has what most trading bots lack: **a safety architecture** (15 features: position caps, balance floors, kill rules, audit trail, intent pipeline). The gap isn't strategy — it's **operational readiness, monitoring, and tax compliance**.

Research across 7+ open-source trading bot projects and 3 studies of retail bot failure consistently shows: **automating a losing strategy doesn't make it profitable — it makes you lose money faster with less awareness.**

The winning approach: **build safety first, prove edge in paper, go live small, scale only after statistical validation.**

### Infrastructure Cost

| Resource | Cost |
|---|---|
| GCP e2-micro (existing) | **$0/mo** |
| Polymarket Gamma API | **$0/mo** (free, no auth, 300 req/10s) |
| Kalshi market data API | **$0/mo** (free, no auth, 200 token/s) |
| Hyperliquid API | **$0/mo** (free, agent wallets) |
| Alpaca stocks API | **$0/mo** (commission-free, paper trading) |
| OANDA forex API | **$0/mo** practice, $1 minimum live |
| CoinGecko prices | **$0/mo** (free tier, 10-50 calls/min) |
| Gemini AI (LLM strategies) | **$0/mo** (60 req/min free tier) |
| Base gas fees | ~$0.01-0.10 per tx (unavoidable) |

**Total infrastructure: $0/mo. Only gas when you trade on-chain.**

---

## 2. Master Comparison: All 10 Paths

### P1 — Prediction Market Arbitrage (Kalshi ↔ Polymarket)

**REALITY CHECK (updated Jul 2026):** Within-platform arbitrage on Polymarket is **dead for retail** — opportunity windows collapsed from 12.3s (2024) to 2.7s (2026), with 73% captured by sub-100ms bots (NYT, Thorsten Meyer analysis). Cross-platform arb (Kalshi ↔ Polymarket) is still viable but harder than popular guides suggest. This is the honest assessment.

**What it is:** Same event (Fed rate decision, election, sports outcome) trades on Kalshi and Polymarket at different prices because they have non-overlapping user bases, different funding mechanisms (fiat vs USDC), and different market-maker compositions. Buy YES on one, NO on the other for combined cost < $1.00.

**MetaEdge already has:** `PredictionMarkets.tsx` with `source: 'polymarket'` handling at lines 28-29. Research 5 has a `server/market-proxy.ts` design. Express + TS stack compatible.

**Needs built:** `server/market-proxy.ts` (~2h), market matching engine (~4h — match same events across platforms by title/category), Kalshi account (CFTC-regulated, available to US). Polymarket account (international or via fiat path via QCEX acquisition).

**Capital:** $5,000-50,000 working capital. Not $50-200. Settlement delays require 30-40% more capital than theoretically needed — funds locked during resolution tie up working capital.

**Realistic returns:** 5-15% annualized on deployed capital for a well-run operation. Not lottery tickets, not 2-4% per trade — the NYT and Thorsten Meyer analysis both converge on this number. Below $5K capital, fees and settlement inefficiency absorb most of the edge.

**Risks:**
- Resolution disputes (1-3% tail on subjective markets — $160M Zelenskyy suit flipped)
- UMA oracle concentration (top 10 token holders control 50%+ voting on Polymarket disputes)
- Kalshi first-print risk (revisions after settlement ignored)
- State-level regulatory: Massachusetts, Nevada, Arizona, Tennessee, Illinois, Connecticut challenging both platforms on gambling grounds. Sports markets vulnerable to state-by-state availability risk.
- Settlement delay (24-48h Polymarket, 0-4h Kalshi) = capital inefficiency
- CFTC classified prediction markets as derivatives (Mar 2026). DOJ prioritizing fraud enforcement.
- Exchange outage during arb position = forced loss

**Reference:** `composio-hq/polymarket-kalshi-arbitrage-bot` (79 stars, TS, free). `tswaim/CrossArb` (simultaneous legs, net profit calculator, fees+gas). Both are reference architectures, not ready-to-deploy — need adaptation.

**Setup time:** ~6h for scanner + alerts. Execution engine adds 2-4h.

---

### P2 — Hyperliquid Perpetual Futures

**What it is:** Automated perp trading on the leading DEX of 2026. Agent wallets can trade but **can never withdraw** — the single biggest security breakthrough for retail bots.

**MetaEdge already has:** Autotrader engine with 90s tick interval, 7+ strategy types, `evaluateOrderRisk()`, per-agent position caps (CLIP=250), balance floor (100), kill rules via `server/killguard.ts`.

**Needs built:** Hyperliquid agent wallet setup (~30min), strategy adapter to map MetaEdge's internal signal to Hyperliquid orders (~3h), backtest data.

**Capital:** $200+ minimum viable. Perp requires margin.

**Risk:** Directional. MetaEdge's kill rules mitigate. Agent wallet means trading-only — cannot withdraw.

**Setup time:** ~4h

**Reference:** Chris0x88/hyperliquid-agent (open source, 23 strategies, no fees, no telemetry). Fomoed (free, agent wallet model, 7 strategies).

---

### P3 — Base On-Chain Trading

**What it is:** Swap tokens on Uniswap V3/V4, Aerodrome on Base chain via MetaEdge's existing MetaMask integration. Trade tokens directly on-chain.

**MetaEdge already has:** `server/metamask.ts` (1383 lines — subprocess management, gas estimation, transaction building, approved token tables). `server/operator.ts` auth layer. Base chain support.

**Needs built:** Token scanner for Base ecosystem (DexScreener API is free), safety verification layer (GoPlus free API detects honeypots, hidden taxes, proxy contracts, mint functions — before LLM evaluates), strategy adapter (~6h).

**Reference:** `tearful-saw/sentinel` — open source, 3-layer verification (DexScreener + GoPlus + LLM), Base + Uniswap. `stevebot1559/basalt` — CLI toolkit for Base swaps in Rust, multi-DEX quoting.

**Capital:** $50-500.

**Risk:** High — rug risk, honeypots, MEV. GoPlus API integration is table stakes. Start with known tokens only.

**Setup time:** ~8h

---

### P4 — CEX Automated (Freqtrade / Bybit)

**What it is:** Hyperopt-tuned strategies on Bybit perpetual futures via Freqtrade (52K+ GitHub stars, battle-tested). Walk-forward validation, 8+ safety protections built in.

**MetaEdge already has:** Safety architecture patterns but no Python bridge. Would run as a separate process on the same VM.

**Needs built:** Freqtrade install + config, Bybit API keys (withdrawals OFF, IP whitelist ON), strategy port from MetaEdge's existing logic (~3h).

**Reference:** `darkvolg/Trading` — public open-source strategy, $500 paper on Bybit, live stats API, walk-forward validated.

**Capital:** $100-500.

**Risk:** Medium — exchange risk (API key leak). Withdrawals OFF enforced at the exchange level. Freqtrade's 8 built-in protections (cooldown, stoploss-guard, max-drawdown, max-open-trades, etc.).

**Setup time:** ~3h

---

### P5 — MetaEdge Paper → Live Transition

**What it is:** Simply flip `LIVE_EXECUTION_ENABLED=true` and `METAMASK_AGENT_ENABLED=true`. The autotrader already has 7+ strategies, position limits, balance floors, and intent validation. Everything already works, just in paper mode.

**MetaEdge already has:** Everything. Full safety stack, 15 features, audit trail, kill rules. The entire application already handles trade lifecycle.

**Needs built:** Confidence (paper track record), small gas budget for Base transactions.

**Capital:** As little as $20 (gas only on Base — ~$0.01-0.10/tx).

**Risk:** Lowest — every limit is already enforced. Paper trade first, graduate to live when consistently profitable.

**Setup time:** Already ready.

---

### P6 — x402 Signal Selling

**What it is:** Sell your trading signals to other agents for $0.10 USDC per call. Agent-to-agent commerce on Base. CryptoSentinel's model: `/api/signals` endpoint returns preview for free, full signal after payment verification.

**MetaEdge already has:** Express server, agent architecture, on-chain capability.

**Needs built:** Signal API endpoint, payment verification (x402 protocol), `.well-known/agent-card.json` (ERC-8004 discovery). ~4h.

**Reference:** `janneh2000/cryptosentinel` — built for hackathon, paid signal API, TradeLog.sol onchain. MIT license.

**Capital:** $0. No capital at risk — just compute.

**Risk:** Minimal. No capital at risk.

**Setup time:** ~4h

---

### P7 — Agent-as-a-Service

**What it is:** Let others deploy their own agents on your MetaEdge instance. Full agent platform, arena competitions, vault clubs already built.

**MetaEdge already has:** Full agent platform — workspace, arena, vault clubs, swarm copilot, spec catalog, market data.

**Needs built:** Multi-tenant isolation (one user can't see another's agents), billing, rate limiting, uptime SLA, documentation. ~2 weeks significant effort.

**Capital:** $0. But e2-micro may need upgrade ($5-15/mo) for multi-tenant load.

**Risk:** Low — you're the platform, not the trader. But you inherit security responsibility for other people's capital. Skip until all other paths are proven.

**Setup time:** 2+ weeks.

---

### P8 — Stocks/ETFs (Alpaca)

**What it is:** Commission-free US stock and ETF trading via Alpaca's REST API. $0 minimum, paper trading available, free tier covers market data and execution. Same autotrader engine, different asset class.

**MetaEdge already has:** Autotrader engine, strategy pipeline, risk controls. The strategy decision layer is asset-agnostic.

**Needs built:** Alpaca account + API keys, `server/alpaca.ts` adapter that maps MetaEdge's signal format to Alpaca orders (~4h). Paper trade first (`paper=True`).

**Capital:** $0 (paper) → $1+ (live). Alpaca has no minimum for live brokerage accounts.

**Risk:** Medium — standard market risk. Regulated broker (SEC/FINRA), SIPC insured. Paper trade first.

**Setup time:** ~4h

---

### P9 — Forex (OANDA)

**What it is:** Automated forex strategy trading (trend following, mean reversion, breakout, SMC, news fade) on major pairs (EUR/USD, GBP/USD, USD/JPY) via OANDA's v20 REST API.

**Important:** Pure forex arbitrage (triangular, cross-exchange) is not viable for retail — spreads collapsed to microseconds years ago. What IS viable is automated **strategy** trading with proven edge.

**MetaEdge already has:** Nothing forex-specific. But the strategy pipeline and risk architecture are general.

**Needs built:** OANDA practice account + API key, `server/oanda.ts` adapter (~5h). Paper trade on OANDA practice environment first (free, real market data, simulated execution).

**Reference:** `Abdrakib/forex-trading-bot` — Claude-powered, 5 strategies, OANDA API, open source. 1,300+ lines of Python, MIT license.

**Capital:** $0 (practice) → $1+ (live OANDA minimum).

**Risk:** Medium — currency risk. OANDA is regulated (CFTC/NFA), practice environment is free. Definite paper trade first.

**Setup time:** ~5h

---

### P10 — Signal Aggregation & Multi-Source Copy Trading

**What it is:** Collect signals from multiple sources (on-chain wallet trackers like Onsight, X/Twitter trading calls, Polymarket leaderboard wallets, Telegram/Discord signal groups), normalize them into a common format, weight by source reliability, and execute only when multiple independent sources converge. MetaEdge's safety layer (position caps, kill rules, balance floor) protects every signal-based trade.

**This is different from blind copy trading because:**
- Blind copy trading follows one wallet = one point of failure. One bad trade from a hot-streak wallet wipes gains.
- Signal aggregation requires **multiple independent sources** to agree before executing. Three wallets independently making the same bet is stronger than one wallet's conviction.
- MetaEdge's safety layer enforces position caps and kill rules that no Telegram bot has.

**MetaEdge already has:** All the safety infrastructure (kill rules, position caps, balance floor, audit trail). Express server for aggregator API. Express + TS stack.

**Needs built:**

| Component | Effort | Description |
|---|---|---|
| `server/signal-collector.ts` | 4h | Fetch signals from Onsight API (Polycop), Polymarket leaderboard, X/Twitter scrape, Telegram |
| `server/signal-matcher.ts` | 3h | Match signals to specific markets/events. Score convergence (N of M sources agree) |
| `server/signal-scorer.ts` | 2h | Track source reliability over time. Down-weight wrong sources, boost consistent ones |
| `db/signals.json` schema | 1h | Store signal: source, market, direction, confidence, timestamp, outcome |
| Dashboard views | 3h | Show live signals, source reliability scores, convergence alerts |

**Signal sources — full catalog (updated Jul 2026):**

| Source | Asset Class | Access | Quality | Why |
|---|---|---|---|---|
| **PolyZig** | Polymarket | REST API + MCP server, free tier, scoped keys | **High** | Sub-500ms mempool copy. Top trader discovery, mirror config, PnL monitoring. Built for AI agents. |
| **Polymarket Data API** | Polymarket | `data-api.polymarket.com`, public, no auth | **High** | Every wallet's positions, trade tape, PnL. 1,000 req/10s. Build your own pipeline. |
| **Polymarket Gamma API** | Polymarket | `gamma-api.polymarket.com`, public, no auth | **Medium** | Market discovery, events, token IDs. Good for matching signals to contracts. |
| **Polymarket CLOB API** | Polymarket | Public + private (auth for trading) | **High** | Order book, prices, midpoint. Price action as signal. |
| **HyperX Agent API** | Hyperliquid perps | WebSocket + REST, free tier | **High** | Real-time fills stream for ANY wallet. Dedicated trading token. Whale tracking + copy trading. |
| **Nansen** | Hyperliquid perps | API, paid | **Low (cost)** | Whale wallet tracking, position monitoring. Paid. Skip until proven need. |
| **Onsight** | Polymarket | Telegram bot, free | **Medium** | Non-custodial, 203 MAU, $5.12M volume. Good for signal discovery. |
| **AI-Traderv2** | Stocks, crypto, forex, Polymarket, options | Open source, API | **Medium** | Multi-market. Agents publish signals. Cross-platform sync (Binance, Coinbase, IBKR). |
| **Cripton AI** | Crypto (DCA/Grid) | API, free tier | **Medium** | 6 AI algorithms per signal (HMM, DRL, Monte Carlo). Non-custodial. |
| **X/Twitter trading calls** | All | Manual scrape | **Low** | Survivorship bias, fake P&Ls, pump groups. Use as confirmation only. |
| **Telegram signal groups** | All | Manual scrape | **Very Low** | Nearly all are pump-and-dump or exit scams. Skip. |

**Why MetaEdge has an edge over copy-trading bots:**

| Feature | Onsight / PolyCop | MetaEdge + Signal Aggregation |
|---|---|---|
| Key custody | Non-custodial (you hold) | Same (your keys) |
| Protection | None (copy blindly) | Position caps, kill rules, balance floor |
| Source diversity | Single wallet per follow | Multi-source convergence scoring |
| Learning loop | None | Source reliability tracking over time |
| Asset classes | Polymarket only | Prediction arb + perps + crypto + stocks + forex |

**Capital:** $100-500 to start. Signal aggregation doesn't need large capital — you can size positions conservatively and scale as source reliability improves.

**Risk:** Medium. The risk isn't the platform (Onsight is non-custodial). The risk is following bad signals. Mitigated by:
- Multi-source convergence (3+ sources must agree)
- Source reliability tracking (automatic down-weight)
- MetaEdge's position caps and kill rules (maximum loss per trade, per day)
- Start with $100, paper trade signals for 30 days before going live

**Setup time:** ~10h for full pipeline. Can start display-only with Onsight in 1h.

**Reference:** Onsight.trade (verified, free, non-custodial, 203 MAU, $5.12M cumulative). The concern with Onsight is execution drift (leader's fill vs your fill) and the earn-when-copied incentive pushing leaders toward risk. Using Onsight as a signal source (not execution) avoids both problems.

---

## 3. The 8 Blind Spots That Kill Trading Bots

From 3 independent studies of retail bot failure (CoinClaw, StratBase, MarketTrace) and 7+ open-source post-mortems. These are the patterns that separate surviving bots from blown accounts.

### Blind Spot #1: Overfitting (The #1 Killer)

A strategy that performs brilliantly on historical data but fails on live markets because it learned noise, not signal.

**How it happens:** Tuning parameters on the same dataset until the backtest looks perfect. The strategy memorizes past market structure that won't repeat.

**Real data:** CoinClaw's engineering team built 6 strategies. 5 failed statistical validation. The 1 that passed still required regime filters and walk-forward testing. These were built by engineers, not random parameter guessers.

**Fix:**
- Walk-forward validation: train on 70% of data, test on unseen 30%. If performance diverges significantly, strategy has no edge.
- 30 days paper trading minimum before real money.
- Compare paper results vs backtest for the same period. If divergence > threshold, don't go live.
- Fewer parameters = less overfitting risk. A strategy with 3 knobs is safer than one with 12.

### Blind Spot #2: Ignoring Transaction Costs

Every trade has spread, commission, and slippage. Most backtests assume perfect fills at mid-price.

**Real data:** A $5K market order on a mid-cap alt can sweep 3 levels of the book during low liquidity. BTC alone costs 2bp slippage per trade. A strategy taking 200 trades/month loses 4% annualized to slippage alone.

**Fix:**
- Include realistic costs in every backtest: spread + commission + slippage.
- Run sensitivity analysis: if doubling costs turns profit into breakeven, the edge is too thin.
- Track realized fill quality vs expected (Research covers "decision-time microstructure capture").

### Blind Spot #3: Regime Blindness

A bot executes rules regardless of context. A trend bot in a ranging market generates loss after loss. A mean reversion bot in a strong trend catches falling knives. The bot can't recognize this without explicit programming.

**Real data:** CoinClaw's ETH Grid bot had Sharpe ratio -0.045 in bear markets. The same strategy WITH a regime filter (simple: stop trading during bear) passed all validation gates. One boolean, everything changed.

**Fix:**
- Add a regime filter per strategy before going live.
- For crypto: BTC tape state (has BTC moved >X% in N minutes? suppress alt entries).
- For perps: funding rate regime.
- For stocks: VIX regime.
- If a strategy can't describe what market conditions it needs, don't deploy it.

### Blind Spot #4: Silent Strategy Decay

A strategy that worked 6 months ago stops working because market microstructure changed. The bot runs, logs show activity, but it has no edge anymore. Most traders don't detect this until P&L has already drawn down.

**Fix — monitor three numbers per strategy:**
1. **Rolling 30-day hit rate** vs baseline from calibration period. If it drops 1.5σ below baseline for 2 weeks, pause.
2. **Gate agreement** — if using an ML/statistical signal gate, track agreement between gate predictions and actual outcomes. Agreement drops usually precede hit-rate drift by 1-2 weeks.
3. **Slippage drift** — rising spread and falling book depth mean your strategy's execution windows are getting more expensive (often because other bots found the same trade).

### Blind Spot #5: Ghost Prices & Stale Data

A cached price from hours ago gets used instead of current price. The bot thinks BTC is at $80K when it's at $68K. Every decision is wrong. The bot logs show activity but it never trades because it's comparing today's price against a ghost.

**Real example:** CoinClaw's V3.6 Fear & Greed bot ran for 3 weeks with `last_price` stuck at $80K — a ghost from a developer's machine. Logged activity 96 times/day. Never placed a single order.

**Fix:**
- Price freshness check before every trade: `if (price.age > 60s) skip trade`.
- Log the age of every data point alongside the decision.
- Mark stale data in the UI so manual oversight can spot it.

### Blind Spot #6: No Kill Switch / No Circuit Breaker

A bug, a flash crash, a misconfigured parameter. Without a hard kill, you watch the account drain while frantically SSH-ing.

**Real data:** Most bot platforms don't have a global circuit breaker. MetaEdge's `killrule.mjs` is ahead of the curve — it auto-disables autopilot on kill rule violations.

**Fix (MetaEdge already has partial):**
- Per-agent kill: ✅ MetaEdge has it (`evaluateKill()` in `killrule.mjs`)
- **Missing:** **Portfolio-level circuit breaker:** if ALL strategies lose >X% in 24h, halt everything. Not per-agent — global.

### Blind Spot #7: Strategy Hopping

Deploy strategy → normal drawdown → panic → switch to different strategy that's been doing well → that one hits its own drawdown → switch again. Result: enter every strategy at its peak, abandon at its trough. Worse than holding any single strategy.

**Fix:**
- Define exit conditions BEFORE deploying: "I will pause this strategy if it loses 15% peak-to-trough over 60 days."
- No strategy changes during a drawdown. Decisions made while losing money are systematically wrong.
- Run all strategies concurrently for the same period — one of them will always be in drawdown. That's normal.

---

## 4. Safety Architecture

MetaEdge's existing safety layer is its competitive advantage. Here's the complete map:

### Already Built (15 features)

| Layer | Feature | File | Status |
|---|---|---|---|
| Execution | `evaluateOrderRisk()` — checks size, balance, rate limits before any trade | `server/trades.ts` | ✅ |
| Execution | Position caps (CLIP=250 per agent, 2,500 max open) | `server/autotrader.ts` | ✅ |
| Execution | Balance floor ($100 minimum after trade) | `server/autotrader.ts` | ✅ |
| Execution | Per-agent opt-in for autopilot | `server/autotrader.ts` | ✅ |
| Execution | Env kill switch (`AUTOPILOT_DISABLED=true`) | `server/autotrader.ts` | ✅ |
| Execution | Intent pipeline with step-by-step validation | `server/trades.ts` | ✅ |
| Execution | Audit trail (every trade decision logged) | `server/trades.ts` | ✅ |
| Execution | Operator allowlist for privileged actions | `server/operator.ts` | ✅ (new) |
| Kill Switch | `evaluateKill()` — strategy survivor bar, auto-disable underperformers | `server/killrule.mjs` | ✅ |
| Kill Switch | Kill guard runs every tick, enforces kill rules | `server/killguard.ts` | ✅ |
| Safety | Deny-by-default CORS | `server.ts` | ✅ (new) |
| Safety | No fallback cookie secret | `server.ts` | ✅ (DA2) |
| Safety | Process.exit(1) on corrupt state | `server.ts` | ✅ (DA1) |
| Safety | Temp-rename atomic writes on declined-daily.json | `server/declined.ts` | ✅ (R1 fix) |
| Safety | Price freshness: 25% outlier guard, jitter smoothing, CoinGecko primary + Coinbase fallback | `server/prices.ts` | ✅ |

### Missing (Needs Building)

| Feature | Why | Effort |
|---|---|---|
| **Portfolio circuit breaker** | Global drawdown protection — if all strategies lose >X% in 24h, halt everything | 30m — `killrule.mjs` already has the pattern, add `evaluatePortfolioDrawdown()` |
| **Stale data gate** | Reject trades if any price feed is older than 60s | 30m — check `price.timestamp` before every decision |
| **Tax-ready trade logging** | Every trade needs cost basis, not just profit. One CSV per path | 1h — extend `trades.csv` columns |
| **Key/credential boot validation** | At startup, verify all expected API keys exist. Warn or fail if missing | 1h — add to `server.ts` startup |
| **Strategy decay monitoring** | Track rolling 30-day hit rate, gate agreement, slippage drift per strategy | 3h — logging + alert |

---

## 5. Position Sizing — Kelly Criterion

**This is the biggest gap in MetaEdge's current architecture.** The autotrader has position caps (CLIP=250, MAX_OPEN=2,500) but they're static — same size regardless of conviction, account equity, or drawdown state.

### The Kelly Framework

The Kelly Criterion calculates the mathematically optimal fraction of capital to risk per trade given your edge:

```
f* = (p × b - q) / b
```
Where: p = win rate, q = loss rate (1-p), b = ratio of avg win to avg loss

**Full Kelly is dangerous for crypto trading.** Three reasons:
1. Your edge estimates are always wrong — imprecise inputs produce wildly different outputs
2. Crypto's volatility means losing streaks reduce bankroll faster than Kelly expects
3. Markets are non-stationary — a 56% win rate in a ranging market may be 44% in a trend

### Practical Variants (use one)

| Variant | Formula | Best For |
|---|---|---|
| **Quarter Kelly** | `f* × 0.25` | First-time deployment, uncertain edge estimates |
| **Half Kelly** | `f* × 0.50` | Strategies with 50+ backtested trades, stable regime |
| **Capped Kelly** | `min(f* × fraction, 5%)` | Safest — use Kelly as floor check, hard cap prevents blowup |

### MetaEdge's Implementation Gap

MetaEdge is currently fixed-position sizing (static caps per agent). The industry standard is dynamic position sizing with three inputs:

1. **Kelly fraction** — based on rolling trade history (50+ trades window)
2. **Regime multiplier** — ranging market = reduced size, trending = full size
3. **Drawdown scaler** — at 5% drawdown start reducing, at 15% go to 25% of normal

**Add to `killrule.mjs` alongside `evaluateKill()`** — `calculatePositionSize()` returns a fraction that the autotrader applies before placing any trade.

### Multi-Strategy Capital Allocation

When running multiple paths simultaneously (P1 + P2 + P3 + P5), Kelly helps allocate capital between them. Multi-asset Kelly gives proportionally more capital to higher-edge strategies.

### When NOT to use Kelly

For the first live deployment of any path: use fixed 1% risk per trade. You need 100+ completed trades before you have reliable edge estimates to feed Kelly. Premature Kelly is overconfident Kelly.

**Reference:** `Cuuper22/polymarket_bot` (open source, Kelly sizing with regime detection, Python). AlgoKing's dynamic Kelly post (fractional Kelly + regime + drawdown scaling, full Python implementation, MIT).

---

## 6. Tax & Regulatory

### Tax Reality

Every trade is a taxable event. A bot running 50 trades/day:
- 12,500+ trades/year
- Each needs cost basis tracking, gain/loss calculation
- Reported on Form 8949 (12,500+ lines)
- Wash sale rules extended to crypto in 2025 (selling at a loss and repurchasing within 30 days = loss disallowed)
- High-frequency strategies with repeated same-asset trades can lose significant tax loss harvesting

### What MetaEdge needs for tax readiness

| Need | Current State | Fix |
|---|---|---|
| Cost basis per trade | Not tracked | Add column to `trades.csv` |
| Wash sale detection | Not implemented | Filter: same-asset trades within 30 days |
| P&L by strategy | Tracked in journal | Already works, good |
| Year-end export | Not implemented | Script to aggregate 8949-ready CSV |

### Quarterly Tax Payments (US)

If profitable, you owe estimated taxes quarterly (Apr 15, Jun 15, Sep 15, Jan 15). Failure to pay = penalties. Track projected P&L monthly, set aside 25-30%.

### Prediction Market Regulation (2026)

- **Kalshi** is CFTC-regulated. Available to US users. All markets have named Source Agencies.
- **Polymarket** is non-custodial, on-chain. Not explicitly US-banned but restricted. Use outside US or via VPN.
- **DOJ priority:** May 2025 — Criminal Division announced fraud enforcement in prediction markets. SDNY (Clayton) anticipates prosecutions.
- **Resolution disputes:** Can escalate to CFTC complaints. One Kalshi trader filed complaint after Cardi B settlement.

**Practical advice:** Report all prediction market income as "Other income" on Schedule 1. If trading professionally through Kalshi (CFTC-regulated), the rules are clearer. Polymarket is in a gray area — consult a crypto tax attorney before significant capital.

---

## 7. Legal Structure

### When to Form an Entity

| Situation | Structure | Why |
|---|---|---|
| Trading as a hobby, < $5K profit/yr | None (individual) | Simpler tax, no filing costs |
| Trading as primary income, $5-80K profit/yr | Single-member LLC | Liability protection, business deductions, Schedule C |
| Trading as primary income, $80K+ profit/yr | LLC electing S-corp | Saves ~$5-10K/yr in self-employment tax |
| Multi-member or external investors | LLC taxed as partnership | K-1s to members, flexible profit distribution |

### Single-member LLC (Recommended for most)

**What it gives you:**
- Liability protection (personal assets separated from trading)
- Business expense deductions (software, hardware, education, data feeds, gas fees)
- Professionalism (easier to open business bank accounts and exchange accounts)
- Clean tax separation (business income/expenses tracked separately from personal)

**What it does NOT do:**
- Save you taxes by default. A single-member LLC is a "disregarded entity" — taxed identically to a sole proprietor.
- Eliminate self-employment tax (15.3% on net earnings from trading if you qualify as a business).

### S-Corp Election ($80K+ profit)

At $80K+ profit, electing S-corp (Form 2553) lets you:
1. Pay yourself a "reasonable salary" (subject to payroll/SE tax)
2. Take remaining profits as distributions (not subject to 15.3% SE tax)

Example: $300K trading profit → $80K salary (SE tax: $12,240) → $220K distribution (no SE tax). Saves ~$33,660 vs sole proprietor.

Requires payroll, accounting, and annual Form 1120-S. Not worth it below $80K.

### Trader Tax Status (TTS)

If you meet the IRS threshold for Trader Tax Status (typically 1,000+ trades/year, short holding periods, trading as primary income activity), you qualify for:

| Benefit | What it does |
|---|---|
| Deduct trading expenses | Software, data feeds, home office, hardware |
| Mark-to-market (475(f)) | Treat all positions as sold Dec 31, unlimited loss deductions, eliminates wash sale rules |
| Ordinary income treatment | Gains/losses are ordinary, not capital |

475(f) election must be made by April 15 of the tax year. Consult a CPA before electing.

### State-Level Considerations

- **Wyoming LLC:** No state income tax, DAO LLC Act, anonymous LLCs allowed, low fees (~$102/yr).
- **Delaware LLC:** Corporate-friendly courts, franchise tax ($300/yr min), no anonymity.
- **Your home state:** Simplest but may have state income tax on trading profits.

If prediction market arbitrage is a primary path, note: Polymarket's legal status varies by state (MA, NV, AZ, TN, IL, CT challenging). An LLC does not shield you from regulatory liability if the activity itself is restricted in your jurisdiction.

### Estimated quarterly payments

Any profitable trading year requires estimated tax payments (Apr 15, Jun 15, Sep 15, Jan 15). Failure to pay = underpayment penalty. Rule of thumb: set aside 30% of gross trading profit for taxes.

---

## 8. Key Management at Scale

Each path needs credentials. One leak = blown account.

| Path | Credential | Risk if Leaked |
|---|---|---|
| P1 Polymarket | Private key (EOA) | Wallet drained |
| P1 Kalshi | API key + secret | Account traded or drained |
| P2 Hyperliquid | Agent wallet key | Can trade (but can't withdraw) — SAFEST |
| P3 Base on-chain | MetaMask private key | Wallet drained |
| P4 Bybit | API key + secret | Can trade (withdrawals OFF) |
| P5 MetaEdge live | MetaMask private key | Wallet drained |
| P8 Alpaca | API key + secret | Account traded (withdrawals configurable) |
| P9 OANDA | API key | Account traded |

### Rules (already enforced by MetaEdge's patterns)

1. **All keys in `.env` on VM.** Never committed. `.env` is gitignored.
2. **Withdrawals OFF on every exchange API key.** If the exchange supports it, enforce it.
3. **Agent wallets for Hyperliquid.** The only path where key leak can't cause fund loss.
4. **IP whitelisting.** Restrict API keys to VM's static IP where possible.
5. **Separate wallets per path.** Don't share keys. If P1 key leaks, P3 trading is still safe.
6. **Boot-time validation.** Extend `server/operator.ts` pattern: `server/credentials.ts` reads all expected env vars at startup, warns on missing, hard-fails for critical ones.

---

## 9. Implementation Roadmap

### Phase 0: Foundation (1-2 days)

| # | What | Why |
|---|---|---|
| 0.1 | Add portfolio circuit breaker to `killrule.mjs` | Global drawdown protection before any real money |
| 0.2 | Add stale data gate to autotrader tick | Prevent ghost-price trades |
| 0.3 | Add credential boot validation | Catch missing keys before bot starts trading |
| 0.4 | Extend `trades.csv` with cost basis columns | Tax-ready from day 1 |

### Phase 1: Fastest money (2 days)

| # | Path | Deliverable |
|---|---|---|
| 1.1 | P5 paper → live | Flip `LIVE_EXECUTION_ENABLED`. Start with $20 gas budget on Base. Paper trade first 30 days. |
| 1.2 | P1 arb shell | `server/market-proxy.ts` — fetches Polymarket + Kalshi markets, displays gaps. Display-only first. |
| 1.3 | P2 Hyperliquid setup | Agent wallet, basic strategy adapter, paper trade on Hyperliquid testnet (free). |
| 1.4 | P10 signal collector | `server/signal-collector.ts` — pull signals from PolyZig (REST/MCP) + Polymarket Data API + HyperX. Display convergence score, skip execution. |

### Phase 2: Scale (1 week)

| # | Path | Deliverable |
|---|---|---|
| 2.1 | P1 arb execution | Market matching engine + automated arb execution. Start with $500-1,000 for realistic edge. |
| 2.2 | P4 Freqtrade/Bybit | Hyperopt-tuned strategy from MetaEdge's signal pipeline. Paper 30 days. |
| 2.3 | Strategy decay monitoring | Hit rate, gate agreement, slippage drift tracked per strategy. |

### Phase 3: Diversify (1 week)

| # | Path | Deliverable |
|---|---|---|
| 3.1 | P3 Base on-chain | Token scanner + GoPlus safety layer. Known tokens only at first. |
| 3.2 | P8 Alpaca stocks | Stock adapter, paper trade, start with index ETFs only. |
| 3.3 | P9 OANDA forex | Forex adapter, practice account, trend-following strategy first. |

### Phase 3.5: Signal maturity (1 week)

| # | Path | Deliverable |
|---|---|---|
| 3.4 | P10 signal execution | `server/signal-matcher.ts` + `server/signal-scorer.ts`. Execute only on 3+ source convergence. Paper 30 days. |
| 3.5 | P10 source reliability | Track source hit rate over time. Auto-downweight unreliable sources. Dashboard. |

### Phase 4: Passive income (2-3 days)

| # | Path | Deliverable |
|---|---|---|
| 4.1 | P6 x402 signal selling | Signal API endpoint + payment verification. |
| 4.2 | P7 Agent-as-a-Service | Only if demand exists. Skip otherwise. |

---

## 10. Operational Readiness Checklist

Before any path goes live with real money, verify:

- [ ] Paper traded 30 days minimum
- [ ] Walk-forward validation passed (train 70%, test 30%)
- [ ] Paper results match backtest expectations (within 15%)
- [ ] Transaction costs included in validation (spread + fee + slippage)
- [ ] Stale data gate enabled
- [ ] Position caps configured and tested
- [ ] Kill switch verified (can halt remotely)
- [ ] Portfolio circuit breaker configured
- [ ] Credential boot validation passing
- [ ] API key withdrawals OFF
- [ ] API key IP whitelisted
- [ ] Key not committed to any repo
- [ ] `trades.csv` logging correctly (spot-check first 10 trades)
- [ ] Health endpoint responding
- [ ] Watched for 24h: no console errors, no unexpected behavior
- [ ] Telegram/Discord alert configured for: trade opened, trade closed, error, kill switch triggered

---

## 11. Infrastructure Watchdog

The GCP e2-micro runs all of this. It's also the single point of failure.

| Threat | Mitigation |
|---|---|
| VM restart / crash | systemd auto-restart (`Restart=always`). Tested in Tier 0. |
| Out of memory | GCP setup script adds 2G swap. If persistent, upgrade to e2-small ($18/mo). |
| API key rotated | Boot validation warns. Fix within one tick cycle. |
| Exchange API outage | All paths degrade gracefully: skip tick, log, continue. |
| Disk full | Cron: prune backups older than 7 days. Monitor `df -h`. |
| Internet down | Can't trade. VM doesn't miss tick — it skips. Resume on reconnect. |

**Daily check (30 seconds):**
```bash
curl http://localhost:3001/api/health      # Should return 200
df -h /                                     # Should be <80% full
systemctl is-active metaedge                # Should be "active"
journalctl -u metaedge --since "24 hours ago" | grep -c error  # Should be 0
```

---
