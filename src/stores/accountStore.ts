/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Account, AccountGroup } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger'; // infoLog, errorLog hinzugefügt
import { TenantDbService } from '@/services/TenantDbService';
import { useWebSocketStore } from './webSocketStore';
import { addToSyncQueue } from '@/services/SyncQueueService';
import { BackendStatus } from '@/types';
import { useSessionStore } from './sessionStore'; // Hinzugefügt

export const useAccountStore = defineStore('account', () => {
  const tenantDbService = new TenantDbService();
  const webSocketStore = useWebSocketStore();
  const sessionStore = useSessionStore(); // Hinzugefügt

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
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account to sync queue', account);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot add to sync queue: currentTenantId is null');
        // Hier könnte eine Fehlerbehandlung oder ein Fallback erfolgen
        // Fürs Erste werfen wir einen Fehler oder kehren frühzeitig zurück,
        // da ohne tenantId die Synchronisation nicht korrekt funktionieren kann.
        throw new Error('currentTenantId is null, cannot add to sync queue');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'create',
        entity: 'Account',
        entityId: account.id,
        payload: account,
      });
      // Optimistic update: Add to local store immediately
      accounts.value.push(account);
      return account;
    }
    try {
      await tenantDbService.addAccount(account);
      accounts.value.push(account);
      return account;
    } catch (err) {
      errorLog('[accountStore]', 'Error adding account, adding to sync queue', { account, error: err });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot add to sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot add to sync queue on error');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'create',
        entity: 'Account',
        entityId: account.id,
        payload: account,
      });
      // Optimistic update even on error if backend was thought to be online
      accounts.value.push(account);
      return account; // Or handle error more gracefully
    }
  }

  async function updateAccount(accountUpdates: Account): Promise<boolean> {
    debugLog('accountStore', 'updateAccount', 'Updating account with data', accountUpdates);
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account update to sync queue', accountUpdates);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot update in sync queue: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot update in sync queue');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'update',
        entity: 'Account',
        entityId: accountUpdates.id,
        payload: accountUpdates,
      });
      // Optimistic update
      const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
      if (idx !== -1) {
        accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
        return true;
      }
      return false;
    }
    try {
      await tenantDbService.updateAccount(accountUpdates);
      const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
      if (idx !== -1) {
        accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
        return true;
      }
      return false;
    } catch (err) {
      errorLog('[accountStore]', 'Error updating account, adding to sync queue', { accountUpdates, error: err });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot update in sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot update in sync queue on error');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'update',
        entity: 'Account',
        entityId: accountUpdates.id,
        payload: accountUpdates,
      });
      // Optimistic update
      const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
      if (idx !== -1) {
        accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
        return true;
      }
      return false;
    }
  }

  async function deleteAccount(accountId: string): Promise<void> {
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account deletion to sync queue', { accountId });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot delete in sync queue: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot delete in sync queue');
      }
      const accountToDelete = accounts.value.find(a => a.id === accountId);
      if (accountToDelete) {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'Account',
          entityId: accountId,
          payload: accountToDelete, // Store the object for potential rollback or inspection
        });
      } else {
        // If account not found locally, still queue deletion by ID for server
         await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'Account',
          entityId: accountId,
          payload: { id: accountId }, // Minimal payload
        });
      }
      // Optimistic update
      accounts.value = accounts.value.filter(a => a.id !== accountId);
      return;
    }
    try {
      await tenantDbService.deleteAccount(accountId);
      accounts.value = accounts.value.filter(a => a.id !== accountId);
    } catch (err) {
      errorLog('[accountStore]', 'Error deleting account, adding to sync queue', { accountId, error: err });
      const accountToDelete = accounts.value.find(a => a.id === accountId);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot delete in sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot delete in sync queue on error');
      }
       if (accountToDelete) {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'Account',
          entityId: accountId,
          payload: accountToDelete,
        });
      } else {
         await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'Account',
          entityId: accountId,
          payload: { id: accountId },
        });
      }
      // Optimistic update
      accounts.value = accounts.value.filter(a => a.id !== accountId);
    }
  }

  async function addAccountGroup(accountGroup: AccountGroup): Promise<AccountGroup> {
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account group to sync queue', accountGroup);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot add account group to sync queue: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot add account group to sync queue');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'create',
        entity: 'AccountGroup',
        entityId: accountGroup.id,
        payload: accountGroup,
      });
      accountGroups.value.push(accountGroup);
      return accountGroup;
    }
    try {
      await tenantDbService.addAccountGroup(accountGroup);
      accountGroups.value.push(accountGroup);
      return accountGroup;
    } catch (err) {
      errorLog('[accountStore]', 'Error adding account group, adding to sync queue', { accountGroup, error: err });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot add account group to sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot add account group to sync queue on error');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'create',
        entity: 'AccountGroup',
        entityId: accountGroup.id,
        payload: accountGroup,
      });
      accountGroups.value.push(accountGroup);
      return accountGroup;
    }
  }

  async function updateAccountGroup(accountGroupUpdates: AccountGroup): Promise<boolean> {
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account group update to sync queue', accountGroupUpdates);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot update account group in sync queue: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot update account group in sync queue');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'update',
        entity: 'AccountGroup',
        entityId: accountGroupUpdates.id,
        payload: accountGroupUpdates,
      });
      const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
      if (idx !== -1) {
        accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
        return true;
      }
      return false;
    }
    try {
      await tenantDbService.updateAccountGroup(accountGroupUpdates);
      const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
      if (idx !== -1) {
        accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
        return true;
      }
      return false;
    } catch (err) {
      errorLog('[accountStore]', 'Error updating account group, adding to sync queue', { accountGroupUpdates, error: err });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot update account group in sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot update account group in sync queue on error');
      }
      await addToSyncQueue({
        tenantId: sessionStore.currentTenantId, // Hinzugefügt
        operation: 'update',
        entity: 'AccountGroup',
        entityId: accountGroupUpdates.id,
        payload: accountGroupUpdates,
      });
      const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
      if (idx !== -1) {
        accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
        return true;
      }
      return false;
    }
  }

  async function deleteAccountGroup(accountGroupId: string): Promise<boolean> {
    if (accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      debugLog('accountStore', 'deleteAccountGroup', 'Group in use, deletion aborted', { accountGroupId });
      return false;
    }
    if (webSocketStore.backendStatus === BackendStatus.OFFLINE) {
      infoLog('[accountStore]', 'Backend offline, adding account group deletion to sync queue', { accountGroupId });
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot delete account group in sync queue: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot delete account group in sync queue');
      }
      const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);
      if (groupToDelete) {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'AccountGroup',
          entityId: accountGroupId,
          payload: groupToDelete,
        });
      } else {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'AccountGroup',
          entityId: accountGroupId,
          payload: { id: accountGroupId },
        });
      }
      accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
      return true;
    }
    try {
      await tenantDbService.deleteAccountGroup(accountGroupId);
      accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
      return true;
    } catch (err) {
      errorLog('[accountStore]', 'Error deleting account group, adding to sync queue', { accountGroupId, error: err });
      const groupToDelete = accountGroups.value.find(g => g.id === accountGroupId);
      if (!sessionStore.currentTenantId) {
        errorLog('[accountStore]', 'Cannot delete account group in sync queue on error: currentTenantId is null');
        throw new Error('currentTenantId is null, cannot delete account group in sync queue on error');
      }
      if (groupToDelete) {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'AccountGroup',
          entityId: accountGroupId,
          payload: groupToDelete,
        });
      } else {
        await addToSyncQueue({
          tenantId: sessionStore.currentTenantId, // Hinzugefügt
          operation: 'delete',
          entity: 'AccountGroup',
          entityId: accountGroupId,
          payload: { id: accountGroupId },
        });
      }
      accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
      return true;
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
    reset, initializeStore,
    loadAccounts,
  };
});
