# External System Gap Matrix

Status: **Research template — evidence collection required before architectural conclusions are frozen**

## Purpose

MetaEdge should not rediscover every trading/agent architecture problem from first principles. This workstream reviews mature trading frameworks, copy-trading systems, agent projects, and current wallet infrastructure to identify proven patterns, known failure modes, and gaps.

Research informs product decisions. It does not automatically become product authority.

## Systems to review

### Mature trading frameworks

- Hummingbot V2
- QuantConnect LEAN
- Freqtrade
- NautilusTrader
- Jesse
- vn.py
- other high-quality event-driven execution/risk frameworks discovered during research

### Copy / wallet intelligence systems

- Hyperliquid wallet/copy-trading implementations
- trader/wallet analytics products and repositories
- social/copy-trading engines with transparent architecture

### Agentic trading / Colosseum

Start from Colosseum Arena resources and relevant projects/forums, especially projects addressing:

- autonomous trading agents;
- multi-agent research;
- verifiable signals;
- execution audit trails;
- agent wallets;
- copy trading;
- source reputation;
- attention / narrative velocity;
- risk-bounded execution.

Primary discovery entry supplied by owner:

`https://colosseum.com/arena/resources`

### Wallet / authority platforms

- current official MetaMask Agent Wallet documentation and repos;
- current MetaMask Smart Accounts / delegation primitives where relevant;
- venue-specific order/execution semantics where MetaEdge may integrate later.

## Comparison dimensions

Every external system should be evaluated against the same matrix.

| Dimension | Questions |
|---|---|
| Discovery | How are opportunities found? |
| Evidence | What data supports a view and how is freshness/provenance handled? |
| Fast-moving markets | Can the system participate before statistical certainty? |
| Signal model | Binary buy/sell, score, forecast, or target exposure? |
| Position management | Can exposure increase/decrease continuously? |
| Portfolio coordination | How are conflicting strategies/sources combined? |
| Risk | Does risk block, resize, hedge, or force reduction? |
| Exploration | Is there an explicit bounded learning/scout mechanism? |
| No-trade | Is abstention evaluated or merely treated as safe? |
| Concurrency | How do multiple controllers/strategies operate in parallel? |
| Execution | Is execution separated from strategy logic? |
| Reconciliation | Are pending/partial/unknown outcomes first-class? |
| Idempotency | How are replay/retry/duplicate actions controlled? |
| Paper simulation | How realistic are fills, latency, fees, slippage, liquidity? |
| Paper→real | What logic is portable and what authority is separated? |
| Copying | Can wallets/traders/strategies/agents be followed? |
| Copy transformation | How are sizing, leverage, and follower risk transformed? |
| Learning | What changes after outcomes? |
| Attribution | Can signal vs execution vs regime vs behavior be separated? |
| Missed opportunities | Are false negatives / undertrading measured? |
| Behavioral data | Are fear/greed/crowding/attention used explicitly? |
| Agent autonomy | What may agents do without human approval? |
| Authority | How is wallet capability bounded/revoked/expired? |
| Explainability | Can a decision be reconstructed after the fact? |
| Recovery | What happens on crash/restart/provider timeout? |
| Security testing | Property/fuzz/stateful/adversarial tests? |
| Production operations | Queues, schedulers, event bus, observability, kill switches? |

## Initial hypotheses to verify

These are **research leads, not frozen facts**:

- Hummingbot V2 may provide useful patterns around parallel controllers and dedicated executors.
- LEAN may provide useful patterns around Alpha → Portfolio Construction → Risk → Execution separation and target portfolios.
- Freqtrade may provide useful patterns around continuously adjusting existing positions.
- Mature event-driven engines such as NautilusTrader/vn.py may provide stronger concurrency/reconciliation patterns than MetaEdge's historical timer-heavy server.
- Hyperliquid copy-trading repos may provide useful leader→follower target exposure, sizing, and reconciliation patterns.
- Colosseum agent projects may contain useful new patterns around source reputation, signal provenance, attention velocity, multi-agent specialization, and wallet authority.

Each hypothesis must be verified from source code/docs before being cited as design evidence.

## Output contract per reviewed system

For every system create a concise record containing:

- system/project;
- repository/source links;
- maturity/activity;
- architecture summary;
- strongest patterns;
- known limitations;
- evidence supporting each conclusion;
- what MetaEdge should `REUSE AS PATTERN`, `ADAPT`, `AVOID`, or `INVESTIGATE`;
- which product/domain decision it may affect.

## Research question of highest priority

The most important cross-system question is:

> How do successful systems remain **decisive under uncertainty** without becoming reckless — particularly when evidence is incomplete but the market is already moving?

Secondary priority:

> How do systems coordinate multiple simultaneous strategies/signals/sources into one portfolio and one execution truth?
