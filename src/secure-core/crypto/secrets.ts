/**
 * Secrets Management and Key Lifecycle
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// No fallback pepper. A hardcoded fallback means every API key in the system is
// signed with a string that is publicly visible in source, so anyone can forge one.
// Fail loudly at the point of use instead of silently signing with a known secret.
function systemPepper(): string {
  const pepper = process.env.SYSTEM_PEPPER;
  if (!pepper) throw new Error('SYSTEM_PEPPER environment variable is required');
  return pepper;
}

// Constant-time compare. `===` on hex digests leaks, via timing, how many leading
// characters matched — enough to recover a hash byte by byte.
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

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
  const hashedSecret = createHmac('sha256', systemPepper())
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

  const expectedHash = createHmac('sha256', systemPepper())
                        .update(plainSecret)
                        .digest('hex');

  if (hashesEqual(record.hashedSecret, expectedHash)) {
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
