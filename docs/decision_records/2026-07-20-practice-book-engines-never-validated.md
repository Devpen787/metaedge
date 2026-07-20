# practice_book.mjs's 6 engines: never validated, PnL is not evidence

Date: 2026-07-20
Status: DECIDED — the 6 crypto_core.mjs engines are retired as candidate
strategies. practice_book.mjs keeps running (it still exercises the Risk OS),
but its equity curve is not to be read as a performance signal, and no further
effort should go into optimizing it. Companion: [[edge-lanes-scoreboard]].

## Why this record exists

A Cluster-1a A/B test (adding a trailing stop) surfaced practice_book.mjs
running -73% to -80% equity. Investigated the mechanics thoroughly (conviction
bar, cost isolation, per-family attribution, universe breadth) and shipped a
real fix — restricting the tradeable universe to liquid large-caps took net
equity from -79.1% to -23.3%. That work was sound on its own terms, but Devin
then asked the more fundamental question the investigation had skipped: does
hourly RSI mean-reversion (or any of the other 5 families) even make sense as
a recurring trade in the first place? It doesn't, and the answer was sitting
in the code's own comments.

## What the 6 engines actually are

`scripts/engines/crypto_core.mjs`'s own header: *"these run on ROBUST, SIMPLE,
NON-OPTIMIZED defaults... deliberately DIFFERENT from the swept survivors that
failed robustness (e.g. rsi_meanrev here is 25/30, never the swept 35/0.03)."*

Translated: a real parameter sweep was run on these families at some point,
found "best" thresholds (e.g. RSI 35 / stop 0.03), and that optimized version
**failed robustness testing**. The response was to swap in generic textbook
parameters instead of the overfit ones — reasoning that at least those aren't
curve-fit to this data.

That fixes exactly one failure mode (curve-fitting). It does not establish
that the strategy *type* has any real edge at all — if anything, a sweep's
optimized best case failing robustness is weak evidence AGAINST the type
having edge on this universe/timeframe, not neutral.

## Where this fails the system's own bar

`docs/trading_research_operating_model.md` requires, before any strategy
exists: a named participant forced/incentivized/constrained to a behavior, a
stated mechanism for why that persists, and a falsifier (gates 1-2 of 12, "NO
CARD, NO CODE"). None of the 6 families (rsi_meanrev, meanrev_stab,
vol_squeeze, momentum_breakout, trend_atr, volume_surge) have this. There is
no answer anywhere to "who is forced to sell at RSI(25) on an hourly crypto
bar, and why would that reverse predictably enough to profit from, every
hour, across dozens of coins, indefinitely." They are what the operating
model's own evidence hierarchy calls level 8 of 9 — "public internet strategy
recipes" — a hypothesis SOURCE, never proof, explicitly not the same thing as
a validated edge.

practice_book.mjs's own header already says this plainly and was simply not
being taken literally: *"Its job is NOT to find edge... PnL is secondary."*
Chasing its equity curve (which is exactly what the Cluster-1a follow-up did)
was optimizing something the file itself says doesn't matter.

## Verdict

Retiring the 6 engines as candidate strategies — not deleting the code (it
still generates realistic trade flow to stress-test stops/sizing/kill-switches,
which is the file's real job), but no longer treating improvements to its PnL
as progress, and no longer implying — in reporting or in future work — that a
better equity curve here means anything was found.

This is the fourth independent strike in the same direction as
[[2026-07-18-crypto-meanrev-timeframe-robustness-kill]] and the Kalshi/
momentum-on-majors findings: generic, unvalidated technical signals keep
failing to clear the bar this system holds everything else to. The pattern is
consistent enough that running all 6 families through the full research-card
gate (Market Researcher sign-off, falsifier, etc.) would very likely produce
the same negative result each time — available as a deliberate next step if
ever worth the cost, but not undertaken now given how predictable the outcome
looks from the accumulated evidence.

## Consequence

The Risk OS (stops, sizing, kill-switch) is currently only exercised by
strategies known not to be real edge. If real trade flow is wanted to stress
it, the honest option is wiring practice_book.mjs to the same signal sources
already going through the real process elsewhere in this codebase (momentum
scout/grader, memecoin scout/grader) rather than inventing a 7th generic
technical-analysis family — not done in this pass, logged as the natural next
step if picked up.
