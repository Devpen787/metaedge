# MetaEdge V1 Specification

## Product Thesis
MetaEdge is a visually alive social agent-wallet trading room where friends can join, interact with paper balances, create and copy paper-trading agent strategies, track together in read-only vault-style clubs, and audit evidence before entering MetaMask-regulated live review. It emphasizes transparency, clear labeling of Paper vs. Live modes, and strict server-authoritative execution.

## Core Architecture
- **App Shell**: Animated responsive layout built using Tailwind CSS and `motion/react`.
- **Express Backend (`server.ts`)**:
  - Unified serverful host on port 3000.
  - Server-authoritative paper simulation, order matching, profile claims, and audit logs.
  - Robust session management via cookie-based anonymous sessions.
  - Relational & graph database simulated through a local persistent JSON database (`db.json`) with atomic, locking writes to prevent state loss on page refresh.
- **Durable Storage Models**:
  - `users`, `sessions`, `profiles`, `friend_rooms`, `room_memberships`, `invites`, `agents`, `strategies`, `paper_books`, `paper_trades`, `vault_clubs`, `audit_events`, `graph_events`.
- **Knowledge Graph Projection**:
  - Reconstructs nodes and edges from `graph_events` to provide rich evidence-readiness pathways (e.g., matching users, agents, strategies, and vaults).
- **MetaMask Verification Layer**:
  - Simulates detailed live-readiness status sheets with absolute truth about blocker items (missing extension, wrong network, missing funds, etc.) instead of fake states.

## Security Posture
1. **Authorization & IDOR Prevention**: Every mutation verifies session ownership server-side.
2. **Input Sanitization**: User-supplied text (names, room titles, comments) is sanitized.
3. **Immutability & Audit**: Audit events are recorded for critical transitions (Paper/Live switch, copy strategy, pause agent).
4. **No Hidden Credentials**: Secrets are kept server-side only.
