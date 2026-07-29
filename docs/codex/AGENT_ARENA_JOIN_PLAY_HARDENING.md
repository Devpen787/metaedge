# Agent Arena Join/Play Hardening

Change: `harden-agent-arena-join-play`

## Current truth

- MetaEdge's canonical Agent Arena lives in this React/Express portal on port 3000.
- A browser session and paper profile require no signup or real funds.
- Deploying agents and paper practice are open to every profile.
- Appearing on leaderboards, creating leagues, and joining leagues require a
  connected MetaMask Agent Wallet.
- The hosted instance keeps live execution globally locked.
- League share URLs use `/arena?league=<id>`.
- Before this change, a missing league rendered an unnamed board, ended leagues
  could still be joined, mutation failures were silent, and prize copy did not
  consistently say that values were paper-only.

## Scope

In scope:

- Preserve an Arena deep link through first-time profile setup.
- Make missing and ended league links explicit and recoverable.
- Reject server-side joins after a league ends or becomes inactive.
- Surface join, create, load, share, and close-position failures in the Arena.
- Keep practice available without a wallet while explaining the wallet-only
  ranked-competition boundary.
- Label agents, balances, prizes, and competition as paper/simulated.
- Add a repo-native Arena journey smoke covering the server invariants.

Out of scope:

- Removing the wallet requirement for ranked competition.
- Live execution, custody, token prizes, or payout settlement.
- Changing the scoring formula, season cadence, or visual design system.
- Deploying the resulting commit to the hosted VM.

## Requirements

1. The app SHALL open `/arena?league=<id>` in the Agent Arena before and after
   first-time profile setup, without discarding the league parameter.
2. The Arena SHALL show an explicit unavailable-invite state when `<id>` does
   not exist and SHALL offer Global Season and Custom Leagues recovery actions.
3. The API SHALL reject joining a missing league with `404`, an ended league
   with `410`, and an inactive league with `409`.
4. League list responses SHALL expose a derived `active` or `ended` status.
5. The UI SHALL not offer Join for an ended league, but SHALL allow its final
   standings to be viewed.
6. Join/create/load/position failures SHALL be visible and actionable instead
   of console-only.
7. Clipboard success SHALL be shown only after the share link was actually
   copied; otherwise the product SHALL provide a manual-copy fallback.
8. Arena copy SHALL distinguish open paper practice from wallet-gated ranked
   competition and SHALL not imply real agents, real funds, or guaranteed
   token prizes.

## Acceptance scenarios

### GIVEN a new visitor opens a valid league link

WHEN they create their paper profile

THEN the Agent Arena opens on that league and the share URL remains intact.

### GIVEN a visitor opens a missing league link

WHEN the league lookup returns `404`

THEN the page names the invite as unavailable and offers recovery without
changing the user's profile, agents, balance, or memberships.

### GIVEN a wallet-connected player targets an ended league

WHEN they submit the join request

THEN the API returns `410`, no membership is written, and final standings stay
readable.

### GIVEN a visitor has no connected wallet

WHEN they open the Arena

THEN paper practice and agent deployment remain available while ranked actions
clearly request a MetaMask Agent Wallet.

### GIVEN clipboard permission is denied

WHEN the player chooses Invite Rivals

THEN the UI does not claim success and presents the exact link for manual copy.

## Proof

- `npm run build`
- `npm run smoke:arena`
- `npm run smoke:tabs`
- `node scripts/load_test.mjs --players 20 --rounds 8` against an isolated DB
- Desktop browser captures for entry, invalid-link recovery, wallet gate, and
  deploy flow; narrow mobile reflow remains an explicit follow-up proof item
- Hosted `/api/health` commit comparison; deployment remains a separate action
