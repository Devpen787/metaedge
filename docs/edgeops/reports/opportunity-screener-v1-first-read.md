# Opportunity Screener v1 — First Read (2026-07-09)

Read-only scanner, first executions. No trades, no wallet, no execution path.
Card: `docs/edgeops/cards/opportunity-screener-v1.md`.

## What changed
The research universe was **decoupled from the product catalog**. `server/prices.ts`
is the website's coin list (it carries `name`, `description`, `marketCap`, `supply`
because the UI renders them). Adding a coin for research meant writing marketing
copy — which is why the universe froze at 11. `server/opportunity/feed.ts` now
supplies price/volume/range only, selected by the criterion in the metaedge-universe
contract.

## Results (actual output)

| | Tier 0 (product catalog) | Tier 1 (criterion-selected) |
|---|---|---|
| Universe size | 11 | **41** |
| Selected how | hand-typed seed list | volume floor + quality filters |
| `funding_basis` candidates | 3 | **3** |
| `energy_liquidity` candidates | 0 | **0** |
| Declines | 8 `NO_FUNDING_DATA` | 38 `NO_FUNDING_DATA`, 41 `INSUFFICIENT_HISTORY` |

Excluded from the top-100-by-volume fetch, **with reasons recorded as evidence**:
- `STABLECOIN` (12): USDT USDC USD1 USDS USDG DAI USDE PYUSD RLUSD FDUSD USDCX USDCV
- `WASH_ADJACENT` (17): QUQ CAP LAB KAITO WETH NES DATA VANRY CASHCAT UP SLX EVAA TLM SKYAI SYN HMSTR BLUR
- `LIQUIDITY_FLOOR` (27): TRUMP JTO ANSEM HBAR XMR FET SENT EURC TIA APT PENGU EIGEN SPCXB OP PENDLE ICP ETHFI GRASS TAG VVV BONK RUNE POL DEXE AERO CHZ VIRTUAL
- `BROKEN_FEED` (3): RSPCX SHEB MPRA

## Three bugs this exercise caught

**1. Open-interest units (would have inverted every funding ranking).**
Hyperliquid reports OI in base-coin units, not USD. The scorer percentile-ranked
coin counts and placed BTC (≈$2.38B OI) **last**, behind SOL (≈$412M). Fixed to
`openInterest × markPx`. Ranking corrected to BTC > ETH > SOL. Second units defect
in this project after funding fraction-vs-percent.

**2. A hand-maintained stablecoin denylist is the wrong tool.**
The first draft listed USDT/USDC/DAI/… and **missed USDG**. Replaced with a
structural test (`|price−1| < 0.02` AND `range/price < 0.01`), which now catches
all 12 including USDG, RLUSD, USDCX, USDCV — coins nobody enumerated.

**3. A top-40 rank cutoff silently excluded our own survivor.**
DOT ranks #52 by volume ($67M) — above the $50M floor. A round-number rank cutoff
would have dropped **the only directional strategy we have on trial** from its own
research universe, for no reason but convenience. This is the same unexamined-default
failure as the 1h timeframe. Rank is now a fetch bound; membership is decided by the
liquidity floor + quality filters. DOT is in; MATIC (dead, $0 volume, still sitting in
the product catalog) is correctly out.

## The finding that matters

**Widening the universe changed nothing about what we can actually score.** The
scanner now *selects* 41 coins and can *evaluate* almost none of them, because
capture never widened:

- `INSUFFICIENT_HISTORY` — the recorder still records `Object.entries(serverPrices)`,
  i.e. the 11 product-catalog coins. The other 30 have **zero** recorded ticks, so
  realized vol is null and they decline. They will decline *forever* until the
  recorder points at the research universe.
- `NO_FUNDING_DATA` (38 of 41) — funding capture is hardcoded to ETH/BTC/SOL
  (`recorder.ts:47`).

So the scanner's honest verdict on itself: **selection is fixed, capture is not.**
It converted "we watch 11 coins" from a vague unease into two precise, machine-readable
capture gaps.

## Costs
- **API:** one CoinGecko `/coins/markets` call returns all 100 rows (cached 10 min).
  Going 11 → 41 coins costs **zero** extra calls.
- **Funding cost, corrected.** An earlier draft of this report claimed "funding is
  per-coin → linear." That conflated two endpoints. Hyperliquid `metaAndAssetCtxs`
  (the LIVE hourly capture the recorder already makes) returns **all 231 perps in
  ONE call**, each with funding, OI and mark price — and `recorder.ts:47` throws 228
  of them away. Widening live funding capture costs **zero** additional calls. Only
  the HISTORICAL `fundingHistory` backfill is genuinely per-coin and paginated.
- **Storage:** ticks scale linearly (~2MB/day for 11 → ~7.5MB/day for 41), well inside
  the 30-day rotation budget.

## Honest limits of these runs
- Executed standalone, so `getHourlyCloses` was empty for **every** symbol — hence
  41/41 `INSUFFICIENT_HISTORY`. On the VM the ~9 overlapping catalog coins would have
  history; the ~30 new ones still would not, because the recorder does not record them.
  The structural conclusion is unchanged.
- `WETH` was excluded as `WASH_ADJACENT`. **Right outcome, wrong reason:** CoinGecko's
  WETH market cap counts only wrapped supply, inflating vol/mcap. WETH should be excluded
  as a *wrapper/duplicate of ETH*. The criterion has no wrapper rule.
- `XAUT` and `PAXG` (gold-backed, ~$4,095) passed every filter. They are a **different
  asset class** with different drivers. The criterion has no asset-class rule.
- Surviving these filters does not mean an asset is manipulation-free or tradeable at
  size. Depth and spread remain unmeasured.

## Replace or coexist with pinned agents?
**Coexist.** The scanner has still routed no edge and its falsifier (beat fixed-universe
always-on + a random-mask control on post-cost forward expectancy) remains **untested**.
It has not earned the right to allocate capital. DOT's trial stays a pinned agent.

## Next highest-priority implementation task
**Point the recorder at the research universe instead of the product catalog.**
`recorder.ts` records `serverPrices` (11 catalog coins) and funding for a hardcoded
`['ETH','BTC','SOL']`. Both must read the Tier-1 membership list. Until then the scanner
can select 41 coins and score 3 — the widened universe is cosmetic.

The funding half of that is nearly free: the hourly `metaAndAssetCtxs` call ALREADY
returns all 231 perps, and we discard 228. Removing the hardcoded filter closes 38 of
41 `NO_FUNDING_DATA` declines at zero API cost. The capture universe is still listed
explicitly in the contract — because membership is a recorded data decision, not
because calls are scarce.
