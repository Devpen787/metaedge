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
- To seed or reset it to the initial state with demo data, run: `npm run seed`

## Build
- Run `npm run build` to compile both the frontend and backend.
- Run `npm run start` to start the compiled production server.
