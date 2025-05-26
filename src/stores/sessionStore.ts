// src/stores/sessionStore.ts
/**
 * Session-Store – hält aktiven User und Tenant.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserStore, type LocalUser } from './userStore';
import { useTenantStore } from './tenantStore';
import { debugLog, warnLog } from '@/utils/logger';

export const useSessionStore = defineStore('session', () => {
  /* ---------------------------------------------------------------- State */
  const currentUserId = ref<string | null>(null);
  const currentTenantId = ref<string | null>(null);

  /* ----------------------------------------------------------- Sub-Stores */
  const userStore = useUserStore();
  const tenantStore = useTenantStore();

  /* ------------------------------------------------------------- Getters */
  const currentUser = computed<LocalUser | undefined>(() =>
    currentUserId.value ? userStore.getUserById(currentUserId.value) : undefined,
  );

  const currentTenant = computed(() =>
    tenantStore.activeTenant // Nutzt den activeTenant Getter aus tenantStore
  );

  /* ------------------------------------------------------------- Actions */
  function login(userId: string): void {
    currentUserId.value = userId;
    localStorage.setItem('finwise_currentUser', userId);
    debugLog('sessionStore', 'login', { userId });
  }

  async function logout(): Promise<void> {
    currentUserId.value = null;
    currentTenantId.value = null;
    localStorage.removeItem('finwise_currentUser');
    localStorage.removeItem('finwise_activeTenant');
    await tenantStore.setActiveTenant(null);
    debugLog('sessionStore', 'logout');
  }

 async function logoutTenant(): Promise<void> {
   currentTenantId.value = null;
   await tenantStore.setActiveTenant(null);
   debugLog('sessionStore', 'logoutTenant');
 }

  async function switchTenant(tenantId: string): Promise<boolean> {
    const ok = await tenantStore.setActiveTenant(tenantId);
    if (ok) {
     // currentTenantId is set by setActiveTenant
     debugLog('sessionStore', 'switchTenant', { tenantId });
   }
   return ok;
 }

  /* --------------------------------------------------------- Persistence */
  async function loadSession(): Promise<void> {
    const uid = localStorage.getItem('finwise_currentUser');
    // userStore.getUserById returns LocalUser | undefined. Ensure null if undefined.
    const user = uid ? userStore.getUserById(uid) : null;

    if (user) {
      currentUserId.value = user.id;
      debugLog('sessionStore', 'loadSession - User geladen', { userId: user.id });

      const tid = localStorage.getItem('finwise_activeTenant');
      // tenantStore.setActiveTenant handles validation and setting activeTenantId
      if (tid) {
        const setActiveSuccess = await tenantStore.setActiveTenant(tid);
        if (setActiveSuccess) {
          // currentTenantId is set by setActiveTenant
          debugLog('sessionStore', 'loadSession - Tenant geladen', { userId: user.id, tenantId: tid });
        } else {
          // Handle case where setActiveTenant failed (e.g., tenant not found or DB error)
          currentTenantId.value = null; // Ensure state is clean
          localStorage.removeItem('finwise_activeTenant'); // Clean up localStorage
          warnLog('sessionStore', 'loadSession - Konnte aktiven Tenant nicht setzen', { userId: user.id, tenantId: tid });
        }
      } else {
        debugLog('sessionStore', 'loadSession - Kein aktiver Tenant in localStorage gefunden', { userId: user.id });
        currentTenantId.value = null; // Sicherstellen, dass kein alter Tenant aktiv ist
      }
    } else {
      debugLog('sessionStore', 'loadSession - Kein User in localStorage gefunden oder User nicht im userStore', { uid });
      currentUserId.value = null;
      currentTenantId.value = null;
      localStorage.removeItem('finwise_currentUser');
      localStorage.removeItem('finwise_activeTenant');
      // Ggf. auch tenantStore.setActiveTenant(null) aufrufen, falls ein Tenant aktiv war
      await tenantStore.setActiveTenant(null);
    }
  }

  loadSession();

  return {
    currentUserId,
    currentTenantId,
    currentUser,
    currentTenant,
    login,
    logout,
    logoutTenant,
    switchTenant,
    loadSession,
  };
});
