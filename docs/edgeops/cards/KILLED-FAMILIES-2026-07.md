# Killed Families — consolidated retro-cards (2026-07)

Process confession: these families were tested BEFORE the no-card-no-code rule
existed (reset 2026-07-08). They are retro-carded here in one consolidated
record — creating six full template files for corpses would be ceremony; the
registry holds every number. New kills get full cards going forward.

Common test design: walk-forward (6mo train → 48-bar embargo → 2mo test, 9
folds), 2y × 1h × 10 tokens, 10bps/side costs, long-only. All evaluations in
`data/edgeops/hypothesis-registry.jsonl` (2,916 + 73 rows).

| Family (card-id) | Participant hypothesis (retro) | OOS verdict | Killed because |
|---|---|---|---|
| momentum_breakout-v1 | late crowd chases confirmed breakouts | 10/10 rejected (best: DOGE PF 1.02) | no one reliably pays breakout buyers after costs on this universe/period |
| trend_atr-v1 (Carver) | slow reactors under-position in trends | 10/10 rejected, PF 0.62–1.08, DD to 70% | 1h crypto trend too choppy; whips eat the trail |
| meanrev_stab-v1 | panic sellers overshoot, stabilize | 10/10 rejected; nearest misses XRP PF 1.50, LINK 1.17 | fold-inconsistency; revisit only with raised bar (snooping logged) |
| vol_squeeze-v1 | compression precedes expansion (law 15) | 10/10 rejected, PF 0.37–0.90 | breakouts from squeezes get faded/chopped after costs |
| volume_surge-v1 | participation spikes carry information | 10/10 rejected; least-bad family (XRP 1.31, DOT 1.26) | signal too public; retained as SELECTOR concept, dead as entry |
| relstrength-v1 (Chan) | laggards chase recent winners | portfolio rejected, PF 0.49, −92% DD | buying winners weekly was the worst idea tested |
| grid-24h-v1 (paper baseline) | none — control arm | realized n=542, −$0.48/trade | did its control job; killed by rule (late — flagged by Devin) |
| custom_ai-24h-v1 (paper baseline) | none — noise arm | realized n=268, −$0.76/trade | same |
| funding episode-selector (under funding-basis-v2) | harvest only funding spikes | killed 7/7 vs always-in benchmark | cleverness subtracted value; costs + missed drip |

Survivors as of this record: **rsi_meanrev DOT** (forward trial, arms ~Jul 16)
and **funding-basis-v2 variant B** (forward paper accrual). Everything else on
this page is dead and stays dead unless a NEW card with a raised bar reopens it.
