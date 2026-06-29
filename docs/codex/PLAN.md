# MetaEdge V1 Implementation Plan

## Phase 1: Storage & Backend Setup
1. Define the local persistent database structure inside `/src/types.ts` (defining all node types: User, Wallet, FriendRoom, Agent, Strategy, PaperTrade, VaultClub, GraphEvent, AuditEvent).
2. Configure `server.ts` to host both the REST API and serve the built client application on port 3000.
3. Build server-side handlers for sessions, room creation, signed unguessable room invites, paper trading, strategy sharing, vault clubs, and graph projection.

## Phase 2: Frontend App Shell & Layout
1. Set up high-quality typographic styles (Inter + JetBrains Mono) in `src/index.css`.
2. Implement a responsive Welcome / Login page allowing instant anonymous profile creation with custom avatars and profile claims.
3. Build the core multi-screen application layout:
   - **Dashboard**: Global balances, active agents, current room feed, and active vault clubs.
   - **Trading Room**: Room activity, members list, invite panel, shared strategies.
   - **Agent Workshop**: Create paper-trading bots, define parameters, copy existing strategies, and audit performance graph evidence.
   - **Vault Clubs**: Manage joint mock savings, contribution history, and milestones.

## Phase 3: Paper/Live Switch & MetaMask Readiness Integration
1. Implement the global persistent Paper / Live mode toggle in the App Shell's header.
2. In **Paper Mode**, ensure all actions default to paper balances and simulated fills.
3. In **Live Mode**, design a highly-polished Readiness and Risk sheet showing:
   - MetaMask wallet installation & connection states.
   - Exact network checks, asset support indicators, limit gates, and human approval prompts.
   - Clear indicators that live execution remains locked.

## Phase 4: Graph Projection & Analytics
1. Keep an audit and graph events ledger in the database.
2. Render node-and-edge network evidence summaries for any active trading agent, explaining precisely *why* the agent is validated to run.

## Phase 5: Verification & Smoke Testing
1. Configure custom integration/smoke tests simulating visitor entry, anonymous login, room invite creation, second-user join, trade matching, and live-lock switch.
2. Compile and run full-stack checks.
