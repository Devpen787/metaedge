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

### `POST /api/rooms`
Creates a private Paper mode friend room for the current user.
- Body: `{ name, description }`
- The server trims and sanitizes room text, rejects blank names, derives `ownerId` from the cookie session, creates an unguessable `inv_...` invite token, and adds the owner as the first member.

### `GET /api/rooms`
Lists only rooms where the current user is a member.

### `GET /api/rooms/:id`
Returns room details only when the current user is a member.
- Non-members receive `403` and cannot read room members, invite state, or shared strategies.

### `POST /api/rooms/join`
Joins the current user to a room with an invite token.
- Body: `{ inviteToken }`
- `inviteToken` can be a raw `inv_...` token or a full `/rooms/join?token=...` URL.
- Disabled or invalid invites are rejected; duplicate joins are idempotent and do not duplicate membership.

### `POST /api/rooms/:id/invite/toggle`
Enables or disables a room invite.
- Only the room owner can toggle invites.

### `POST /api/agents`
Creates a new trading agent.
- Body: `{ name, description, assetSymbol, tradeType, strategyType, leverage, roomId }`
- The server trims/sanitizes agent text, rejects blank names/assets, derives `ownerId` from the cookie session, and only accepts `roomId` when the current user is a room member.
- When a valid `roomId` is provided, MetaEdge creates a room-scoped paper strategy that room members can review and copy.

### `GET /api/agents`
Lists only agents owned by the current user.

### `GET /api/strategies`
Lists strategies authored by the current user or shared in rooms where the current user is a member.

### `POST /api/strategies/copy`
Copies an accessible paper strategy into the current user's agent book.
- Body: `{ strategyId }`
- The copied agent owner is derived from the cookie session and starts `paused` for review.
- Non-members cannot copy private room strategies by guessing IDs.

## MetaMask Agent Wallet v3 Endpoints

These endpoints follow the MetaMask Agent Wallet v3 model: browser login first, readiness checks before review, quote/preview before execution, and live execution locked unless the server explicitly enables it.

### `GET /api/mm/readiness`
Returns a product-safe MetaMask Agent Wallet readiness summary.
- Includes `mm login browser` guidance, Agent Wallet v3 health, wallet setup, wallet address, Base balance, trading mode, policy limits, 24h outflow policy, 2FA approval requirement, and live lock status.
- Does not return raw policy YAML, stack traces, wallet secrets, session IDs, or CLI credentials.
- Successful calls emit `METAMASK_READINESS_CHECK` audit events and `metamask_check` graph events.

### `POST /api/mm/login-browser`
Returns browser-login guidance for MetaMask Agent Wallet.
- By default, the route does not launch an external login process and returns guidance to run `mm login browser` locally.
- It never accepts or stores CLI tokens or wallet secrets.

### `POST /api/mm/login`
Deprecated and intentionally removed.
- Always returns `410`.
- This endpoint exists only to prevent old token-paste flows from silently working.

### `POST /api/mm/swap/quote`
Requests a swap or bridge preview.
- Body: `{ from, to, amount, fromChain, toChain?, slippage?, refuel? }`
- Validates symbols, amounts, and chain IDs before calling Agent Wallet.
- Returns `executeLocked: true` unless `LIVE_EXECUTION_ENABLED=true`.

### `POST /api/mm/swap/execute`
Executes a previously reviewed quote only when live execution is explicitly enabled.
- Body: `{ quoteId }`
- Default response is `403 Live locked`.

### `POST /api/mm/perps/quote`
Requests a perps preview before opening a position.
- Body: `{ symbol, side, size, leverage, type?, limitPx? }`
- Requires `side` to be `long` or `short`.
- Returns `openLocked: true` unless `LIVE_EXECUTION_ENABLED=true`.

### `POST /api/mm/perps/open`
Opens a perp position only when live execution is explicitly enabled.
- Body: `{ symbol, side, size, leverage }`
- Default response is `403 Live locked`.

### `POST /api/mm/predict/quote`
Requests a prediction-market order preview.
- Body: `{ tokenId, side, size, limitPrice? }`
- Requires `side` to be `buy` or `sell`.
- Returns `placeLocked: true` unless `LIVE_EXECUTION_ENABLED=true`.

### `POST /api/mm/transfer`
Executes a live transfer only when live execution is explicitly enabled.
- Body: `{ to, amount, token, chainId }`
- Default response is `403 Live locked`.
