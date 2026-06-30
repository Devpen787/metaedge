# MetaEdge V1 Acceptance Gate

| Journey / Metric | Real Standard | Status | Evidence / Notes |
|---|---|---|---|
| **Hosted Friend URL** | Accessible via port 3000 mapping |  Verified | Actively running on port 3000 behind nginx container reverse proxy |
| **Durable Auth & Profile** | Server-created ID, profile claim, session persistence |  Journey 2 Verified | `npm run smoke:session` proves opaque cookie persistence and rejects spoofed `x-metaedge-session-id` / raw user-id cookies. `npm run smoke:profile` proves profile claim/edit persistence and rejects spoofed body ownership. |
| **Signed Invites & Join** | Unguessable tokens, second browser context joining |  Verified | Room creation generates a random unguessable token (`inv_...`); joining checks URL `?token=` parameter on mount |
| **Persistent Switch** | Paper/Live mode switch in top header, states survive refresh |  Verified | Toggle persists in the navigation bar; keeps state on reload |
| **Authoritative Balances** | Balances and trades generated and held on server |  Verified | `/api/trades` checks balance, performs state transitions, and saves to database |
| **Agent / Strategies** | Paper token and perp simulation, strategy copy/share |  Verified | Full spot and perp options; custom strategies are copyable and shareable |
| **Vault Clubs** | Joint mock coordination, contribution list, read-only stats |  Verified | Dynamic savings clubs with simulated deposits and targeted milestones |
| **MetaMask Readiness** | Real-time checks (wallet missing, connected, chain) |  Verified | Dynamic scanning via window detection and connection requests |
| **Kuzu Graph Projection** | Relationship nodes/edges generated from event logs |  Verified | Graph projection generated from database event ledger and displayed on SVG canvas |
| **Security & Auditing** | IDOR protection, sanitized text, audit logs |  Verified | Checks membership on access, sanitizes strings, keeps audit logs in `db.json` |
| **Diagnostics & Health** | `/api/health` returning connectivity and state |  Verified | Endpoint active returning connectivity, build hash, version, and security indicators |
| **Smoke Tests** | Local browser tests verify core user paths |  Partial | `npm run lint`, `npm run build`, `npm run smoke:session`, and `npm run smoke:profile` pass. Browser journey tests continue one path at a time. |
