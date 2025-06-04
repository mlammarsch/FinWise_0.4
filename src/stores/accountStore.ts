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

  async function addAccount(account: Account, fromSync = false): Promise<Account> {
    const webSocketStore = useWebSocketStore();
    // Lokale DB immer zuerst aktualisieren für sofortiges UI-Feedback
    // Nur zur DB hinzufügen, wenn es nicht schon durch einen Sync-Vorgang geschieht
    // oder wenn es explizit nicht aus einem Sync kommt.
    // Die Logik hier ist, dass wenn fromSync=true, die DB bereits vom WebSocketService aktualisiert wurde.
    // Aber der Store muss trotzdem aktualisiert werden.
    // Wenn fromSync=false, dann ist es eine lokale Änderung.

    // Wenn die Änderung vom Sync kommt, wurde die DB bereits im TenantDbService durch den WebSocket Handler aktualisiert.
    // Wir müssen hier nur den Store State aktualisieren.
    // Wenn es eine lokale Änderung ist (fromSync = false), dann muss die DB hier aktualisiert werden.
    if (!fromSync) {
      await tenantDbService.addAccount(account);
    }
    const existingAccountIndex = accounts.value.findIndex(a => a.id === account.id);
    if (existingAccountIndex === -1) {
      accounts.value.push(account);
    } else {
      // Falls das Konto schon existiert (z.B. durch eine Race Condition oder doppelte Nachricht), aktualisieren wir es.
      accounts.value[existingAccountIndex] = account;
      warnLog('accountStore', `addAccount: Account ${account.id} existed, updated instead.`);
    }
    infoLog('accountStore', `Account "${account.name}" im Store hinzugefügt/aktualisiert.`);

    if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT,
          entityId: account.id,
          operationType: SyncOperationType.CREATE,
          payload: account,
        });
        infoLog('accountStore', `Account "${account.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von Account "${account.name}" zur Sync Queue.`, e);
        // Hier könnte eine Fehlerbehandlung für den Benutzer erfolgen
      }
    } else if (!fromSync) {
      // TODO: Logik für Online-Senden (späterer Schritt, wenn fromSync false ist)
      debugLog('accountStore', `Account "${account.name}" würde jetzt online gesendet (nicht implementiert).`);
    }
    return account;
  }

  async function updateAccount(accountUpdates: Account, fromSync = false): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    if (!fromSync) {
      await tenantDbService.updateAccount(accountUpdates);
    }
    const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
      infoLog('accountStore', `Account "${accountUpdates.name}" im Store aktualisiert.`);

      if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT,
            entityId: accountUpdates.id,
            operationType: SyncOperationType.UPDATE,
            payload: accountUpdates,
          });
          infoLog('accountStore', `Account "${accountUpdates.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von Account Update "${accountUpdates.name}" zur Sync Queue.`, e);
        }
      } else if (!fromSync) {
        // TODO: Logik für Online-Senden
        debugLog('accountStore', `Account Update "${accountUpdates.name}" würde jetzt online gesendet (nicht implementiert).`);
      }
      return true;
    }
    // Fall: Konto nicht im Store gefunden, aber es kam ein Update vom Sync.
    // Das bedeutet, das Konto wurde möglicherweise erstellt, während wir offline waren, und dann aktualisiert.
    // Wir sollten es als neues Konto hinzufügen.
    if (fromSync) {
      warnLog('accountStore', `updateAccount: Account ${accountUpdates.id} not found in store during sync. Adding it.`);
      await addAccount(accountUpdates, true); // Rufe addAccount mit fromSync=true auf
      return true;
    }
    return false;
  }

  async function deleteAccount(accountId: string, fromSync = false): Promise<void> {
    const webSocketStore = useWebSocketStore();
    const accountToDelete = accounts.value.find(a => a.id === accountId);

    if (!fromSync) {
      await tenantDbService.deleteAccount(accountId);
    }
    accounts.value = accounts.value.filter(a => a.id !== accountId);
    infoLog('accountStore', `Account mit ID "${accountId}" aus Store entfernt.`);

    if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE && accountToDelete) {
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
    } else if (!fromSync && accountToDelete) {
      // TODO: Logik für Online-Senden
      debugLog('accountStore', `Account Delete (ID: "${accountId}") würde jetzt online gesendet (nicht implementiert).`);
    }
  }

  async function addAccountGroup(accountGroup: AccountGroup, fromSync = false): Promise<AccountGroup> {
    const webSocketStore = useWebSocketStore();
    if (!fromSync) {
      await tenantDbService.addAccountGroup(accountGroup);
    }

    const existingGroupIndex = accountGroups.value.findIndex(g => g.id === accountGroup.id);
    if (existingGroupIndex === -1) {
      accountGroups.value.push(accountGroup);
    } else {
      accountGroups.value[existingGroupIndex] = accountGroup;
      warnLog('accountStore', `addAccountGroup: AccountGroup ${accountGroup.id} existed, updated instead.`);
    }
    infoLog('accountStore', `AccountGroup "${accountGroup.name}" im Store hinzugefügt/aktualisiert.`);

    if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          entityId: accountGroup.id,
          operationType: SyncOperationType.CREATE,
          payload: accountGroup,
        });
        infoLog('accountStore', `AccountGroup "${accountGroup.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup "${accountGroup.name}" zur Sync Queue.`, e);
      }
    } else if (!fromSync) {
      // TODO: Logik für Online-Senden
      debugLog('accountStore', `AccountGroup "${accountGroup.name}" würde jetzt online gesendet (nicht implementiert).`);
    }
    return accountGroup;
  }

  async function updateAccountGroup(accountGroupUpdates: AccountGroup, fromSync = false): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    if (!fromSync) {
      await tenantDbService.updateAccountGroup(accountGroupUpdates);
    }
    const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
    if (idx !== -1) {
      accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
      infoLog('accountStore', `AccountGroup "${accountGroupUpdates.name}" im Store aktualisiert.`);

      if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.ACCOUNT_GROUP,
            entityId: accountGroupUpdates.id,
            operationType: SyncOperationType.UPDATE,
            payload: accountGroupUpdates,
          });
          infoLog('accountStore', `AccountGroup "${accountGroupUpdates.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('accountStore', `Fehler beim Hinzufügen von AccountGroup Update "${accountGroupUpdates.name}" zur Sync Queue.`, e);
        }
      } else if (!fromSync) {
        // TODO: Logik für Online-Senden
        debugLog('accountStore', `AccountGroup Update "${accountGroupUpdates.name}" würde jetzt online gesendet (nicht implementiert).`);
      }
      return true;
    }
    if (fromSync) {
      warnLog('accountStore', `updateAccountGroup: AccountGroup ${accountGroupUpdates.id} not found in store during sync. Adding it.`);
      await addAccountGroup(accountGroupUpdates, true);
      return true;
    }
    return false;
  }

  async function deleteAccountGroup(accountGroupId: string, fromSync = false): Promise<boolean> {
    const webSocketStore = useWebSocketStore();
    if (!fromSync && accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      errorLog('accountStore', `deleteAccountGroup: Group ${accountGroupId} is still in use by accounts. Deletion aborted.`);
      // Hier könnte man einen Fehler werfen oder eine Benachrichtigung anzeigen
      return false;
    }
    const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);

    if (!fromSync) {
      await tenantDbService.deleteAccountGroup(accountGroupId);
    }
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
    infoLog('accountStore', `AccountGroup mit ID "${accountGroupId}" aus Store entfernt.`);

    if (!fromSync && webSocketStore.backendStatus === BackendStatus.OFFLINE && groupToDelete) {
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
    } else if (!fromSync && groupToDelete) {
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
