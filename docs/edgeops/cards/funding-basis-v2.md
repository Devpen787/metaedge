# Research Card: funding-basis-v2

Status: variant B = FORWARD-PAPER · variants A, C = KILLED / NOT-OPENED
Created: 2026-07-08 · Pool: structural carry/funding/basis · Instrument: crypto perp + spot (Hyperliquid)
Supersedes: funding-carry-alwayson-v1 (numbers carried forward; template upgraded)

## Participant map (Market Researcher)
Leveraged longs pay hourly funding for perp exposure they can't or won't fund
via spot: retail bull euphoria, capital-constrained traders, momentum chasers.
**They pay us** when we hold the balancing side (short perp) hedged with spot.
Persistence: structural — funding exists BY DESIGN to tether perps to spot;
payment for balance-sheet service, not a mispricing that arbitrage closes.
It compresses when arb capital is abundant (observed: HL majors 2024–26 mean
9.5–13.7% APR, far below 2021-era legend numbers).

## The three variants (never conflated — per the reset review)

### Variant A — unhedged funding exposure (long perp collecting negative funding, or short perp naked)
KILLED WITHOUT TESTING, by risk model: directional exposure dwarfs funding
income (funding ~1bp/h vs price σ ~50–100bp/h). This is a directional trade
wearing a yield costume. Any future interest re-enters as a DIRECTIONAL card.

### Variant B — hedged spot-perp carry (long spot + short 1x perp)
The real structural trade. Historical verdict (2y, train/test, 7 coins, 40bps
episode costs, recorded-premium basis): episode-selector KILLED 7/7
(underperforms always-in everywhere); **always-in survivor: ~13–14% APR on
ETH/BTC net** (per funding-study-2026-07-08).
- Core sentence: because levered longs are incentivized to pay hourly funding
  during normal/bullish regimes, and this appears directly in the funding-rate
  series, we participate via a standing delta-neutral spot-long/perp-short,
  exit only on sustained negative funding, and expect ~8–14% APR after 40bps
  episode costs, basis drift, and negative-funding hours. False if forward
  accrual < 5% APR over 60 days.
- WHERE/WHEN selector: majors (ETH/BTC) only — liquidity + lowest negative-hour
  share; alts add negative-hour drag (SOL 26.6%) without compensating spikes.
- Cost model: 40bps per episode (4 legs); basis from recorded premium; capital
  = 2× notional (both legs funded).
- Risk model: 1x short → liq needs ~+100%; margin-stress flagged at +50%
  excursions (0 observed on majors); UNMODELED: exchange/custody (both legs),
  spot borrow n/a (we hold, not borrow).
- Benchmark/null: cash (0%); the episode selector (killed); MetaMask Money
  Account ~4% APY as the civilian alternative.
- Falsifier: forward paper accrual (from OUR recorder's funding capture,
  $100 notional each ETH+BTC) tracks < 5% APR over 60 days → kill. Any modeled
  assumption found >2× optimistic vs live → kill.
- Frequency/failure: always-on; dies by funding-regime compression (arb
  capital influx) — visible in the same series, exit is graceful.
- Safety classification: paper-forward now; OPERATOR-LIVE-ONLY ever (two-venue
  legs exceed normal-user rails); never competition-eligible.
- Capital honesty: at $100/leg this validates a pool (~$13/yr on majors); it
  deploys meaningfully only when capital scales.

### Variant C — directional strategy with funding overlay
NOT OPENED. Requires a surviving directional strategy first (currently only
rsi_meanrev DOT on trial). If DOT survives forward trial, a v3 card may test
funding-regime as an overlay filter on it — logged as a pre-declared future
hypothesis to avoid post-hoc snooping.

## Data
Contracts: hyperliquid-funding-history + binance-klines-1h + metaedge-recorder-live
(all in docs/data_requirements_and_contracts.md). Missing: none for variant B
forward trial. Dangerous to fake: fill quality at size, exchange risk.

## Sign-offs
MR ✅ (participant map above) · DE ✅ (contracts exist; units bug fixed & documented)
· QR ✅ (train/test, registry +73, selector-vs-benchmark falsification)
· XR ✅ (costs/basis/margin modeled; exchange risk stated unmodeled)
· PS ✅ (paper-forward; operator-live-only ceiling)

## Falsifier denominator — PRE-COMMITTED 2026-07-09, before any data accrued

The historical study reported **APR on NOTIONAL** (`pos.acc += rows[i].funding`
accrues a fraction of notional). But this card's own cost model states capital =
2× notional (both legs funded). Those give different verdicts, so the denominator
is pinned NOW, before evidence exists:

> **The falsifier is evaluated on RETURN ON DEPLOYED CAPITAL (2× notional).**
> This is the stricter, capital-honest reading. Re-reading it as on-notional after
> seeing the numbers would be post-hoc selection and is forbidden.

**Consequence, computed before the trial accrues (`scripts/carry_trial.ts`):**

| sustained funding (APR on notional) | trial APR on capital @ day 60 | verdict |
|---|---|---|
| 8% | 2.78% | KILL |
| 10.95% (**current**) | **4.26%** | **KILL** |
| 12% | 4.78% | KILL |
| 14% | 5.78% | survives |
| 20% | 8.78% | survives |

**Breakeven: ~12.4% sustained funding APR on notional.** Observed HL majors mean
9.5–13.7%. So variant B sits *at the edge of its own historical range* and, at
today's 10.95%, is **projected to fail its own falsifier**. The headline "~13–14%
APR" from the historical study was on NOTIONAL; on capital that is ~6.5–7% — a far
thinner margin over the 5% floor than this card originally implied.

The cost drag explains it: the 40bps round trip needs **~13.3 days of carry to
repay** at current funding. At $100 notional the position earns ~$0.03/day.

If a venue accepts spot as perp collateral (capital ≈ 1× notional), the economics
change materially — that would be a NEW card (v3), never a re-reading of this one.

## Trial mechanics (implemented 2026-07-09)
- Accrual reads the shared `funding_scanner_snapshot` contract via
  `readFundingSeries()` — the scanner's first consumer, not a private bolt-on.
- `premium` is now captured by the recorder (it was previously discarded), so
  basis is measurable from 2026-07-09 forward. Earlier rows report basis
  UNMEASURED — never zero.
- **Capture-coverage guard:** recorder gaps do not accrue, so an outage
  UNDERSTATES carry. Below 90% coverage the trial refuses a verdict rather than
  rendering a false KILL.

## Decision log
2026-07-08: A killed by risk model · B → FORWARD-PAPER (60-day accrual vs 5%
APR floor, from recorder funding capture) · C pre-declared, blocked on a
directional survivor.
2026-07-09: Falsifier denominator pinned to return-on-capital BEFORE data accrued.
Projection at current funding (10.95%) → 4.26% on capital → **would KILL**. Trial
armed and accruing (day 1.5/60). We now EXPECT this card to die. The trial exists
to find out, not to confirm.
