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

**Present: 20/20 · Surfaced in UI: 11/20 · Planned homes: 8 · Unreachable: 1** _(refreshed 2026-07-07 — run `node scripts/capability_matrix.mjs --strict` for the live truth; this snapshot goes stale, the script doesn't)_

> Known unreachable: `/api/mm/autopilot/execute` — the legacy fake-autopilot planner route, superseded by the real server-side autotrader. Kept only until its removal is deliberately decided; not linked from any UI.

> Note: the "Token login returns 410" row below is stale — token connect now lives at `/api/mm/connect/token` (used once, never stored). The connect flow rows predate the two-wallet redesign.

| Capability | Kind | Status | UI entry |
|---|---|---|---|
| Wallet readiness | readonly | **direct** | AgentWalletModal, ReadinessSheet |
| Wallet status | readonly | **direct** | AgentWalletModal → Overview |
| Browser login | auth | **direct** | AgentWalletModal |
| Token login | removed | **removed** | returns 410 — MetaEdge never accepts wallet secrets |
| Wallet address | readonly | **direct** | AgentWalletModal → Overview |
| Wallet balance | readonly | **direct** | AgentWalletModal → Overview |
| Transfer / send | execute | **direct** | AgentWalletModal → Overview (simulate / live) |
| Swap quote | readonly | **direct** | AgentWalletModal → Swaps |
| Swap execute | execute | **direct** | AgentWalletModal → Swaps (simulate / live) |
| Perps balance | readonly | **direct** | AgentWalletModal → Perps |
| Perps quote | readonly | **direct** | AgentWalletModal → Perps |
| Perps open | execute | **direct** | AgentWalletModal → Perps (simulate / live) |
| Predict markets | readonly | **direct** | AgentWalletModal → Markets |
| Predict quote | readonly | **direct** | AgentWalletModal → Markets |
| Predict place | execute | **direct** | AgentWalletModal → Markets (simulate; live not yet wired) |
| Intent solver | ai | **direct** | IntentSolver |
| Swarm copilot chat | ai | **direct** | SwarmCopilot |
| Autopilot planner | ai | **direct** | AgenticAutopilot |

"Direct" = a UI component fetches the endpoint. "Orchestrated" = a
natural-language endpoint runs the capability under the hood. "Removed" =
intentionally disabled (410).

## Paper simulation vs live execution

Execute actions (transfer, swap, perps open, predict place) are **not locked** —
they are a first-class **paper-simulation** path so competitions can use the full
capability set risk-free:

- **Paper mode** (`LIVE_EXECUTION_ENABLED=false`, default): the button reads
  *Simulate … (paper)* and returns an honest simulated fill **built from a live
  quote** (real route, real expected output, real entry/liq/fee) — no funds move.
- **Live mode** (`LIVE_EXECUTION_ENABLED=true` + readiness + MetaMask approval):
  the same button executes the real on-chain transaction.

Verified against a live `mm` CLI: paper swap `10 USDC → 0.00632233 WETH via okx`
(real `quoteId`); paper perp `long 0.1 ETH entry 1570.6 / liq 785.3 / fee 0.0707`.
Input validation is enforced in both modes (bad address / missing token → 400).

**One honest gap:** live *prediction-market placement* isn't CLI-verified yet, so
`/api/mm/predict/place` simulates in paper and returns a labeled 501 in live —
rather than pretending. All other execute paths have a real live path.

## Wallet actions feed the competition

A paper swap or perp records an **open Agent Arena position**, so using MetaMask
capabilities in paper mode actually moves your standing. To stay coherent, the
position's entry is snapshotted from the arena's **single spot-price universe**
(the same live prices the Trading Desk uses) — not the mm quote, which lives in a
different price world — and marked-to-market against that same source. Only
swaps/perps into priced assets are scored (stablecoin swaps, transfers, and
prediction placements are not). Wallet-only players appear on the global board
with strategy `Wallet`; league scoring floors positions opened before you joined.

## How reachability is verified

- **present** — grep `server/metamask.ts` for the route literal.
- **direct** — grep every file under `src/` for a fetch to the route (with an
  end boundary so `/api/mm/login` can't match `/api/mm/login-browser`).
- **orchestrated** — grep the Intent Solver and Autopilot handler bodies for the
  mm CLI subcommand (e.g. `'swap', 'quote'`) they run internally.
