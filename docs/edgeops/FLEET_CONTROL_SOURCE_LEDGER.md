# Fleet Control Source Ledger

Date: 2026-07-07

Use this ledger to keep MetaEdge's fleet-control design grounded in systems that
already exist. These sources inform paper-mode architecture only; they do not
prove any MetaEdge strategy has edge.

## Bot Architecture

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| Hummingbot Strategy V2 | https://hummingbot.org/strategies/v2-strategies/ | Separate controllers from executors. Strategy logic should create actions; execution should manage lifecycle. |
| Hummingbot Executors | https://hummingbot.org/strategies/v2-strategies/executors/ | Executors can be created, stopped, stored, and reported independently from signal logic. |
| Hummingbot Position Executor | https://hummingbot.org/strategies/v2-strategies/executors/positionexecutor/ | Attach stop loss, take profit, time limit, and trailing stop concepts to position lifecycle. |
| Hummingbot Grid Executor | https://hummingbot.org/strategies/v2-strategies/executors/gridexecutor/ | Use batch processing, max open orders, and position caps instead of unbounded order creation. |
| Hummingbot Controllers | https://hummingbot.org/strategies/v2-strategies/controllers/ | Controllers are reusable long-running strategy building blocks and support multi-strategy setups. |
| Hummingbot controller walkthrough | https://hummingbot.org/strategies/v2-strategies/walkthrough-controller/ | A single script can run multiple controller configs, which maps to MetaEdge fleet profiles. |

## Shared Data And Protections

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| Freqtrade producer/consumer mode | https://www.freqtrade.io/en/stable/producer-consumer/ | Reuse analyzed data across bots to avoid duplicate indicator work and rate-limit pressure. |
| Freqtrade configuration | https://www.freqtrade.io/en/stable/configuration/ | Enforce `max_open_trades`, pair constraints, and other global bot limits. |
| Freqtrade protections | https://www.freqtrade.io/en/2024.1/includes/protections/ | Treat cooldown, stoploss guard, max drawdown, and low-profit locks as core protections. |
| Freqtrade bot basics | https://www.freqtrade.io/en/stable/bot-basics/ | Keep dry-run/live distinctions clear and make loop cadence explicit. |

## Event-Driven Trading Systems

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| NautilusTrader execution concepts | https://nautilustrader.io/docs/latest/concepts/execution/ | Execution and order management can coordinate multiple strategies and venues. |
| NautilusTrader architecture | https://nautilustrader.io/docs/latest/concepts/architecture/ | Use a deterministic message/event flow with a cache and risk engine between strategy and execution. |
| NautilusTrader live concepts | https://nautilustrader.io/docs/latest/concepts/live/ | Keep strategy code portable across backtest/live while respecting live reconciliation and risk differences. |
| Nautilus execution crate | https://docs.rs/nautilus-execution | Model the order lifecycle from submission through fill processing. |
| Nautilus risk crate | https://docs.rs/nautilus-risk | Put pre-trade validation, position sizing, and trading controls before execution. |

## GitHub Repositories Reviewed

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| Freqtrade | https://github.com/freqtrade/freqtrade | Dry-run-first crypto bot with backtesting, Web UI, protections, and exchange integrations. |
| Hummingbot | https://github.com/hummingbot/hummingbot | Mature open-source crypto bot with controller/executor architecture and public usage claims. |
| NautilusTrader | https://github.com/nautechsystems/nautilus_trader | Production-grade event-driven trading engine with risk and execution boundaries. |
| QuantConnect LEAN | https://github.com/QuantConnect/Lean | Professional modular event-driven backtest/live engine. |
| Qlib | https://github.com/microsoft/qlib | AI quant research pipeline covering data, models, backtesting, risk, portfolio, and execution. |
| vn.py | https://github.com/vnpy/vnpy | Broad quant platform with gateways, event engine, paper account, risk manager, and portfolio manager. |
| Jesse | https://github.com/jesse-ai/jesse | Crypto strategy framework for backtesting, optimization, and live trading. |
| Lumibot | https://github.com/Lumiwealth/lumibot | Backtestable AI trading agents with paper/live broker paths; useful hybrid-agent reference. |
| VectorBT | https://github.com/polakowo/vectorbt | Fast large-scale backtesting; useful for idea killing and dangerous without multiple-testing controls. |
| Backtrader | https://github.com/mementum/backtrader | Established event-driven backtesting reference, though less active. |
| TradingAgents | https://github.com/TauricResearch/TradingAgents | Multi-agent LLM trading-firm simulation; useful role model, not execution proof. |
| AI Hedge Fund | https://github.com/virattt/ai-hedge-fund | Popular educational proof-of-concept; explicitly not real trading. |
| FinRobot | https://github.com/AI4Finance-Foundation/FinRobot | Financial analysis agents, report generation, and scheduler concepts. |
| FinMem code | https://github.com/pipiku915/FinMem-LLM-StockTrading | LLM trading-agent memory research code. |

## Papers And Benchmarks

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| TradingAgents paper | https://arxiv.org/html/2412.20138v5 | Specialized LLM trading roles and risk-team structure are useful, but results remain research evidence. |
| FinMem paper | https://arxiv.org/abs/2311.13743 | Layered memory and interpretable financial decision-making can inform EdgeOps memory/review design. |
| FinRL-Meta NeurIPS paper | https://papers.neurips.cc/paper_files/paper/2022/file/0bf54b80686d2c4dc0808c2e98d430f7-Paper-Datasets_and_Benchmarks.pdf | Finance has low signal-to-noise, survivorship bias, backtest overfitting; use DataOps and benchmarks. |
| Probability of Backtest Overfitting | https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf | Multiple strategy searches create false positives; report trials and use out-of-sample controls. |
| Deflated Sharpe Ratio | https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf | Correct Sharpe-like claims for multiple testing and non-normal returns. |
| Day Trading for a Living? | https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3423101 | The base rate for persistent individual day trading can be extremely poor; automation should not lower friction without harder gates. |
| Trading Is Hazardous to Your Wealth | https://faculty.haas.berkeley.edu/odean/Papers%20current%20versions/Individual_Investor_Performance_Final.pdf | Frequent individual trading can underperform broad market benchmarks after costs; active trading needs a high proof bar. |
| False and Missed Discoveries in Financial Economics | https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3073799 | Even financial research findings can suffer from multiplicity and false/missed discovery problems. |

## Institutional Risk Controls

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| FIA automated trading risk controls | https://www.fia.org/sites/default/files/2024-07/FIA_WP_AUTOMATED%20TRADING%20RISK%20CONTROLS_FINAL_0.pdf | Pre-trade risk controls, stability controls, and kill-switch design are part of responsible automation. |
| CFTC/FIA best practices | https://www.cftc.gov/media/2746/TAC100319_FIA/download | Electronic orders need pre-trade controls and tools for excessive messaging or uncontrolled orders. |
| CFTC concept release on automated trading risk controls | https://www.federalregister.gov/documents/2013/09/12/2013-22185/concept-release-on-risk-controls-and-system-safeguards-for-automated-trading-environments | A kill switch should be able to stop working orders and prevent new orders until authorized resumption. |
| LME disorderly trading controls | https://www.lme.com/-/media/Files/Trading/Systems/LMEselect/LMEselect10/Policies-and-Controls-for-the-Prevention-of-Disorderly-Trading.pdf | Runaway algorithmic behavior is a known exchange-level risk category. |
| ESMA supervisory briefing on algorithmic trading | https://www.esma.europa.eu/sites/default/files/2026-02/ESMA74-1505669079-10311_Supervisory_Briefing_on_Algorithmic_Trading_in_the_EU.pdf | Supervisory controls, governance, monitoring, and risk boundaries should be explicit. |
| FMSB algorithmic trading statement of good practice | https://fmsb.com/wp-content/uploads/2018/07/Algorithmic-Trading_SGP_TD_v12.pdf | Combine pre-trade controls, real-time monitoring, post-trade reporting, and supervision. |
| CFTC AI trading-bot advisory | https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html | Do not market AI bots as money machines; AI cannot predict sudden market changes. |

## Community And Failure Signals

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| Reddit: tools and frustrations | https://www.reddit.com/r/algotrading/comments/1nr1nmg/what_tools_do_you_use_and_what_frustrates_you_the/ | Practitioners cite Freqtrade/Hummingbot/Lean stacks and complain about data gaps, partial fills, fees, funding, rate limits, nonce drift, and cancel/replace rules. |
| Reddit: backtests lie/live trading | https://www.reddit.com/r/algotrading/comments/1rkghne/backtests_lie_live_trading_doesnt/ | Backtests often fail live due to slippage, overfitting, regime changes, data, and logic. |
| Reddit: first bot losing every second | https://www.reddit.com/r/algotrading/comments/qsib30/my_first_bot_makes_losing_trades_every_second/ | New bots can lose from execution frequency, fees, and naive assumptions even before strategy quality is known. |
| Reddit: backtesting vs paper trading | https://www.reddit.com/r/algotrading/comments/yokatk/backtesting_vs_paper_trading_in_real_time/ | Paper trading catches plumbing and leakage issues but does not prove real fills or edge. |
| Reddit: overfitting checks beyond paper | https://www.reddit.com/r/algotrading/comments/1rc6wd3/what_else_can_i_do_besides_paper_trading_to_see/ | Walk-forward, Monte Carlo, parameter sensitivity, and cross-asset checks are recurring community recommendations. |
| Reddit: crypto bot suggestions follow-up | https://www.reddit.com/r/algotrading/comments/1sd9hlj/followup_tested_every_suggestion_from_my_last/ | Testing suggestions and reporting what failed is valuable research behavior. |
| AgentPostmortem | https://www.agentpostmortem.com/ | AI-agent incident ledgers are useful for wrong-recipient, security, and expensive-mistake patterns, but individual reports need source verification. |
| CFTC AI bot fraud warning | https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html | Strong product-language boundary: no guaranteed returns, no "AI predicts markets" claims. |

## X / Twitter Field Signals

| Source | Link | What MetaEdge Should Learn |
| --- | --- | --- |
| TradingAgents promotional posts | https://x.com/TradersPostInc/status/2065146942557168078 | X shows strong attention around TradingAgents, but attention is not proof. |
| Open-source AI trading tool lists | https://x.com/Axel_bitblaze69/article/2074224655179899170 | Useful discovery surface for repos; treat as inspiration only. |
| AI Hedge Fund creator feed | https://x.com/virattt | Useful for roadmap/distribution signal; repo itself is clearer evidence. |
| AI trading-agent search surface | https://x.com/search?q=AI%20trading%20agents%20github | Use X to find claims, then require repo/paper/ledger evidence. |

## MetaEdge Translation

- Hummingbot gives the controller/executor split.
- Freqtrade gives shared data and practical protection primitives.
- NautilusTrader gives the event/risk/execution architecture.
- Institutional guidance gives kill switch, pre-trade controls, and supervisory
  vocabulary.

MetaEdge should implement the smallest paper-mode version of those patterns
before increasing speed, agent count, or trade concurrency.
