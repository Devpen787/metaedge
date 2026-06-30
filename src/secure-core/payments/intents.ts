/**
 * Intent lifecycle + matching rules.
 */

export type IntentStatus = 'OPEN' | 'MATCHED' | 'EXPIRED' | 'CANCELLED';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  payerId: string;
  recipientId: string;
  rail: string;
  referenceNonce: string;
  expiry: number;
  status: IntentStatus;
}

export function createIntent(data: Omit<PaymentIntent, 'id' | 'status'>): PaymentIntent {
  return {
    ...data,
    id: `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'OPEN'
  };
}

export function validateIntent(intent: PaymentIntent): boolean {
  if (intent.status !== 'OPEN') return false;
  if (Date.now() > intent.expiry) return false;
  return true;
}
