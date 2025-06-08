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
   * Richtet die globalen Router Guards ein.
   */
  setupGuards(router: Router) {
    router.beforeEach(async (to, _from, next) => {
      const session = useSessionStore();

      if (!session.currentUserId) session.loadSession();

      const isAuthRoute    = ['/login', '/register'].includes(to.path);
      const isTenantRoute  = to.path === '/tenant-select';

      if (!session.currentUserId) {
        if (isAuthRoute) return next();
        debugLog('[SessionService] redirect → /login', { target: to.path });
        return next({ path: '/login' });
      }

      if (!session.currentTenantId) {
        const ok = TenantService.ensureTenantSelected();
        if (!ok) {
          if (!isTenantRoute) {
            debugLog('[SessionService] redirect → /tenant-select', { target: to.path });
            return next({ path: '/tenant-select' });
          }
        }
      }

      if (isAuthRoute) {
        if (session.currentTenantId) {
          debugLog('[SessionService] redirect (Auth) → /');
          return next({ path: '/' });
        }
        debugLog('[SessionService] redirect (Auth) → /tenant-select');
        return next({ path: '/tenant-select' });
      }

      if (isTenantRoute && session.currentTenantId) {
        debugLog('[SessionService] redirect (Tenant chosen) → /');
        return next({ path: '/' });
      }

      return next();
    });

    setTimeout(() => {
      infoLog('[SessionService]', 'Router-Guards aktiviert');
    }, 0);
  },

  logoutAndRedirect(router: Router) {
    useSessionStore().logout();
    router.push('/login');
  },
};
