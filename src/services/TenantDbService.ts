// src/services/TenantDbService.ts
import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore';
import type { Account, AccountGroup, SyncQueueEntry } from '@/types';
import { SyncStatus } from '@/types'; // SyncStatus importieren
import { errorLog, warnLog, debugLog } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class TenantDbService {
  private get db(): FinwiseTenantSpecificDB | null {
    const tenantStore = useTenantStore();
    return tenantStore.activeTenantDB;
  }

  /**
   * Fügt ein neues Konto zur IndexedDB hinzu.
   * @param account Das hinzuzufügende Konto.
   */
  async addAccount(account: Account): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accounts.add(account);
      debugLog('TenantDbService', `Konto "${account.name}" (ID: ${account.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen des Kontos "${account.name}"`, { account, error: err });
      throw err;
    }
  }

  /**
   * Aktualisiert ein bestehendes Konto in der IndexedDB.
   * @param account Das zu aktualisierende Konto.
   */
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

  /**
   * Löscht ein Konto aus der IndexedDB anhand seiner ID.
   * @param accountId Die ID des zu löschenden Kontos.
   */
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

  /**
   * Ruft ein Konto anhand seiner ID aus der IndexedDB ab.
   * @param accountId Die ID des abzurufenden Kontos.
   * @returns Das gefundene Konto oder undefined.
   */
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

  /**
   * Ruft alle Konten aus der IndexedDB ab.
   * @returns Ein Array aller Konten.
   */
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

  /**
   * Fügt eine neue Kontogruppe zur IndexedDB hinzu.
   * @param accountGroup Die hinzuzufügende Kontogruppe.
   */
  async addAccountGroup(accountGroup: AccountGroup): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accountGroups.add(accountGroup);
      debugLog('TenantDbService', `Kontogruppe "${accountGroup.name}" (ID: ${accountGroup.id}) hinzugefügt.`);
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Kontogruppe "${accountGroup.name}"`, { accountGroup, error: err });
      throw err;
    }
  }

  /**
   * Aktualisiert eine bestehende Kontogruppe in der IndexedDB.
   * @param accountGroup Die zu aktualisierende Kontogruppe.
   */
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

  /**
   * Löscht eine Kontogruppe aus der IndexedDB anhand ihrer ID.
   * @param accountGroupId Die ID der zu löschenden Kontogruppe.
   */
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

  /**
   * Ruft eine Kontogruppe anhand ihrer ID aus der IndexedDB ab.
   * @param accountGroupId Die ID der abzurufenden Kontogruppe.
   * @returns Die gefundene Kontogruppe oder undefined.
   */
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

  /**
   * Ruft alle Kontogruppen aus der IndexedDB ab.
   * @returns Ein Array aller Kontogruppen.
   */
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
   * Fügt einen neuen Eintrag zur Sync Queue hinzu.
   * @param entry Der hinzuzufügende Sync-Queue-Eintrag (ohne id, timestamp, status, tenantId - diese werden hier gesetzt).
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
      tenantId: tenantStore.activeTenantId, // tenantId hier setzen
      timestamp: Date.now(),
      status: SyncStatus.PENDING, // Initialer Status
      attempts: 0,
    };

    try {
      await this.db.syncQueue.add(newEntry);
      debugLog('TenantDbService', `SyncQueue-Eintrag für Entity ${newEntry.entityType} (ID: ${newEntry.entityId}, Op: ${newEntry.operationType}) hinzugefügt.`, newEntry);
      return newEntry;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen des SyncQueue-Eintrags für Entity ${newEntry.entityType} (ID: ${newEntry.entityId})`, { entry: newEntry, error: err });
      throw err; // Fehler weiterwerfen, damit der aufrufende Code darauf reagieren kann
    }
  }
}
