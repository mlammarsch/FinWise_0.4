import { defineStore } from 'pinia';
import { ref, computed, onMounted, type Ref, type ComputedRef } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import Dexie, { type Table } from 'dexie';
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';
import { apiService } from '@/services/apiService';
import type { DbTenant, DbUser } from './userStore';
import type { Account, AccountGroup, Category, CategoryGroup, Recipient, Tag, AutomationRule, SyncQueueEntry, PlanningTransaction } from '../types';
import type { ExtendedTransaction } from './transactionStore';

export class FinwiseTenantSpecificDB extends Dexie {
  accounts!: Table<Account, string>;
  accountGroups!: Table<AccountGroup, string>;
  categories!: Table<Category, string>;
  categoryGroups!: Table<CategoryGroup, string>;
  transactions!: Table<ExtendedTransaction, string>;
  planningTransactions!: Table<PlanningTransaction, string>;
  recipients!: Table<Recipient, string>;
  tags!: Table<Tag, string>;
  rules!: Table<AutomationRule, string>;
  syncQueue!: Table<SyncQueueEntry, string>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      accounts: '&id, name, accountType, isActive, accountGroupId',
      accountGroups: '&id, name',
    });
    this.version(2).stores({
      accounts: '&id, name, accountType, isActive, accountGroupId',
      accountGroups: '&id, name',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status',
    });
    this.version(3).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status',
    });
    this.version(4).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(5).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(6).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(7).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
      recipients: '&id, name, defaultCategoryId, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(8).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
      recipients: '&id, name, defaultCategoryId, updated_at',
      tags: '&id, name, parentTagId, color, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(9).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
      recipients: '&id, name, defaultCategoryId, updated_at',
      tags: '&id, name, parentTagId, color, updated_at',
      rules: '&id, name, stage, priority, isActive, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
    this.version(10).stores({
      accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
      accountGroups: '&id, name, sortOrder, image, updated_at',
      categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
      categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
      transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
      planningTransactions: '&id, name, accountId, categoryId, startDate, isActive, recurrencePattern, transactionType, updated_at',
      recipients: '&id, name, defaultCategoryId, updated_at',
      tags: '&id, name, parentTagId, color, updated_at',
      rules: '&id, name, stage, priority, isActive, updated_at',
      syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
    });
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
import { useCategoryStore } from './categoryStore';
import { useSessionStore } from './sessionStore';
import { WebSocketService } from '@/services/WebSocketService';

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
        debugLog('tenantStore', 'updateTenant: Tenant lokal aktualisiert', { id, tenantName });
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
      warnLog('tenantStore', `setActiveTenant: Tenant ${id} nicht sofort in der Liste gefunden. Versuche erneutes Laden der Tenants aus der userDB.`);
      await loadTenants();
      tenantExists = tenants.value.find(t => t.uuid === id);
    }

    if (!tenantExists) {
      errorLog('tenantStore', `setActiveTenant: Tenant mit ID ${id} auch nach erneutem Laden aus userDB nicht gefunden. Mandantenspezifische DB wird nicht geöffnet.`);
      if (activeTenantId.value === id) {
        activeTenantId.value = null;
        localStorage.removeItem('finwise_activeTenant');
        const dbInstanceToClose = activeTenantDB.value;
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
      const session = useSessionStore();
      if (session.currentTenantId === id) {
        session.currentTenantId = null;
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

      const accountStore = useAccountStore();
      await accountStore.initializeStore();

      const categoryStore = useCategoryStore();
      await categoryStore.initializeStore();

      if (id) {
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
