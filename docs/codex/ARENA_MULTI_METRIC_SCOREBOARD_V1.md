# Arena Multi-Metric Scoreboard v1

## Current truth to preserve

- MetaEdge is paper-only: no Arena action moves real funds.
- The global Arena runs in monthly seasons; custom leagues have their own join time and end time.
- Ranked participation requires a connected Agent Wallet, while unranked paper practice remains open.
- Spot/perp paper fills and prediction-market positions already contribute to Arena P&L.
- League membership, fills, bets, and standings are derived from the durable JSON database.

## Scope in

- Period-correct volume, realized P&L, unrealized P&L, and percentage return.
- Server-authoritative ranking by return percentage, P&L, or traded volume.
- Per-player attribution across Spot, Perps, and Predictions.
- Append-only prediction bet events for fair season and league accounting.
- An immutable scored trade ledger.
- API and UI proof for each metric view.

## Scope out

- Real-money prizes or live execution.
- Cross-venue arbitrage, liquidity provision, options, yield, or other research lanes without a user-facing paper event ledger.
- Combining research-runtime evidence with player competition balances.
- Hosted deployment.

## Requirements

1. The Arena SHALL compute every metric from durable player events, never UI state.
2. The Arena SHALL expose `roi`, `pnl`, and `volume` ranking views and SHALL identify the active metric in the response.
3. Traded volume SHALL be gross paper notional (`abs(size * fill price)`) plus prediction stake, and SHALL NOT be described as profit.
4. Percentage return SHALL equal total period P&L divided by the board start balance.
5. A season or league SHALL count only positions opened after that player's scoring start; closing a carried-in position SHALL NOT import pre-period gains or losses.
6. The Arena SHALL attribute activity, volume, realized P&L, and unrealized P&L to Spot, Perps, and Predictions.
7. Prediction bets SHALL append timestamped events so later bets can be separated from earlier seasons or league joins.
8. Ranked paper trade records SHALL be immutable through player APIs.
9. Research-only money-making lanes SHALL remain unscored until they emit durable, attributable paper events with a declared valuation rule.

## Scenarios

### Multi-metric ranking

GIVEN two connected players with different return, dollar P&L, and volume
WHEN a client requests each supported metric
THEN the response is sorted by that metric and every row still exposes all three values.

### Fair period boundary

GIVEN a player opened a position before joining a league
WHEN that position is closed after joining
THEN its pre-join P&L does not enter the league score.

### Lane attribution

GIVEN a player has spot fills, perp fills, and prediction bets in the scoring period
WHEN the standings are loaded
THEN each lane reports its own event count, gross volume, realized P&L, and unrealized P&L and the lane totals reconcile to the player totals.

### Immutable score

GIVEN a recorded paper fill contributes to Arena metrics
WHEN a player calls either trade deletion endpoint
THEN the server rejects the mutation and the durable ledger remains unchanged.

## Proof

- `npm run lint`
- `npm run build`
- `npm run smoke:arena`
- The Arena smoke SHALL assert all three rank views, lane reconciliation, prediction event persistence, period flooring, and blocked deletion.
- Browser proof SHALL show the metric selector, Volume column, lane chips, and player detail breakdown without presenting locked research lanes as playable.
