/**
 * Role checks and allowed operations per state.
 */

export type Role = 'PAYER' | 'RECEIVER' | 'ORGANIZER' | 'OBSERVER';

export interface RBACPolicy {
  role: Role;
  allowedActions: string[];
}

const Policies: RBACPolicy[] = [
  { role: 'PAYER', allowedActions: ['SUBMIT_EVIDENCE', 'VIEW_INTENT'] },
  { role: 'RECEIVER', allowedActions: ['CONFIRM_RECEIPT', 'VIEW_INTENT'] },
  { role: 'ORGANIZER', allowedActions: ['CREATE_INTENT', 'OVERRIDE_EVIDENCE', 'CANCEL_INTENT'] },
  { role: 'OBSERVER', allowedActions: ['VIEW_INTENT'] }
];

export function canPerformAction(role: Role, action: string): boolean {
  const policy = Policies.find(p => p.role === role);
  if (!policy) return false;
  return policy.allowedActions.includes(action);
}
