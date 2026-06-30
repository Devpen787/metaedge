/**
 * Source-specific verification adapters + binding lifecycle.
 */

export interface IdentityClaim {
  userId: string;
  sourceType: string;
  sourceId: string;
  verifiedBy: string;
  expiry: number;
}

export const IdentityTable = new Map<string, IdentityClaim[]>();

export function bindIdentity(userId: string, claim: IdentityClaim): boolean {
  // Validate claim logic
  if (Date.now() > claim.expiry) {
    return false; // Expired claim
  }
  
  const userClaims = IdentityTable.get(userId) || [];
  // Ensure no duplicate source mapping
  const existing = userClaims.find(c => c.sourceType === claim.sourceType && c.sourceId === claim.sourceId);
  if (existing) return true;

  userClaims.push(claim);
  IdentityTable.set(userId, userClaims);
  return true;
}

export function verifyIdentity(userId: string, sourceType: string, sourceId: string): boolean {
  const claims = IdentityTable.get(userId) || [];
  const claim = claims.find(c => c.sourceType === sourceType && c.sourceId === sourceId);
  if (!claim) return false;
  return Date.now() <= claim.expiry;
}
