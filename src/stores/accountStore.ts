/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Account, AccountGroup } from '@/types';
import { debugLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';

export const useAccountStore = defineStore('account', () => {
  /* ------------------------------------------------------ State */
  const accounts      = ref<Account[]>([]);
  const accountGroups = ref<AccountGroup[]>([]);

  /* ---------------------------------------------------- Getters */
  const activeAccounts = computed(() =>
    accounts.value.filter(a => a.isActive)
  );

  function getAccountById(id: string) {
    return accounts.value.find(a => a.id === id);
  }

  const getAccountGroupById = computed(() => (id: string) =>
    accountGroups.value.find(g => g.id === id),
  );

  /* ---------------------------------------------------- Actions */
  function addAccount(account: Omit<Account, 'id'>) {
    const newAcc: Account = { ...account, id: uuidv4() };
    accounts.value.push(newAcc);
    saveAccounts();
    return newAcc;
  }

  function updateAccount(id: string, updates: Partial<Account>) {
    const idx = accounts.value.findIndex(a => a.id === id);
    if (idx === -1) return false;
    accounts.value[idx] = { ...accounts.value[idx], ...updates };
    saveAccounts();
    return true;
  }

  function deleteAccount(id: string) {
    accounts.value = accounts.value.filter(a => a.id !== id);
    saveAccounts();
  }

  /* ---------- Account-Groups ---------- */
  function addAccountGroup(group: Omit<AccountGroup, 'id'>) {
    const g = { ...group, id: uuidv4() };
    accountGroups.value.push(g);
    saveAccountGroups();
    return g;
  }

  function updateAccountGroup(id: string, updates: Partial<AccountGroup>) {
    const idx = accountGroups.value.findIndex(g => g.id === id);
    if (idx === -1) return false;
    accountGroups.value[idx] = { ...accountGroups.value[idx], ...updates };
    saveAccountGroups();
    return true;
  }

  function deleteAccountGroup(id: string) {
    if (accounts.value.some(a => a.accountGroupId === id)) return false;
    accountGroups.value = accountGroups.value.filter(g => g.id !== id);
    saveAccountGroups();
    return true;
  }

  /* ------------------------------------------------- Persistence */
  function loadAccounts() {
    // Konten laden
    const raw = localStorage.getItem(storageKey('accounts'));
    accounts.value = raw ? JSON.parse(raw) : [];

    // **Gruppen nur laden, aber keine Default-Gruppen mehr hier anlegen**
    const rawGroups = localStorage.getItem(storageKey('account_groups'));
    accountGroups.value = rawGroups ? JSON.parse(rawGroups) : [];

    debugLog('[accountStore] loadAccounts', {
      cnt: accounts.value.length,
      groups: accountGroups.value.length,
    });
  }

  function saveAccounts() {
    localStorage.setItem(
      storageKey('accounts'),
      JSON.stringify(accounts.value),
    );
  }

  function saveAccountGroups() {
    localStorage.setItem(
      storageKey('account_groups'),
      JSON.stringify(accountGroups.value),
    );
  }

  function reset() {
    accounts.value = [];
    accountGroups.value = [];
    loadAccounts();
  }

  // Initial load
  loadAccounts();

  return {
    /* state */ accounts, accountGroups,
    /* getter */ activeAccounts, getAccountById, getAccountGroupById,
    /* crud */ addAccount, updateAccount, deleteAccount,
    addAccountGroup, updateAccountGroup, deleteAccountGroup,
    /* util */ reset,
  };
});
