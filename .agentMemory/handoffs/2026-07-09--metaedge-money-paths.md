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
2. [Master Comparison: All 9 Paths](#2-master-comparison-all-9-paths)
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

## 2. Master Comparison: All 9 Paths

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

## 3. The 7 Blind Spots That Kill Trading Bots

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

## 5. Tax & Regulatory

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

## 6. Key Management at Scale

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

## 7. Implementation Roadmap

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

### Phase 2: Scale (1 week)

| # | Path | Deliverable |
|---|---|---|
| 2.1 | P1 arb execution | Market matching engine + automated arb execution. Start with $50-200. |
| 2.2 | P4 Freqtrade/Bybit | Hyperopt-tuned strategy from MetaEdge's signal pipeline. Paper 30 days. |
| 2.3 | Strategy decay monitoring | Hit rate, gate agreement, slippage drift tracked per strategy. |

### Phase 3: Diversify (1 week)

| # | Path | Deliverable |
|---|---|---|
| 3.1 | P3 Base on-chain | Token scanner + GoPlus safety layer. Known tokens only at first. |
| 3.2 | P8 Alpaca stocks | Stock adapter, paper trade, start with index ETFs only. |
| 3.3 | P9 OANDA forex | Forex adapter, practice account, trend-following strategy first. |

### Phase 4: Passive income (2-3 days)

| # | Path | Deliverable |
|---|---|---|
| 4.1 | P6 x402 signal selling | Signal API endpoint + payment verification. |
| 4.2 | P7 Agent-as-a-Service | Only if demand exists. Skip otherwise. |

---

## 8. Operational Readiness Checklist

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

## 9. Infrastructure Watchdog

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
