# Local Development

## Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Optional: Create a `.env` file based on `.env.example`

## Running Locally
- Run `npm run dev` to start the local dev server (Express + Vite middleware).
- The server will be available at `http://localhost:3000`.

## Database Reset
- The database is a local JSON file at `data/db.json`. 
- To seed or reset it to the curated demo state, run: `npm run seed` or `npm run reset-demo`.
- The demo seed is intentionally small and replaces the old committed `db.json` runtime dump. It includes demo users, rooms, agents, strategies, trades, a vault club, evidence events, and prediction markets.
- New anonymous preview users join the seeded demo world by default. Set `METAEDGE_DEMO_AUTOSTART=false` to disable that behavior.

## Build
- Run `npm run build` to compile both the frontend and backend.
- Run `npm run start` to start the compiled production server.
