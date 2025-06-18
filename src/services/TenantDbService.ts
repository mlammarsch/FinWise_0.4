import Dexie, { type Transaction } from 'dexie'; // Import für Dexie und Transaction hinzufügen
import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore';
import type { Account, AccountGroup, Category, CategoryGroup, Recipient, Tag, AutomationRule, SyncQueueEntry, QueueStatistics, PlanningTransaction } from '@/types';
import type { MonthlyBalance } from '@/stores/monthlyBalanceStore';
import type { ExtendedTransaction } from '@/stores/transactionStore';
import { SyncStatus, EntityTypeEnum, SyncOperationType } from '@/types';
import { errorLog, warnLog, debugLog } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class TenantDbService {
  private get db(): FinwiseTenantSpecificDB | null {
    const tenantStore = useTenantStore();
    return tenantStore.activeTenantDB;
  }

  async addAccount(account: Account): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const plainAccount = this.toPlainObject(account);
      await this.db.accounts.put(plainAccount);
      debugLog('TenantDbService', `Konto "${account.name}" (ID: ${account.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen des Kontos "${account.name}"`, { account, error: err });
      throw err;
    }
  }

  async updateAccount(account: Account): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      debugLog('TenantDbService', 'updateAccount', 'Putting account into DB', account);
      const plainAccount = this.toPlainObject(account);
      await this.db.accounts.put(plainAccount);
      debugLog('TenantDbService', `Konto "${account.name}" (ID: ${account.id}) aktualisiert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Kontos "${account.name}"`, { account, error: err });
      throw err;
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accounts.delete(accountId);
      debugLog('TenantDbService', `Konto mit ID "${accountId}" gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen des Kontos mit ID "${accountId}"`, { accountId, error: err });
      throw err;
    }
  }

  async getAccountById(accountId: string): Promise<Account | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAccountById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const account = await this.db.accounts.get(accountId);
      debugLog('TenantDbService', `Konto mit ID "${accountId}" abgerufen.`, { account });
      return account;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen des Kontos mit ID "${accountId}"`, { accountId, error: err });
      return undefined;
    }
  }

  async getAllAccounts(): Promise<Account[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllAccounts: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const accounts = await this.db.accounts.toArray();
      debugLog('TenantDbService', 'Alle Konten abgerufen.', { count: accounts.length });
      return accounts;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Konten', { error: err });
      return [];
    }
  }

  async addAccountGroup(accountGroup: AccountGroup): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accountGroups.put(accountGroup);
      debugLog('TenantDbService', `Kontogruppe "${accountGroup.name}" (ID: ${accountGroup.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Kontogruppe "${accountGroup.name}"`, { accountGroup, error: err });
      throw err;
    }
  }

  async updateAccountGroup(accountGroup: AccountGroup): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accountGroups.put(accountGroup);
      debugLog('TenantDbService', `Kontogruppe "${accountGroup.name}" (ID: ${accountGroup.id}) aktualisiert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Kontogruppe "${accountGroup.name}"`, { accountGroup, error: err });
      throw err;
    }
  }

  async deleteAccountGroup(accountGroupId: string): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accountGroups.delete(accountGroupId);
      debugLog('TenantDbService', `Kontogruppe mit ID "${accountGroupId}" gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Kontogruppe mit ID "${accountGroupId}"`, { accountGroupId, error: err });
      throw err;
    }
  }

  async getAccountGroupById(accountGroupId: string): Promise<AccountGroup | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAccountGroupById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const accountGroup = await this.db.accountGroups.get(accountGroupId);
      debugLog('TenantDbService', `Kontogruppe mit ID "${accountGroupId}" abgerufen.`, { accountGroup });
      return accountGroup;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Kontogruppe mit ID "${accountGroupId}"`, { accountGroupId, error: err });
      return undefined;
    }
  }

  async getAllAccountGroups(): Promise<AccountGroup[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllAccountGroups: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const accountGroups = await this.db.accountGroups.toArray();
      debugLog('TenantDbService', 'Alle Kontogruppen abgerufen.', { count: accountGroups.length });
      return accountGroups;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Kontogruppen', { error: err });
      return [];
    }
  }

  async addCategory(category: Category): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addCategory: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const plainCategory = this.toPlainObject(category);
      await this.db.categories.put(plainCategory);
      debugLog('TenantDbService', `Kategorie "${category.name}" (ID: ${category.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Kategorie "${category.name}"`, { category, error: err });
      throw err;
    }
  }

  async updateCategory(category: Category): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateCategory: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const plainCategory = this.toPlainObject(category);
      await this.db.categories.put(plainCategory);
      debugLog('TenantDbService', `Kategorie "${category.name}" (ID: ${category.id}) aktualisiert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Kategorie "${category.name}"`, { category, error: err });
      throw err;
    }
  }

  async deleteCategory(categoryId: string): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteCategory: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.categories.delete(categoryId);
      debugLog('TenantDbService', `Kategorie mit ID "${categoryId}" gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Kategorie mit ID "${categoryId}"`, { categoryId, error: err });
      throw err;
    }
  }

  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getCategoryById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const category = await this.db.categories.get(categoryId);
      debugLog('TenantDbService', `Kategorie mit ID "${categoryId}" abgerufen.`, { category });
      return category;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Kategorie mit ID "${categoryId}"`, { categoryId, error: err });
      return undefined;
    }
  }

  async getAllCategories(): Promise<Category[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllCategories: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const categories = await this.db.categories.toArray();
      debugLog('TenantDbService', 'Alle Kategorien abgerufen.', { count: categories.length });
      return categories;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Kategorien', { error: err });
      return [];
    }
  }

  async addCategoryGroup(categoryGroup: CategoryGroup): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addCategoryGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.categoryGroups.put(categoryGroup);
      debugLog('TenantDbService', `Kategoriegruppe "${categoryGroup.name}" (ID: ${categoryGroup.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Kategoriegruppe "${categoryGroup.name}"`, { categoryGroup, error: err });
      throw err;
    }
  }

  async updateCategoryGroup(categoryGroup: CategoryGroup): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateCategoryGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.categoryGroups.put(categoryGroup);
      debugLog('TenantDbService', `Kategoriegruppe "${categoryGroup.name}" (ID: ${categoryGroup.id}) aktualisiert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Kategoriegruppe "${categoryGroup.name}"`, { categoryGroup, error: err });
      throw err;
    }
  }

  async deleteCategoryGroup(categoryGroupId: string): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteCategoryGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.categoryGroups.delete(categoryGroupId);
      debugLog('TenantDbService', `Kategoriegruppe mit ID "${categoryGroupId}" gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Kategoriegruppe mit ID "${categoryGroupId}"`, { categoryGroupId, error: err });
      throw err;
    }
  }

  async getCategoryGroupById(categoryGroupId: string): Promise<CategoryGroup | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getCategoryGroupById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const categoryGroup = await this.db.categoryGroups.get(categoryGroupId);
      debugLog('TenantDbService', `Kategoriegruppe mit ID "${categoryGroupId}" abgerufen.`, { categoryGroup });
      return categoryGroup;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Kategoriegruppe mit ID "${categoryGroupId}"`, { categoryGroupId, error: err });
      return undefined;
    }
  }

  async getAllCategoryGroups(): Promise<CategoryGroup[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllCategoryGroups: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const categoryGroups = await this.db.categoryGroups.toArray();
      debugLog('TenantDbService', 'Alle Kategoriegruppen abgerufen.', { count: categoryGroups.length });
      return categoryGroups;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Kategoriegruppen', { error: err });
      return [];
    }
  }

  async addSyncQueueEntry(
    entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId'>,
  ): Promise<SyncQueueEntry | null> {
    const tenantStore = useTenantStore();
    if (!this.db || !tenantStore.activeTenantId) {
      warnLog('TenantDbService', 'addSyncQueueEntry: Keine aktive Mandanten-DB oder activeTenantId verfügbar.');
      throw new Error('Keine aktive Mandanten-DB oder activeTenantId verfügbar.');
    }

    const newEntry: SyncQueueEntry = {
      ...entryData,
      id: uuidv4(),
      tenantId: tenantStore.activeTenantId,
      timestamp: Date.now(),
      status: SyncStatus.PENDING,
      attempts: 0,
    };

    try {
      await this.db.syncQueue.add(newEntry);
      debugLog('TenantDbService', `SyncQueue-Eintrag für Entity ${newEntry.entityType} (ID: ${newEntry.entityId}, Op: ${newEntry.operationType}) hinzugefügt.`, newEntry);
      return newEntry;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen des SyncQueue-Eintrags für Entity ${newEntry.entityType} (ID: ${newEntry.entityId})`, { entry: newEntry, error: err });
      throw err;
    }
  }

  async getPendingSyncEntries(tenantId: string): Promise<SyncQueueEntry[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getPendingSyncEntries: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const entries = await this.db.syncQueue
        .where({ tenantId: tenantId, status: SyncStatus.PENDING })
        .sortBy('timestamp');
      debugLog('TenantDbService', `Ausstehende Sync-Einträge für Mandant ${tenantId} abgerufen.`, { count: entries.length });
      return entries;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen ausstehender Sync-Einträge für Mandant ${tenantId}`, { error: err });
      return [];
    }
  }

  async updateSyncQueueEntryStatus(
    entryId: string,
    newStatus: SyncStatus,
    error?: string | undefined,
    transaction?: Transaction // Optionaler Parameter
  ): Promise<boolean> {
    if (!this.db && !transaction) { // Wenn keine DB und keine Transaktion, dann geht nichts
      warnLog('TenantDbService', 'updateSyncQueueEntryStatus: Keine aktive Mandanten-DB oder Transaktion verfügbar.');
      return false;
    }

    const updateData: Partial<SyncQueueEntry> = { status: newStatus };

    // Die Logik für attempts und lastAttempt muss innerhalb der Transaktion erfolgen,
    // um Konsistenz zu gewährleisten, besonders wenn die Funktion mit einer bestehenden Transaktion aufgerufen wird.
    // Da wir hier potenziell eine bestehende Transaktion verwenden, können wir nicht einfach this.db.syncQueue.get(entryId) außerhalb aufrufen.
    // Diese Logik wird in die 'operation' verlagert.

    if (newStatus === SyncStatus.FAILED && error) {
      updateData.error = error;
    }
    if (newStatus === SyncStatus.SYNCED) {
      updateData.error = undefined; // Fehler zurücksetzen bei erfolgreicher Synchronisation
    }

    const operation = async (tx: Transaction): Promise<number> => {
      const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');

      if (newStatus === SyncStatus.PROCESSING) {
        // Wichtig: Lese den aktuellen Eintrag *innerhalb* der Transaktion, um Race Conditions zu vermeiden
        const currentEntry = await syncQueueTable.get(entryId);
        updateData.attempts = (currentEntry?.attempts ?? 0) + 1;
        updateData.lastAttempt = Date.now();
      }

      return await syncQueueTable.update(entryId, updateData);
    };

    try {
      let updatedCount = 0;
      if (transaction) {
        updatedCount = await operation(transaction);
      } else if (this.db) {
        // Stellen Sie sicher, dass this.db.syncQueue hier korrekt referenziert wird,
        // oder übergeben Sie die Tabellennamen explizit, wenn Dexie das erfordert.
        updatedCount = await this.db.transaction('rw', this.db.syncQueue, async (tx) => {
          return await operation(tx);
        });
      } else {
        // Sollte durch die Prüfung am Anfang nicht erreicht werden, aber als Sicherheitsnetz
        warnLog('TenantDbService', 'updateSyncQueueEntryStatus: Weder Transaktion noch DB verfügbar für Operation.');
        return false;
      }

      if (updatedCount > 0) {
        debugLog('TenantDbService', `Status für SyncQueue-Eintrag ${entryId} auf ${newStatus} aktualisiert.`);
        return true;
      } else {
        // Wenn der Eintrag nicht gefunden wurde, könnte das ein Fehler sein oder erwartet (z.B. schon gelöscht)
        // Das Logging hier beibehalten, aber die aufrufende Stelle muss ggf. Kontext haben.
        warnLog('TenantDbService', `Konnte SyncQueue-Eintrag ${entryId} für Status-Update nicht finden (innerhalb der Transaktion).`);
        return false;
      }
    } catch (dbError) {
      errorLog('TenantDbService', `Dexie-Fehler beim Aktualisieren des SyncQueue-Eintrags ${entryId} auf Status ${newStatus}.`, { error: dbError });
      return false;
    }
  }

  async removeSyncQueueEntry(
    entryId: string,
    transaction?: Transaction // Optionaler Parameter
  ): Promise<boolean> {
    if (!this.db && !transaction) {
      warnLog('TenantDbService', 'removeSyncQueueEntry: Keine aktive Mandanten-DB oder Transaktion verfügbar.');
      return false;
    }

    const operation = async (tx: Transaction): Promise<boolean> => {
      const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');
      const existingEntry = await syncQueueTable.get(entryId);
      if (!existingEntry) {
        warnLog('TenantDbService', `removeSyncQueueEntry: Eintrag ${entryId} nicht gefunden (innerhalb der Transaktion), möglicherweise bereits entfernt.`);
        // Betrachte es als Erfolg, wenn das Ziel "Eintrag ist weg" ist.
        // Die aufrufende Stelle (WebSocketService) loggt bereits, wenn sie einen Eintrag nicht entfernen konnte,
        // weil er "möglicherweise bereits entfernt" wurde. Dieses Logging hier ist also konsistent.
        return true;
      }
      await syncQueueTable.delete(entryId);
      debugLog('TenantDbService', `SyncQueue-Eintrag ${entryId} erfolgreich entfernt (innerhalb der Transaktion).`);
      return true;
    };

    try {
      if (transaction) {
        return await operation(transaction);
      } else if (this.db) {
        // Stellen Sie sicher, dass this.db.syncQueue hier korrekt referenziert wird.
        return await this.db.transaction('rw', this.db.syncQueue, async (tx) => {
          return await operation(tx);
        });
      } else {
        warnLog('TenantDbService', 'removeSyncQueueEntry: Weder Transaktion noch DB verfügbar für Operation.');
        return false;
      }
    } catch (dbError) {
      errorLog('TenantDbService', `Dexie-Fehler beim Entfernen des SyncQueue-Eintrags ${entryId}.`, { error: dbError });
      return false;
    }
  }

  async getSyncQueueEntry(entryId: string): Promise<SyncQueueEntry | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getSyncQueueEntry: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const entry = await this.db.transaction('r', this.db.syncQueue, async () => {
        return await this.db!.syncQueue.get(entryId);
      });
      if (entry) {
        debugLog('TenantDbService', `SyncQueue-Eintrag ${entryId} abgerufen.`);
      }
      return entry;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen des SyncQueue-Eintrags ${entryId}`, { error: err });
      return undefined;
    }
  }

  async getFailedSyncEntries(tenantId: string, maxRetries: number = 3): Promise<SyncQueueEntry[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getFailedSyncEntries: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const entries = await this.db.syncQueue
        .where({ tenantId: tenantId, status: SyncStatus.FAILED })
        .filter(entry => (entry.attempts ?? 0) < maxRetries)
        .sortBy('timestamp');
      debugLog('TenantDbService', `Fehlgeschlagene Sync-Einträge für Mandant ${tenantId} abgerufen.`, { count: entries.length });
      return entries;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen fehlgeschlagener Sync-Einträge für Mandant ${tenantId}`, { error: err });
      return [];
    }
  }

  async getProcessingSyncEntries(tenantId: string): Promise<SyncQueueEntry[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getProcessingSyncEntries: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const entries = await this.db.syncQueue
        .where({ tenantId: tenantId, status: SyncStatus.PROCESSING })
        .sortBy('timestamp');
      debugLog('TenantDbService', `Verarbeitende Sync-Einträge für Mandant ${tenantId} abgerufen.`, { count: entries.length });
      return entries;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen verarbeitender Sync-Einträge für Mandant ${tenantId}`, { error: err });
      return [];
    }
  }

  async resetStuckProcessingEntries(tenantId: string, timeoutMs: number = 30000): Promise<number> {
    if (!this.db) {
      warnLog('TenantDbService', 'resetStuckProcessingEntries: Keine aktive Mandanten-DB verfügbar.');
      return 0;
    }
    try {
      const cutoffTime = Date.now() - timeoutMs;
      const stuckEntries = await this.db.syncQueue
        .where({ tenantId: tenantId, status: SyncStatus.PROCESSING })
        .filter(entry => (entry.lastAttempt ?? 0) < cutoffTime)
        .toArray();

      let resetCount = 0;
      for (const entry of stuckEntries) {
        const success = await this.updateSyncQueueEntryStatus(entry.id, SyncStatus.PENDING, 'Reset from stuck PROCESSING state');
        if (success) {
          resetCount++;
        }
      }

      if (resetCount > 0) {
        debugLog('TenantDbService', `${resetCount} hängende PROCESSING-Einträge für Mandant ${tenantId} zurückgesetzt.`);
      }
      return resetCount;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Zurücksetzen hängender PROCESSING-Einträge für Mandant ${tenantId}`, { error: err });
      return 0;
    }
  }

  async getQueueStatistics(tenantId: string): Promise<QueueStatistics> {
    if (!this.db) {
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }

    try {
      const [pendingEntries, processingEntries, failedEntries] = await Promise.all([
        this.db.syncQueue.where({ tenantId, status: SyncStatus.PENDING }).toArray(),
        this.db.syncQueue.where({ tenantId, status: SyncStatus.PROCESSING }).toArray(),
        this.db.syncQueue.where({ tenantId, status: SyncStatus.FAILED }).toArray()
      ]);

      const oldestPending = pendingEntries.length > 0
        ? Math.min(...pendingEntries.map(e => e.timestamp))
        : null;

      const lastError = failedEntries.length > 0
        ? failedEntries.sort((a, b) => (b.lastAttempt || 0) - (a.lastAttempt || 0))[0].error
        : null;

      return {
        pendingCount: pendingEntries.length,
        processingCount: processingEntries.length,
        failedCount: failedEntries.length,
        lastSyncTime: null, // Wird später implementiert
        oldestPendingTime: oldestPending,
        totalSyncedToday: 0, // Wird später implementiert
        averageSyncDuration: 0, // Wird später implementiert
        lastErrorMessage: lastError || null
      };

    } catch (error) {
      errorLog('TenantDbService', 'Error getting queue statistics', { error, tenantId });
      throw error;
    }
  }

  async getPendingDeleteOperations(tenantId: string): Promise<{accounts: string[], accountGroups: string[], categories: string[], categoryGroups: string[], recipients: string[], tags: string[]}> {
    /**
     * Holt alle pending DELETE-Operationen aus der Sync-Queue.
     * Wird verwendet um zu vermeiden, dass gelöschte Entitäten durch initial data load wieder hinzugefügt werden.
     */
    if (!this.db) {
      warnLog('TenantDbService', 'getPendingDeleteOperations: Keine aktive Mandanten-DB verfügbar.');
      return { accounts: [], accountGroups: [], categories: [], categoryGroups: [], recipients: [], tags: [] };
    }

    try {
      // Hole alle pending UND processing DELETE-Operationen
      // PROCESSING ist wichtig, da DELETE-Einträge während der Verarbeitung noch aktiv sind
      const pendingDeletes = await this.db.syncQueue
        .where({ tenantId, operationType: 'delete' })
        .and(entry => entry.status === SyncStatus.PENDING || entry.status === SyncStatus.PROCESSING)
        .toArray();

      const accounts: string[] = [];
      const accountGroups: string[] = [];
      const categories: string[] = [];
      const categoryGroups: string[] = [];
      const recipients: string[] = [];
      const tags: string[] = [];

      for (const entry of pendingDeletes) {
        if (entry.entityType === 'Account') {
          accounts.push(entry.entityId);
        } else if (entry.entityType === 'AccountGroup') {
          accountGroups.push(entry.entityId);
        } else if (entry.entityType === 'Category') {
          categories.push(entry.entityId);
        } else if (entry.entityType === 'CategoryGroup') {
          categoryGroups.push(entry.entityId);
        } else if (entry.entityType === 'Recipient') {
          recipients.push(entry.entityId);
        } else if (entry.entityType === 'Tag') {
          tags.push(entry.entityId);
        }
      }

      debugLog('TenantDbService', `Found ${accounts.length} pending account deletes, ${accountGroups.length} pending account group deletes, ${categories.length} pending category deletes, ${categoryGroups.length} pending category group deletes, ${recipients.length} pending recipient deletes and ${tags.length} pending tag deletes for tenant ${tenantId}`);

      return { accounts, accountGroups, categories, categoryGroups, recipients, tags };

    } catch (error) {
      errorLog('TenantDbService', 'Error getting pending DELETE operations', { error, tenantId });
      return { accounts: [], accountGroups: [], categories: [], categoryGroups: [], recipients: [], tags: [] };
    }
  }

  /**
   * Löscht die komplette IndexedDB für den aktuellen Mandanten
   */
  async deleteTenantDatabase(): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteTenantDatabase: Keine aktive Mandanten-DB verfügbar.');
      return;
    }

    try {
      const tenantStore = useTenantStore();
      const currentTenantId = tenantStore.activeTenantId;

      if (!currentTenantId) {
        throw new Error('Kein aktiver Mandant verfügbar.');
      }

      // Schließe die Datenbank-Verbindung
      this.db.close();

      // Lösche die komplette Datenbank
      await this.db.delete();

      // Setze die DB-Referenz im TenantStore zurück
      tenantStore.activeTenantDB = null;

      debugLog('TenantDbService', `IndexedDB für Mandant ${currentTenantId} vollständig gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Löschen der Mandanten-Datenbank', { error: err });
      throw err;
    }
  }

  /**
   * Setzt die IndexedDB für den aktuellen Mandanten zurück und initialisiert sie neu
   */
  async resetTenantDatabase(): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'resetTenantDatabase: Keine aktive Mandanten-DB verfügbar.');
      return;
    }

    try {
      const tenantStore = useTenantStore();
      const currentTenantId = tenantStore.activeTenantId;

      if (!currentTenantId) {
        throw new Error('Kein aktiver Mandant verfügbar.');
      }

      // Lösche alle Daten aus allen Tabellen
      await this.db.transaction('rw', [
        this.db.accounts,
        this.db.accountGroups,
        this.db.categories,
        this.db.categoryGroups,
        this.db.transactions,
        this.db.planningTransactions,
        this.db.tags,
        this.db.recipients,
        this.db.rules,
        this.db.syncQueue
      ], async () => {
        await Promise.all([
          this.db!.accounts.clear(),
          this.db!.accountGroups.clear(),
          this.db!.categories.clear(),
          this.db!.categoryGroups.clear(),
          this.db!.transactions.clear(),
          this.db!.planningTransactions.clear(),
          this.db!.tags.clear(),
          this.db!.recipients.clear(),
          this.db!.rules.clear(),
          this.db!.syncQueue.clear()
        ]);
      });

      debugLog('TenantDbService', `IndexedDB für Mandant ${currentTenantId} zurückgesetzt.`);
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Zurücksetzen der Mandanten-Datenbank', { error: err });
      throw err;
    }
  }

  /**
   * Löscht alle SyncQueue-Einträge für den aktuellen Mandanten
   */
  async clearSyncQueue(): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'clearSyncQueue: Keine aktive Mandanten-DB verfügbar.');
      return;
    }

    try {
      const tenantStore = useTenantStore();
      const currentTenantId = tenantStore.activeTenantId;

      if (!currentTenantId) {
        throw new Error('Kein aktiver Mandant verfügbar.');
      }

      // Einfache Lösung: Lösche alle SyncQueue-Einträge (nicht nur für aktuellen Mandanten)
      // Da jede Mandanten-DB separate IndexedDB ist, sind sowieso nur Einträge des aktuellen Mandanten drin
      const deletedCount = await this.db.syncQueue.clear();

      debugLog('TenantDbService', `${deletedCount} SyncQueue-Einträge für Mandant ${currentTenantId} gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Löschen der SyncQueue-Einträge', { error: err });
      throw err;
    }
  }

  async addTransaction(transaction: ExtendedTransaction): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addTransaction: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      // Konvertiere transaction zu plain object
      const plainTransaction = this.toPlainObject(transaction);

      await this.db.transactions.put(plainTransaction);
      debugLog('TenantDbService', `Transaktion "${transaction.description}" (ID: ${transaction.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Transaktion "${transaction.description}"`, { transaction, error: err });
      throw err;
    }
  }

  async updateTransaction(transaction: ExtendedTransaction): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateTransaction: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      // Konvertiere transaction zu plain object
      const plainTransaction = this.toPlainObject(transaction);

      await this.db.transactions.put(plainTransaction);
      debugLog('TenantDbService', `Transaktion "${transaction.description}" (ID: ${transaction.id}) aktualisiert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Transaktion "${transaction.description}"`, { transaction, error: err });
      throw err;
    }
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteTransaction: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.transactions.delete(transactionId);
      debugLog('TenantDbService', `Transaktion mit ID "${transactionId}" gelöscht.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Transaktion mit ID "${transactionId}"`, { transactionId, error: err });
      throw err;
    }
  }

  async getTransactionById(transactionId: string): Promise<ExtendedTransaction | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getTransactionById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const transaction = await this.db.transactions.get(transactionId);
      debugLog('TenantDbService', `Transaktion mit ID "${transactionId}" abgerufen.`, { transaction });
      return transaction;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Transaktion mit ID "${transactionId}"`, { transactionId, error: err });
      return undefined;
    }
  }

  async getAllTransactions(): Promise<ExtendedTransaction[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllTransactions: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const transactions = await this.db.transactions.toArray();
      debugLog('TenantDbService', 'Alle Transaktionen abgerufen.', { count: transactions.length });
      return transactions;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Transaktionen', { error: err });
      return [];
    }
  }

  async createRecipient(recipient: Recipient): Promise<Recipient> {
    if (!this.db) {
      warnLog('TenantDbService', 'createRecipient: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const recipientWithTimestamp = {
        ...recipient,
        updated_at: new Date().toISOString()
      };
      await this.db.recipients.put(recipientWithTimestamp);
      debugLog('TenantDbService', `Empfänger "${recipient.name}" (ID: ${recipient.id}) erstellt.`);
      return recipientWithTimestamp;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Erstellen des Empfängers "${recipient.name}"`, { recipient, error: err });
      throw err;
    }
  }

  async getRecipients(): Promise<Recipient[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getRecipients: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const recipients = await this.db.recipients.toArray();
      debugLog('TenantDbService', 'Alle Empfänger abgerufen.', { count: recipients.length });
      return recipients;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Empfänger', { error: err });
      return [];
    }
  }

  async getRecipientById(id: string): Promise<Recipient | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getRecipientById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const recipient = await this.db.recipients.get(id);
      debugLog('TenantDbService', `Empfänger mit ID "${id}" abgerufen.`, { recipient });
      return recipient;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen des Empfängers mit ID "${id}"`, { id, error: err });
      return undefined;
    }
  }

  async updateRecipient(id: string, updates: Partial<Recipient>): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateRecipient: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existing = await this.db.recipients.get(id);
      if (!existing) {
        warnLog('TenantDbService', `Empfänger mit ID "${id}" für Update nicht gefunden.`);
        return false;
      }

      const updatedRecipient = {
        ...existing,
        ...updates,
        id, // ID darf nicht überschrieben werden
        updated_at: new Date().toISOString()
      };

      await this.db.recipients.put(updatedRecipient);
      debugLog('TenantDbService', `Empfänger "${updatedRecipient.name}" (ID: ${id}) aktualisiert.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Empfängers mit ID "${id}"`, { id, updates, error: err });
      return false;
    }
  }

  async deleteRecipient(id: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteRecipient: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existing = await this.db.recipients.get(id);
      if (!existing) {
        warnLog('TenantDbService', `Empfänger mit ID "${id}" für Löschung nicht gefunden.`);
        return false;
      }

      await this.db.recipients.delete(id);
      debugLog('TenantDbService', `Empfänger mit ID "${id}" gelöscht.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen des Empfängers mit ID "${id}"`, { id, error: err });
      return false;
    }
  }

  async createTag(tag: Tag): Promise<Tag> {
    if (!this.db) {
      warnLog('TenantDbService', 'createTag: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const tagWithTimestamp = {
        ...tag,
        updated_at: new Date().toISOString()
      };
      await this.db.tags.put(tagWithTimestamp);
      debugLog('TenantDbService', `Tag "${tag.name}" (ID: ${tag.id}) erstellt.`);
      return tagWithTimestamp;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Erstellen des Tags "${tag.name}"`, { tag, error: err });
      throw err;
    }
  }

  async getTags(): Promise<Tag[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getTags: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const tags = await this.db.tags.toArray();
      debugLog('TenantDbService', 'Alle Tags abgerufen.', { count: tags.length });
      return tags;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Tags', { error: err });
      return [];
    }
  }

  async getTagById(id: string): Promise<Tag | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getTagById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const tag = await this.db.tags.get(id);
      debugLog('TenantDbService', `Tag mit ID "${id}" abgerufen.`, { tag });
      return tag;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen des Tags mit ID "${id}"`, { id, error: err });
      return undefined;
    }
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateTag: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingTag = await this.db.tags.get(id);
      if (!existingTag) {
        warnLog('TenantDbService', `Tag mit ID "${id}" für Update nicht gefunden.`);
        return false;
      }

      const updatedTag = {
        ...existingTag,
        ...updates,
        id, // ID darf nicht überschrieben werden
        updated_at: new Date().toISOString()
      };

      await this.db.tags.put(updatedTag);
      debugLog('TenantDbService', `Tag "${updatedTag.name}" (ID: ${id}) aktualisiert.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Tags mit ID "${id}"`, { id, updates, error: err });
      return false;
    }
  }

  async deleteTag(id: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteTag: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingTag = await this.db.tags.get(id);
      if (!existingTag) {
        warnLog('TenantDbService', `Tag mit ID "${id}" für Löschung nicht gefunden.`);
        return false;
      }

      await this.db.tags.delete(id);
      debugLog('TenantDbService', `Tag "${existingTag.name}" (ID: ${id}) gelöscht.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen des Tags mit ID "${id}"`, { id, error: err });
      return false;
    }
  }

  // ============================================================================
  // AUTOMATION RULES CRUD OPERATIONS
  // ============================================================================

  // Hilfsfunktion: Konvertiert Vue Reactive Proxies zu plain JavaScript-Objekten
  public toPlainObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.toPlainObject(item));
    }

    // Erstelle plain object ohne reactive properties
    const plain: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && !key.startsWith('__v_')) {
        plain[key] = this.toPlainObject(obj[key]);
      }
    }
    return plain;
  }

  async createRule(rule: AutomationRule): Promise<AutomationRule> {
    if (!this.db) {
      warnLog('TenantDbService', 'createRule: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      // Konvertiere rule zu plain object
      const plainRule = this.toPlainObject(rule);

      const ruleWithTimestamp = {
        ...plainRule,
        updated_at: new Date().toISOString()
      };

      debugLog('TenantDbService', 'createRule - Vue Reactive Proxies konvertiert', {
        ruleName: rule.name,
        ruleId: rule.id,
        conditionsCount: ruleWithTimestamp.conditions?.length || 0,
        actionsCount: ruleWithTimestamp.actions?.length || 0
      });

      await this.db.rules.put(ruleWithTimestamp);
      debugLog('TenantDbService', `Regel "${rule.name}" (ID: ${rule.id}) erstellt.`);
      return ruleWithTimestamp;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Erstellen der Regel "${rule.name}"`, { rule, error: err });
      throw err;
    }
  }

  async getRules(): Promise<AutomationRule[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getRules: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const rules = await this.db.rules.orderBy('priority').toArray();
      debugLog('TenantDbService', `${rules.length} Regeln abgerufen.`);
      return rules;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen der Regeln', { error: err });
      return [];
    }
  }

  async getRuleById(id: string): Promise<AutomationRule | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getRuleById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const rule = await this.db.rules.get(id);
      if (rule) {
        debugLog('TenantDbService', `Regel "${rule.name}" (ID: ${id}) abgerufen.`);
      }
      return rule;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Regel mit ID "${id}"`, { id, error: err });
      return undefined;
    }
  }

  async updateRule(id: string, updates: Partial<AutomationRule>): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateRule: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingRule = await this.db.rules.get(id);
      if (!existingRule) {
        warnLog('TenantDbService', `Regel mit ID "${id}" für Update nicht gefunden.`);
        return false;
      }

      // Konvertiere updates zu plain object
      const plainUpdates = this.toPlainObject(updates);

      const updatedRule = {
        ...existingRule,
        ...plainUpdates,
        id, // ID darf nicht überschrieben werden
        updated_at: new Date().toISOString()
      };

      await this.db.rules.put(updatedRule);
      debugLog('TenantDbService', `Regel "${updatedRule.name}" (ID: ${id}) aktualisiert.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Regel mit ID "${id}"`, { id, updates, error: err });
      return false;
    }
  }

  async deleteRule(id: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteRule: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingRule = await this.db.rules.get(id);
      if (!existingRule) {
        warnLog('TenantDbService', `Regel mit ID "${id}" für Löschung nicht gefunden.`);
        return false;
      }

      await this.db.rules.delete(id);
      debugLog('TenantDbService', `Regel "${existingRule.name}" (ID: ${id}) gelöscht.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Regel mit ID "${id}"`, { id, error: err });
      return false;
    }
  }

  // PlanningTransaction CRUD-Methoden
  async createPlanningTransaction(planningTransaction: PlanningTransaction): Promise<PlanningTransaction> {
    if (!this.db) {
      warnLog('TenantDbService', 'createPlanningTransaction: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const planningTransactionWithTimestamp = {
        ...planningTransaction,
        updated_at: new Date().toISOString()
      };
      const plainPlanningTransaction = this.toPlainObject(planningTransactionWithTimestamp);
      await this.db.planningTransactions.put(plainPlanningTransaction);
      debugLog('TenantDbService', `Planungstransaktion "${planningTransaction.name}" (ID: ${planningTransaction.id}) erstellt.`);
      return planningTransactionWithTimestamp;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Erstellen der Planungstransaktion "${planningTransaction.name}"`, { planningTransaction, error: err });
      throw err;
    }
  }

  async getPlanningTransactions(): Promise<PlanningTransaction[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getPlanningTransactions: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const planningTransactions = await this.db.planningTransactions.toArray();
      debugLog('TenantDbService', 'Alle Planungstransaktionen abgerufen.', { count: planningTransactions.length });
      return planningTransactions;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller Planungstransaktionen', { error: err });
      return [];
    }
  }

  async getPlanningTransactionById(id: string): Promise<PlanningTransaction | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getPlanningTransactionById: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const planningTransaction = await this.db.planningTransactions.get(id);
      if (planningTransaction) {
        debugLog('TenantDbService', `Planungstransaktion mit ID "${id}" abgerufen.`);
      }
      return planningTransaction;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der Planungstransaktion mit ID "${id}"`, { id, error: err });
      return undefined;
    }
  }

  async updatePlanningTransaction(id: string, updates: Partial<PlanningTransaction>): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'updatePlanningTransaction: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingPlanningTransaction = await this.db.planningTransactions.get(id);
      if (!existingPlanningTransaction) {
        warnLog('TenantDbService', `Planungstransaktion mit ID "${id}" für Update nicht gefunden.`);
        return false;
      }

      const updatedPlanningTransaction = {
        ...existingPlanningTransaction,
        ...updates,
        id, // ID darf nicht überschrieben werden
        updated_at: new Date().toISOString()
      };

      const plainUpdatedPlanningTransaction = this.toPlainObject(updatedPlanningTransaction);
      await this.db.planningTransactions.put(plainUpdatedPlanningTransaction);
      debugLog('TenantDbService', `Planungstransaktion "${updatedPlanningTransaction.name}" (ID: ${id}) aktualisiert.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Planungstransaktion mit ID "${id}"`, { id, updates, error: err });
      return false;
    }
  }

  async deletePlanningTransaction(id: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'deletePlanningTransaction: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const existingPlanningTransaction = await this.db.planningTransactions.get(id);
      if (!existingPlanningTransaction) {
        warnLog('TenantDbService', `Planungstransaktion mit ID "${id}" für Löschung nicht gefunden.`);
        return false;
      }

      await this.db.planningTransactions.delete(id);
      debugLog('TenantDbService', `Planungstransaktion "${existingPlanningTransaction.name}" (ID: ${id}) gelöscht.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der Planungstransaktion mit ID "${id}"`, { id, error: err });
      return false;
    }
  }

  // ============================================================================
  // MONTHLY BALANCE CRUD OPERATIONS
  // ============================================================================

  async getAllMonthlyBalances(): Promise<MonthlyBalance[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getAllMonthlyBalances: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const monthlyBalances = await this.db.monthlyBalances.orderBy('[year+month]').toArray();
      debugLog('TenantDbService', 'Alle MonthlyBalances abgerufen.', { count: monthlyBalances.length });
      return monthlyBalances;
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Abrufen aller MonthlyBalances', { error: err });
      return [];
    }
  }

  async saveMonthlyBalance(monthlyBalance: MonthlyBalance): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'saveMonthlyBalance: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      const plainMonthlyBalance = this.toPlainObject(monthlyBalance);
      await this.db.monthlyBalances.put(plainMonthlyBalance);
      debugLog('TenantDbService', `MonthlyBalance für ${monthlyBalance.year}/${monthlyBalance.month + 1} gespeichert.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Speichern der MonthlyBalance für ${monthlyBalance.year}/${monthlyBalance.month + 1}`, { monthlyBalance, error: err });
      throw err;
    }
  }

  async getMonthlyBalancesByYear(year: number): Promise<MonthlyBalance[]> {
    if (!this.db) {
      warnLog('TenantDbService', 'getMonthlyBalancesByYear: Keine aktive Mandanten-DB verfügbar.');
      return [];
    }
    try {
      const monthlyBalances = await this.db.monthlyBalances
        .where('year')
        .equals(year)
        .sortBy('month');
      debugLog('TenantDbService', `MonthlyBalances für Jahr ${year} abgerufen.`, { count: monthlyBalances.length });
      return monthlyBalances;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der MonthlyBalances für Jahr ${year}`, { year, error: err });
      return [];
    }
  }

  async getMonthlyBalance(year: number, month: number): Promise<MonthlyBalance | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getMonthlyBalance: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const monthlyBalance = await this.db.monthlyBalances.get([year, month]);
      debugLog('TenantDbService', `MonthlyBalance für ${year}/${month + 1} abgerufen.`, { found: !!monthlyBalance });
      return monthlyBalance;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Abrufen der MonthlyBalance für ${year}/${month + 1}`, { year, month, error: err });
      return undefined;
    }
  }

  async deleteMonthlyBalance(year: number, month: number): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteMonthlyBalance: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      await this.db.monthlyBalances.delete([year, month]);
      debugLog('TenantDbService', `MonthlyBalance für ${year}/${month + 1} gelöscht.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Löschen der MonthlyBalance für ${year}/${month + 1}`, { year, month, error: err });
      return false;
    }
  }

  // Sync-Queue-Methoden
  async addToSyncQueue(tableName: string, operation: 'create' | 'update' | 'delete', entity: any): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addToSyncQueue: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }

    try {
      const tenantStore = useTenantStore();
      const syncEntry: SyncQueueEntry = {
        id: uuidv4(),
        tenantId: tenantStore.activeTenantId || '',
        entityType: this.getEntityTypeFromTableName(tableName),
        entityId: entity.id,
        operationType: this.getSyncOperationType(operation),
        payload: entity,
        timestamp: Date.now(),
        status: SyncStatus.PENDING,
        attempts: 0
      };

      const plainSyncEntry = this.toPlainObject(syncEntry);
      await this.db.syncQueue.add(plainSyncEntry);
      debugLog('TenantDbService', `Sync-Queue-Eintrag für ${tableName} ${operation} hinzugefügt`, { entityId: entity.id });
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen zur Sync-Queue für ${tableName} ${operation}`, { entity, error: err });
      throw err;
    }
  }

  private getEntityTypeFromTableName(tableName: string): EntityTypeEnum {
    const mapping: Record<string, EntityTypeEnum> = {
      'accounts': EntityTypeEnum.ACCOUNT,
      'accountGroups': EntityTypeEnum.ACCOUNT_GROUP,
      'categories': EntityTypeEnum.CATEGORY,
      'categoryGroups': EntityTypeEnum.CATEGORY_GROUP,
      'recipients': EntityTypeEnum.RECIPIENT,
      'tags': EntityTypeEnum.TAG,
      'automationRules': EntityTypeEnum.RULE,
      'planningTransactions': EntityTypeEnum.PLANNING_TRANSACTION,
      'transactions': EntityTypeEnum.TRANSACTION
    };
    return mapping[tableName] || EntityTypeEnum.ACCOUNT;
  }

  private getSyncOperationType(operation: 'create' | 'update' | 'delete'): SyncOperationType {
    const mapping: Record<string, SyncOperationType> = {
      'create': SyncOperationType.CREATE,
      'update': SyncOperationType.UPDATE,
      'delete': SyncOperationType.DELETE
    };
    return mapping[operation];
  }
}
