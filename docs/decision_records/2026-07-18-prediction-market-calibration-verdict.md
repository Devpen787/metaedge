# Prediction-market lane (#1): calibration edge — VERDICT

Date: 2026-07-18
Status: DECIDED — no capturable calibration edge. Lane set to self-monitor forward.
Companion tool: `scripts/kalshi_calibration.mjs`. Data source: the read-only
`kalshi_scout.mjs` (VM cron `*/5`, blind recording).

## The question

The cheapest, highest-probability edge in the prediction-market lane is
**calibration / favorite-longshot bias**: when the crowd prices an event at P%,
does it happen P% of the time? A systematic, well-populated gap is a tradeable
edge that needs **no forecast of ours** — only fading the mispriced side. It also
carries none of the model-error risk that made the counting/fair-value probe
suspect (it uses the market's own implied price, not a model we built).

## What was measured

Joined the scout's blind-recorded **implied price** (last two-sided quote ≥2 min
before close, mid of bid/ask) to its blind-recorded **realized outcome**
(yes/no), over 2026-07-16..18. Terminal and barrier markets bucketed separately;
one observation per market; two-sided non-degenerate books only.

- 67,601 resolutions recorded; **3,960 joined** a genuinely tradeable quote.
- The 63,641 unmatched were **validated as correctly excluded**: spot-checked
  tickers had one-sided books (e.g. a 15-min market quoted `0.90 / 1.00` — no real
  ask) or were never quoted (degenerate boundary strikes). The join is not broken;
  most Kalshi crypto markets simply have no real two-sided book.

## Verdict: NO capturable edge

- **Efficient where liquid.** Big-n buckets sit within ~1–2c of truth:
  2c→0.9% (n=1317), 98c→99.3% (n=876), 93c→95% (n=228), 88c→92% (n=131). Every
  one of those gaps is **smaller than its bid-ask spread**. Zero buckets cleared
  the bar (n≥100 AND post-cost edge >2c). Holds under a volume filter too.
- **The one real bias is uncapturable.** Longshots at 2c are overpriced (happen
  0.9%) — textbook favorite-longshot — but that's ~1c of edge behind a ~1.7c
  spread. Visible, not keepable.
- **The fast-recycle thesis is dead.** The 15-minute series (the whole
  "capital recycles ~96×/day" argument) have **one-sided books**
  (`0.90 / 1.00`) — structurally untradeable. Fees + wide spreads eat everything.

## The single thread worth watching (not a trade)

The 60–72c buckets consistently showed YES **underpriced** (priced ~65%, realized
~78%) across both the full and volume-filtered runs. But combined n≈140, spreads
~4c, so it is a **hypothesis, not an edge**. It is exactly what the forward
monitor exists to confirm or bury as n grows.

## What "done and set to fly" means for this lane

Rather than build a paper harness to bet an edge the measurement says isn't there
(the over-building mistake this whole effort exists to avoid), the lane is left as
a **self-monitor**: `kalshi_calibration.mjs` runs daily on the VM against the
still-accruing blind scout data and prints a greppable
`CALIBRATION VERDICT ... FLAGS=n` line. FLAGS stays 0 → nothing to do. If a real
bias ever appears (regime change, the 60–72c thread firming up), it flags itself,
and only then is a paper harness justified.

## Scope of this verdict

Kills the **calibration / longshot-fade** sub-thesis, the lane's strongest and
cheapest. It does not by itself prove the counting/fair-value strike-mispricing
idea is dead — but an aggregate-efficient market makes persistent individual
mispricings unlikely, so that idea drops in priority. Cross-venue remains PARKED
(see RESEARCH_BACKLOG #1). Recommendation: move build effort to the next lane;
let this one watch.
