# Decision Record: Research OS Reset — 2026-07-08

Source: Devin-supplied meta-review (advisor critique of the agent's research
patterns + an improved operating model). Used ONCE as source material per its
own instruction; this record + the docs it spawned are the durable artifacts.
The full review text is NOT retained as a standing prompt.

## Review verdicts (deep review, not blind adoption)

**ADOPTED (new, valuable):**
- Evidence hierarchy (9 levels; levels 6–9 = hypothesis material, never proof)
- Five-role sign-off (Market Researcher / Data Engineer / Quant Researcher /
  Execution-Risk Officer / Product Safety Officer)
- No strategy code before a research card — hard gate
- No backtest before a data contract — hard gate
- Anti-pattern enforcement section ("you are failing if…")
- Compressed standing operating model instead of pasted reports

**ADAPTED (would violate its own critique if followed blindly):**
- The 7-doc set is consolidated against existing artifacts to avoid doc sprawl:
  `trading_research_operating_model.md` SUPERSEDES `docs/edgeops/RESEARCH_CHARTER.md`
  (charter kept as history with a superseded header). `TRADING_CANON.md` is
  demoted to evidence rules UNDER the model. `DATA_MODEL.md` (platform storage)
  is unrelated and untouched.
- Stocks/tokenized stocks: marked irrelevant-to-current-venue in inventories,
  not built out.
- "Feed the deep research report once": there is no separate 20-page report;
  the pasted review IS the source material and was consumed as such.

**CONFESSED VIOLATIONS this reset fixes:**
- vol_squeeze / volume_surge / trend_atr / meanrev_stab / relstrength were
  tested with NO research cards; rsi_meanrev was carded AFTER its backtest.
- The funding units bug (fraction vs percent, invalidated two full runs) is
  precisely the defect class a data contract's fields/units section catches.
- 1h timeframe was inherited from data convenience, not chosen.

**PRODUCT IMPLICATION LOGGED (not doctrine-only):**
- "No competition scoring by raw PnL alone" → Agent Arena scoring change
  (risk-adjusted / expectancy-aware) queued as a product decision.

## Execution plan (one step per turn-sized task, in order)

1. [this turn] Doc bundle: this record; trading_research_operating_model.md;
   research_card_template.md; data_requirements_and_contracts.md (template +
   retroactive contracts for datasets already used); strategy_taxonomy.md;
   backtest_validation_rules.md; agent_and_user_safety_policy.md; charter
   marked superseded.
2. Foundation task A: instrument/opportunity inventory (spot, perps,
   options-as-signal-only, paper synthetics, competition instruments; stocks
   marked N/A) → docs/instrument_opportunity_inventory.md.
3. Foundation task B: data inventory with classifications (available /
   missing-required-now / useful-later / irrelevant / dangerous-to-fake) →
   appended to data_requirements_and_contracts.md.
4. Foundation task C: funding/basis research card v2 on the new template,
   separating unhedged funding exposure / hedged spot-perp carry / directional
   with funding overlay (upgrades funding-carry-alwayson-v1).
5. Retro-card the uncarded tested families as KILLED cards (registry
   completeness): vol_squeeze, volume_surge, trend_atr, meanrev_stab,
   relstrength, momentum_breakout.
6. Only then: choose the next implementation task per the model's priorities.

## Mandatory from this date

No strategy code without a card. No backtest without a data contract. Every
research response ends with: files changed / tests-checks run / data added or
missing / decision record update / blockers / next highest-priority action.
