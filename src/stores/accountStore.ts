/**
 * Pfad: src/stores/accountStore.ts
 * Speichert Konten & Gruppen – jetzt tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
// import { v4 as uuidv4 } from 'uuid'; // UUID wird voraussichtlich vom TenantDbService oder Aufrufer behandelt
import type { Account, AccountGroup } from '@/types'; // Als Typ-Import gekennzeichnet
import { debugLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService'; // Import TenantDbService

export const useAccountStore = defineStore('account', () => {
  const tenantDbService = new TenantDbService(); // Instanz des TenantDbService

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
  async function addAccount(account: Account): Promise<Account> {
    await tenantDbService.addAccount(account);
    accounts.value.push(account);
    // debugLog('[accountStore] addAccount', { account });
    return account;
  }

  async function updateAccount(accountUpdates: Account): Promise<boolean> {
    // Die Signatur wurde gemäß Plan beibehalten, erwartet aber ein volles Account Objekt für den Service.
    // Der Plan sagt: "updateAccount(account: Account)" für den Store, aber die alte Signatur war (id, updates).
    // Ich nehme an, der Plan meint, dass die Store-Methode `updateAccount(account: Account)` heißen soll.
    // Wenn die alte Signatur (id: string, updates: Partial<Account>) beibehalten werden MUSS,
    // dann müsste hier der Account erst geladen und dann mit den Updates versehen werden.
    // Ich folge der Annahme, dass die Signatur zu `updateAccount(account: Account)` geändert werden soll,
    // da dies konsistenter mit `addAccount` und den typischen Service-Methoden ist.
    // Falls die alte Signatur (id, updates) strikt beibehalten werden muss, bitte anmerken.
    // **Korrektur gemäß Plan: Signatur `updateAccount(account: Account)` ist korrekt.**
    await tenantDbService.updateAccount(accountUpdates); // Geht davon aus, dass bei Fehler eine Exception geworfen wird
    const idx = accounts.value.findIndex(a => a.id === accountUpdates.id);
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...accountUpdates };
      // debugLog('accountStore', 'updateAccount', 'Account updated in store', { accountId: accountUpdates.id });
      return true;
    }
    // debugLog('accountStore', 'updateAccount', 'Account not found in store for update', { accountId: accountUpdates.id });
    return false; // Account nicht im lokalen Store gefunden
  }

  async function deleteAccount(accountId: string): Promise<void> {
    await tenantDbService.deleteAccount(accountId);
    accounts.value = accounts.value.filter(a => a.id !== accountId);
    // debugLog('[accountStore] deleteAccount', { accountId });
  }

  /* ---------- Account-Groups ---------- */
  async function addAccountGroup(accountGroup: AccountGroup): Promise<AccountGroup> {
    await tenantDbService.addAccountGroup(accountGroup);
    accountGroups.value.push(accountGroup);
    // debugLog('[accountStore] addAccountGroup', { accountGroup });
    return accountGroup;
  }

  async function updateAccountGroup(accountGroupUpdates: AccountGroup): Promise<boolean> {
    // Siehe Kommentar bei updateAccount. Annahme: Signatur wird zu `updateAccountGroup(accountGroup: AccountGroup)`
    // **Korrektur gemäß Plan: Signatur `updateAccountGroup(accountGroup: AccountGroup)` ist korrekt.**
    await tenantDbService.updateAccountGroup(accountGroupUpdates); // Geht davon aus, dass bei Fehler eine Exception geworfen wird
    const idx = accountGroups.value.findIndex(g => g.id === accountGroupUpdates.id);
    if (idx !== -1) {
      accountGroups.value[idx] = { ...accountGroups.value[idx], ...accountGroupUpdates };
      // debugLog('accountStore', 'updateAccountGroup', 'Group updated in store', { groupId: accountGroupUpdates.id });
      return true;
    }
    // debugLog('accountStore', 'updateAccountGroup', 'Group not found in store for update', { groupId: accountGroupUpdates.id });
    return false; // Gruppe nicht im lokalen Store gefunden
  }

  async function deleteAccountGroup(accountGroupId: string): Promise<boolean> {
    // Beachte: Die alte Logik prüfte, ob Konten die Gruppe verwenden.
    // Diese Prüfung sollte idealerweise im TenantDbService oder hier vor dem DB-Aufruf erfolgen.
    // Fürs Erste wird die Prüfung hier beibehalten, bevor der DB-Aufruf erfolgt.
    if (accounts.value.some(a => a.accountGroupId === accountGroupId)) {
      debugLog('accountStore', 'deleteAccountGroup', 'Group in use, deletion aborted', { accountGroupId });
      return false; // Verhindere Löschung, wenn Gruppe noch verwendet wird
    }
    await tenantDbService.deleteAccountGroup(accountGroupId);
    accountGroups.value = accountGroups.value.filter(g => g.id !== accountGroupId);
    // debugLog('[accountStore] deleteAccountGroup', { accountGroupId });
    return true;
  }

  /* ------------------------------------------------- Persistence */
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

  async function initializeStore(): Promise<void> {
    await loadAccounts();
    debugLog('accountStore', 'initializeStore', 'completed');
  }

  // Initial load wird durch initializeStore ersetzt, das vom tenantStore aufgerufen wird.
  // loadAccounts(); // Entfernt

  return {
    /* state */ accounts, accountGroups,
    /* getter */ activeAccounts, getAccountById, getAccountGroupById,
    /* crud */ addAccount, updateAccount, deleteAccount,
    addAccountGroup, updateAccountGroup, deleteAccountGroup,
    /* util */ reset, initializeStore, // initializeStore hinzugefügt
    // loadAccounts explizit exportieren, falls es extern benötigt wird (obwohl initializeStore der primäre Weg sein sollte)
    loadAccounts,
  };
});
