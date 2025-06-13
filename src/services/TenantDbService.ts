import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore';
import type { Account, AccountGroup, Category, CategoryGroup, SyncQueueEntry, QueueStatistics } from '@/types';
import { SyncStatus } from '@/types';
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
      await this.db.accounts.put(account);
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
      await this.db.accounts.put(account);
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
      await this.db.categories.put(category);
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
      await this.db.categories.put(category);
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

  async updateSyncQueueEntryStatus(entryId: string, newStatus: SyncStatus, error?: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateSyncQueueEntryStatus: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      const updateData: Partial<SyncQueueEntry> = { status: newStatus };
      if (newStatus === SyncStatus.PROCESSING) {
        updateData.attempts = (await this.db.syncQueue.get(entryId))?.attempts ?? 0 + 1;
        updateData.lastAttempt = Date.now();
      }
      if (newStatus === SyncStatus.FAILED && error) {
        updateData.error = error;
      }
      if (newStatus === SyncStatus.SYNCED) {
        updateData.error = undefined;
      }

      const updatedCount = await this.db.syncQueue.update(entryId, updateData);
      if (updatedCount > 0) {
        debugLog('TenantDbService', `Status für SyncQueue-Eintrag ${entryId} auf ${newStatus} aktualisiert.`);
        return true;
      } else {
        warnLog('TenantDbService', `Konnte SyncQueue-Eintrag ${entryId} für Status-Update nicht finden.`);
        return false;
      }
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Status für SyncQueue-Eintrag ${entryId}`, { error: err });
      return false;
    }
  }

  async removeSyncQueueEntry(entryId: string): Promise<boolean> {
    if (!this.db) {
      warnLog('TenantDbService', 'removeSyncQueueEntry: Keine aktive Mandanten-DB verfügbar.');
      return false;
    }
    try {
      // Prüfen, ob der Eintrag existiert, bevor wir ihn löschen
      const existingEntry = await this.db.syncQueue.get(entryId);
      if (!existingEntry) {
        warnLog('TenantDbService', `SyncQueue-Eintrag ${entryId} für Löschung nicht gefunden.`);
        return false;
      }

      await this.db.syncQueue.delete(entryId);
      debugLog('TenantDbService', `SyncQueue-Eintrag ${entryId} erfolgreich entfernt.`);
      return true;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Entfernen des SyncQueue-Eintrags ${entryId}`, { error: err });
      return false;
    }
  }

  async getSyncQueueEntry(entryId: string): Promise<SyncQueueEntry | undefined> {
    if (!this.db) {
      warnLog('TenantDbService', 'getSyncQueueEntry: Keine aktive Mandanten-DB verfügbar.');
      return undefined;
    }
    try {
      const entry = await this.db.syncQueue.get(entryId);
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

  async getPendingDeleteOperations(tenantId: string): Promise<{accounts: string[], accountGroups: string[], categories: string[], categoryGroups: string[]}> {
    /**
     * Holt alle pending DELETE-Operationen aus der Sync-Queue.
     * Wird verwendet um zu vermeiden, dass gelöschte Entitäten durch initial data load wieder hinzugefügt werden.
     */
    if (!this.db) {
      warnLog('TenantDbService', 'getPendingDeleteOperations: Keine aktive Mandanten-DB verfügbar.');
      return { accounts: [], accountGroups: [], categories: [], categoryGroups: [] };
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

      for (const entry of pendingDeletes) {
        if (entry.entityType === 'Account') {
          accounts.push(entry.entityId);
        } else if (entry.entityType === 'AccountGroup') {
          accountGroups.push(entry.entityId);
        } else if (entry.entityType === 'Category') {
          categories.push(entry.entityId);
        } else if (entry.entityType === 'CategoryGroup') {
          categoryGroups.push(entry.entityId);
        }
      }

      debugLog('TenantDbService', `Found ${accounts.length} pending account deletes, ${accountGroups.length} pending account group deletes, ${categories.length} pending category deletes and ${categoryGroups.length} pending category group deletes for tenant ${tenantId}`);

      return { accounts, accountGroups, categories, categoryGroups };

    } catch (error) {
      errorLog('TenantDbService', 'Error getting pending DELETE operations', { error, tenantId });
      return { accounts: [], accountGroups: [], categories: [], categoryGroups: [] };
    }
  }
}
