/**
 * Capability declarations per surface (Mini-app, bot, webhook, guest link, API).
 */

export type SurfaceType = 'UI' | 'BOT' | 'WEBHOOK' | 'API' | 'GUEST_LINK';

export interface Capabilities {
  canCreateIntent: boolean;
  canSubmitEvidence: boolean;
  canConfirm: boolean;
  canClose: boolean;
  canOverride: boolean;
}

export interface SurfaceAdapter {
  id: string;
  type: SurfaceType;
  capabilities: Capabilities;
}

export const Registry = new Map<string, SurfaceAdapter>();

export function registerAdapter(adapter: SurfaceAdapter) {
  Registry.set(adapter.id, adapter);
}

export function checkCapability(adapterId: string, capability: keyof Capabilities): boolean {
  const adapter = Registry.get(adapterId);
  if (!adapter) return false;
  return !!adapter.capabilities[capability];
}
