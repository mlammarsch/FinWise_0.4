/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Account, AccountGroup, SyncQueueEntry } from '@/types';
import { SyncOperationType } from '@/types';
import { debugLog, errorLog, infoLog } from '@/utils/logger'; // errorLog und infoLog importieren
import { TenantDbService } from '@/services/TenantDbService';
import { useWebSocketStore } from './webSocketStore'; // WebSocketStore importieren
import { BackendStatus } from '@/types'; // BackendStatus importieren

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

  async function addAccount(account: Account): Promise<Account> {
    const webSocketStore = useWebSocketStore();
    // Lokale DB immer zuerst aktualisieren für sofortiges UI-Feedback
    await tenantDbService.addAccount(account);
    accounts.value.push(account);
    infoLog('accountStore', `Account "${account.name}" lokal hinzugefügt.`);

    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: 'Account',
          entityId: account.id,
          operationType: SyncOperationType.CREATE,
          payload: account,
        });
        infoLog('accountStore', `Account "${account.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account "${account.name}" zur Sync Queue.`, e);
        // Hier könnte eine Fehlerbehandlung für den Benutzer erfolgen
      }
    } else {
      // TODO: Logik für Online-Senden (späterer Schritt)
      debugLog('accountStore', `Account "${account.name}" würde jetzt online gesendet (nicht implementiert).`);
    }
    return account;
  }

  async function updateAccount(accountUpdates: Account): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    // Lokale DB immer zuerst aktualisieren
    await tenantDbService.updateAccount(accountUpdates);
    const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
      infoLog('accountStore', `Account "${accountUpdates.name}" lokal aktualisiert.`);

      if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: 'Account',
            entityId: accountUpdates.id,
            operationType: SyncOperationType.UPDATE,
            payload: accountUpdates,
          });
          infoLog('accountStore', `Account "${accountUpdates.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von Account Update "${accountUpdates.name}" zur Sync Queue.`, e);
        }
      } else {
        // TODO: Logik für Online-Senden
        debugLog('accountStore', `Account Update "${accountUpdates.name}" würde jetzt online gesendet (nicht implementiert).`);
      }
      return true;
    }
    return false;
  }

  async function deleteAccount(accountId: string): Promise<void> {
    const webSocketStore = useWebSocketStore();
    const accountToDelete = accounts.value.find(a => a.id === accountId);
    // Lokale DB immer zuerst aktualisieren
    await tenantDbService.deleteAccount(accountId);
    accounts.value = accounts.value.filter(a => a.id !== accountId);
    infoLog('accountStore', `Account mit ID "${accountId}" lokal gelöscht.`);

    if (webSocketStore.backendStatus === BackendStatus.OFFLINE && accountToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: 'Account',
          entityId: accountId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountId }, // Nur ID bei Delete
        });
        infoLog('accountStore', `Account mit ID "${accountId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account Delete (ID: "${accountId}") zur Sync Queue.`, e);
      }
    } else if (accountToDelete) {
      // TODO: Logik für Online-Senden
      debugLog('accountStore', `Account Delete (ID: "${accountId}") würde jetzt online gesendet (nicht implementiert).`);
    }
  }

  async function addAccountGroup(accountGroup: AccountGroup): Promise<AccountGroup> {
    const webSocketStore = useWebSocketStore();
    await tenantDbService.addAccountGroup(accountGroup);
    accountGroups.value.push(accountGroup);
    infoLog('accountStore', `AccountGroup "${accountGroup.name}" lokal hinzugefügt.`);

    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: 'AccountGroup',
          entityId: accountGroup.id,
          operationType: SyncOperationType.CREATE,
          payload: accountGroup,
        });
        infoLog('accountStore', `AccountGroup "${accountGroup.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup "${accountGroup.name}" zur Sync Queue.`, e);
      }
    } else {
      // TODO: Logik für Online-Senden
      debugLog('accountStore', `AccountGroup "${accountGroup.name}" würde jetzt online gesendet (nicht implementiert).`);
    }
    return accountGroup;
  }

  async function updateAccountGroup(accountGroupUpdates: AccountGroup): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    await tenantDbService.updateAccountGroup(accountGroupUpdates);
    const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
    if (idx !== -1) {
      accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
      infoLog('accountStore', `AccountGroup "${accountGroupUpdates.name}" lokal aktualisiert.`);

      if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: 'AccountGroup',
            entityId: accountGroupUpdates.id,
            operationType: SyncOperationType.UPDATE,
            payload: accountGroupUpdates,
          });
          infoLog('accountStore', `AccountGroup "${accountGroupUpdates.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup Update "${accountGroupUpdates.name}" zur Sync Queue.`, e);
        }
      } else {
        // TODO: Logik für Online-Senden
        debugLog('accountStore', `AccountGroup Update "${accountGroupUpdates.name}" würde jetzt online gesendet (nicht implementiert).`);
      }
      return true;
    }
    return false;
  }

  async function deleteAccountGroup(accountGroupId: string): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    if (accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      debugLog('accountStore', 'deleteAccountGroup', 'Group in use, deletion aborted', { accountGroupId });
      return false;
    }
    const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);
    await tenantDbService.deleteAccountGroup(accountGroupId);
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
    infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" lokal gelöscht.`);

    if (webSocketStore.backendStatus === BackendStatus.OFFLINE && groupToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: 'AccountGroup',
          entityId: accountGroupId,
          operationType: SyncOperationType.DELETE,
          payload: { id: accountGroupId }, // Nur ID bei Delete
        });
        infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup Delete (ID: "${accountGroupId}") zur Sync Queue.`, e);
      }
    } else if (groupToDelete) {
      // TODO: Logik für Online-Senden
      debugLog('accountStore', `AccountGroup Delete (ID: "${accountGroupId}") würde jetzt online gesendet (nicht implementiert).`);
    }
    return true;
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
    reset, initializeStore,
    loadAccounts,
  };
});
