// src/services/SessionService.ts
/**
 * SessionService – stellt Router-Guards & Initial-Bootstrapping bereit.
 */

import { Router } from 'vue-router';
import { useSessionStore } from '@/stores/sessionStore';
import { TenantService } from './TenantService';
import { infoLog, debugLog } from '@/utils/logger';

export const SessionService = {
  /**
   * Legt alle globalen Guards an.
   */
  setupGuards(router: Router) {
    router.beforeEach(async (to, _from, next) => {
      const session = useSessionStore();

      // Lade Session aus LocalStorage beim ersten Guard-Aufruf
      if (!session.currentUserId) session.loadSession();

      const isAuthRoute    = ['/login', '/register'].includes(to.path);
      const isTenantRoute  = to.path === '/tenant-select';

      /* ---------- Kein User eingeloggt ---------- */
      if (!session.currentUserId) {
        if (isAuthRoute) return next();
        debugLog('[SessionService] redirect → /login', { target: to.path });
        return next({ path: '/login' });
      }

      /* ---------- User eingeloggt, aber Tenant fehlt ---------- */
      if (!session.currentTenantId) {
        // Versuche automatisch einen Tenant zu setzen
        const ok = TenantService.ensureTenantSelected();
        if (!ok) {
          if (!isTenantRoute) {
            debugLog('[SessionService] redirect → /tenant-select', { target: to.path });
            return next({ path: '/tenant-select' });
          }
        }
      }

      /* ---------- Auth-Routen ---------- */
      if (isAuthRoute) {
        // Bereits eingeloggt → Dashboard (Tenant vorausgesetzt)
        if (session.currentTenantId) {
          debugLog('[SessionService] redirect (Auth) → /');
          return next({ path: '/' });
        }
        // Kein Tenant → zuerst Tenant wählen
        debugLog('[SessionService] redirect (Auth) → /tenant-select');
        return next({ path: '/tenant-select' });
      }

      /* ---------- Tenant-Route ---------- */
      if (isTenantRoute && session.currentTenantId) {
        // Tenant bereits gewählt → Dashboard
        debugLog('[SessionService] redirect (Tenant chosen) → /');
        return next({ path: '/' });
      }

      /* ---------- Alles OK ---------- */
      return next();
    });

    // Logging erst NACH vollständigem Setup
    setTimeout(() => {
      infoLog('[SessionService]', 'Router-Guards aktiviert');
    }, 0);
  },

  /**
   * Convenience: Ausloggen + Redirect.
   */
  logoutAndRedirect(router: Router) {
    useSessionStore().logout();
    router.push('/login');
  },
};
