# Wallet Ledger — where is what, and how much

The single source of truth for our real money and wallets, so we never again
spend an hour re-deriving it from block explorers.

- **Live balances:** run `node scripts/wallet_status.mjs` (needs an authenticated
  `mm` session). It lists every wallet, reads balances across all chains, writes
  `wallet-status.json` (latest) and appends to `wallet-status-history.jsonl`
  (track record over time).
- **This file:** the facts a balance check *can't* tell you — roles, which wallet
  is registered where, funding history, and the gotchas we hit.

_Last hand-updated: 2026-07-06._

## The wallets

All four are **server wallets under the same authenticated MetaMask account**.
Switch which one the CLI controls with `mm wallet select --address <0x…>`.

| Address | Name | Role | Balance (2026-07-06) |
|---|---|---|---|
| `0x09B7815143de8d7ecc093dD6eb70E94e041ba40D` | **Server EVM Wallet 1** | **CANONICAL / funded — trade from here** | **$3.77** (Arbitrum: 0.001329 ETH + 1.43 USDC) |
| `0x9604ff918c0d575bdd19f09bf655cc044db41ea7` | (unnamed) | empty; was mistakenly used first | $0.00 |
| `0x618cec8b2906dbad135b05f32671d92c78e9b778` | (unnamed) | empty | $0.00 |
| `0x2403a40b16ff638d2c7fccd2883a1cce0e8f8d78` | (unnamed) | empty | $0.00 |

**Personal wallet (the "bank"):** `jevpen.eth` / MetaJev (`0x6180a…af171`) — this
is Devin's everyday MetaMask that funds the agent wallets. Not an agent wallet.

## MetaMask Agent Wallet Trading Competition

- Registered addresses: **both** `0x9604…41ea7` and `0x09B78…1ba40d`.
- **Trade from `0x09B78…1ba40d`** (the funded, canonical one) so real trades score.
  See [[metamask-agent-competition]]. Window Jul 6–12 2026.

## Funding history

| Date | Tx | From → To | Amount |
|---|---|---|---|
| 2026-06-17 | [`0x255a84…27cd49`](https://arbiscan.io/tx/0x255a84c8b5c52982096307d4c0678f011aec5c01e3bf82b8996d56415527cd49) | jevpen.eth → `0x09B78…1ba40d` (Arbitrum) | 6.1 USDC (~$6.10) |
| 2026-06-17 | [`0x5e79be…72ff0e`](https://arbiscan.io/tx/0x5e79bef74e3d846551ccc96e3d73c6c40aa387d16da1872b2793714cca72ff0e) | jevpen.eth → `0x09B78…1ba40d` (Arbitrum) | 0.001512 ETH (~$2.66) |

Funded ~$8.76 total; ~$3.77 remains (the rest spent on setup/gas). All funds are
on **Arbitrum One** (chain 42161).

## Gotchas we learned (so we don't repeat them)

- The account has **multiple wallets**; the CLI can silently be pointed at an
  empty one. Always confirm with `mm wallet address` and `mm wallet list`.
- `mm wallet balance --chain 8453` (Base) reported $0 because the money is on
  **Arbitrum**. The no-`--chain` `mm wallet balance` scans all chains — use that.
- **Hyperliquid perps balance is separate** from wallet balance
  (`mm perps balance --venue hyperliquid`).
