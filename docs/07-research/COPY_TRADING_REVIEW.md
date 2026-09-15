# Copy Trading / Wallet Intelligence Review — Tranche 1

Status: **Research evidence — not implementation approval**

Reviewed: 2026-09-15

Primary implementation reviewed:

- `Gajesh2007/copytrading-agent` — Hyperliquid

Additional ecosystem discovery:

- public Hyperliquid copy-trading repos and analytics lists;
- Colosseum/agent projects relevant to source reputation and manipulation resistance.

## Key finding

The strongest reusable copy-trading pattern is:

> **observe leader state → derive follower target exposure → apply follower policy/risk → trade the delta → reconcile against authoritative venue state**

This matches the MetaEdge CopySource model much better than replaying every source order literally.

## `Gajesh2007/copytrading-agent`

Repo-verified behavior:

- listens for leader fills over WebSocket;
- tracks shared leader/follower state;
- derives target exposure per market;
- applies copy ratio;
- applies leverage, notional and slippage caps;
- submits IOC limit orders to synchronize follower exposure;
- periodically reconciles with Hyperliquid `clearinghouseState` snapshots;
- supports inverse copy mode.

## What MetaEdge should adopt as a pattern

### 1. Target exposure, not raw order replay

A leader's fill is evidence that the leader's position changed. The follower should calculate the exposure appropriate for the follower, then move toward that target.

This naturally handles:

- different account sizes;
- different leverage policy;
- already-existing follower exposure;
- partial fills;
- missed WebSocket events;
- inverse strategies;
- position reduction.

### 2. Periodic authoritative reconciliation

A streaming event feed cannot be assumed perfect. Periodically compare local state against venue/canonical state and repair drift.

For future MetaEdge real execution, this becomes mandatory.

### 3. Follower-specific caps

Source behavior is not follower authority. The follower owns:

- max source allocation;
- leverage cap;
- single-asset cap;
- portfolio cap;
- slippage;
- venue/network allowlist;
- loss limits;
- staleness tolerance.

## What MetaEdge should reject from the reference implementation

### Private-key model

The reference repo expects a follower private key. MetaEdge's eventual real path should remain behind the approved MetaMask/agent-wallet authority model rather than importing this pattern.

### Lack of automated tests

The repo explicitly states no automated tests are bundled. That is unacceptable for MetaEdge's copy engine, particularly around:

- idempotency;
- repeated fills;
- partial fills;
- stale source data;
- position flips;
- disconnect/reconnect;
- restart recovery;
- leader state correction;
- follower risk clipping.

## Wallet intelligence is not the same as copying

The user journey must distinguish:

- **Observe** — inspect wallet/trader behavior;
- **Follow** — receive updates;
- **Shadow** — counterfactually simulate the follower policy;
- **Paper Copy** — mutate a paper portfolio;
- **Live Copy** — future separately-authorized real execution.

A wallet may be useful intelligence even if it is unsuitable to copy.

## Source completeness risk

A visible wallet may represent only one piece of the source's true risk:

- another wallet may hedge it;
- spot may hedge perps;
- options/off-chain positions may be invisible;
- deposits/withdrawals can distort naive PnL;
- a source may deliberately trade around public observability.

Therefore MetaEdge needs a first-class `SourceCompleteness` / `ObservationLimits` explanation.

## Source selection should be adversarial

Raw leaderboard PnL is insufficient. Future source evaluation should consider:

- drawdown;
- leverage;
- concentration;
- holding horizon;
- realized vs unrealized PnL;
- deposit/withdrawal effects;
- regime dependence;
- sample length;
- trade independence;
- liquidation proximity/history;
- consistency;
- execution quality;
- suspicious/manipulative patterns;
- survivorship bias;
- whether performance is dominated by a small number of trades.

Manipulation-resistant copy-trading research discovered during this tranche reinforces the need to treat copied sources as potentially adversarial rather than automatically “smart money.”

## Proposed MetaEdge copy pipeline

```text
SourceObservation
      ↓
SourceInterpretation
      ↓
CopyRelationship / CopyPolicy
      ↓
CopyView (desired follower exposure)
      ↓
Portfolio Authority
      ↓
Risk-adjusted Target
      ↓
Paper / future Real Execution
      ↓
Reconciliation
      ↓
Copy Attribution
```

No source directly owns the follower broker.

## Research questions still open

- best normalization method: percent equity, volatility-scaled, risk-unit, or hybrid;
- how to detect leader deposits/withdrawals and distinguish them from PnL;
- how to reconstruct position intent from fills vs snapshots;
- how much latency makes a source action stale;
- source quality scoring without rebuilding a hidden scalar confidence gate;
- multi-source conflict resolution;
- source manipulation/front-running risk;
- whether copy policies should target exposure continuously or only react to discrete source events.
