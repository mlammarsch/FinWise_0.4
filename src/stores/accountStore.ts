/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Account, AccountGroup } from '@/types';
import { debugLog } from '@/utils/logger';
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

  async function addAccount(account: Account): Promise<Account> {
    await tenantDbService.addAccount(account);
    accounts.value.push(account);
    return account;
  }

  async function updateAccount(accountUpdates: Account): Promise<boolean> {
    await tenantDbService.updateAccount(accountUpdates);
    const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
      return true;
    }
    return false;
  }

  async function deleteAccount(accountId: string): Promise<void> {
    await tenantDbService.deleteAccount(accountId);
    accounts.value = accounts.value.filter(a => a.id !== accountId);
  }

  async function addAccountGroup(accountGroup: AccountGroup): Promise<AccountGroup> {
    await tenantDbService.addAccountGroup(accountGroup);
    accountGroups.value.push(accountGroup);
    return accountGroup;
  }

  async function updateAccountGroup(accountGroupUpdates: AccountGroup): Promise<boolean> {
    await tenantDbService.updateAccountGroup(accountGroupUpdates);
    const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
    if (idx !== -1) {
      accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
      return true;
    }
    return false;
  }

  async function deleteAccountGroup(accountGroupId: string): Promise<boolean> {
    if (accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      debugLog('accountStore', 'deleteAccountGroup', 'Group in use, deletion aborted', { accountGroupId });
      return false;
    }
    await tenantDbService.deleteAccountGroup(accountGroupId);
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
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
