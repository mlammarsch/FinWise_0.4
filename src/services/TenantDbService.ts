// src/services/TenantDbService.ts
import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore';
import type { Account, AccountGroup, SyncQueueEntry } from '@/types';
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

  /**
   * Fügt einen Eintrag zur Synchronisationswarteschlange hinzu.
   */
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
}
