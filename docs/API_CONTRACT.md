# API Contract

## Authentication
All API requests automatically identify the user via the `metaedge_session` `httpOnly` cookie. The cookie contains an opaque server-issued token, not a user id. If the cookie is missing, expired, or invalid, the server provisions a new anonymous user identity.

Client-provided `userId` values and `x-metaedge-session-id` headers are ignored for ownership. The server derives the acting user only from the cookie-backed session record.

## Common Endpoints

### `GET /api/session`
Returns current user profile and balance.

### `GET /api/dashboard-data`
Returns batched dashboard data for the user (rooms, agents, strategies, vaults, audits, trades, prediction markets).

### `POST /api/profile`
Claims or edits the current profile.
- Body: `{ displayName, bio, avatarUrl }`
- The server ignores body ownership fields such as `userId` and updates only the cookie-derived current user.
- A successful first profile save sets `profile.claimedAt`; later edits update `profile.updatedAt`.

### `POST /api/trades`
Executes a simulated paper trade.
- Body: `{ agentId, assetSymbol, side, size, price, leverage, roomId }`

### `POST /api/faucet`
Claims exactly `$10,000` in Paper money for the current user.
- The server ignores body fields such as `amount`, `paperBalance`, `faucetClaimedCount`, and `userId`.
- Each session user can claim at most 10 times.
- Successful claims emit `FAUCET_CLAIM` audit events and `paper_action` graph events.

### `POST /api/agents`
Creates a new trading agent.
- Body: `{ name, description, assetSymbol, tradeType, strategyType, leverage, roomId }`

### `POST /api/mm/transfer`
Executes a live transfer using MetaMask agent. Requires `LIVE_EXECUTION_ENABLED=true` server-side, otherwise returns 403.
- Body: `{ to, amount, token, chainId }`
