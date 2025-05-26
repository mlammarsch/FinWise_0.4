// src/stores/tenantStore.ts
/**
 * Pinia-Store für Mandanten (Tenants).
 * Verwendet Dexie für die Persistenz der Tenant-Liste (in finwiseUserDB)
 * und für dynamische, mandantenspezifische Datenbanken (finwiseTenantDB_<TENANT_UUID>).
 */

import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import Dexie, { type Table } from 'dexie'; // DexieConstructor entfernt, da nicht direkt verwendet
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';

// Importiere DbTenant und DbUser Typen aus userStore
import type { DbTenant, DbUser } from './userStore';

// Schnittstelle für die mandantenspezifische Datenbank
class FinwiseTenantSpecificDB extends Dexie {
  // Hier werden Tabellen für den Mandanten definiert, z.B.
  // transactions!: Table<any, string>;
  // accounts!: Table<any, string>;
  // categories!: Table<any, string>;
  // ...
  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      // Vorerst leer, Struktur wird in separaten Tasks definiert.
      // Beispiel:
      // appSettings: '++id, key, value', // Für mandantenspezifische Einstellungen
      // transactions: '&uuid, date, accountId, categoryId, amount, type, description, createdAt, updatedAt',
      // accounts: '&uuid, name, type, balance, createdAt, updatedAt',
      // categories: '&uuid, name, parentId, type, createdAt, updatedAt',
    });
  }
}

// Globale Instanz der User-DB (vereinfacht, besser über userStore beziehen)
// Diese Lösung ist nicht ideal, da sie die DB-Definition dupliziert.
// Eine bessere Lösung wäre, dass userStore eine Methode bereitstellt, um auf db.dbTenants zuzugreifen.
class FinwiseUserDBGlobal extends Dexie {
  dbUsers!: Table<DbUser, string>;
  dbTenants!: Table<DbTenant, string>;

  constructor() {
    super('finwiseUserDB');
    this.version(1).stores({
      dbUsers: '&uuid, username, email, createdAt, updatedAt', // Angepasst an userStore
      dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt', // name zu tenantName
    });
  }
}
const userDB = new FinwiseUserDBGlobal(); // Diese Instanz wird für Tenant-Metadaten verwendet

// Importe für Store-Resets (bleiben vorerst)
import { useAccountStore } from './accountStore';
import { useCategoryStore } from './categoryStore';
// import { CategoryService } from '@/services/CategoryService'; // Wird später für Basiskategorie benötigt
import { useSessionStore } from './sessionStore'; // Hinzugefügt für sessionStore.currentTenantId

export const useTenantStore = defineStore('tenant', () => {
  /* ---------------------------------------------------------------- State */
  const tenants = ref<DbTenant[]>([]);
  const activeTenantId = ref<string | null>(null);
  /**
   * Hält die aktive Dexie-Datenbankinstanz für den ausgewählten Mandanten.
   * Notwendig für dynamische mandantenspezifische Datenbanken.
   */
  const activeTenantDB = ref<FinwiseTenantSpecificDB | null>(null);

  /* -------------------------------------------------------------- Getters */
  const getTenantsByUser = computed(() => (userId: string) =>
    tenants.value.filter(t => t.user_id === userId),
  );

  const activeTenant = computed(() =>
    tenants.value.find(t => t.uuid === activeTenantId.value) || null,
  );

  /* -------------------------------------------------------------- Actions */

  /**
   * Lädt die Tenant-Liste aus der finwiseUserDB und versucht, den zuletzt
   * aktiven Mandanten wiederherzustellen.
   * Wird bei der Initialisierung des Stores aufgerufen.
   */
  async function loadTenants(): Promise<void> {
    try {
      const storedTenants = await userDB.dbTenants.toArray();
      tenants.value = storedTenants;
      debugLog('tenantStore', 'loadTenants: Tenants geladen', { count: tenants.value.length });

      const storedActiveTenantId = localStorage.getItem('finwise_activeTenant');
      if (storedActiveTenantId && tenants.value.some(t => t.uuid === storedActiveTenantId)) {
        // setActiveTenant nicht direkt hier aufrufen, um Endlosschleifen bei Fehlern zu vermeiden.
        // Der Aufruf erfolgt typischerweise durch die UI oder einen Router-Guard nach dem Laden.
        // Für die reine Wiederherstellung des activeTenantId reicht das Setzen des Refs.
        // Die DB-Verbindung wird dann bei Bedarf durch expliziten Aufruf von setActiveTenant hergestellt.
        activeTenantId.value = storedActiveTenantId;
        infoLog('tenantStore', 'loadTenants: Aktiver Tenant aus localStorage wiederhergestellt', { activeTenantId: storedActiveTenantId });
        // Optional: Hier direkt setActiveTenant aufrufen, wenn das gewünschte Verhalten ist.
        // await setActiveTenant(storedActiveTenantId);
      } else if (activeTenantId.value && !tenants.value.some(t => t.uuid === activeTenantId.value)) {
        // Wenn ein activeTenantId gesetzt war, aber der Tenant nicht mehr existiert
        activeTenantId.value = null;
        localStorage.removeItem('finwise_activeTenant');
      }
    } catch (err) {
      errorLog('tenantStore', 'Fehler beim Ausführen von loadTenants', err);
      tenants.value = [];
    }
  }

  onMounted(() => {
    loadTenants();
  });

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
      tenants.value.push(newTenant); // State aktualisieren
      infoLog('tenantStore', `Neuer Tenant "${newTenant.tenantName}" für User ${userId} lokal angelegt`, { tenantId: newTenant.uuid });

      // Asynchrone Backend-Synchronisation, blockiert nicht den Rest der Funktion
      _syncTenantWithBackend(newTenant).then(syncSuccess => {
        if (syncSuccess) {
          infoLog('tenantStore', `Tenant ${newTenant.uuid} erfolgreich im Hintergrund mit Backend synchronisiert.`);
        } else {
          warnLog('tenantStore', `Hintergrund-Synchronisation für Tenant ${newTenant.uuid} mit Backend fehlgeschlagen. Lokale Anlage bleibt bestehen.`);
        }
      });

      // Neuen Tenant direkt aktiv schalten
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
        tenantName: tenantName.trim(), // name zu tenantName
        updatedAt: now,
      });
      if (updateCount > 0) {
        const idx = tenants.value.findIndex(t => t.uuid === id);
        if (idx !== -1) {
          tenants.value[idx].tenantName = tenantName.trim(); // name zu tenantName
          tenants.value[idx].updatedAt = now;
        }
        debugLog('tenantStore', 'updateTenant: Tenant aktualisiert', { id, tenantName: tenantName }); // name zu tenantName
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
      await Dexie.delete(dbName); // Mandantenspezifische DB löschen
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
      // TODO: Reset für abhängige Stores, die mandantenspezifische Daten halten.
      // useAccountStore().resetForTenant(id); // Beispiel
      infoLog('tenantStore', 'Tenant gelöscht', { tenantId: id });
      return true;
    } catch (err) {
      errorLog('tenantStore', `Fehler beim Löschen des Tenants ${id}`, err);
      return false;
    }
  }

  async function setActiveTenant(id: string | null): Promise<boolean> {
    if (activeTenantId.value === id && activeTenantDB.value && activeTenantDB.value.isOpen()) {
      // Bereits der aktive Tenant und DB ist offen
      debugLog('tenantStore', `Tenant ${id} ist bereits aktiv und DB verbunden.`);
      return true;
    }

    // Vorherige DB schließen
    if (activeTenantDB.value) {
      activeTenantDB.value.close();
      activeTenantDB.value = null;
      debugLog('tenantStore', 'Vorherige aktive Mandanten-DB geschlossen.');
    }

    if (!id) { // Keinen Tenant aktiv setzen
      activeTenantId.value = null;
      localStorage.removeItem('finwise_activeTenant');
      infoLog('tenantStore', 'Kein Tenant aktiv.');
      // Hier könnten globale Resets für mandantenabhängige Stores erfolgen
      return true;
    }

    const tenantExists = tenants.value.find(t => t.uuid === id);
    if (!tenantExists) {
      errorLog('tenantStore', `setActiveTenant: Tenant mit ID ${id} nicht gefunden.`);
      activeTenantId.value = null; // Sicherstellen, dass kein ungültiger Tenant aktiv ist
      localStorage.removeItem('finwise_activeTenant');
      return false;
    }

    activeTenantId.value = id;
    localStorage.setItem('finwise_activeTenant', id);
    const session = useSessionStore(); // sessionStore Instanz holen

    try {
      const dbName = `finwiseTenantDB_${id}`;
      const tenantDB = new FinwiseTenantSpecificDB(dbName);
      await tenantDB.open();
      activeTenantDB.value = tenantDB;
      session.currentTenantId = id; // SessionStore im Erfolgsfall aktualisieren
      infoLog('tenantStore', `Tenant "${tenantExists.tenantName}" (DB: ${dbName}) aktiviert und DB verbunden. SessionStore aktualisiert.`);

      // TODO: Logik zum Initialisieren von Daten für den aktiven Mandanten (z.B. Basiskategorien)
      // const catStore = useCategoryStore();
      // if (activeTenantDB.value) {
      //    const categoryService = new CategoryService(activeTenantDB.value);
      //    // ... Logik für Basiskategorien ...
      // }

      // TODO: Benachrichtige andere Stores, die mandantenspezifische DB zu verwenden.
      //       Dies kann über Events, direkte Aufrufe oder reaktive Abhängigkeiten geschehen.
      //       z.B. useTransactionStore().setActiveTenantDB(activeTenantDB.value);

      return true;
    } catch (err) {
      errorLog('tenantStore', `Fehler beim Verbinden/Initialisieren der Mandanten-DB für ${id}`, err);
      activeTenantDB.value = null;
      activeTenantId.value = null; // Bei Fehler auch activeTenantId zurücksetzen
      localStorage.removeItem('finwise_activeTenant');
      session.currentTenantId = null; // SessionStore im Fehlerfall zurücksetzen
      return false;
    }
  }

  async function reset(): Promise<void> { // Bezieht sich auf das Leeren der Tenant-Liste in finwiseUserDB
    try {
      await userDB.dbTenants.clear();
      tenants.value = [];
      if (activeTenantDB.value) {
        activeTenantDB.value.close();
      }
      activeTenantDB.value = null;
      activeTenantId.value = null;
      localStorage.removeItem('finwise_activeTenant');
      const session = useSessionStore(); // Ist hier schon korrekt vorhanden
      session.currentTenantId = null;
      infoLog('tenantStore', 'Alle Tenant-Einträge in finwiseUserDB geleert und aktiver Tenant zurückgesetzt.');
    } catch (err) {
      errorLog('tenantStore', 'Fehler beim Reset des TenantStores (Tenant-Liste)', err);
    }
  }

  // --- Sync Platzhalter ---
  async function syncCurrentTenantData(): Promise<void> {
    if (!activeTenantDB.value || !activeTenantId.value) {
      warnLog('tenantStore', 'syncCurrentTenantData: Kein aktiver Mandant oder DB-Verbindung.');
      return;
    }
    debugLog('tenantStore', `syncCurrentTenantData für Mandant ${activeTenantId.value} aufgerufen (Platzhalter)`);
    // TODO: Implementierung der Synchronisationslogik mit dem Backend für den aktuellen Mandanten
  }

  /**
   * Private Hilfsfunktion zur Synchronisation eines einzelnen Mandanten mit dem Backend.
   * @param tenant Das DbTenant-Objekt, das synchronisiert werden soll.
   * @returns Promise<boolean> True bei Erfolg, false bei Fehler.
   */
  async function _syncTenantWithBackend(tenant: DbTenant): Promise<boolean> {
    debugLog('tenantStore', `Versuche Tenant ${tenant.uuid} mit Backend zu synchronisieren.`);
    try {
      // const sessionStore = useSessionStore(); // Falls Auth-Token benötigt wird
      // const authToken = sessionStore.token; // Beispiel

      const response = await fetch('/api/tenants/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authToken}`, // Falls benötigt
        },
        body: JSON.stringify({
          uuid: tenant.uuid,
          name: tenant.tenantName, // Backend erwartet 'name'
          user_id: tenant.user_id,
          // createdAt und updatedAt könnten hier auch gesendet werden,
          // falls das Backend diese Werte übernimmt und nicht selbst setzt.
          // createdAt: tenant.createdAt,
          // updatedAt: tenant.updatedAt,
        }),
      });

      if (response.ok) {
        // Optional: Antwort des Backends verarbeiten, falls nötig
        // const syncedTenantData = await response.json();
        infoLog('tenantStore', `Tenant ${tenant.uuid} ("${tenant.tenantName}") erfolgreich mit Backend synchronisiert.`);
        return true;
      }
      // else { // Dieser Else-Block ist laut Biome redundant, da der if-Block bereits mit return endet.
      const errorText = await response.text();
      errorLog('tenantStore', `Fehler bei der Synchronisation von Tenant ${tenant.uuid} mit Backend. Status: ${response.status}`, { details: errorText, tenantName: tenant.tenantName });
      return false;
      // }
    } catch (error) {
      errorLog('tenantStore', `Netzwerkfehler oder anderer Fehler bei der Synchronisation von Tenant ${tenant.uuid} mit Backend.`, { error, tenantName: tenant.tenantName });
      return false;
    }
  }

  return {
    /* State */
    tenants,
    activeTenantId,
    activeTenantDB,

    /* Getter */
    getTenantsByUser,
    activeTenant,

    /* Actions */
    loadTenants, // Beibehalten und exportiert
    addTenant,
    updateTenant,
    deleteTenant,
    setActiveTenant,
    reset,

    /* Sync Actions */
    syncCurrentTenantData,
  };
});
