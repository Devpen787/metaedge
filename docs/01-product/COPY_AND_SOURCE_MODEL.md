# Copy and Source Model

Status: **Draft for human approval**

## Why this exists

"Copy trading" in MetaEdge is broader than copying a strategy. A user may want to observe and follow a wallet, trader, strategy, agent, portfolio, cohort, or signal source.

The product needs one shared model so these do not become seven unrelated systems.

## CopySource

A `CopySource` is an entity whose observable behavior may produce useful trading information.

Source types:

- `wallet`
- `trader`
- `strategy`
- `agent`
- `portfolio`
- `cohort`
- `signal_provider`

Future source types may be added, but they must map into the same downstream copy pipeline.

## Source observation

A `SourceObservation` records what MetaEdge actually observed, not what it imagines the source intended.

Minimum concerns:

- source id and type;
- timestamp / observed-at / received-at;
- venue/network;
- instrument;
- action or position change;
- size/notional where visible;
- leverage where visible;
- provenance;
- freshness;
- completeness/confidence of observation;
- raw evidence references.

The system must preserve a distinction between:

- what was observed;
- what is inferred;
- what is unknown.

## Important wallet/trader caveat

A visible wallet may be only one leg of a larger position. A trader may hedge elsewhere, operate several wallets, use options or off-chain exposure, or deliberately separate execution accounts.

Therefore MetaEdge must never imply that observing one wallet necessarily reveals the source's full strategy or risk.

## Copy relationship modes

A user can establish a `CopyRelationship` with a source in one of these modes:

### Watch

Show source activity and changes.

### Follow

Persist the source in the user's intelligence feed and surface meaningful updates.

### Shadow

Compute what would have happened under the user's own portfolio/risk assumptions without changing the paper portfolio.

### Paper Copy

Translate qualifying source actions into bounded paper intents under the user's own policy.

### Live Copy — future only

Translate qualifying source actions into separately authorized real proposals under explicit execution authority.

Live copy is not part of the current foundation implementation scope.

## Copying is transformation

MetaEdge does **not** clone source actions blindly.

Example:

A source wallet with $20M equity opens a $5M position at 12x leverage.

MetaEdge may infer that the source allocated 25% of observed equity, but the follower's `CopyPolicy` might permit only:

- 3% single-source allocation;
- 2x leverage;
- 7% maximum aggregate ETH exposure;
- $500 scout notional;
- 30 bps maximum modeled slippage.

The follower's proposal is therefore a transformed action, not a copied dollar amount.

## CopyPolicy

A copy relationship should eventually define policy dimensions such as:

- sizing method;
- maximum source contribution to portfolio exposure;
- maximum single-position notional;
- leverage cap;
- asset allowlist / denylist;
- venue/network constraints;
- direction filters;
- stale-source timeout;
- source-quality requirements;
- max slippage;
- stop / take-profit policy;
- daily/session loss cap;
- correlation/concentration cap;
- pause/revoke conditions.

## Canonical copy pipeline

`SourceObservation`
→ `SourceInterpretation`
→ `CopyProposal`
→ portfolio aggregation
→ risk bounds
→ `PaperOrderIntent` or future `RealTradeIntent`
→ execution
→ attribution back to the copy relationship and source observation.

## Source intelligence

MetaEdge should eventually evaluate sources on multiple dimensions rather than rank them by raw PnL alone.

Candidate dimensions:

- realized vs unrealized performance;
- drawdown;
- consistency across windows;
- leverage;
- concentration;
- holding period;
- turnover;
- execution timing;
- asset specialization;
- regime dependence;
- source age / sample size;
- behavior after losses;
- behavior after wins;
- risk-adjusted returns;
- survivorship concerns;
- possible hedging/incomplete observation;
- recent activity;
- whether performance is dominated by a few outliers.

## Shared downstream model

The important product decision is that wallets, traders, strategies, agents, portfolios, and cohorts differ primarily in **how source observations are created**.

Once translated into a bounded MetaEdge view, they should share the same portfolio, risk, paper, learning, and future real-execution machinery wherever possible.
