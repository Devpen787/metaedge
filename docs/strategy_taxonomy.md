# Strategy Taxonomy

Strategies are classified by INSTRUMENT MECHANICS and SOURCE OF EDGE — never by
indicator. "RSI strategy" is not a classification; RSI is a feature.

## Instrument classes (what we can touch)

| Class | Status for us | Notes |
|---|---|---|
| Spot crypto | TRADEABLE (paper + operator-live) | 11-token CONVENIENCE list (see universe note); Arbitrum real rails |
| Crypto perps | TRADEABLE (paper + operator-live) | Hyperliquid via mm; funding = structural data |
| Paper synthetic instruments | PLATFORM-NATIVE | MetaEdge paper ledger; cost-adjusted fills |
| Competition instruments | PLATFORM-NATIVE | Arena scoring; scoring reform queued (no raw-PnL ranking) |
| Options | SIGNAL DATA ONLY | We never execute options; OI/skew/expiry may inform spot/perp cards |
| Stocks / tokenized stocks / ETFs / futures | IRRELEVANT TO CURRENT VENUE | Revisit only on venue expansion |
| Illiquid tokens | AVOID | Energy floor + manipulation adjacency |

## Opportunity pools (source of edge)

| Pool | Who pays us | Our access | Tested? |
|---|---|---|---|
| Structural carry / funding / basis | Levered longs paying for exposure | ✅ best fit | ✅ carry survivor (card alwayson-v1); episode selector killed |
| Dislocation / liquidation cascades | Forced sellers | ✅ patience fits | ❌ needs liquidation data |
| Trend / momentum | Late crowd | tested | ❌ killed 10/10 (1h) |
| Mean reversion | Panic/euphoria overshoot | tested | 🟡 DOT survivor on forward trial |
| Volatility expansion / compression | Straddle-like flows | tested | ❌ killed as entry; retained as selector concept |
| Options / expiry / dealer hedging | Hedging flows around expiries | signal-only | ❌ untested — data gap (law 16) |
| Relative value / pairs | Divergence traders | tested (rotation) | ❌ killed hard |
| Event-driven | Slow reactors to catalysts | possible | ❌ no event calendar wired |
| Liquidity provision / market making | Spread crossers | ❌ out of scope | infra/capital prohibitive |
| Allocation / rebalancing | n/a (self-service) | platform feature | not a trading edge |
| Execution / cost reduction | ourselves | ✅ proven | ✅ measured 0.048% RT live |

## Universe note (2026-07-09) — the 11-token list is a convenience, not a choice

The live universe (`server/prices.ts`) is 11 hand-typed majors, inherited from
seed data. Our own data contract confesses the resulting survivorship bias, and
the trigger loop pins one asset per agent (`autotrader.ts`) — the machine cannot
"scan N assets, act where a condition is met." Under this model that is a
FAILURE MODE, not a design: universe membership must become a deliberate
opportunity-field decision, and triggering must become scan-and-select gated by
a WHERE/WHEN selector (order-of-operations step 6). Any universe change is a
data decision (contract required), never a convenience edit.

## Classification rule

Every research card names exactly one instrument class and one primary pool.
A card claiming edge without naming WHO PAYS US in that pool is invalid.
"Volume spiked" / "volatility spiked" is a TRADABILITY observation (step 6),
never an edge — a card that stops there is invalid.
