# Data Requirements & Contracts

Rule: **No backtest may run without a data contract.** The funding units bug
(2026-07-08: thresholds in percent compared against fractions, invalidating two
full study runs) is the defect class this document exists to prevent — a
contract's FIELDS/UNITS section forces the check before code runs.

## Contract template

```markdown
### Contract: <dataset-slug>
- Venue / instrument / timeframe:
- Source (exact API/file):
- Fields (name, type, UNITS, example value):
- Timestamp convention (tz, open/close-of-bar, ms/s):
- Alignment (how it joins other datasets; join key):
- Missing-data policy (gaps, halts, listing dates):
- Survivorship considerations:
- Fee model · spread/slippage model · funding/borrow model (if applicable):
- Latency assumption:
- Corporate action / event handling (if applicable):
- WHAT CANNOT BE CONCLUDED from this dataset:
```

## Retroactive contracts for datasets already in use

### Contract: binance-klines-1h
- Venue/instrument/timeframe: Binance spot USDT pairs, 11 tokens, 1h OHLCV, 2y.
- Source: `GET /api/v3/klines` → `data/market/backfill-<SYM>-1h.jsonl` (rebuildable, gitignored).
- Fields: t (ms, bar OPEN time), o/h/l/c (quote USDT, float), v (base vol), qv (quote vol), trades (count).
- Alignment: join on `Math.floor(t/3600000)`; note HL funding stamps ~hh:00 + drift.
- Missing data: MATIC truncated (POL migration, ~2mo only) — excluded from sweeps.
- Survivorship: universe hand-picked from CURRENT majors → survivorship bias
  acknowledged; delisted/collapsed tokens absent. Results overstate universe quality.
- Fees/slippage model: 10bps/side flat (vs measured live 4.5–13bps) — conservative.
- Latency: signals on bar close, entries at NEXT bar open.
- CANNOT conclude: intrabar path (stop-vs-target sequencing is assumed
  conservative), spread dynamics, book depth, exchange downtime effects.
  Binance prices ≠ our live CoinGecko-derived feed (survivors must forward-verify).

### Contract: hyperliquid-funding-history
- Venue/instrument/timeframe: Hyperliquid perps, hourly funding + premium, 2y, 7 coins.
- Source: `POST /info {type:fundingHistory}` → `data/market/funding-hist-<COIN>.jsonl`.
- Fields: t (ms), funding (HOURLY RATE as FRACTION, e.g. 0.0000125 = 1.25bp/h ≈ 11% APR — **always annualize ×24×365×100 before comparing to percent thresholds**), premium (perp-vs-oracle FRACTION).
- Alignment: hour-floor join to klines (see above; timestamps drift seconds past the hour).
- Missing data: none observed in 17,519-row pulls; kPEPE = 1000×PEPE (ratio-safe).
- Fee model: 40bps per 4-leg episode (open/close × spot/perp), conservative.
- CANNOT conclude: exchange/custody risk, fill quality at size, spot-leg borrow
  availability, funding of coins not pulled, pre-2024-07 regimes.

### Contract: metaedge-recorder-live
- Venue/instrument/timeframe: our production feed (CoinGecko primary/Coinbase
  fallback), 11 tokens, 1-minute ticks + hourly funding snapshot, 30d rotation.
- Source: `server/recorder.ts` → `data/market/ticks-*.jsonl`, `funding-*.jsonl` (on the VM).
- Fields: t (ms), sym, px (USD float), chg24h (PERCENT), vol24h (USD), hi/lo24h.
- Alignment: the ONLY dataset that matches live paper fills exactly (same feed).
- Missing-data policy: recorder gaps = server restarts; strategies requiring
  history must DECLINE (INSUFFICIENT_HISTORY), never backfill from other feeds.
- CANNOT conclude: anything before 2026-07-07 (recorder birth); order-book
  microstructure; true spreads.

## Data inventory & classifications

Populated by Foundation Task B (see decision record 2026-07-08). Classes:
`available` · `missing-required-now` · `useful-later` · `irrelevant-to-venue` ·
`dangerous-to-fake`.
