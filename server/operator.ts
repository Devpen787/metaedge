import { readDatabase } from './storage.js';

// WHO IS AN OPERATOR — single source of truth.
//
// An operator is a user whose wallet address appears in the allowlist. That
// address is authentic: finalizeConnect/wallets-select read it from the user's
// OWN authenticated mm session, so request data cannot spoof it.
//
// This used to live privately inside metamask.ts as `liveEnabledFor`, which meant
// any other route needing an operator check had to re-parse the env var. Two
// copies of an authorization rule is one copy too many.
//
// NOTE the deliberate separation of concerns:
//   isOperator()  — "is this person an operator?"        (identity)
//   liveEnabledFor() in metamask.ts — "may live execution run?"  (capability)
// Live execution can be enabled globally for everyone; being an operator cannot.
// Authorization checks want isOperator(), NOT the global trading flag.

const RAW = process.env.OPERATOR_ALLOWLIST || process.env.LIVE_ALLOWLIST || '';
const ALLOWLIST = RAW.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

export function operatorAllowlistConfigured(): boolean {
  return ALLOWLIST.length > 0;
}

export function isOperator(userId: string | undefined): boolean {
  // No fallback. An unconfigured allowlist grants nobody operator rights, rather
  // than silently granting everybody — the same rule as the secret fallbacks.
  if (!userId || ALLOWLIST.length === 0) return false;
  try {
    const wallet = (readDatabase().users[userId]?.walletAddress || '').toLowerCase();
    return !!wallet && ALLOWLIST.includes(wallet);
  } catch {
    return false;
  }
}
