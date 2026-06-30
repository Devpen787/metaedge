# MetaEdge V1 Security Architecture & Trust Boundaries

## 1. Overview and Trust Boundaries
MetaEdge V1 establishes a clear cryptographic and logical division between two execution realms: the **Intelligence/Simulated Layer** (MetaEdge sandbox) and the **Execution/Authority Layer** (MetaMask, external networks).

- **Client Space (Untrusted)**: The browser frontend is considered untrusted. All parameters supplied by the client (e.g., wallet addresses, trade payloads, profile updates) are fully validated on the server.
- **Server Space (Trusted)**: The Express backend (`server.ts`) handles session resolution, authenticates resource access to prevent IDOR (Insecure Direct Object Reference) vulnerabilities, manages the authoritative state of paper accounts, and records audit trails.

---

## 2. Server-Authoritative Identity & Request Ownership
Sovereign user sessions are governed by secure, server-issued anonymous user identifiers rather than client-asserted states:

1. **httpOnly Session Cookie**: At session start, the server issues a `metaedge_session` cookie marked with `httpOnly` and `SameSite=Lax`. This protects the opaque session token from cross-site scripting (XSS) extraction.
2. **Derived Identity**: All protected endpoints (such as `/api/rooms/:id`, `/api/agents`, `/api/trades`, and `/api/vaults`) resolve the acting user’s identity from a server-side session record. The cookie does not contain a user id.
3. **No Header Identity**: Client-provided `userId` values and `x-metaedge-session-id` headers are ignored for ownership decisions.
4. **IDOR Prevention & Room Isolation**:
   - A user cannot fetch, copy, or manipulate a trading room, strategy, or vault club without being a verified, active member of that specific space in the persistent state of `db.json`.
   - Before returning details or accepting trade telemetry, the server explicitly checks: `room.memberIds.includes(userId)`.

---

## 3. Paper / Live Mode Isolation & Safety Gates
The Paper/Live switch is designed as a strict, untamperable unidirectional gate to prevent unauthorized execution:

- **Canary Guard Mode**: Default state for all room participants is **Paper Mode**. All virtual trading books, ledger balances, and order fills reside entirely within the server's simulated engine.
- **Canary Defense Gates**: Moving to **Live Mode** does not execute any trade directly on the server. Instead, it unlocks a high-fidelity visual **Readiness Sheet** in the client's browser.
- **MetaMask Isolation**: All real-world asset movement, signature prompts, and execution instructions require explicit client-side MetaMask interaction. 
- **Global Smart Contract Lock**: Since MetaEdge V1 serves strictly as an intelligence and proof layer, the live execution path remains globally locked on the backend. No server endpoint is capable of triggering live on-chain operations.

---

## 4. Exclusion of Secrets and Raw Keys
To maintain a robust security posture under audit:

- **No Seed Phrases or Private Keys**: The MetaEdge workspace does not store, request, or manipulate seed phrases, private keys, or wallet secrets.
- **No Client-Side API Keys**: Third-party integrations or Gemini API credentials are kept strictly server-side inside secure environment configurations. 
- **Sovereign Client Signatures**: All interactions with live networks are handled exclusively by prompting user-approved signatures through the connected MetaMask browser extension, keeping user assets secure under the self-custody of their own keys.
