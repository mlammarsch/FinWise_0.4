/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Account, AccountGroup, SyncQueueEntry } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types'; // EntityTypeEnum importiert
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger'; // warnLog importiert
import { TenantDbService } from '@/services/TenantDbService';

export const useAccountStore = defineStore('account', () => {
  const tenantDbService = new TenantDbService();

  const accounts = ref<Account[]>([]);
  const accountGroups = ref<AccountGroup[]>([]);

  // Loading Guards
  const isLoading = ref<boolean>(false);
  const isLoaded = ref<boolean>(false);

  const activeAccounts = computed(() =>
    accounts.value.filter(a => a.isActive)
  );

  function getAccountById(id: string) {
    return accounts.value.find(a => a.id === id);
  }

  const getAccountGroupById = computed(() => (id: string) =>
    accountGroups.value.find(g => g.id === id),
  );

  async function addAccount(accountData: Omit<Account, 'updated_at'> | Account, fromSync = false): Promise<Account> {

    // Bestimme sortOrder falls nicht gesetzt (Fallback-Mechanismus)
    let sortOrder = (accountData as Account).sortOrder;
    if (sortOrder === undefined && accountData.accountGroupId) {
      const accountsInGroup = accounts.value.filter(
        acc => acc.accountGroupId === accountData.accountGroupId
      );
      const maxSortOrder = accountsInGroup.reduce((max, acc) =>
        Math.max(max, acc.sortOrder || 0), -1
      );
      sortOrder = maxSortOrder + 1;
      debugLog('accountStore', `addAccount: Automatische sortOrder ${sortOrder} für Konto "${accountData.name}" in Gruppe ${accountData.accountGroupId}`);
    }

    const accountWithTimestamp: Account = {
      ...accountData,
      sortOrder: sortOrder || 0,
      // FE-Timestamp in camelCase setzen (Backend-Mapping erfolgt später)
      updatedAt: (accountData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localAccount = await tenantDbService.getAccountById(accountWithTimestamp.id);
      if (localAccount && localAccount.updatedAt && accountWithTimestamp.updatedAt &&
        new Date(localAccount.updatedAt) >= new Date(accountWithTimestamp.updatedAt)) {
        infoLog('accountStore', `addAccount (fromSync): Lokales Konto ${localAccount.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localAccount; // Gib das lokale, "gewinnende" Konto zurück
      }
      // Wenn eingehend neuer ist oder lokal nicht existiert, fahre fort mit DB-Update und Store-Update
      await tenantDbService.addAccount(accountWithTimestamp); // addAccount ist wie put, überschreibt wenn ID existiert
      infoLog('accountStore', `addAccount (fromSync): Eingehendes Konto ${accountWithTimestamp.id} angewendet (neuer oder lokal nicht vorhanden).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.addAccount(accountWithTimestamp);
    }

    const existingAccountIndex = accounts.value.findIndex(a => a.id === accountWithTimestamp.id);
    if (existingAccountIndex === -1) {
      accounts.value.push(accountWithTimestamp);
    } else {
      if (!fromSync || (accountWithTimestamp.updatedAt && (!accounts.value[existingAccountIndex].updatedAt || new Date(accountWithTimestamp.updatedAt) > new Date(accounts.value[existingAccountIndex].updatedAt!)))) {
        accounts.value[existingAccountIndex] = accountWithTimestamp;
      } else if (fromSync) {
        warnLog('accountStore', `addAccount (fromSync): Store-Konto ${accounts.value[existingAccountIndex].id} war neuer als eingehendes ${accountWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('accountStore', `Account "${accountWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${accountWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        // Entferne veraltete Felder wie 'image' vor der Synchronisation
        const cleanAccountForSync = {
          ...accountWithTimestamp,
        };

        // LWW: FE führt updatedAt (camelCase); Backend-Mapping setzt updated_at automatisch
        if (!cleanAccountForSync.updatedAt) {
          cleanAccountForSync.updatedAt = new Date().toISOString();
        }

        // Entferne undefined-Werte
        Object.keys(cleanAccountForSync).forEach(key => {
          if ((cleanAccountForSync as any)[key] === undefined) {
            delete (cleanAccountForSync as any)[key];
          }
        });

        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT,
          entityId: accountWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(cleanAccountForSync),
        });
        infoLog('accountStore', `Account "${accountWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account "${accountWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return accountWithTimestamp;
  }

  async function updateAccount(accountUpdatesData: Account, fromSync = false): Promise<boolean> {

    const accountUpdatesWithTimestamp: Account = {
      ...accountUpdatesData,
      // FE verwendet updatedAt; Mapping zu updated_at erfolgt bei SyncQueue
      updatedAt: (accountUpdatesData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localAccount = await tenantDbService.getAccountById(accountUpdatesWithTimestamp.id);
      if (!localAccount) {
        infoLog('accountStore', `updateAccount (fromSync): Lokales Konto ${accountUpdatesWithTimestamp.id} nicht gefunden. Behandle als addAccount.`);
        await addAccount(accountUpdatesWithTimestamp, true);
        return true;
      }

      if (localAccount.updatedAt && accountUpdatesWithTimestamp.updatedAt &&
        new Date(localAccount.updatedAt) >= new Date(accountUpdatesWithTimestamp.updatedAt)) {
        infoLog('accountStore', `updateAccount (fromSync): Lokales Konto ${localAccount.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true;
      }
      await tenantDbService.updateAccount(accountUpdatesWithTimestamp);
      infoLog('accountStore', `updateAccount (fromSync): Eingehendes Update für Konto ${accountUpdatesWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateAccount(accountUpdatesWithTimestamp);
    }

    const idx = accounts.value.findIndex(a => a.id === accountUpdatesWithTimestamp.id);
    if (idx !== -1) {
      if (!fromSync || (accountUpdatesWithTimestamp.updatedAt && (!accounts.value[idx].updatedAt || new Date(accountUpdatesWithTimestamp.updatedAt) > new Date(accounts.value[idx].updatedAt!)))) {
        accounts.value[idx] = { ...accounts.value[idx], ...accountUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('accountStore', `updateAccount (fromSync): Store-Konto ${accounts.value[idx].id} war neuer als eingehendes ${accountUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('accountStore', `Account "${accountUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${accountUpdatesWithTimestamp.id}).`);

      if (!fromSync) {
        try {
          const fullAccountForSync = accounts.value[idx];

          // Entferne veraltete Felder wie 'image' vor der Synchronisation
          const cleanAccountForSync = {
            ...fullAccountForSync,
          };

          // LWW: FE-feld updatedAt setzen; Backend-Mapping kümmert sich um updated_at
          if (!cleanAccountForSync.updatedAt) {
            cleanAccountForSync.updatedAt = accountUpdatesWithTimestamp.updatedAt || new Date().toISOString();
          }

          // Entferne undefined-Werte
          Object.keys(cleanAccountForSync).forEach(key => {
            if ((cleanAccountForSync as any)[key] === undefined) {
              delete (cleanAccountForSync as any)[key];
            }
          });

          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT,
            entityId: accountUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(cleanAccountForSync),
          });
          infoLog('accountStore', `Account "${accountUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von Account Update "${accountUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('accountStore', `updateAccount: Account ${accountUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addAccount(accountUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteAccount(accountId: string, fromSync = false): Promise<void> {
    const accountToDelete = accounts.value.find(a => a.id === accountId);

    await tenantDbService.deleteAccount(accountId);
    accounts.value = accounts.value.filter(a => a.id !== accountId);
    infoLog('accountStore', `Account mit ID "${accountId}" aus Store und lokaler DB entfernt.`);

    if (!fromSync && accountToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT,
          entityId: accountId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountId },
        });
        infoLog('accountStore', `Account mit ID "${accountId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account Delete (ID: "${accountId}") zur Sync Queue.`, e);
      }
    }
  }

  async function addAccountGroup(accountGroupData: Omit<AccountGroup, 'updated_at' | 'sortOrder'> | AccountGroup, fromSync = false): Promise<AccountGroup> {

    let sortOrder = (accountGroupData as AccountGroup).sortOrder;
    if (sortOrder === undefined) {
      const maxSortOrder = accountGroups.value.reduce((max, g) => Math.max(max, g.sortOrder), -1);
      sortOrder = maxSortOrder + 1;
    }

    const accountGroupWithTimestamp: AccountGroup = {
      ...accountGroupData,
      sortOrder,
      updatedAt: (accountGroupData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      const localGroup = await tenantDbService.getAccountGroupById(accountGroupWithTimestamp.id);
      if (localGroup && localGroup.updatedAt && accountGroupWithTimestamp.updatedAt &&
        new Date(localGroup.updatedAt) >= new Date(accountGroupWithTimestamp.updatedAt)) {
        infoLog('accountStore', `addAccountGroup (fromSync): Lokale Gruppe ${localGroup.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localGroup;
      }
      await tenantDbService.addAccountGroup(accountGroupWithTimestamp);
      infoLog('accountStore', `addAccountGroup (fromSync): Eingehende Gruppe ${accountGroupWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.addAccountGroup(accountGroupWithTimestamp);
    }

    const existingGroupIndex = accountGroups.value.findIndex(g => g.id === accountGroupWithTimestamp.id);
    if (existingGroupIndex === -1) {
      accountGroups.value.push(accountGroupWithTimestamp);
    } else {
      if (!fromSync || (accountGroupWithTimestamp.updatedAt && (!accountGroups.value[existingGroupIndex].updatedAt || new Date(accountGroupWithTimestamp.updatedAt) > new Date(accountGroups.value[existingGroupIndex].updatedAt!)))) {
        accountGroups.value[existingGroupIndex] = accountGroupWithTimestamp;
      } else if (fromSync) {
        warnLog('accountStore', `addAccountGroup (fromSync): Store-Gruppe ${accountGroups.value[existingGroupIndex].id} war neuer als eingehende ${accountGroupWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('accountStore', `AccountGroup "${accountGroupWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${accountGroupWithTimestamp.id}).`);

    if (!fromSync) {
      try {
        // Entferne veraltete Felder wie 'image' vor der Synchronisation
        const cleanGroupForSync = {
          ...accountGroupWithTimestamp,
        };

        // LWW: updatedAt sicherstellen (Mapping zu updated_at erfolgt später)
        if (!(cleanGroupForSync as any).updatedAt) {
          (cleanGroupForSync as any).updatedAt = accountGroupWithTimestamp.updatedAt || new Date().toISOString();
        }

        // Entferne undefined-Werte
        Object.keys(cleanGroupForSync).forEach(key => {
          if ((cleanGroupForSync as any)[key] === undefined) {
            delete (cleanGroupForSync as any)[key];
          }
        });

        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          entityId: accountGroupWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(cleanGroupForSync),
        });
        infoLog('accountStore', `AccountGroup "${accountGroupWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup "${accountGroupWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return accountGroupWithTimestamp;
  }

  async function updateAccountGroup(accountGroupUpdatesData: AccountGroup, fromSync = false): Promise<boolean> {

    const accountGroupUpdatesWithTimestamp: AccountGroup = {
      ...accountGroupUpdatesData,
      updatedAt: (accountGroupUpdatesData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      const localGroup = await tenantDbService.getAccountGroupById(accountGroupUpdatesWithTimestamp.id);
      if (!localGroup) {
        infoLog('accountStore', `updateAccountGroup (fromSync): Lokale Gruppe ${accountGroupUpdatesWithTimestamp.id} nicht gefunden. Behandle als addAccountGroup.`);
        await addAccountGroup(accountGroupUpdatesWithTimestamp, true);
        return true;
      }

      if (localGroup.updatedAt && accountGroupUpdatesWithTimestamp.updatedAt &&
        new Date(localGroup.updatedAt) >= new Date(accountGroupUpdatesWithTimestamp.updatedAt)) {
        infoLog('accountStore', `updateAccountGroup (fromSync): Lokale Gruppe ${localGroup.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true;
      }
      await tenantDbService.updateAccountGroup(accountGroupUpdatesWithTimestamp);
      infoLog('accountStore', `updateAccountGroup (fromSync): Eingehendes Update für Gruppe ${accountGroupUpdatesWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateAccountGroup(accountGroupUpdatesWithTimestamp);
    }

    const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdatesWithTimestamp.id);
    if (idx !== -1) {
      if (!fromSync || (accountGroupUpdatesWithTimestamp.updatedAt && (!accountGroups.value[idx].updatedAt || new Date(accountGroupUpdatesWithTimestamp.updatedAt) > new Date(accountGroups.value[idx].updatedAt!)))) {
        accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('accountStore', `updateAccountGroup (fromSync): Store-Gruppe ${accountGroups.value[idx].id} war neuer als eingehende ${accountGroupUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('accountStore', `AccountGroup "${accountGroupUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${accountGroupUpdatesWithTimestamp.id}).`);

      if (!fromSync) {
        try {
          // Entferne veraltete Felder wie 'image' vor der Synchronisation
          const cleanGroupForSync = {
            ...accountGroupUpdatesWithTimestamp,
          };

          // LWW: updatedAt sicherstellen (Mapping zu updated_at erfolgt später)
          if (!(cleanGroupForSync as any).updatedAt) {
            (cleanGroupForSync as any).updatedAt = accountGroupUpdatesWithTimestamp.updatedAt || new Date().toISOString();
          }

          // Entferne undefined-Werte
          Object.keys(cleanGroupForSync).forEach(key => {
            if ((cleanGroupForSync as any)[key] === undefined) {
              delete (cleanGroupForSync as any)[key];
            }
          });

          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT_GROUP,
            entityId: accountGroupUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(cleanGroupForSync),
          });
          infoLog('accountStore', `AccountGroup "${accountGroupUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup Update "${accountGroupUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('accountStore', `updateAccountGroup: AccountGroup ${accountGroupUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addAccountGroup(accountGroupUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteAccountGroup(accountGroupId: string, fromSync = false): Promise<boolean> {
    const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);
    if (!groupToDelete) {
      warnLog('accountStore', `deleteAccountGroup: Gruppe mit ID ${accountGroupId} nicht gefunden.`);
      return false;
    }

    // Prüfen, ob noch Konten dieser Gruppe zugeordnet sind
    const accountsInGroup = accounts.value.filter(a => a.accountGroupId === accountGroupId);
    if (accountsInGroup.length > 0) {
      errorLog('accountStore', `Kann AccountGroup ${accountGroupId} nicht löschen, da noch ${accountsInGroup.length} Konten zugeordnet sind.`);
      return false;
    }

    await tenantDbService.deleteAccountGroup(accountGroupId);
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
    infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" aus Store und lokaler DB entfernt.`);

    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          entityId: accountGroupId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountGroupId },
        });
        infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup Delete (ID: "${accountGroupId}") zur Sync Queue.`, e);
      }
    }
    return true;
  }

  async function updateAccountLogo(accountId: string, newLogoPath: string | null): Promise<void> {
    const account = getAccountById(accountId);
    if (account) {
      const updatedAccount: Account = {
        ...account,
        logo_path: newLogoPath,
        updatedAt: new Date().toISOString(),
      };
      await updateAccount(updatedAccount);
      infoLog('accountStore', `Logo für Account ${accountId} aktualisiert.`);
    } else {
      errorLog('accountStore', `updateAccountLogo: Account mit ID ${accountId} nicht gefunden.`);
    }
  }

  async function updateAccountGroupLogo(accountGroupId: string, newLogoPath: string | null): Promise<void> {
    const group = getAccountGroupById.value(accountGroupId);
    if (group) {
      const updatedGroup: AccountGroup = {
        ...group,
        logo_path: newLogoPath,
        updatedAt: new Date().toISOString(),
      };
      await updateAccountGroup(updatedGroup);
      infoLog('accountStore', `Logo für AccountGroup ${accountGroupId} aktualisiert.`);
    } else {
      errorLog('accountStore', `updateAccountGroupLogo: AccountGroup mit ID ${accountGroupId} nicht gefunden.`);
    }
  }


  async function loadAccounts(): Promise<void> {
    // Loading Guard: Verhindere mehrfaches gleichzeitiges Laden
    if (isLoading.value) {
      debugLog('accountStore', 'loadAccounts: Bereits am Laden, überspringe redundanten Aufruf');
      return;
    }

    // Wenn bereits geladen und Daten vorhanden, überspringe
    if (isLoaded.value && accounts.value.length > 0 && accountGroups.value.length > 0) {
      debugLog('accountStore', 'loadAccounts: Bereits geladen, überspringe redundanten Aufruf');
      return;
    }

    isLoading.value = true;

    try {
      debugLog('accountStore', 'loadAccounts: Starte Laden der Konten und Gruppen');

      const dbAccounts = await tenantDbService.getAllAccounts();
      const dbAccountGroups = await tenantDbService.getAllAccountGroups();
      accounts.value = dbAccounts;
      accountGroups.value = dbAccountGroups;

      isLoaded.value = true;
      infoLog('accountStore', `Konten (${dbAccounts.length}) und Gruppen (${dbAccountGroups.length}) aus der Mandanten-DB geladen.`);
    } catch (e) {
      errorLog('accountStore', 'Fehler beim Laden der Konten aus der Mandanten-DB.', e);
      accounts.value = [];
      accountGroups.value = [];
      isLoaded.value = false;
    } finally {
      isLoading.value = false;
    }
  }

  async function reset(): Promise<void> {
    accounts.value = [];
    accountGroups.value = [];

    // Loading-Status zurücksetzen für neuen Tenant
    isLoading.value = false;
    isLoaded.value = false;

    await loadAccounts(); // Daten nach dem Zurücksetzen neu laden
    infoLog('accountStore', 'Account-Store zurückgesetzt und neu geladen.');
  }


  // Initialisierung
  async function initializeStore(): Promise<void> {
    // await tenantDbService.init(); // Entfernt, da die Initialisierung über den tenantStore läuft
    await loadAccounts();
  }

  return {
    accounts,
    accountGroups,
    activeAccounts,
    isLoading,
    isLoaded,
    getAccountById,
    getAccountGroupById,
    addAccount,
    updateAccount,
    deleteAccount,
    addAccountGroup,
    updateAccountGroup,
    deleteAccountGroup,
    updateAccountLogo,
    updateAccountGroupLogo,
    loadAccounts,
    reset,
    initializeStore,
  };
});
