# Decision Readiness

Status: **Working product-foundation guide**

## Ready to freeze

- Product cycle: Discover → Understand → Test → Act → Manage → Learn → Scale.
- Shared CopySource model for wallets, traders, strategies, agents, portfolios, cohorts and signal providers.
- No single confidence score as the main permission gate.
- Weak but valid evidence may map to shadow/scout/reduced exposure; objective integrity constraints may block.
- Strategies/source loops propose desired exposure rather than direct broker commands.
- Continuous position management.
- Many observation/reasoning loops with one portfolio authority and one execution authority.
- Paper and real share strategy/evidence logic but not execution authority or mutable order state.
- A launched Paper Agent may operate unattended inside its approved deterministic envelope.

## Ready to design, but not freeze numerically

- exploration sizing defaults;
- Evidence Profile taxonomy;
- portfolio view aggregation;
- source reputation methodology;
- V1 spot-only vs spot + paper perps.

## Still needs focused research before implementation

- exact current MetaMask real-execution and async/reconciliation contracts;
- canonical market/flow/on-chain/social data providers;
- production queue/event/scheduler technology;
- real-copy product/compliance boundaries.

## Research stop rule

Do not add another framework merely because it exists. Add research only when a specific open decision lacks evidence, current sources materially disagree, a changing vendor/API matters, a security assumption needs verification, or a real operating failure exposes a missing pattern.

## Conclusion

Source coverage is sufficient to complete the V1 product foundation and derive the first domain/state model. The remaining gaps are targeted implementation or quantitative-design questions, not reasons to stop product definition.
