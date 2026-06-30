/**
 * Mutation events and immutable hash chains / append-only policy.
 */

export interface AuditEvent {
  actor: string;
  action: string;
  target: string;
  payloadHash: string;
  requestId: string;
  timestamp: number;
}

// In a real application, this would be an append-only verifiable ledger
const auditLog: AuditEvent[] = [];

export function logAuditEvent(event: AuditEvent) {
  // Console logging for debugging in dev
  console.log(`[AUDIT] ${event.action} by ${event.actor} on ${event.target} (Req: ${event.requestId})`);
  
  // Append to immutable log
  auditLog.push(Object.freeze({ ...event }));
}

export function getAuditTrail(targetId: string): AuditEvent[] {
  return auditLog.filter(log => log.target === targetId);
}
