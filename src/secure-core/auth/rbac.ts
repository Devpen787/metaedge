/**
 * Role-Based Access Control
 */

export type Role = 'TRADER' | 'ADMIN' | 'SYSTEM' | 'AUDITOR';

export interface RBACContext {
  userId: string;
  roles: Role[];
}

export function assertPermission(context: RBACContext, requiredRole: Role, action: string) {
  if (!context.roles.includes(requiredRole) && !context.roles.includes('ADMIN') && !context.roles.includes('SYSTEM')) {
    throw new Error(`UNAUTHORIZED: Missing role ${requiredRole} for action ${action}`);
  }
}
