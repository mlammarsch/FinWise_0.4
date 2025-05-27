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
  async addAccount(accountData: Omit<Account, 'created_at' | 'updated_at'>): Promise<Account> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    const now = new Date().toISOString();
    const accountToSave: Account = {
      ...accountData,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.db.accounts.add(accountToSave);
      debugLog('TenantDbService', `Konto "${accountToSave.name}" (ID: ${accountToSave.id}) hinzugefügt.`);
      await this._addChangeToSyncQueue('Account', accountToSave.id, 'CREATE', accountToSave);
      return accountToSave;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen des Kontos "${accountToSave.name}"`, { account: accountToSave, error: err });
      throw err;
    }
  }

  /**
   * Aktualisiert ein bestehendes Konto in der IndexedDB.
   * @param account Das zu aktualisierende Konto.
   */
  async updateAccount(accountData: Partial<Omit<Account, 'id' | 'created_at'>> & { id: string }): Promise<Account> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccount: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }

    const existingAccount = await this.db.accounts.get(accountData.id);
    if (!existingAccount) {
      errorLog('TenantDbService', `Konto mit ID "${accountData.id}" nicht gefunden für Update.`);
      throw new Error(`Konto mit ID "${accountData.id}" nicht gefunden.`);
    }

    const now = new Date().toISOString();
    const accountToUpdate: Account = {
      ...existingAccount,
      ...accountData,
      updated_at: now,
      // created_at bleibt vom existingAccount erhalten und wird nicht überschrieben
    };

    try {
      await this.db.accounts.put(accountToUpdate);
      debugLog('TenantDbService', `Konto "${accountToUpdate.name}" (ID: ${accountToUpdate.id}) aktualisiert.`);
      await this._addChangeToSyncQueue('Account', accountToUpdate.id, 'UPDATE', accountToUpdate);
      return accountToUpdate;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren des Kontos "${accountToUpdate.name}"`, { account: accountToUpdate, error: err });
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
      // Optional: Vor dem Löschen das Objekt abrufen, falls Teile davon im Payload benötigt werden.
      // Für einen reinen DELETE-Vorgang ist oft nur die ID nötig.
      // const accountToDelete = await this.db.accounts.get(accountId);
      // if (!accountToDelete) {
      //   warnLog('TenantDbService', `Konto mit ID "${accountId}" nicht gefunden zum Löschen.`);
      //   // Ggf. Fehler werfen oder einfach nichts tun
      //   return;
      // }

      await this.db.accounts.delete(accountId);
      debugLog('TenantDbService', `Konto mit ID "${accountId}" gelöscht.`);
      // Für DELETE Operationen ist der Payload in der SyncQueue optional oder enthält nur die ID.
      await this._addChangeToSyncQueue('Account', accountId, 'DELETE', { id: accountId });
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
  async addAccountGroup(accountGroupData: Omit<AccountGroup, 'created_at' | 'updated_at'>): Promise<AccountGroup> {
    if (!this.db) {
      warnLog('TenantDbService', 'addAccountGroup: Keine aktive Mandanten-DB verfügbar.');
      throw new Error('Keine aktive Mandanten-DB verfügbar.');
    }
    const now = new Date().toISOString();
    const accountGroupToSave: AccountGroup = {
      ...accountGroupData,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.db.accountGroups.add(accountGroupToSave);
      debugLog('TenantDbService', `Kontogruppe "${accountGroupToSave.name}" (ID: ${accountGroupToSave.id}) hinzugefügt.`);
      await this._addChangeToSyncQueue('AccountGroup', accountGroupToSave.id, 'CREATE', accountGroupToSave);
      return accountGroupToSave;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Hinzufügen der Kontogruppe "${accountGroupToSave.name}"`, { accountGroup: accountGroupToSave, error: err });
      throw err;
    }
  }

  /**
   * Aktualisiert eine bestehende Kontogruppe in der IndexedDB.
   * @param accountGroup Die zu aktualisierende Kontogruppe.
   */
  async updateAccountGroup(accountGroupData: Partial<Omit<AccountGroup, 'id' | 'created_at'>> & { id: string }): Promise<AccountGroup> {
    if (!this.db) {
      warnLog('TenantDbService', 'updateAccountGroup: Keine aktive Mandanten-DB verfügbar.');
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
      updated_at: now,
      // created_at bleibt vom existingAccountGroup erhalten
    };

    try {
      await this.db.accountGroups.put(accountGroupToUpdate);
      debugLog('TenantDbService', `Kontogruppe "${accountGroupToUpdate.name}" (ID: ${accountGroupToUpdate.id}) aktualisiert.`);
      await this._addChangeToSyncQueue('AccountGroup', accountGroupToUpdate.id, 'UPDATE', accountGroupToUpdate);
      return accountGroupToUpdate;
    } catch (err) {
      errorLog('TenantDbService', `Fehler beim Aktualisieren der Kontogruppe "${accountGroupToUpdate.name}"`, { accountGroup: accountGroupToUpdate, error: err });
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
      await this._addChangeToSyncQueue('AccountGroup', accountGroupId, 'DELETE', { id: accountGroupId });
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
