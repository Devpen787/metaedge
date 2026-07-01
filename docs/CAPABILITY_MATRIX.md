# MetaMask Agent-Wallet Capability → UI Reachability

**Goal 2:** every MetaMask agent/wallet capability must be not just *present* (a
backend route) but *reachable* through the UI (a user can trigger it).

Regenerate anytime — the numbers below come straight from the script and it
re-derives every row from source, so it can't silently drift:

```bash
npm run capability:matrix          # print the matrix
node scripts/capability_matrix.mjs --strict   # exit 1 if a safe capability loses its UI path
```

## Snapshot

**Present: 17/17 · Reachable: 7/17 · Unreachable: 10**

| Capability | Kind | Present | Reachable | UI entry |
|---|---|---|---|---|
| Wallet readiness | readonly | yes | **direct** | AgentWalletModal, ReadinessSheet |
| Wallet status | readonly | yes | — | none |
| Browser login | auth | yes | **direct** | AgentWalletModal |
| Token login | auth | yes | — | none |
| Wallet address | readonly | yes | — | none |
| Wallet balance | readonly | yes | — | none |
| Transfer / send | execute | yes | — | none (gated) |
| Swap quote | readonly | yes | **orchestrated** | Intent Solver / Autopilot (read-only) |
| Swap execute | execute | yes | — | none (gated) |
| Perps balance | readonly | yes | — | none |
| Perps quote | readonly | yes | — | none |
| Perps open | execute | yes | — | none (gated) |
| Predict markets | readonly | yes | **orchestrated** | Intent Solver / Autopilot (read-only) |
| Predict quote | readonly | yes | — | none |
| Intent solver | ai | yes | **direct** | IntentSolver |
| Swarm copilot chat | ai | yes | **direct** | SwarmCopilot |
| Autopilot planner | ai | yes | **direct** | AgenticAutopilot |

"Direct" = a UI component fetches the endpoint. "Orchestrated" = a
natural-language endpoint runs the capability under the hood (read-only quote /
market search). "Gated" = an execute path deliberately behind
`LIVE_EXECUTION_ENABLED`.

## The 10 gaps, and what to do with each

**Safe to surface now (read-only / auth — no live execution unlocked): 7**
- Wallet status, Wallet address, Wallet balance
- Perps balance, Perps quote
- Predict quote
- Token login

These are all read-only previews or auth. Surfacing them makes the wallet
genuinely inspectable without touching the live lock. Recommended home: promote
the **Agent Wallet modal** from descriptive cards into a live panel — Overview
(address + balance + status), Swaps (real quote), Perps (balance + quote
preview), Predict (markets + quote preview). Each shows the real preview and an
"Execute — locked in paper mode" affordance.

**Intentionally gated (execute — keep locked until live is switched on): 3**
- Transfer / send, Swap execute, Perps open

These stay unreachable *by design* until `LIVE_EXECUTION_ENABLED=true`. The UI
should show them as visible-but-locked so testers see the full surface without
being able to move real funds. `--strict` does **not** fail on these.

## How reachability is verified

- **present** — grep `server/metamask.ts` for the route literal.
- **direct** — grep every file under `src/` for a fetch to the route (with an
  end boundary so `/api/mm/login` can't match `/api/mm/login-browser`).
- **orchestrated** — grep the Intent Solver and Autopilot handler bodies for the
  mm CLI subcommand (e.g. `'swap', 'quote'`) they run internally.
