// src/services/TenantDbService.ts
import { useTenantStore, type FinwiseTenantSpecificDB, type SyncQueueItem } from '@/stores/tenantStore';
import type { Account, AccountGroup, SyncableEntity } from '@/types';
import { errorLog, warnLog, debugLog } from '@/utils/logger';

export class TenantDbService {
  private get db(): FinwiseTenantSpecificDB | null {
    const tenantStore = useTenantStore();
    return tenantStore.activeTenantDB;
  }

  /**
   * Fügt ein neues Konto zur IndexedDB hinzu.
   * @param account Das hinzuzufügende Konto.
   */
  async addAccount(accountData: Omit<Account, 'created_at' | 'updated_at'>, skipSyncQueue = false): Promise<Account> {
    return this.addAccountInternal(accountData, skipSyncQueue);
  }

  /**
   * Interne Methode zum Hinzufügen eines Kontos.
   * @param accountData Die Daten des Kontos.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async addAccountInternal(accountData: Omit<Account, 'created_at' | 'updated_at'> | Account, skipSyncQueue = false): Promise<Account> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccountInternal: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    const now = new Date().toISOString();
    const accountToSave: Account = {
      created_at: now, // Standardwert, falls nicht in accountData vorhanden (z.B. bei Sync vom Server)
      updated_at: now, // Standardwert
      ...accountData, // Überschreibt created_at/updated_at, falls in accountData vorhanden (z.B. bei Sync vom Server)
    };
     // Sicherstellen, dass ID vorhanden ist, falls nicht in Omit enthalten
    if (!accountToSave.id) {
        errorLog('TenantDbService', 'addAccountInternal: Account ID fehlt.', { accountData });
        throw new Error('Account ID ist erforderlich.');
    }


    try {
      await this.db.accounts.put(accountToSave); // put statt add für Upsert-Verhalten bei Sync
      debugLog('TenantDbService', `Konto "${accountToSave.name}" (ID: ${accountToSave.id}) hinzugefügt/aktualisiert.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('Account', accountToSave.id, 'CREATE', accountToSave);
      }
      return accountToSave;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen/Aktualisieren des Kontos "${accountToSave.name}"`, { account: accountToSave, error: err });
      throw err;
    }
  }


  /**
   * Aktualisiert ein bestehendes Konto in der IndexedDB.
   * @param account Das zu aktualisierende Konto.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async updateAccount(accountData: Partial<Omit<Account, 'id' | 'created_at'>> & { id: string }, skipSyncQueue = false): Promise<Account> {
    return this.updateAccountInternal(accountData, skipSyncQueue);
  }

  /**
   * Interne Methode zum Aktualisieren eines Kontos.
   * @param accountData Die Daten des Kontos.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async updateAccountInternal(accountData: Partial<Omit<Account, 'id' | 'created_at'>> & { id: string } | Account, skipSyncQueue = false): Promise<Account> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccountInternal: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }

    const existingAccount = await this.db.accounts.get(accountData.id);
    if (!existingAccount) {
      // Wenn das Konto nicht existiert und wir von einem Sync-Downstream kommen,
      // könnte es ein Create-Szenario sein, das als Update fehlinterpretiert wurde.
      // In diesem Fall wäre ein Add besser. Für den Moment werfen wir einen Fehler.
      // Alternativ: if (skipSyncQueue) return this.addAccountInternal(accountData as Account, true);
      errorLog('TenantDbService', `Konto mit ID "${accountData.id}" nicht gefunden für Update.`);
      throw new Error(`Konto mit ID "${accountData.id}" nicht gefunden.`);
    }

    const now = new Date().toISOString();
    const accountToUpdate: Account = {
      ...existingAccount,
      ...accountData,
      updated_at: accountData.updated_at || now, // Nutze updated_at von accountData (vom Server) oder setze neu
      // created_at bleibt vom existingAccount erhalten und wird nicht überschrieben, es sei denn explizit in accountData
    };

    try {
      await this.db.accounts.put(accountToUpdate);
      debugLog('TenantDbService', `Konto "${accountToUpdate.name}" (ID: ${accountToUpdate.id}) aktualisiert.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('Account', accountToUpdate.id, 'UPDATE', accountToUpdate);
      }
      return accountToUpdate;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Kontos "${accountToUpdate.name}"`, { account: accountToUpdate, error: err });
      throw err;
    }
  }

  /**
   * Löscht ein Konto aus der IndexedDB anhand seiner ID.
   * @param accountId Die ID des zu löschenden Kontos.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async deleteAccount(accountId: string, skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accounts.delete(accountId);
      debugLog('TenantDbService', `Konto mit ID "${accountId}" gelöscht.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('Account', accountId, 'DELETE', { id: accountId });
      }
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
  async addAccountGroup(accountGroupData: Omit<AccountGroup, 'created_at' | 'updated_at'>, skipSyncQueue = false): Promise<AccountGroup> {
    return this.addAccountGroupInternal(accountGroupData, skipSyncQueue);
  }

  /**
   * Interne Methode zum Hinzufügen einer Kontogruppe.
   * @param accountGroupData Die Daten der Kontogruppe.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async addAccountGroupInternal(accountGroupData: Omit<AccountGroup, 'created_at' | 'updated_at'> | AccountGroup, skipSyncQueue = false): Promise<AccountGroup> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccountGroupInternal: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    const now = new Date().toISOString();
    const accountGroupToSave: AccountGroup = {
      created_at: now,
      updated_at: now,
      ...accountGroupData,
    };
    if (!accountGroupToSave.id) {
        errorLog('TenantDbService', 'addAccountGroupInternal: AccountGroup ID fehlt.', { accountGroupData });
        throw new Error('AccountGroup ID ist erforderlich.');
    }

    try {
      await this.db.accountGroups.put(accountGroupToSave); // put für Upsert
      debugLog('TenantDbService', `Kontogruppe "${accountGroupToSave.name}" (ID: ${accountGroupToSave.id}) hinzugefügt/aktualisiert.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('AccountGroup', accountGroupToSave.id, 'CREATE', accountGroupToSave);
      }
      return accountGroupToSave;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen/Aktualisieren der Kontogruppe "${accountGroupToSave.name}"`, { accountGroup: accountGroupToSave, error: err });
      throw err;
    }
  }

  /**
   * Aktualisiert eine bestehende Kontogruppe in der IndexedDB.
   * @param accountGroup Die zu aktualisierende Kontogruppe.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async updateAccountGroup(accountGroupData: Partial<Omit<AccountGroup, 'id' | 'created_at'>> & { id: string }, skipSyncQueue = false): Promise<AccountGroup> {
    return this.updateAccountGroupInternal(accountGroupData, skipSyncQueue);
  }

  /**
   * Interne Methode zum Aktualisieren einer Kontogruppe.
   * @param accountGroupData Die Daten der Kontogruppe.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async updateAccountGroupInternal(accountGroupData: Partial<Omit<AccountGroup, 'id' | 'created_at'>> & { id: string } | AccountGroup, skipSyncQueue = false): Promise<AccountGroup> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccountGroupInternal: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }

    const existingAccountGroup = await this.db.accountGroups.get(accountGroupData.id);
    if (!existingAccountGroup) {
      errorLog('TenantDbService', `Kontogruppe mit ID "${accountGroupData.id}" nicht gefunden für Update.`);
      throw new Error(`Kontogruppe mit ID "${accountGroupData.id}" nicht gefunden.`);
    }

    const now = new Date().toISOString();
    const accountGroupToUpdate: AccountGroup = {
      ...existingAccountGroup,
      ...accountGroupData,
      updated_at: accountGroupData.updated_at || now,
    };

    try {
      await this.db.accountGroups.put(accountGroupToUpdate);
      debugLog('TenantDbService', `Kontogruppe "${accountGroupToUpdate.name}" (ID: ${accountGroupToUpdate.id}) aktualisiert.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('AccountGroup', accountGroupToUpdate.id, 'UPDATE', accountGroupToUpdate);
      }
      return accountGroupToUpdate;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Kontogruppe "${accountGroupToUpdate.name}"`, { accountGroup: accountGroupToUpdate, error: err });
      throw err;
    }
  }

  /**
   * Löscht eine Kontogruppe aus der IndexedDB anhand ihrer ID.
   * @param accountGroupId Die ID der zu löschenden Kontogruppe.
   * @param skipSyncQueue Ob der Eintrag zur Sync-Queue übersprungen werden soll.
   */
  async deleteAccountGroup(accountGroupId: string, skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'deleteAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    try {
      await this.db.accountGroups.delete(accountGroupId);
      debugLog('TenantDbService', `Kontogruppe mit ID "${accountGroupId}" gelöscht.`);
      if (!skipSyncQueue) {
        await this._addChangeToSyncQueue('AccountGroup', accountGroupId, 'DELETE', { id: accountGroupId });
      }
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
   * Fügt mehrere Konten auf einmal hinzu (Bulk-Operation).
   * @param accounts Array von Konten, die hinzugefügt werden sollen.
   * @param skipSyncQueue Ob Einträge zur Sync-Queue übersprungen werden sollen.
   */
  async bulkAddAccounts(accounts: Account[], skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'bulkAddAccounts: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    if (accounts.length === 0) {
      debugLog('TenantDbService', 'bulkAddAccounts: Keine Konten zum Hinzufügen.');
      return;
    }
    try {
      // Sicherstellen, dass alle Accounts Zeitstempel haben, falls sie vom Server kommen
      const now = new Date().toISOString();
      const accountsToSave = accounts.map(acc => ({
        ...acc,
        created_at: acc.created_at || now,
        updated_at: acc.updated_at || now,
      }));

      await this.db.accounts.bulkPut(accountsToSave); // put für Upsert-Verhalten
      debugLog('TenantDbService', `${accountsToSave.length} Konten im Bulk hinzugefügt/aktualisiert.`);
      if (!skipSyncQueue) {
        const syncItems: SyncQueueItem[] = accountsToSave.map(acc => ({
          entity_type: 'Account',
          entity_id: acc.id,
          operation: 'CREATE', // Annahme: bulkAdd wird für neue oder zu überschreibende Daten genutzt
          payload: { ...acc },
          timestamp: new Date().toISOString(), // frischer Zeitstempel für den Queue-Eintrag
          attempts: 0,
        }));
        await this.db.syncQueue.bulkAdd(syncItems);
        debugLog('TenantDbService', `${syncItems.length} Account-Änderungen zur Sync-Queue im Bulk hinzugefügt.`);
      }
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Bulk-Hinzufügen von Konten', { count: accounts.length, error: err });
      throw err;
    }
  }

  /**
   * Fügt mehrere Kontogruppen auf einmal hinzu (Bulk-Operation).
   * @param accountGroups Array von Kontogruppen, die hinzugefügt werden sollen.
   * @param skipSyncQueue Ob Einträge zur Sync-Queue übersprungen werden sollen.
   */
  async bulkAddAccountGroups(accountGroups: AccountGroup[], skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'bulkAddAccountGroups: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    if (accountGroups.length === 0) {
      debugLog('TenantDbService', 'bulkAddAccountGroups: Keine Kontogruppen zum Hinzufügen.');
      return;
    }
    try {
      const now = new Date().toISOString();
      const groupsToSave = accountGroups.map(ag => ({
        ...ag,
        created_at: ag.created_at || now,
        updated_at: ag.updated_at || now,
      }));

      await this.db.accountGroups.bulkPut(groupsToSave); // put für Upsert
      debugLog('TenantDbService', `${groupsToSave.length} Kontogruppen im Bulk hinzugefügt/aktualisiert.`);
      if (!skipSyncQueue) {
        const syncItems: SyncQueueItem[] = groupsToSave.map(ag => ({
          entity_type: 'AccountGroup',
          entity_id: ag.id,
          operation: 'CREATE',
          payload: { ...ag },
          timestamp: new Date().toISOString(),
          attempts: 0,
        }));
        await this.db.syncQueue.bulkAdd(syncItems);
        debugLog('TenantDbService', `${syncItems.length} AccountGroup-Änderungen zur Sync-Queue im Bulk hinzugefügt.`);
      }
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Bulk-Hinzufügen von Kontogruppen', { count: accountGroups.length, error: err });
      throw err;
    }
  }

  /**
   * Löscht mehrere Konten auf einmal (Bulk-Operation).
   * @param accountIds Array von Konto-IDs, die gelöscht werden sollen.
   * @param skipSyncQueue Ob Einträge zur Sync-Queue übersprungen werden sollen.
   */
  async bulkDeleteAccounts(accountIds: string[], skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'bulkDeleteAccounts: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    if (accountIds.length === 0) {
      debugLog('TenantDbService', 'bulkDeleteAccounts: Keine Konto-IDs zum Löschen.');
      return;
    }
    try {
      await this.db.accounts.bulkDelete(accountIds);
      debugLog('TenantDbService', `${accountIds.length} Konten im Bulk gelöscht.`);
      if (!skipSyncQueue) {
        const syncItems: SyncQueueItem[] = accountIds.map(id => ({
          entity_type: 'Account',
          entity_id: id,
          operation: 'DELETE',
          payload: { id }, // Nur ID für Delete-Payload
          timestamp: new Date().toISOString(),
          attempts: 0,
        }));
        await this.db.syncQueue.bulkAdd(syncItems);
        debugLog('TenantDbService', `${syncItems.length} Account-Löschanforderungen zur Sync-Queue im Bulk hinzugefügt.`);
      }
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Bulk-Löschen von Konten', { count: accountIds.length, error: err });
      throw err;
    }
  }

  /**
   * Löscht mehrere Kontogruppen auf einmal (Bulk-Operation).
   * @param accountGroupIds Array von Kontogruppen-IDs, die gelöscht werden sollen.
   * @param skipSyncQueue Ob Einträge zur Sync-Queue übersprungen werden sollen.
   */
  async bulkDeleteAccountGroups(accountGroupIds: string[], skipSyncQueue = false): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', 'bulkDeleteAccountGroups: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    if (accountGroupIds.length === 0) {
      debugLog('TenantDbService', 'bulkDeleteAccountGroups: Keine Kontogruppen-IDs zum Löschen.');
      return;
    }
    try {
      await this.db.accountGroups.bulkDelete(accountGroupIds);
      debugLog('TenantDbService', `${accountGroupIds.length} Kontogruppen im Bulk gelöscht.`);
      if (!skipSyncQueue) {
        const syncItems: SyncQueueItem[] = accountGroupIds.map(id => ({
          entity_type: 'AccountGroup',
          entity_id: id,
          operation: 'DELETE',
          payload: { id },
          timestamp: new Date().toISOString(),
          attempts: 0,
        }));
        await this.db.syncQueue.bulkAdd(syncItems);
        debugLog('TenantDbService', `${syncItems.length} AccountGroup-Löschvorgänge zur Sync-Queue im Bulk hinzugefügt.`);
      }
    } catch (err) {
      errorLog('TenantDbService', 'Fehler beim Bulk-Löschen von Kontogruppen', { count: accountGroupIds.length, error: err });
      throw err;
    }
  }

  // Private helper to add changes to the sync queue
  private async _addChangeToSyncQueue(
    entity_type: string,
    entity_id: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload?: Partial<SyncableEntity>,
  ): Promise<void> {
    if (!this.db) {
      warnLog('TenantDbService', '_addChangeToSyncQueue: Keine aktive Mandanten-DB verfügbar.');
      // Entscheiden, ob hier ein Fehler geworfen oder die Operation leise fehlschlagen soll.
      // Für den Moment loggen wir und kehren zurück.
      return;
    }
    const now = new Date().toISOString();
    const syncItem: SyncQueueItem = {
      entity_type,
      entity_id,
      operation,
      payload: payload ? { ...payload } : undefined, // payload kopieren
      timestamp: now,
      attempts: 0,
      last_attempt_at: undefined,
    };
    try {
      await this.db.syncQueue.add(syncItem);
      debugLog('TenantDbService', `Änderung für ${entity_type} ID ${entity_id} zur Sync-Queue hinzugefügt.`, { operation });
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen zur Sync-Queue für ${entity_type} ID ${entity_id}`, { error: err, item: syncItem });
      // Hier könnte man überlegen, ob der Fehler weitergereicht werden soll.
    }
  }
}
