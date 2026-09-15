# MetaEdge Relaunch — Start Here

Status: **Product-foundation draft**  
Branch: `relaunch/product-foundation`  
Base checkpoint: `codex/metaedge-v5-paper-checkpoint` @ `99246ada41bd0979ef7aaa603a730b09c30572f1`

## What MetaEdge is becoming

MetaEdge develops financially competent agents that **discover opportunities, reason under uncertainty, take bounded action, manage positions, learn from outcomes, and progressively earn authority**.

The product cycle is:

**Discover → Understand → Test → Act → Manage → Learn → Scale**

A source of edge can be a market pattern, wallet, trader, strategy, agent, portfolio, cohort, or signal provider.

## Current relaunch rule

This branch is **documentation/contracts only** until a human explicitly approves implementation.

Do not refactor product code, change execution behavior, enable live trading, deploy, sign transactions, move funds, or delete legacy implementation from this branch.

## Authority order

When documents conflict, use this order:

1. `docs/00-constitution/PRODUCT_CONSTITUTION.md`
2. approved product contracts in `docs/01-product/`
3. approved journeys in `docs/02-journeys/`
4. domain/state/security contracts
5. current architecture/migration decisions
6. research and archaeology as supporting evidence only

Historical implementation and old agent handoffs are **not product authority** unless explicitly adopted by the relaunch documents.

## Core product decisions under this foundation

- Safety must bound action without turning ordinary uncertainty into permanent inactivity.
- Weak evidence normally reduces exposure; only hard safety/integrity constraints may force a block.
- Signals propose **target exposure**, not direct broker commands.
- Many loops may observe and propose concurrently; one portfolio authority resolves aggregate exposure; one execution authority mutates trading state.
- Copying means observing and transforming wallets, traders, strategies, agents, portfolios, cohorts, or signal providers under the user's own risk policy.
- Paper and real may share strategy logic and evidence, but never share execution authority or mutable trade state.
- Human psychology is market data; human emotion is not execution authority.
- AI models are reasoning components, not durable memory or financial authority.
- A no-trade decision is accountable and should be evaluated against its counterfactual outcome.

## Read next

- `docs/CURRENT_STATE.md`
- `docs/00-constitution/PRODUCT_CONSTITUTION.md`
- `docs/01-product/PRODUCT_MODEL.md`
- `docs/01-product/COPY_AND_SOURCE_MODEL.md`
- `docs/01-product/RISK_AND_EXPLORATION.md`
- `docs/01-product/AGENT_MODEL.md`
- `docs/01-product/PAPER_TO_REAL.md`
- `docs/02-journeys/INDEX.md`
- `docs/04-decision-system/PARALLEL_LOOPS.md`
- `docs/07-research/EXTERNAL_SYSTEM_GAP_MATRIX.md`
- `docs/09-decisions/DECISION_LOG.md`

## Legacy status

The pre-relaunch codebase is a **quarry**: it contains valuable tested components, research, failure lessons, and historical evidence. Nothing is deleted yet. Every substantial capability must later earn `REUSE`, `ADAPT`, `REPLACE`, `REMOVE`, `DEFER`, or `UNKNOWN / NEEDS PROOF` status before entering the clean relaunch architecture.
