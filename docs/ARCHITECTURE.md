# MetaEdge Architecture

## Overview
MetaEdge is a React (Vite) + Express application providing simulated and (gated) live trading, prediction markets, and social vault clubs. 

## Backend Structure
The backend (`server.ts`) is decomposed into domain-specific modules located in `server/`:
- **storage.ts**: Database initialization and IO. Currently uses a JSON file at `data/db.json` with an easy migration path to Postgres via `DATABASE_URL`.
- **auth.ts**: Session middleware using `httpOnly` cookies and user profile endpoints.
- **prices.ts**: Simulated price feeds and occasional real-market ticker fallbacks.
- **rooms.ts**: Friend Rooms and invites.
- **agents.ts**: Trading Agents and strategy management.
- **trades.ts**: Simulated paper-trading endpoints.
- **vaults.ts**: Vault Clubs for group contributions.
- **predictions.ts**: Prediction markets betting and resolution.
- **graph.ts**: System relationships projector.
- **metamask.ts**: MetaMask agent integration and gated live-execution (`LIVE_EXECUTION_ENABLED`).

## Frontend Structure
The frontend is built with React and TailwindCSS. It utilizes standard `fetch` for API calls and expects state mutations to be handled sequentially. 

## Environment Constraints
The application runs on Port `3000` via Express. Vite is run as an Express middleware for local dev. On build, the backend is compiled to `dist/server.cjs` and Express serves the frontend static assets.
