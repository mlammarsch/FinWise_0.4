// src/utils/storageKey.ts
/**
 * Erzeugt einen mandanten- & user-spezifischen LocalStorage-Key.
 * Fallback „global“, wenn Session noch nicht initialisiert.
 */

import { useSessionStore } from '@/stores/sessionStore';

export function storageKey(base: string): string {
  const session = useSessionStore();

  const uid = session.currentUserId  ?? 'global';
  const tid = session.currentTenantId ?? 'global';

  return `finwise_${uid}_${tid}_${base}`;
}
