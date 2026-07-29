# MetaEdge Source Map

Date: 2026-07-06

## Live Deployment

- URL: `https://35-202-252-207.sslip.io/`
- Hosting shape: Google Compute Engine VM, Caddy reverse proxy, systemd service named `metaedge`.
- Public health endpoint: `/api/health`
- Reported live commit: `9f0a233`
- Health snapshot:
  - `status`: `ok`
  - `app`: `MetaEdge`
  - `dbConnectivity`: `true`
  - `liveModeGlobalLock`: `true`
  - users observed during check: `318`
- Direct VM SSH from this Mac was not available: public-key auth denied.
- `gcloud` CLI was not installed locally, so GCP project/instance metadata could not be inspected directly from this machine.

## Local Repos

### Current Gemini Rebuild

- Path: `/Users/devinsonpena/Documents/metaedge-gemini`
- Git remote: `https://github.com/Devpen787/metaedge.git`
- Current branch: `claude/backend-buildout`
- Local branch head: `3e1d783`
- Remote tracking branch: `origin/claude/backend-buildout`
- Branch status: up to date with tracked remote after `git fetch origin`
- Dirty local files:
  - `src/components/TradingHub.tsx`
  - `audit/`

### Older Python/Legacy MetaEdge

- Path: `/Users/devinsonpena/Documents/meta-edge/metaedge`
- Git remote: `https://github.com/Devpen787/meta-edge.git`
- Current branch observed: `codex/social-trading-room-v1`
- This is not the app currently deployed at the sslip.io URL.

## GitHub Branches

### `origin/claude/backend-buildout`

- Head: `3e1d783`
- This is the branch that contains the live app's Swarm/Autopilot architecture.
- The deployed commit `9f0a233` is an ancestor of this branch.
- Commits local/remote branch has after deployment:
  - `a40dd4f` Decouple token Connect from browser-connect loading state
  - `3e1d50b` Two-wallet model
  - `058c711` Guard prediction payout preview
  - `1562109` Surface Agent Wallet address + competition banner
  - `98b5ec5` Add wallet ledger
  - `8f00af2` Account management multi-wallet panel
  - `3e1d783` Wallet command center + guardrails

### `origin/main`

- Head: `bc05d23`
- This branch has newer commits than local `main`, but it is not what the current GCP deployment reports.
- It is a large divergent change set from `claude/backend-buildout`.
- Compared with `claude/backend-buildout`, it removes many deployment/test/docs files and removes `server/autotrader.ts`.
- Its `AgenticAutopilot.tsx` is the older planner/X402-style UI, not the paper-agent Autopilot seen in the live product.

## Swarm Intelligence Code Map

- Swarm navigation: `src/App.tsx`
- Swarm Copilot UI: `src/components/SwarmCopilot.tsx`
- Intent Solver UI: `src/components/IntentSolver.tsx`
- Autopilot UI: `src/components/AgenticAutopilot.tsx`
- Trading Agents UI: `src/components/AgentWorkshop.tsx`
- Agent routes: `server/agents.ts`
- Manual/copilot trade ledger: `server/trades.ts`
- Autopilot server ticker: `server/autotrader.ts`
- MetaMask/chat/intent endpoints: `server/metamask.ts`

## Product Truth

- Trading Agents creates real paper agents through `/api/agents`.
- Manual fills use `/api/trades`.
- Copilot and simple parsed intents can use `/api/copilot/execute` to place real paper fills.
- Autopilot in `claude/backend-buildout` uses a real server-side ticker in `server/autotrader.ts`.
- Autopilot trades are paper-only, written through the same `placePaperTrade` ledger as manual fills, and audited as `AUTOPILOT_TRADE`.
- Live execution is globally locked in the deployed health response.

## Current Gap

The deployed GCP app is not at the latest `claude/backend-buildout` commit. It reports `9f0a233`, while the branch head is `3e1d783`.

The deployed commit already contains the real paper-agent Autopilot architecture, but it does not include the later wallet command center, wallet ledger, and multi-wallet refinements.

## Main Risk

Do not blindly deploy `origin/main` over the GCP VM if the goal is preserving the current Swarm/Autopilot direction. Based on the branch diff, `origin/main` appears to be a divergent line that would remove the current `server/autotrader.ts` implementation.

The safer production path is:

1. Treat `claude/backend-buildout` as the current product source for the GCP app.
2. Decide whether to advance GCP from `9f0a233` to `3e1d783`.
3. Review or cherry-pick from `origin/main` only after checking that it does not regress the paper-agent Swarm loop.
