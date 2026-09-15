# System Overview — Relaunch Direction

Status: **Conceptual architecture draft; implementation not authorized**

## Product-to-system map

MetaEdge should remain organized around the product cycle:

**Discover → Understand → Test → Act → Manage → Learn → Scale**

The architecture should support this without letting data providers, LLM vendors, wallet SDKs, or legacy stores become product authority.

## Conceptual layers

### 1. Identity / user policy

Owns:

- user/account identity;
- paper portfolios;
- preferences;
- copy policies;
- risk policies;
- future wallet associations.

Application identity is not the same thing as wallet identity.

### 2. Evidence / market intelligence

Owns immutable, provenance-bearing observations from:

- market data;
- flows/liquidity;
- derivatives;
- wallets/traders;
- on-chain sources;
- behavioral/narrative sources;
- catalysts/news;
- source activity.

This layer records observations. It does not authorize trades.

### 3. Strategy / source interpretation

Owns:

- strategy definitions and versions;
- source interpretations;
- thesis/invalidation;
- evidence profiles;
- views/desired exposure contributions.

LLMs may assist interpretation but do not own strategy or financial state.

### 4. Portfolio authority

Owns the aggregate target exposure across:

- user strategies;
- copied wallets/traders;
- agents;
- manual views;
- exploration sleeves;
- confirmed/core sleeves.

This is the single authority that resolves conflicting views and current exposure.

### 5. Risk authority

Applies objective policy and integrity constraints to portfolio targets.

Risk may clip, force reduction, or hard-block for explicit reasons. It does not decide the market thesis.

### 6. Execution domains

Separate paths:

- Paper Execution
- Future Real Execution

The paths may receive the same target-exposure decision but create distinct intents, state, authorization, and reconciliation.

### 7. Reconciliation / positions

Owns canonical execution outcome and resulting positions.

Explicit states include pending, partial, complete, rejected, expired, failed, and unknown/reconciliation-required where appropriate.

### 8. Learning / attribution

Owns:

- trade/source/strategy attribution;
- execution-quality comparison;
- regime analysis;
- missed-opportunity counterfactuals;
- paper-vs-real calibration;
- agent track record;
- strategy/source lifecycle recommendations.

Historical evidence is append-only in meaning: a new decision/version does not rewrite an old result.

## Critical write-authority rule

The relaunch should have many readers and proposers, but very few financial writers:

- observation loops write evidence;
- strategy/source loops write views;
- portfolio authority writes target exposure;
- paper execution writes paper order/fill state;
- future real execution writes real-operation state;
- reconciliation writes canonical outcomes/positions.

No observation, LLM, copied source, or strategy plugin directly writes wallet/financial execution state.

## Fast and slow clocks

The system must support different timescales without forcing one global cadence.

Examples:

- seconds/minutes: fast market/flow/wallet events;
- minutes/hours: target exposure and risk updates;
- hours/days: strategy evaluation and source reputation;
- days/weeks: evidence aggregation and agent maturity;
- asynchronous provider/wallet time: reconciliation.

Different clocks coordinate through durable events/state rather than assuming one timer loop owns the world.

## Vendor boundaries

### LLMs

Reasoning/synthesis adapters only.

### MetaMask

Future wallet/security/execution adapter, not canonical strategy/portfolio state.

### Market providers

Evidence sources with explicit provenance/freshness, not hidden truth.

### Venues

External execution reality that must be reconciled into MetaEdge state.

## Migration principle

Do not rebuild all historical subsystems inside this architecture.

Every old component must be evaluated against the final contracts and classified:

- `REUSE`
- `ADAPT`
- `REPLACE`
- `REMOVE`
- `DEFER`
- `UNKNOWN / NEEDS PROOF`

The target architecture is derived from approved product journeys, not from the shape of the old repository.
