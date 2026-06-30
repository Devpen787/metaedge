# API Contract

## Authentication
All API requests automatically identify the user via the `metaedge_session` `httpOnly` cookie. If not present, the server provisions a new anonymous user identity.

## Common Endpoints

### `GET /api/session`
Returns current user profile and balance.

### `GET /api/dashboard-data`
Returns batched dashboard data for the user (rooms, agents, strategies, vaults, audits, trades, prediction markets).

### `POST /api/trades`
Executes a simulated paper trade.
- Body: `{ agentId, assetSymbol, side, size, price, leverage, roomId }`

### `POST /api/agents`
Creates a new trading agent.
- Body: `{ name, description, assetSymbol, tradeType, strategyType, leverage, roomId }`

### `POST /api/mm/transfer`
Executes a live transfer using MetaMask agent. Requires `LIVE_EXECUTION_ENABLED=true` server-side, otherwise returns 403.
- Body: `{ to, amount, token, chainId }`
