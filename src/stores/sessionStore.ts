// src/stores/sessionStore.ts
/**
 * Session-Store – hält aktiven User und Tenant.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserStore, LocalUser } from './userStore';
import { useTenantStore, Tenant } from './tenantStore';
import { debugLog } from '@/utils/logger';
import { DataService } from '@/services/DataService'; // <-- NEU

export const useSessionStore = defineStore('session', () => {
  /* ---------------------------------------------------------------- State */
  const currentUserId = ref<string | null>(null);
  const currentTenantId = ref<string | null>(null);

  /* ----------------------------------------------------------- Sub-Stores */
  const userStore = useUserStore();
  const tenantStore = useTenantStore();

  /* ------------------------------------------------------------- Getters */
  const currentUser = computed<LocalUser | null>(() =>
    currentUserId.value ? userStore.getUserById(currentUserId.value) : null,
  );

  const currentTenant = computed<Tenant | null>(() =>
    currentTenantId.value
      ? tenantStore.tenants.find(t => t.id === currentTenantId.value) || null
      : null,
  );

  /* ------------------------------------------------------------- Actions */
  function login(userId: string): void {
    currentUserId.value = userId;
    localStorage.setItem('finwise_currentUser', userId);
    debugLog('[sessionStore] login', { userId });
  }

  function logout(): void {
    currentUserId.value = null;
    currentTenantId.value = null;
    localStorage.removeItem('finwise_currentUser');
    localStorage.removeItem('finwise_activeTenant');
    tenantStore.activeTenantId = null;
    debugLog('[sessionStore] logout');
  }

  function logoutTenant(): void {
    currentTenantId.value = null;
    tenantStore.activeTenantId = null;
    localStorage.removeItem('finwise_activeTenant');
    debugLog('[sessionStore] logoutTenant');
  }

  function switchTenant(tenantId: string): boolean {
    const ok = tenantStore.setActiveTenant(tenantId);
    if (ok) {
      currentTenantId.value = tenantId;
      debugLog('[sessionStore] switchTenant', { tenantId });
    }
    return ok;
  }

  /* --------------------------------------------------------- Persistence */
  function loadSession(): void {
    const uid = localStorage.getItem('finwise_currentUser');
    if (uid && userStore.getUserById(uid)) currentUserId.value = uid;

    const tid = localStorage.getItem('finwise_activeTenant');
    if (tid && tenantStore.tenants.find(t => t.id === tid)) {
      currentTenantId.value = tid;
      tenantStore.activeTenantId = tid;
    }

    debugLog('[sessionStore] loadSession', { uid, tid });

    // ----------- NEU: nach Initial-Login Tenant-Daten laden -----------
    if (currentTenantId.value) {
      DataService.reloadTenantData();
    }
    // ------------------------------------------------------------------
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
