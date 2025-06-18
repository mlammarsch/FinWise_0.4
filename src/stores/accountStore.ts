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

  const accounts      = ref<Account[]>([]);
  const accountGroups = ref<AccountGroup[]>([]);

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

    const accountWithTimestamp: Account = {
      ...accountData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updated_at: (accountData as any).updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localAccount = await tenantDbService.getAccountById(accountWithTimestamp.id);
      if (localAccount && localAccount.updated_at && accountWithTimestamp.updated_at &&
          new Date(localAccount.updated_at) >= new Date(accountWithTimestamp.updated_at)) {
        infoLog('accountStore', `addAccount (fromSync): Lokales Konto ${localAccount.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        // Optional: Store mit lokalen Daten "auffrischen", falls er abweicht (sollte nicht passieren, wenn Logik korrekt ist)
        // const storeIdx = accounts.value.findIndex(a => a.id === localAccount.id);
        // if (storeIdx !== -1 && JSON.stringify(accounts.value[storeIdx]) !== JSON.stringify(localAccount)) {
        //   accounts.value[storeIdx] = localAccount;
        // }
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
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt, falls die DB-Operation nicht sofort reflektiert wird
      // oder falls es eine Race Condition gab. Im `fromSync`-Fall sollte die DB bereits den "Gewinner" haben.
      if (!fromSync || (accountWithTimestamp.updated_at && (!accounts.value[existingAccountIndex].updated_at || new Date(accountWithTimestamp.updated_at) > new Date(accounts.value[existingAccountIndex].updated_at!)))) {
        accounts.value[existingAccountIndex] = accountWithTimestamp;
      } else if (fromSync) {
        // Wenn fromSync und das Store-Konto neuer ist, behalte das Store-Konto (sollte durch obige DB-Prüfung nicht passieren)
         warnLog('accountStore', `addAccount (fromSync): Store-Konto ${accounts.value[existingAccountIndex].id} war neuer als eingehendes ${accountWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('accountStore', `Account "${accountWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${accountWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT,
          entityId: accountWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(accountWithTimestamp),
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
      updated_at: accountUpdatesData.updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localAccount = await tenantDbService.getAccountById(accountUpdatesWithTimestamp.id);
      if (!localAccount) {
        // Konto existiert lokal nicht, also behandle es wie ein "CREATE" vom Sync
        infoLog('accountStore', `updateAccount (fromSync): Lokales Konto ${accountUpdatesWithTimestamp.id} nicht gefunden. Behandle als addAccount.`);
        await addAccount(accountUpdatesWithTimestamp, true); // Rufe addAccount mit fromSync=true auf
        return true; // Frühzeitiger Ausstieg, da addAccount die weitere Logik übernimmt
      }

      if (localAccount.updated_at && accountUpdatesWithTimestamp.updated_at &&
          new Date(localAccount.updated_at) >= new Date(accountUpdatesWithTimestamp.updated_at)) {
        infoLog('accountStore', `updateAccount (fromSync): Lokales Konto ${localAccount.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        // Optional: Store mit lokalen Daten "auffrischen"
        // const storeIdx = accounts.value.findIndex(a => a.id === localAccount.id);
        // if (storeIdx !== -1 && JSON.stringify(accounts.value[storeIdx]) !== JSON.stringify(localAccount)) {
        //   accounts.value[storeIdx] = localAccount;
        // }
        return true; // Änderung verworfen, aber Operation als "erfolgreich" für den Sync-Handler betrachten
      }
      // Eingehend ist neuer, fahre fort mit DB-Update und Store-Update
      await tenantDbService.updateAccount(accountUpdatesWithTimestamp);
      infoLog('accountStore', `updateAccount (fromSync): Eingehendes Update für Konto ${accountUpdatesWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateAccount(accountUpdatesWithTimestamp);
    }

    const idx = accounts.value.findIndex(a => a.id === accountUpdatesWithTimestamp.id);
    if (idx !== -1) {
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt
      if (!fromSync || (accountUpdatesWithTimestamp.updated_at && (!accounts.value[idx].updated_at || new Date(accountUpdatesWithTimestamp.updated_at) > new Date(accounts.value[idx].updated_at!)))) {
        accounts.value[idx] = { ...accounts.value[idx], ...accountUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('accountStore', `updateAccount (fromSync): Store-Konto ${accounts.value[idx].id} war neuer als eingehendes ${accountUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('accountStore', `Account "${accountUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${accountUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT,
            entityId: accountUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(accountUpdatesWithTimestamp),
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

    // Lokale DB immer zuerst (oder zumindest vor dem Hinzufügen zur SyncQueue) aktualisieren,
    // unabhängig davon, ob es vom Sync kommt oder eine lokale Änderung ist,
    // um den lokalen Zustand konsistent zu halten.
    // Die `fromSync`-Logik verhindert dann nur das erneute Senden an den Server.
    await tenantDbService.deleteAccount(accountId);
    accounts.value = accounts.value.filter(a => a.id !== accountId);
    infoLog('accountStore', `Account mit ID "${accountId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync && accountToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT,
          entityId: accountId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountId }, // Nur ID bei Delete
        });
        infoLog('accountStore', `Account mit ID "${accountId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account Delete (ID: "${accountId}") zur Sync Queue.`, e);
      }
    }
  }

  async function addAccountGroup(accountGroupData: Omit<AccountGroup, 'updated_at'> | AccountGroup, fromSync = false): Promise<AccountGroup> {

    const accountGroupWithTimestamp: AccountGroup = {
      ...accountGroupData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updated_at: (accountGroupData as any).updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localGroup = await tenantDbService.getAccountGroupById(accountGroupWithTimestamp.id);
      if (localGroup && localGroup.updated_at && accountGroupWithTimestamp.updated_at &&
          new Date(localGroup.updated_at) >= new Date(accountGroupWithTimestamp.updated_at)) {
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
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt
      if (!fromSync || (accountGroupWithTimestamp.updated_at && (!accountGroups.value[existingGroupIndex].updated_at || new Date(accountGroupWithTimestamp.updated_at) > new Date(accountGroups.value[existingGroupIndex].updated_at!)))) {
        accountGroups.value[existingGroupIndex] = accountGroupWithTimestamp;
      } else if (fromSync) {
         warnLog('accountStore', `addAccountGroup (fromSync): Store-Gruppe ${accountGroups.value[existingGroupIndex].id} war neuer als eingehende ${accountGroupWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('accountStore', `AccountGroup "${accountGroupWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${accountGroupWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          entityId: accountGroupWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(accountGroupWithTimestamp),
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
      updated_at: accountGroupUpdatesData.updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localGroup = await tenantDbService.getAccountGroupById(accountGroupUpdatesWithTimestamp.id);
      if (!localGroup) {
        infoLog('accountStore', `updateAccountGroup (fromSync): Lokale Gruppe ${accountGroupUpdatesWithTimestamp.id} nicht gefunden. Behandle als addAccountGroup.`);
        await addAccountGroup(accountGroupUpdatesWithTimestamp, true);
        return true;
      }

      if (localGroup.updated_at && accountGroupUpdatesWithTimestamp.updated_at &&
          new Date(localGroup.updated_at) >= new Date(accountGroupUpdatesWithTimestamp.updated_at)) {
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
      if (!fromSync || (accountGroupUpdatesWithTimestamp.updated_at && (!accountGroups.value[idx].updated_at || new Date(accountGroupUpdatesWithTimestamp.updated_at) > new Date(accountGroups.value[idx].updated_at!)))) {
        accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('accountStore', `updateAccountGroup (fromSync): Store-Gruppe ${accountGroups.value[idx].id} war neuer als eingehende ${accountGroupUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('accountStore', `AccountGroup "${accountGroupUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${accountGroupUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT_GROUP,
            entityId: accountGroupUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(accountGroupUpdatesWithTimestamp),
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
    if (!fromSync && accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      errorLog('accountStore', `deleteAccountGroup: Group ${accountGroupId} is still in use by accounts. Deletion aborted.`);
      // Hier könnte man einen Fehler werfen oder eine Benachrichtigung anzeigen
      return false;
    }
    const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);

    // Lokale DB immer zuerst (oder zumindest vor dem Hinzufügen zur SyncQueue) aktualisieren,
    // unabhängig davon, ob es vom Sync kommt oder eine lokale Änderung ist,
    // um den lokalen Zustand konsistent zu halten.
    await tenantDbService.deleteAccountGroup(accountGroupId);
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
    infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync && groupToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          entityId: accountGroupId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountGroupId }, // Nur ID bei Delete
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
      const oldLogoPath = account.logoUrl; // Alten Pfad speichern
      // Erstelle ein Update-Objekt, das nur die zu ändernden Felder und die ID enthält.
      // updated_at wird in updateAccount gesetzt.
      const accountUpdates: Partial<Account> & { id: string } = {
        id: accountId,
        logoUrl: newLogoPath,
      };
      // Rufe updateAccount mit dem partiellen Update auf.
      // fromSync ist false, da dies eine lokale Änderung ist.
      await updateAccount(accountUpdates as Account, false);
      infoLog('accountStore', `Logo für Konto ${accountId} aktualisiert auf ${newLogoPath}.`);

      if (oldLogoPath && newLogoPath === null) { // Wenn Logo entfernt wurde
        // const tenantDb = useTenantDbService().value; // useTenantDbService ist nicht definiert, tenantDbService ist direkt verfügbar
        if (tenantDbService) {
          await tenantDbService.removeCachedLogo(oldLogoPath);
          infoLog('accountStore', `Altes Logo ${oldLogoPath} für Konto ${accountId} aus Cache entfernt.`);
        }
      }
    } else {
      errorLog('accountStore', `Konto ${accountId} für Logo-Update nicht gefunden.`);
    }
  }

  async function updateAccountGroupLogo(accountGroupId: string, newLogoPath: string | null): Promise<void> {
    const group = accountGroups.value.find(g => g.id === accountGroupId);
    if (group) {
      const oldLogoPath = group.logoUrl; // Alten Pfad speichern
      const groupUpdates: Partial<AccountGroup> & { id: string } = {
        id: accountGroupId,
        logoUrl: newLogoPath,
      };
      await updateAccountGroup(groupUpdates as AccountGroup, false);
      infoLog('accountStore', `Logo für Kontogruppe ${accountGroupId} aktualisiert auf ${newLogoPath}.`);

      if (oldLogoPath && newLogoPath === null) { // Wenn Logo entfernt wurde
        // const tenantDb = useTenantDbService().value; // useTenantDbService ist nicht definiert, tenantDbService ist direkt verfügbar
        if (tenantDbService) {
          await tenantDbService.removeCachedLogo(oldLogoPath);
          infoLog('accountStore', `Altes Logo ${oldLogoPath} für Kontogruppe ${accountGroupId} aus Cache entfernt.`);
        }
      }
    } else {
      errorLog('accountStore', `Kontogruppe ${accountGroupId} für Logo-Update nicht gefunden.`);
    }
  }

  async function loadAccounts(): Promise<void> {
    try {
      const [loadedAccounts, loadedAccountGroups] = await Promise.all([
        tenantDbService.getAllAccounts(),
        tenantDbService.getAllAccountGroups(),
      ]);
      accounts.value = loadedAccounts || [];
      accountGroups.value = loadedAccountGroups || [];
      debugLog('accountStore', 'loadAccounts', 'completed', {
        cnt: accounts.value.length,
        groups: accountGroups.value.length,
      });
    } catch (error) {
      debugLog('accountStore', 'loadAccounts', 'Error loading accounts', { error });
      accounts.value = [];
      accountGroups.value = [];
    }
  }

  async function reset(): Promise<void> {
    accounts.value = [];
    accountGroups.value = [];
    await loadAccounts();
    debugLog('accountStore', 'reset', 'completed');
  }

  /** Initialisiert den Store beim Tenantwechsel oder App-Start */
  async function initializeStore(): Promise<void> {
    await loadAccounts();
    debugLog('accountStore', 'initializeStore', 'completed');
  }

  return {
    accounts, accountGroups,
    activeAccounts, getAccountById, getAccountGroupById,
    addAccount, updateAccount, deleteAccount,
    addAccountGroup, updateAccountGroup, deleteAccountGroup,
    updateAccountLogo, updateAccountGroupLogo,
    reset, initializeStore,
    loadAccounts,
  };
});
