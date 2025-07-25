// src/stores/sessionStore.ts
/**
 * Session-Store – hält aktiven User und Tenant.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserStore, type LocalUser, db, type DbSession } from './userStore'; // Importiere db und DbSession
import { useTenantStore } from './tenantStore';
import { debugLog, warnLog, errorLog } from '@/utils/logger'; // Importiere errorLog

// Fester Schlüssel für die Session-Daten in IndexedDB
const SESSION_KEY = 'currentSession';

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
  async function login(userId: string): Promise<void> { // Mache async, um DB-Operation abzuwarten
    currentUserId.value = userId;
    await saveSession(); // Session in IndexedDB speichern
    debugLog('sessionStore', 'login', { userId });
  }

  async function logout(): Promise<void> {
    currentUserId.value = null;
    currentTenantId.value = null;
    await saveSession(); // Session in IndexedDB leeren
    await tenantStore.setActiveTenant(null);
    debugLog('sessionStore', 'logout');
  }

 async function logoutTenant(): Promise<void> {
   const tenantId = currentTenantId.value;

   // Signal ans Backend senden, um Datenbankressourcen freizugeben
   if (tenantId) {
     try {
       const { WebSocketService } = await import('@/services/WebSocketService');
       const success = WebSocketService.sendTenantDisconnect(tenantId, 'user_logout');
       if (success) {
         debugLog('sessionStore', 'Tenant disconnect signal sent to backend', { tenantId });
       } else {
         debugLog('sessionStore', 'Failed to send tenant disconnect signal - WebSocket not connected', { tenantId });
       }
     } catch (error) {
       debugLog('sessionStore', 'Error sending tenant disconnect signal', { tenantId, error });
     }
   }

   currentTenantId.value = null;
   await saveSession(); // Session in IndexedDB aktualisieren
   await tenantStore.setActiveTenant(null);
   debugLog('sessionStore', 'logoutTenant', { tenantId });
 }

  async function switchTenant(tenantId: string): Promise<boolean> {
    const previousTenantId = currentTenantId.value;

    // Signal ans Backend für vorherigen Mandanten senden
    if (previousTenantId && previousTenantId !== tenantId) {
      try {
        const { WebSocketService } = await import('@/services/WebSocketService');
        const success = WebSocketService.sendTenantDisconnect(previousTenantId, 'tenant_switch');
        if (success) {
          debugLog('sessionStore', 'Tenant disconnect signal sent for previous tenant', { previousTenantId, newTenantId: tenantId });
        } else {
          debugLog('sessionStore', 'Failed to send tenant disconnect signal - WebSocket not connected', { previousTenantId, newTenantId: tenantId });
        }
      } catch (error) {
        debugLog('sessionStore', 'Error sending tenant disconnect signal for previous tenant', { previousTenantId, newTenantId: tenantId, error });
      }
    }

    const ok = await tenantStore.setActiveTenant(tenantId);
    if (ok) {
     // currentTenantId is set by setActiveTenant
     await saveSession(); // Session in IndexedDB aktualisieren
     debugLog('sessionStore', 'switchTenant', { previousTenantId, tenantId });
   }
   return ok;
 }

  /* --------------------------------------------------------- Persistence */

  // Hilfsfunktion zum Speichern der Session in IndexedDB
  async function saveSession(): Promise<void> {
    try {
      const sessionData: DbSession = {
        id: SESSION_KEY,
        currentUserId: currentUserId.value,
        currentTenantId: currentTenantId.value,
      };
      await db.dbSession.put(sessionData); // put() fügt hinzu oder aktualisiert
      debugLog('sessionStore', 'saveSession: Session in DB gespeichert', { userId: currentUserId.value, tenantId: currentTenantId.value });
    } catch (err) {
      errorLog('sessionStore', 'saveSession: Fehler beim Speichern der Session in DB', err);
    }
  }

  async function loadSession(): Promise<void> {
    try {
      const sessionData = await db.dbSession.get(SESSION_KEY);
      if (sessionData) {
        currentUserId.value = sessionData.currentUserId;
        currentTenantId.value = sessionData.currentTenantId; // Wird hier direkt gesetzt, setActiveTenant wird unten aufgerufen

        debugLog('sessionStore', 'loadSession - Session aus DB geladen', { userId: currentUserId.value, tenantId: currentTenantId.value });

        // TenantStore muss den aktiven Tenant setzen, um reaktive Abhängigkeiten zu gewährleisten
        if (currentTenantId.value) {
           const setActiveSuccess = await tenantStore.setActiveTenant(currentTenantId.value);
           if (!setActiveSuccess) {
             // Handle case where setActiveTenant failed (e.g., tenant not found in tenantStore)
             warnLog('sessionStore', 'loadSession - Konnte aktiven Tenant aus DB nicht setzen (Tenant nicht gefunden?)', { userId: currentUserId.value, tenantId: currentTenantId.value });
             currentTenantId.value = null; // State bereinigen
             await saveSession(); // Geänderten State speichern
           }
        } else {
           // Sicherstellen, dass tenantStore keinen aktiven Tenant hat, falls currentTenantId null ist
           await tenantStore.setActiveTenant(null);
        }

        // Prüfe auf inkonsistenten Zustand: Tenant ohne User
        if (currentTenantId.value && !currentUserId.value) {
          warnLog('sessionStore', 'loadSession - Inkonsistenter Zustand: Tenant ohne User gefunden. Erstelle Default-User.', { tenantId: currentTenantId.value });
          await ensureDefaultUser();
        }

      } else {
        debugLog('sessionStore', 'loadSession - Keine Session in DB gefunden.');
        currentUserId.value = null;
        currentTenantId.value = null;
        await tenantStore.setActiveTenant(null); // Sicherstellen, dass tenantStore keinen aktiven Tenant hat
      }
    } catch (err) {
      errorLog('sessionStore', 'loadSession: Fehler beim Laden der Session aus DB', err);
      currentUserId.value = null;
      currentTenantId.value = null;
      await tenantStore.setActiveTenant(null); // Sicherstellen, dass tenantStore keinen aktiven Tenant hat
    }
  }

  /**
   * Erstellt einen Default-User, wenn ein Tenant vorhanden ist, aber kein User angemeldet ist.
   * Dies löst das Problem der fehlenden User-Session für Settings-Synchronisation.
   */
  async function ensureDefaultUser(): Promise<void> {
    try {
      // Prüfe, ob bereits ein User in der DB existiert
      const existingUsers = await db.dbUsers.toArray();

      if (existingUsers.length > 0) {
        // Verwende den ersten verfügbaren User
        const defaultUser = existingUsers[0];
        currentUserId.value = defaultUser.uuid;
        await saveSession();
        debugLog('sessionStore', 'ensureDefaultUser - Existierenden User als Default gesetzt', { userId: defaultUser.uuid });
        return;
      }

      // Erstelle einen neuen Default-User
      const defaultUserId = 'default-user-' + Date.now();
      const now = new Date().toISOString();

      const defaultDbUser = {
        uuid: defaultUserId,
        username: 'Default User',
        email: 'default@finwise.local',
        createdAt: now,
        updatedAt: now,
        needsBackendSync: false
      };

      await db.dbUsers.add(defaultDbUser);
      currentUserId.value = defaultUserId;
      await saveSession();

      debugLog('sessionStore', 'ensureDefaultUser - Default-User erstellt und Session aktualisiert', { userId: defaultUserId });

      // Lade User-Store neu, damit der neue User verfügbar ist
      await userStore._loadUsersFromDb();

    } catch (err) {
      errorLog('sessionStore', 'ensureDefaultUser: Fehler beim Erstellen des Default-Users', err);
    }
  }

  // Session beim Initialisieren des Stores laden
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
    ensureDefaultUser,
    // saveSession wird nicht exportiert, da es eine interne Hilfsfunktion ist
  };
});
