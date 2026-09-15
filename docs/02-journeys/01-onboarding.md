# J01 — Onboarding / Enter MetaEdge

Status: **Detailed draft for human review**

## USER JOB

Understand what MetaEdge does and enter a safe paper-first workspace quickly without being forced to connect a wallet first.

## PURPOSE

Onboarding teaches the product loop before feature complexity appears: **Discover → Understand → Test → Act → Manage → Learn**.

A source of edge can be a market, wallet, trader, strategy, agent, portfolio, cohort or signal provider.

## AUTHORITATIVE STATE

Candidate concepts: `UserAccount`, `UserProfile`, `OnboardingState`, `PaperWorkspace`, and optional later `WalletConnection`.

Wallet connection is not the user's primary application identity.

## HAPPY PATH

1. User lands on MetaEdge.
2. Product explains the paper-first product loop in plain language.
3. User enters a paper workspace without requiring a wallet.
4. Optional experience/goals/preferences can be set without blocking access.
5. User chooses a meaningful starting path: discover markets, discover wallets/traders, explore strategies/agents, or start from an idea.

## PRODUCT LAW

Do not lead with wallet setup, API keys, model selection, agent configuration or the old feature taxonomy. Teach the product loop first.

## EMPTY / FAILURE / UNKNOWN

A new account shows useful discovery rather than fake portfolio data. If session recovery is ambiguous, do not silently create a replacement identity and mutate history.

## BACK / REFRESH / RESTART

Refresh should restore the same durable user/workspace where possible. Product authority does not depend on conversation context.

## OWNER / AUTHORITY

Identity owns account/session truth. User owns profile/preferences. Wallet does not own application identity.

## NEXT JOURNEY

J02 Discover, J05 Create/Copy Strategy, or J08 Paper Portfolio.
