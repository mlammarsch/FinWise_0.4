// src/stores/tenantStore.ts
import { defineStore } from 'pinia';
import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import Dexie, { type Table } from 'dexie';
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';
import { apiService } from '@/services/apiService';
import type { DbTenant, DbUser } from './userStore';
import type { Account, AccountGroup, SyncQueueEntry } from '../types'; // Importiere die Typen

export class FinwiseTenantSpecificDB extends Dexie {
  accounts!: Table<Account, string>;
  accountGroups!: Table<AccountGroup, string>;
  syncQueue!: Table<SyncQueueEntry, string>; // Sync Queue Tabelle

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      accounts: '&id, name, accountType, isActive, accountGroupId', // Veraltet, aber für Upgrades beibehalten
      accountGroups: '&id, name', // Veraltet
    });
    // Version 2 fügte die syncQueue Tabelle hinzu und behielt alte Schemata bei
    this.version(2).stores({
      accounts: '&id, name, accountType, isActive, accountGroupId', // Veraltet
      accountGroups: '&id, name', // Veraltet
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status',
    });
    // Version 3 aktualisiert accounts und accountGroups auf das vollständige Schema
    this.version(3).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status', // Schema beibehalten
    });
    // Weitere Versionen hier bei Bedarf
  }
}

class FinwiseUserDBGlobal extends Dexie {
  dbUsers!: Table<DbUser, string>;
  dbTenants!: Table<DbTenant, string>;

  constructor() {
    super('finwiseUserDB');
    this.version(1).stores({
      dbUsers: '&uuid, username, email, createdAt, updatedAt',
      dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt',
    });
  }
}
const userDB = new FinwiseUserDBGlobal();

import { useAccountStore } from './accountStore';
// import { useCategoryStore } from './categoryStore'; // Vorerst nicht benötigt
import { useSessionStore } from './sessionStore';
import { WebSocketService } from '@/services/WebSocketService'; // Korrigierter Import-Case

// Definiere den expliziten Typ für den Store-State
interface TenantStoreState {
  tenants: Ref<DbTenant[]>;
  activeTenantId: Ref<string | null>;
  activeTenantDB: Ref<FinwiseTenantSpecificDB | null>;
  getTenantsByUser: ComputedRef<(userId: string) => DbTenant[]>;
  activeTenant: ComputedRef<DbTenant | null>;
  loadTenants: () => Promise<void>;
  addTenant: (tenantName: string, userId: string) => Promise<DbTenant | null>;
  updateTenant: (id: string, tenantName: string) => Promise<boolean>;
  deleteTenant: (id: string) => Promise<boolean>;
  setActiveTenant: (id: string | null) => Promise<boolean>;
  reset: () => Promise<void>;
  syncCurrentTenantData: () => Promise<void>;
}

export const useTenantStore = defineStore('tenant', (): TenantStoreState => {
  const tenants = ref<DbTenant[]>([]);
  const activeTenantId = ref<string | null>(null);
  const activeTenantDB = ref<FinwiseTenantSpecificDB | null>(null);

  const getTenantsByUser = computed(() => (userId: string) =>
    tenants.value.filter(t => t.user_id === userId),
  );

  const activeTenant = computed(() =>
    tenants.value.find(t => t.uuid === activeTenantId.value) || null,
  );

  async function loadTenants(): Promise<void> {
    try {
      tenants.value = await userDB.dbTenants.toArray();
      debugLog('tenantStore', 'loadTenants: Tenants geladen', { count: tenants.value.length });

      const storedActiveTenantId = localStorage.getItem('finwise_activeTenant');
      if (storedActiveTenantId && tenants.value.some(t => t.uuid === storedActiveTenantId)) {
        activeTenantId.value = storedActiveTenantId;
        infoLog('tenantStore', 'loadTenants: Aktiver Tenant aus localStorage wiederhergestellt', { activeTenantId: storedActiveTenantId });
      } else if (activeTenantId.value && !tenants.value.some(t => t.uuid === activeTenantId.value)) {
        activeTenantId.value = null;
        localStorage.removeItem('finwise_activeTenant');
      }
    } catch (err) {
      errorLog('tenantStore', 'Fehler beim Ausführen von loadTenants', err);
      tenants.value = [];
    }
  }

  onMounted(loadTenants);

  async function addTenant(tenantName: string, userId: string): Promise<DbTenant | null> {
    if (!tenantName.trim() || !userId) {
      errorLog('tenantStore', 'addTenant: Ungültiger Name oder UserID');
      return null;
    }
    const now = new Date().toISOString();
    const newTenant: DbTenant = {
      uuid: uuidv4(),
      tenantName: tenantName.trim(),
      user_id: userId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await userDB.dbTenants.add(newTenant);
      tenants.value.push(newTenant);
      infoLog('tenantStore', `Neuer Tenant "${newTenant.tenantName}" für User ${userId} lokal angelegt`, { tenantId: newTenant.uuid });

      _syncTenantWithBackend(newTenant).then(syncSuccess => {
        if (syncSuccess) {
          infoLog('tenantStore', `Tenant ${newTenant.uuid} erfolgreich im Hintergrund mit Backend synchronisiert.`);
        } else {
          warnLog('tenantStore', `Hintergrund-Synchronisation für Tenant ${newTenant.uuid} mit Backend fehlgeschlagen. Lokale Anlage bleibt bestehen.`);
        }
      });

      await setActiveTenant(newTenant.uuid);
      return newTenant;
    } catch (err) {
      errorLog('tenantStore', 'Fehler beim Hinzufügen des Tenants zur DB', { error: err });
      return null;
    }
  }

  async function updateTenant(id: string, tenantName: string): Promise<boolean> {
    if (!tenantName.trim()) return false;
    const now = new Date().toISOString();
    try {
      const updateCount = await userDB.dbTenants.update(id, {
        tenantName: tenantName.trim(),
        updatedAt: now,
      });
      if (updateCount > 0) {
        const idx = tenants.value.findIndex(t => t.uuid === id);
        if (idx !== -1) {
          tenants.value[idx].tenantName = tenantName.trim();
          tenants.value[idx].updatedAt = now;
        }
        debugLog('tenantStore', 'updateTenant: Tenant aktualisiert', { id, tenantName });
        return true;
      }
      warnLog('tenantStore', 'updateTenant: Tenant nicht gefunden oder keine Änderungen', { id });
      return false;
    } catch (err) {
      errorLog('tenantStore', `Fehler beim Aktualisieren des Tenants ${id}`, err);
      return false;
    }
  }

  async function deleteTenant(id: string): Promise<boolean> {
    try {
      await userDB.dbTenants.delete(id);
      const dbName = `finwiseTenantDB_${id}`;
      await Dexie.delete(dbName);
      infoLog('tenantStore', `Mandantenspezifische DB ${dbName} gelöscht.`);

      tenants.value = tenants.value.filter(t => t.uuid !== id);
      if (activeTenantId.value === id) {
        if (activeTenantDB.value) {
          activeTenantDB.value.close();
          activeTenantDB.value = null;
        }
        activeTenantId.value = null;
        localStorage.removeItem('finwise_activeTenant');
      }
      infoLog('tenantStore', 'Tenant gelöscht', { tenantId: id });
      return true;
    } catch (err) {
      errorLog('tenantStore', `Fehler beim Löschen des Tenants ${id}`, err);
      return false;
    }
  }

  /** Aktiviert einen Mandanten und verbindet dessen spezifische IndexedDB. */
  async function setActiveTenant(id: string | null): Promise<boolean> {
    if (activeTenantId.value === id && activeTenantDB.value?.isOpen()) {
      debugLog('tenantStore', `Tenant ${id} ist bereits aktiv und DB verbunden.`);
      return true;
    }

    const previousDbInstance = activeTenantDB.value;
    if (previousDbInstance instanceof Dexie) {
      previousDbInstance.close();
      activeTenantDB.value = null;
      debugLog('tenantStore', 'Vorherige aktive Mandanten-DB (Dexie-Instanz) geschlossen.');
    } else if (previousDbInstance) {
      // Fallback, falls es ein Objekt ist, aber keine Dexie-Instanz (sollte nicht passieren)
      warnLog('tenantStore', 'Vorherige aktive Mandanten-DB war keine Dexie-Instanz, konnte nicht sicher geschlossen werden.', previousDbInstance);
      activeTenantDB.value = null;
    }

    if (!id) {
      activeTenantId.value = null;
      localStorage.removeItem('finwise_activeTenant');
      infoLog('tenantStore', 'Kein Tenant aktiv.');
      return true;
    }

    let tenantExists = tenants.value.find(t => t.uuid === id);

    if (!tenantExists) {
      // Wenn der Tenant nicht sofort gefunden wird, versuchen, die Tenant-Liste neu zu laden.
      // Dies könnte helfen, wenn setActiveTenant aufgerufen wird, bevor loadTenants abgeschlossen ist
      // oder bevor die Synchronisation der Mandanten vom Backend die lokale userDB aktualisiert hat.
      warnLog('tenantStore', `setActiveTenant: Tenant ${id} nicht sofort in der Liste gefunden. Versuche erneutes Laden der Tenants aus der userDB.`);
      await loadTenants(); // Sicherstellen, dass die Liste aus der userDB aktuell ist
      tenantExists = tenants.value.find(t => t.uuid === id); // Erneuter Versuch
    }

    if (!tenantExists) {
      errorLog('tenantStore', `setActiveTenant: Tenant mit ID ${id} auch nach erneutem Laden aus userDB nicht gefunden. Mandantenspezifische DB wird nicht geöffnet.`);
      // Setze den aktiven Tenant zurück, falls er es war
      if (activeTenantId.value === id) {
        activeTenantId.value = null;
        localStorage.removeItem('finwise_activeTenant');
        const dbInstanceToClose = activeTenantDB.value; // Wert aus Ref holen
        // Dieser Block ist innerhalb von if (activeTenantId.value === id)
        // und behandelt den Fall, dass der Tenant nicht gefunden wurde,
        // aber vorher vielleicht als aktiv galt.
        const dbToCloseDueToNotFoundTenant = activeTenantDB.value;
        if (dbToCloseDueToNotFoundTenant instanceof Dexie) {
          dbToCloseDueToNotFoundTenant.close();
          activeTenantDB.value = null;
          debugLog('tenantStore', 'setActiveTenant: DB für nicht gefundenen (aber zuvor aktiven) Tenant geschlossen.');
        } else if (dbToCloseDueToNotFoundTenant) {
           warnLog('tenantStore', 'setActiveTenant: DB-Instanz für nicht gefundenen Tenant war keine Dexie-Instanz.', dbToCloseDueToNotFoundTenant);
           activeTenantDB.value = null;
        }
      }
      // Informiere auch den sessionStore, dass dieser Tenant nicht gültig ist
      const session = useSessionStore();
      if (session.currentTenantId === id) {
        session.currentTenantId = null; // Dies sollte idealerweise einen neuen Login-Flow oder Tenant-Auswahl triggern
        warnLog('tenantStore', `setActiveTenant: currentTenantId im sessionStore für ungültigen Tenant ${id} zurückgesetzt.`);
      }
      return false;
    }

    activeTenantId.value = id;
    localStorage.setItem('finwise_activeTenant', id);
    const session = useSessionStore();

    try {
      const dbName = `finwiseTenantDB_${id}`;
      const tenantDB = new FinwiseTenantSpecificDB(dbName);
      await tenantDB.open();
      activeTenantDB.value = tenantDB;
      session.currentTenantId = id;
      infoLog('tenantStore', `Tenant "${tenantExists.tenantName}" (DB: ${dbName}) aktiviert und DB verbunden. SessionStore aktualisiert.`);

      // Nach erfolgreicher Aktivierung und DB-Verbindung, initiale Daten anfordern
      // Stellen Sie sicher, dass der WebSocket verbunden ist, bevor Sie dies tun.
      // Dies könnte auch im WebSocketService selbst behandelt werden, wenn sich der Tenant ändert und eine Verbindung besteht.
      // Fürs Erste rufen wir es hier direkt auf, unter der Annahme, dass der WS-Connect-Prozess
      // auch durch die Tenant-Änderung getriggert wird oder bereits verbunden ist.
      // Der initiale Datenabruf wird nun vom WebSocketService gehandhabt,
      // der auf Änderungen des activeTenantId und des Verbindungsstatus reagiert.
      // debugLog('tenantStore', `setActiveTenant: Initialer Datenabruf für Tenant ${id} wird vom WebSocketService übernommen.`);
      // Expliziter Aufruf zum Anfordern initialer Daten:
      if (id) { // Sicherstellen, dass eine ID vorhanden ist
        // Es ist wichtig zu prüfen, ob der WebSocketService bereit ist oder die Anfrage puffert.
        // Fürs Erste gehen wir davon aus, dass der connect-Prozess des WebSockets auch durch
        // die Tenant-Änderung (via main.ts Watcher) getriggert wird und die Anfrage dann gesendet werden kann.
        WebSocketService.requestInitialData(id);
        infoLog('tenantStore', `setActiveTenant: Anforderung für initiale Daten für Tenant ${id} an WebSocketService gesendet.`);
      }
      return true;
    } catch (err) {
      errorLog('tenantStore', `Fehler beim Verbinden/Initialisieren der Mandanten-DB für ${id}`, err);
      activeTenantDB.value = null;
      activeTenantId.value = null;
      localStorage.removeItem('finwise_activeTenant');
      session.currentTenantId = null;
      return false;
    }
  }

  async function reset(): Promise<void> {
    try {
      await userDB.dbTenants.clear();
      tenants.value = [];
      if (activeTenantDB.value) {
        activeTenantDB.value.close();
      }
      activeTenantDB.value = null;
      activeTenantId.value = null;
      localStorage.removeItem('finwise_activeTenant');
      useSessionStore().currentTenantId = null;
      infoLog('tenantStore', 'Alle Tenant-Einträge in finwiseUserDB geleert und aktiver Tenant zurückgesetzt.');
    } catch (err) {
      errorLog('tenantStore', 'Fehler beim Reset des TenantStores (Tenant-Liste)', err);
    }
  }

  async function syncCurrentTenantData(): Promise<void> {
    if (!activeTenantDB.value || !activeTenantId.value) {
      warnLog('tenantStore', 'syncCurrentTenantData: Kein aktiver Mandant oder DB-Verbindung.');
      return;
    }
    debugLog('tenantStore', `syncCurrentTenantData für Mandant ${activeTenantId.value} aufgerufen (Platzhalter)`);
  }

  async function _syncTenantWithBackend(tenant: DbTenant): Promise<boolean> {
    debugLog('tenantStore', `Versuche Tenant ${tenant.uuid} mit Backend zu synchronisieren via apiService.`);
    try {
      const payload = {
        uuid: tenant.uuid,
        name: tenant.tenantName,
        user_id: tenant.user_id,
      };
      await apiService.post('/tenants/', payload);
      infoLog('tenantStore', `Tenant ${tenant.uuid} ("${tenant.tenantName}") erfolgreich mit Backend synchronisiert.`);
      return true;
    } catch (error: unknown) {
      let errorMessage = 'Unbekannter Synchronisationsfehler';

      if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('already exists for this user')) {
          warnLog(
            'tenantStore',
            `Tenant ${tenant.uuid} ("${tenant.tenantName}") existiert bereits im Backend oder ein anderer Fehler mit dieser Meldung ist aufgetreten.`,
            { tenantUuid: tenant.uuid, originalErrorMessage: errorMessage },
          );
          return true;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      errorLog(
        'tenantStore',
        `Fehler bei der Synchronisation von Tenant ${tenant.uuid} ("${tenant.tenantName}") mit Backend: ${errorMessage}`,
        { rawError: error, tenantUuid: tenant.uuid },
      );
      return false;
    }
  }

  return {
    tenants,
    activeTenantId,
    activeTenantDB,
    getTenantsByUser,
    activeTenant,
    loadTenants,
    addTenant,
    updateTenant,
    deleteTenant,
    setActiveTenant,
    reset,
    syncCurrentTenantData,
  };
});
