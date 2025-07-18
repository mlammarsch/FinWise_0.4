// src/services/SessionService.ts
/**
 * SessionService – stellt Router-Guards & Initial-Bootstrapping bereit.
 */

import { Router } from 'vue-router';
import { useSessionStore } from '@/stores/sessionStore';
import { TenantService } from './TenantService';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAccountStore } from '@/stores/accountStore';
import { ImageService } from './ImageService';
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
   * Lädt auch Logo-Cache wenn ein Mandant aktiv ist
   */
  async initializeUserSettings() {
    try {
      const settingsStore = useSettingsStore();
      await settingsStore.initializeForUser();
      debugLog('SessionService', 'Settings für Benutzer initialisiert');

      // Logo-Cache laden wenn Mandant bereits ausgewählt ist
      // WICHTIG: Warten bis accountStore.reset() abgeschlossen ist
      const sessionStore = useSessionStore();
      if (sessionStore.currentTenantId) {
        // Warte kurz, damit DataService.reloadTenantData() die Stores laden kann
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.preloadLogosForTenant();
      }
    } catch (error) {
      errorLog('SessionService', 'Fehler beim Initialisieren der Settings', error);
      // Graceful degradation - App funktioniert weiter mit Default-Settings
    }
  },

  /**
   * Sammelt alle logoPath-Pfade und lädt die Bilder vom Backend in den logoCache
   * Wird beim Login und Mandantenwechsel aufgerufen
   */
  async preloadLogosForTenant(): Promise<void> {
    try {
      debugLog('SessionService', 'Starte Logo-Preloading für aktuellen Mandanten');

      const accountStore = useAccountStore();
      const logoPaths = new Set<string>();

      // Sammle alle logo_path-Pfade von Accounts
      for (const account of accountStore.accounts) {
        if (account.logo_path) {
          logoPaths.add(account.logo_path);
        }
      }

      // Sammle alle logo_path-Pfade von AccountGroups
      for (const accountGroup of accountStore.accountGroups) {
        if (accountGroup.logo_path) {
          logoPaths.add(accountGroup.logo_path);
        }
      }

      debugLog('SessionService', `Gefundene Logo-Pfade für Preloading: ${logoPaths.size}`, {
        logoPaths: Array.from(logoPaths)
      });

      // Lade alle Logos parallel und cache sie
      const logoPromises = Array.from(logoPaths).map(async (logoPath) => {
        try {
          const cachedLogo = await ImageService.fetchAndCacheLogo(logoPath);
          if (cachedLogo) {
            debugLog('SessionService', `Logo erfolgreich gecacht: ${logoPath}`);
          } else {
            debugLog('SessionService', `Logo konnte nicht gecacht werden: ${logoPath}`);
          }
        } catch (error) {
          errorLog('SessionService', `Fehler beim Cachen des Logos: ${logoPath}`, error);
        }
      });

      await Promise.allSettled(logoPromises);

      infoLog('SessionService', `Logo-Preloading abgeschlossen. ${logoPaths.size} Logos verarbeitet.`);
    } catch (error) {
      errorLog('SessionService', 'Fehler beim Logo-Preloading', error);
      // Graceful degradation - App funktioniert weiter ohne Logo-Cache
    }
  },
};
