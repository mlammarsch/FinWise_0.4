// src/services/SessionService.ts
/**
 * SessionService – stellt Router-Guards & Initial-Bootstrapping bereit.
 */

import { Router } from 'vue-router';
import { useSessionStore } from '@/stores/sessionStore';
import { TenantService } from './TenantService';
import { useSettingsStore } from '@/stores/settingsStore';
import { infoLog, debugLog, errorLog } from '@/utils/logger';

export const SessionService = {
  /**
   * Richtet die globalen Router Guards ein.
   */
  setupGuards(router: Router) {
    router.beforeEach(async (to, _from, next) => {
      const session = useSessionStore();

      if (!session.currentUserId) {
        await session.loadSession();
      } else {
        // Initialisiere Settings für angemeldeten Benutzer
        await this.initializeUserSettings();
      }

      const isAuthRoute    = ['/login', '/register'].includes(to.path);
      const isTenantRoute  = to.path === '/tenant-select';

      if (!session.currentUserId) {
        if (isAuthRoute) return next();
        debugLog('SessionService', 'redirect → /login', { target: to.path });
        return next({ path: '/login' });
      }

      if (!session.currentTenantId) {
        const ok = TenantService.ensureTenantSelected();
        if (!ok) {
          if (!isTenantRoute) {
            debugLog('SessionService', 'redirect → /tenant-select', { target: to.path });
            return next({ path: '/tenant-select' });
          }
        }
      }

      if (isAuthRoute) {
        if (session.currentTenantId) {
          debugLog('SessionService', 'redirect (Auth) → /');
          return next({ path: '/' });
        }
        debugLog('SessionService', 'redirect (Auth) → /tenant-select');
        return next({ path: '/tenant-select' });
      }

      if (isTenantRoute && session.currentTenantId) {
        debugLog('SessionService', 'redirect (Tenant chosen) → /');
        return next({ path: '/' });
      }

      return next();
    });

    setTimeout(() => {
      infoLog('SessionService', 'Router-Guards aktiviert');
    }, 0);
  },

  logoutAndRedirect(router: Router) {
    useSessionStore().logout();
    router.push('/login');
  },

  /**
   * Vollständiger Logout mit IndexedDB-Bereinigung und Redirect
   * Wird bei Mandanten-Löschung verwendet
   */
  async logoutWithCleanupAndRedirect(router: Router) {
    try {
      const sessionStore = useSessionStore();

      // Logout durchführen
      sessionStore.logout();

      // Redirect zu Login
      router.push('/login');

      infoLog('SessionService', 'Vollständiger Logout mit Cleanup durchgeführt.');
    } catch (error) {
      errorLog('SessionService', 'Fehler beim Logout mit Cleanup', { error });
      // Fallback: Normaler Logout
      this.logoutAndRedirect(router);
    }
  },

  /**
   * Initialisiert Settings für den angemeldeten Benutzer
   */
  async initializeUserSettings() {
    try {
      const settingsStore = useSettingsStore();
      await settingsStore.initializeForUser();
      debugLog('SessionService', 'Settings für Benutzer initialisiert');
    } catch (error) {
      errorLog('SessionService', 'Fehler beim Initialisieren der Settings', error);
      // Graceful degradation - App funktioniert weiter mit Default-Settings
    }
  },
};
