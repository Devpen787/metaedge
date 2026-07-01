# MetaEdge Manual Tab Walkthrough

A per-tab checklist for a human render pass — the one thing the node smokes can't
assert (that pixels actually appear and nothing throws in the browser).

**Run it:** `npm run build && node dist/server.cjs`, open http://localhost:3000.
**Data layer:** all 16 tab endpoints verified green (`npm run smoke:tabs`).
**Live lock:** `LIVE_EXECUTION_ENABLED=false` — nothing can move real funds.

Legend: ✅ = data path pre-verified against the running server · 👁 = needs your eyes.

---

## Top bar
- 👁 Header shows session user, "Paper mode", and a **MetaMask Agent Wallet** button (top right).
- 👁 Clicking **Agent Wallet** opens the modal (see Wallet section below).
- 👁 Sidebar nav lists every tab; the active tab is highlighted.

## 1. Dashboard  ✅ `/api/dashboard-data`
- 👁 Portfolio value, paper balance, and recent activity render (no `NaN`, no blank cards).
- 👁 Faucet button claims paper funds and the balance updates.

## 2. Swarm Copilot  ✅ `/api/mm/chat`
- 👁 Chat input works; sending a message returns a reply + "thought process" steps.
- 👁 Asking to *do* something ("swap 100 USDC to ETH") returns a **proposal** card (description, actions, cost, risk) — and does NOT auto-execute.
- 👁 Model selector (local / BYOK) is visible; BYOK without a key shows the auth-error reply, not a crash.

## 3. Intent Solver  ✅ `/api/mm/intent/solve` (empty intent → 400 by design)
- 👁 Typing an intent ("bridge USDC to Base and buy the top AI token") returns a **step plan**.
- 👁 Each step shows an action, asset, network, and an honest cost label (`gas only (est.)` or a real fee).
- 👁 Empty submit is handled gracefully (no plan / prompt to enter text), not a spinner forever.

## 4. Autopilot  ✅ `/api/mm/autopilot/execute` (empty body → 400 by design)
- 👁 Setting a budget + risk profile and running produces a **simulation plan** with logs.
- 👁 Response is labeled simulation / `liveExecution:false`; there is no "live trade executed" claim.
- 👁 A zero/negative budget is rejected with a clear message.

## 5. Trading Agents  ✅ `/api/agents`, `/api/prices`
- 👁 Existing agents list; **Create agent** form works (name, asset, strategy, type).
- 👁 A new agent appears immediately; pause/revoke changes its status.
- 👁 No agents → a sensible empty state, not a blank panel.

## 6. Trading Desk  ✅ `/api/trades`, `/api/prices`
- 👁 Live-ish prices render; placing a paper buy then a sell updates the position.
- 👁 Realized P&L is honest (a 1@100 buy then 1@150 sell shows +50, not a random number).

## 7. Market Charts  ✅ `/api/prices`
- 👁 Chart renders for the selected token; switching token/timeframe updates it.
- 👁 No console errors on chart mount/unmount.

## 8. Predictions  ✅ `/api/predictions`
- 👁 Seeded markets render (BTC $120k, agent-beats-momentum, gas < 12 Gwei) with Yes/No pools.
- 👁 Placing a paper bet updates the pool/your position.

## 9. Rooms  ✅ `/api/rooms`
- 👁 Create a room; it appears. Invite link toggles on/off.
- 👁 Joining via a link/token adds you as a member.

## 10. Vaults  ✅ `/api/vaults`
- 👁 Vault clubs render; contributing updates the simulated total + your contribution.

## 11. Agent Arena  ✅ `/api/arena/leagues`, `/api/arena/leaderboard`
- 👁 **Global** leaderboard shows real competitors ranked by ROI (empty state if no agents traded yet).
- 👁 Header stats are real (competitors, capital in play, top return, in profit) — no `4,821` / `$14.2M` fiction.
- 👁 Your own row is highlighted with a **You** tag; there is no duplicate fake "You" row.
- 👁 Create a league (name, balance, duration) → it appears and you're auto-joined.
- 👁 Switch to a league → leaderboard reflects that league; pre-join P&L shows +0.0%.
- 👁 "Reward" reads *Leaderboard Glory* (global) or the creator's prize (league) — no fake `$50,000` pool.
- 👁 **Wallet actions score here**: a paper swap/perp in the Agent Wallet modal opens a live marked-to-market position, so your ROI on this board moves as prices tick (strategy shows `Wallet` for wallet-only players).
- 👁 **Your Wallet Positions** panel (above the leaderboard) lists each open position with live P&L that refreshes every 5s; **Close** settles it (freezes realized P&L, marks it *Settled*), and the leaderboard updates.

## 12. Platform Data (Analytics)  — static component
- 👁 Renders charts/metrics from bundled data without throwing. (No live endpoint.)

## 13. Evidence Map (Graph)  ✅ `/api/graph`
- 👁 Nodes/edges render; the graph is interactive (pan/zoom/hover) without console errors.

## 14. Specs Hub  — static component
- 👁 Capability/spec cards render. (No live endpoint.)

## 15. Quant Engine (Pro only)  ✅ `/api/quant/backtest`
- 👁 Enable Pro mode; the tab appears. Running a backtest returns in-sample/out-of-sample
  split, Sharpe, and labeled-simulated feeds — not a single fabricated number.

---

## MetaMask Agent Wallet modal (top-right button)
Every tab fetches **real** Agent Wallet data. Execute actions **simulate** in paper
mode (the default) using real quotes, and run for real in Live mode.

- 👁 Header shows a **Paper mode — actions simulate** banner (indigo); the Mode chip reads *Paper (simulate)*.
- **Readiness** ✅ — checks list (CLI v3, browser login, wallet setup, trading mode, policy, 24h outflow, 2FA, live lock), each Ready / Needs review.
- **Overview** ✅ `/api/mm/status` `/api/mm/address` `/api/mm/balance`
  - 👁 Auth status, a clean `0x…` address, and a balance preview load (Refresh re-fetches).
  - 👁 **Send**: fill To + Amount → button reads *Simulate Send (paper)* → returns a `simulated: true` fill (no funds moved).
- **Swaps** ✅ `/api/mm/swap/quote` + `/api/mm/swap/execute`
  - 👁 A from/to/amount **Get quote** returns a real route + fee.
  - 👁 *Simulate Execute swap (paper)* returns a fill built from a live quote (e.g. `10 USDC → 0.0063 WETH via okx`, real quoteId).
- **Perps** ✅ `/api/mm/perps/balance` + `/api/mm/perps/quote` + `/api/mm/perps/open`
  - 👁 Margin balance loads; a symbol/side/size/leverage quote previews.
  - 👁 *Simulate Open position (paper)* returns entry / liquidation / fee / notional from a real quote.
- **Markets** ✅ `/api/mm/predict/markets` + `/api/mm/predict/quote` + `/api/mm/predict/place`
  - 👁 Market search returns real markets; an order quote previews.
  - 👁 *Simulate Place order (paper)* returns a simulated order (needs a Token ID from a market).

**Going Live:** with `LIVE_EXECUTION_ENABLED=true`, the banner turns orange, buttons
read *… — LIVE*, and they execute real transactions after MetaMask approval. Only
prediction-market *placement* isn't wired for live yet (returns a labeled 501).

## Readiness sheet (if surfaced separately) ✅ `/api/mm/readiness`
- 👁 Mirrors the readiness checks; used as the pre-live gate.

---

### What "pre-verified" covers vs not
- ✅ means the endpoint the tab calls returned valid JSON against the running app
  (16/16 green), and the render path was type-checked (`tsc --noEmit` clean) + bundled.
- 👁 items are genuine visual/interaction checks a browser has to confirm — layout,
  animations, empty states, and that no component throws at runtime. Those are yours to tick.
