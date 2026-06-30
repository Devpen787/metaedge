/**
 * Evidence intake, normalization, match engine, status updates.
 */
import { PaymentIntent } from '../payments/intents';
import { logAuditEvent } from '../audit/logger';

export type EvidenceOutcome = 'matched' | 'mismatched' | 'stale' | 'duplicate' | 'expired' | 'wrong_currency' | 'wrong_recipient';

export interface Evidence {
  id: string;
  intentId: string;
  amount: number;
  currency: string;
  recipientId: string;
  timestamp: number;
}

const processedEvidence = new Set<string>();

export function ingestEvidence(evidence: Evidence, intent: PaymentIntent, actorId: string): EvidenceOutcome {
  if (processedEvidence.has(evidence.id)) return 'duplicate';
  
  processedEvidence.add(evidence.id);

  if (Date.now() > intent.expiry) return 'expired';
  if (evidence.currency !== intent.currency) return 'wrong_currency';
  if (evidence.recipientId !== intent.recipientId) return 'wrong_recipient';
  
  // Example of stable field matching rather than just amount
  if (evidence.amount !== intent.amount) return 'mismatched';
  
  logAuditEvent({
    actor: actorId,
    action: 'EVIDENCE_MATCHED',
    target: intent.id,
    requestId: evidence.id,
    payloadHash: 'ev_hash',
    timestamp: Date.now()
  });

  return 'matched';
}
