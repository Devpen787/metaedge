# Trading Canon — the literature, encoded

Date: 2026-07-07 · Status: doctrine (each law is either enforced in code, partially enforced, or TODO with a named home)

The point of this file: knowledge that isn't executable is decoration. Each law
below is distilled from the trading canon (Douglas, Murphy, Chan, Bandy,
Carver, López de Prado, Schwager) and mapped to WHERE it lives in our pipeline.
When a law is TODO, it names the smallest next artifact.

## The arc (why each law exists)

Chart-reading era (pre-1970s): psychology was the edge → *lesson: discipline beats prediction.*
Indicator era (1970s–80s, Murphy): shared signals decay → *lesson: public indicators are vocabulary, not edge.*
Systematic era (1990s–2000s, Chan/Bandy): process beats conviction → *lesson: validate or die.*
ML era (2010s, López de Prado): compute made self-deception scalable → *lesson: the main risk is fooling yourself faster.*
Agentic era (now): raw signals arbitraged; what remains for small operators is process quality, niche access, and honesty at machine speed.

## Laws and where they live

### From Douglas (Trading in the Zone) — psychology as architecture
1. **Think in expectancy over samples, never in single trades.** ENFORCED: report acts only on n≥30; single-trade outcomes never change cards.
2. **No overrides mid-plan; the plan is written before entry.** ENFORCED: pre-committed cards (stop/target/size before trigger), operator approval, fail-closed halts.
3. **Anything can happen — size so that being wrong is survivable.** ENFORCED for real money (equity floors, ≤$1 risk per shot). TODO for sizing *method* (see Carver, law 12).

### From Murphy (Technical Analysis) — signals as vocabulary
4. **Indicators are features, not strategies.** PARTIAL: candles backfilled (2y × 11 tokens); indicator computation (MA/RSI/ATR/volume features) not yet implemented. → next artifact: feature functions over backfill JSONL.
5. **Confirm across dimensions (trend + momentum + volume), never one signal alone.** TODO: current brains use one signal (24h change) by design as baselines. New cards must combine ≥2 orthogonal features.

### From Chan (Quantitative/Algorithmic Trading) — strategy archetypes
6. **Momentum and mean-reversion are the two primitive families; know which regime you're in.** PARTIAL: both families run as baselines; regime is labeled on theses but doesn't gate anything yet. → regime filter as a card.
7. **A strategy is a business: costs, capacity, and operational risk first.** ENFORCED: cost-pessimistic fills (10bps/side), measured real venue costs (5–13bps), ops guardrails.

### From Bandy (Quantitative Trading Systems) — validation discipline
8. **In-sample optimization is meaningless without out-of-sample survival.** TODO (the big one): the backtester over backfill must split train/validate by TIME (walk-forward), never optimize on the full series. → next artifact: `scripts/backtest_sweep.mjs` with walk-forward.
9. **Report many metrics; refuse to act on return alone.** PARTIAL: expectancy/win-rate/avg win-loss exist; missing: max drawdown, profit factor, Sharpe-style ratio per family. → add to edge report + backtester.

### From López de Prado (Advances in Financial ML) — the self-deception defenses
10. **Multiple testing destroys naive significance: track EVERY hypothesis tried, not just survivors.** PARTIAL: family cap (≤5) + declined accounting exist; missing: a hypothesis registry counting all tested variants so the acceptance bar rises with the number of trials. → registry file + deflated threshold in report.
11. **Leakage and look-ahead are the default state, not the exception.** PARTIAL: forward paper-testing is leak-proof by construction (data arrives in real time); the backtester must enforce it for historical sweeps (no future bars in features, embargo between train/test windows).

### From Carver (Systematic Trading) — sizing and portfolio
12. **Size by volatility target, capped fractional Kelly; never fixed notional across assets.** TODO: autotrader uses fixed $250 clips. → volatility-scaled sizing as a card once ATR features exist (law 4).
13. **Diversification across uncorrelated families beats optimizing one.** PARTIAL: 4 families run; correlation between their returns not yet measured. → correlation block in edge report when n allows.

### From Schwager (Market Wizards) — the meta-lesson
14. **Every wizard's edge was different; all shared risk control and process fidelity.** ENFORCED as culture: guardrails, decision logs, restraint accounting, honest reports.

## Adoption rules for outside tools (frameworks, repos)
- Adopt PRINCIPLES (vectorized sweeps, walk-forward, purged splits) into OUR stack — one pipeline, one feed, one cost model across backtest/paper/live.
- Do not pivot stacks to chase a framework. A backtester that uses a different feed than live trading reintroduces the exact mismatch we built the recorder to kill.
- Any external strategy code is a HYPOTHESIS SOURCE, never a drop-in: it enters through a research card like every other idea.

## Reading order (for humans joining the project)
Douglas → Murphy (skim as vocabulary) → Chan (Quantitative Trading) → Bandy → López de Prado. Carver alongside Bandy. Schwager for perspective between heavier books.
