/**
 * Surface Capability Registry & Identity Binding
 */

export type SurfaceType = 'WEB_UI' | 'MOBILE_APP' | 'API_KEY' | 'TRADING_BOT_WEBHOOK';

export interface IdentityBinding {
  userId: string;
  surface: SurfaceType;
  kycLevel: 'NONE' | 'TIER_1' | 'TIER_2';
  deviceId?: string;
  ipAddress?: string;
}

export const SURFACE_CAPABILITIES: Record<SurfaceType, string[]> = {
  'WEB_UI': ['READ_ALL', 'CREATE_TRADE', 'CLOSE_TRADE', 'WITHDRAW_FUNDS'],
  'MOBILE_APP': ['READ_ALL', 'CREATE_TRADE', 'CLOSE_TRADE'],
  'API_KEY': ['READ_MARKET', 'CREATE_TRADE', 'CLOSE_TRADE'], // Cannot withdraw via API
  'TRADING_BOT_WEBHOOK': ['CREATE_TRADE', 'CLOSE_TRADE'] // Minimal permissions
};

export function assertCapability(binding: IdentityBinding, requiredAction: string) {
  const allowedActions = SURFACE_CAPABILITIES[binding.surface];
  if (!allowedActions.includes(requiredAction)) {
    throw new Error(`SURFACE_RESTRICTED: ${binding.surface} is not permitted to perform ${requiredAction}`);
  }

  // KYC Enforcements
  if (requiredAction === 'WITHDRAW_FUNDS' && binding.kycLevel === 'NONE') {
    throw new Error(`KYC_REQUIRED: Must complete Tier 1 KYC to withdraw funds.`);
  }
}
