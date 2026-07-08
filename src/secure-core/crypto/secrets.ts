/**
 * Secrets Management and Key Lifecycle
 */

import { createHmac, randomBytes } from 'crypto';

export interface APIKeyRecord {
  keyId: string;
  hashedSecret: string;
  userId: string;
  roles: string[];
  createdAt: number;
  expiresAt: number | null;
  isRevoked: boolean;
}

const keyVault = new Map<string, APIKeyRecord>();

export function generateApiKey(userId: string, roles: string[] = ['TRADER']): { keyId: string, plainSecret: string } {
  const keyId = `key_${randomBytes(8).toString('hex')}`;
  const plainSecret = randomBytes(32).toString('hex');
  
  // Hash the secret for storage
  const hashedSecret = createHmac('sha256', process.env.SYSTEM_PEPPER || 'fallback_pepper')
                        .update(plainSecret)
                        .digest('hex');

  keyVault.set(keyId, {
    keyId,
    hashedSecret,
    userId,
    roles,
    createdAt: Date.now(),
    expiresAt: null,
    isRevoked: false
  });

  // Only return the plain secret once
  return { keyId, plainSecret };
}

export function verifyApiKey(keyId: string, plainSecret: string): APIKeyRecord | null {
  const record = keyVault.get(keyId);
  if (!record || record.isRevoked) return null;
  if (record.expiresAt && Date.now() > record.expiresAt) return null;

  const expectedHash = createHmac('sha256', process.env.SYSTEM_PEPPER || 'fallback_pepper')
                        .update(plainSecret)
                        .digest('hex');

  if (record.hashedSecret === expectedHash) {
    return record;
  }
  return null;
}

export function revokeApiKey(keyId: string, userId: string) {
  const record = keyVault.get(keyId);
  if (record && record.userId === userId) {
    record.isRevoked = true;
  }
}
