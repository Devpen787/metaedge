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

**Present: 17/17 · Surfaced in UI: 16/17 · Removed by design: 1 · Unreachable gaps: 0**

| Capability | Kind | Present | Status | UI entry |
|---|---|---|---|---|
| Wallet readiness | readonly | yes | **direct** | AgentWalletModal, ReadinessSheet |
| Wallet status | readonly | yes | **direct** | AgentWalletModal → Overview |
| Browser login | auth | yes | **direct** | AgentWalletModal |
| Token login | removed | yes | **removed** | returns 410 — MetaEdge never accepts wallet secrets |
| Wallet address | readonly | yes | **direct** | AgentWalletModal → Overview |
| Wallet balance | readonly | yes | **direct** | AgentWalletModal → Overview |
| Transfer / send | execute | yes | **gated-ui** | AgentWalletModal → Overview (visible, locked) |
| Swap quote | readonly | yes | **direct** | AgentWalletModal → Swaps |
| Swap execute | execute | yes | **gated-ui** | AgentWalletModal → Swaps (visible, locked) |
| Perps balance | readonly | yes | **direct** | AgentWalletModal → Perps |
| Perps quote | readonly | yes | **direct** | AgentWalletModal → Perps |
| Perps open | execute | yes | **gated-ui** | AgentWalletModal → Perps (visible, locked) |
| Predict markets | readonly | yes | **direct** | AgentWalletModal → Markets |
| Predict quote | readonly | yes | **direct** | AgentWalletModal → Markets |
| Intent solver | ai | yes | **direct** | IntentSolver |
| Swarm copilot chat | ai | yes | **direct** | SwarmCopilot |
| Autopilot planner | ai | yes | **direct** | AgenticAutopilot |

"Direct" = a UI component fetches the endpoint. "Orchestrated" = a
natural-language endpoint runs the capability under the hood. "Gated-UI" = an
execute path deliberately behind `LIVE_EXECUTION_ENABLED`, shown as a
visible-but-locked button. "Removed" = intentionally disabled (410).

## How the gaps were closed

The `AgentWalletModal` was promoted from descriptive cards into a **live panel**
that fetches real Agent Wallet data on every tab:
- **Overview** — real `status` (auth), `address`, `balance`, plus a
  visible-but-locked Send/transfer form.
- **Swaps** — real `swap/quote` (route + fee), locked Execute.
- **Perps** — real `perps/balance` and `perps/quote`, locked Open.
- **Markets** — real `predict/markets` search and `predict/quote`, locked Place.

Verified against a live, authenticated `mm` CLI: status returns
`isAuthenticated: true`, address returns a real `0x…`, swap/quote returns a real
`quoteId` + route, perps/balance returns the real Hyperliquid balance.

**Still gated by design (3 execute paths):** Transfer/send, Swap execute, Perps
open stay locked until `LIVE_EXECUTION_ENABLED=true`. They're shown as
visible-but-locked so testers see the full surface without moving real funds.
`--strict` treats these (and the removed token login) as intentionally handled.

## How reachability is verified

- **present** — grep `server/metamask.ts` for the route literal.
- **direct** — grep every file under `src/` for a fetch to the route (with an
  end boundary so `/api/mm/login` can't match `/api/mm/login-browser`).
- **orchestrated** — grep the Intent Solver and Autopilot handler bodies for the
  mm CLI subcommand (e.g. `'swap', 'quote'`) they run internally.
