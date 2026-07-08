# Research Card: funding-carry-alwayson-v1

Status: HISTORICAL SURVIVOR — earns a forward paper trial. NOT an edge yet.
Created: 2026-07-08 · Pool: structural carry · Venue: Hyperliquid perp + spot

## Hypothesis
Permanent delta-neutral carry (long spot + short 1x perp) harvests the
structural funding premium longs pay for leverage. Boring, always-on, no
prediction. The CLEVER version (episode selector) was tested and KILLED — it
underperformed always-in on all 7 coins (selector costs + missed baseline drip
exceeded spike capture).

## Screened result (test year, costs 40bps + recorded basis)
Net per half-year: ETH +7.1% · BTC +6.8% · DOGE +6.4% · AVAX +5.6% ·
kPEPE +4.9% · WIF +3.9% · SOL +1.3%  (≈ 3–14% APR range; majors ~13-14% APR)

## Modeled risks
Hedge: delta-neutral by construction. Basis: from recorded premium (small drag).
Costs: 40bps/roundtrip. Margin: 1x short, stress only at >50% up-moves.
UNMODELED: exchange/custody risk both legs; negative-funding stretches (12-27%
of hours) accrue as real drag — included in the numbers.

## Falsifier (kill conditions)
- Forward paper accrual (from OUR recorder's funding capture) tracks below
  5% APR over 60 days → kill.
- Any modeled assumption (basis, costs) found >2x optimistic vs live → kill.

## Forward-trial plan
Paper: daily report accrues hypothetical carry from recorded hourly funding
(ETH+BTC, $100 notional each) vs the 5% APR floor. Real money only after 60
clean days AND capital sized so the yield matters (at $100, 13% APR = $13/yr —
validate now, deploy when capital scales).

## Capital honesty
This pool pays single-digit dollars at our current size. Its value today is
VALIDATION — a proven, boring, structural return ready for when capital exists.
