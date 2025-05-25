// src/stores/transactionStore.ts
/**
 * Pfad: src/stores/transactionStore.ts
 * Transaktionen – jetzt tenant-spezifisch persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Transaction } from '@/types';
import { useAccountStore } from './accountStore';
import { debugLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';

export interface ExtendedTransaction extends Transaction {
  tagIds: string[];
  payee: string;
  counterTransactionId: string | null;
  planningTransactionId: string | null;
  isReconciliation: boolean;
  runningBalance: number;
  transferToAccountId?: string | null;
}

function toDateOnlyString(i: string): string {
  return i?.split('T')[0] ?? i;
}

export const useTransactionStore = defineStore('transaction', () => {
  /* ----------------------------------------------------- State */
  const transactions = ref<ExtendedTransaction[]>([]);
  const accountStore = useAccountStore();

  /* --------------------------------------------------- Getters */
  const getTransactionById = computed(() => (id: string) =>
    transactions.value.find(t => t.id === id),
  );

  const getTransactionsByAccount = computed(() => (accountId: string) =>
    transactions.value
      .filter(t => t.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  );

  const getTransactionsByCategory = computed(() => (categoryId: string) =>
    transactions.value
      .filter(t => t.categoryId === categoryId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  );

  function getRecentTransactions(limit: number = 10) {
    debugLog('[transactionStore] getRecentTransactions', { limit });
    return [...transactions.value]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  /* --------------------------------------------------- Actions */
  function addTransaction(tx: ExtendedTransaction): ExtendedTransaction {
    transactions.value.push(tx);
    saveTransactions();
    debugLog('[transactionStore] addTransaction', tx);
    return tx;
  }

  function updateTransaction(id: string, updates: Partial<ExtendedTransaction>): boolean {
    const idx = transactions.value.findIndex(t => t.id === id);
    if (idx === -1) {
      debugLog('[transactionStore] updateTransaction - not found', id);
      return false;
    }
    transactions.value[idx] = { ...transactions.value[idx], ...updates };
    saveTransactions();
    debugLog('[transactionStore] updateTransaction - updated', { id, updates });
    return true;
  }

  function deleteTransaction(id: string): boolean {
    const before = transactions.value.length;
    transactions.value = transactions.value.filter(t => t.id !== id);
    const success = transactions.value.length < before;
    if (success) {
      saveTransactions();
      debugLog('[transactionStore] deleteTransaction - deleted', id);
    } else {
      debugLog('[transactionStore] deleteTransaction - not found', id);
    }
    return success;
  }

  /* ----------------------------------------------- Persistence */
  function loadTransactions() {
    const raw = localStorage.getItem(storageKey('transactions'));
    transactions.value = raw ? JSON.parse(raw) : [];

    // normalize dates
    transactions.value = transactions.value.map(tx => ({
      ...tx,
      date: toDateOnlyString(tx.date),
      valueDate: toDateOnlyString(tx.valueDate || tx.date),
    }));

    debugLog('[transactionStore] loadTransactions', {
      cnt: transactions.value.length,
    });
  }

  function saveTransactions() {
    localStorage.setItem(
      storageKey('transactions'),
      JSON.stringify(transactions.value),
    );
    debugLog('[transactionStore] saveTransactions');
  }

  function reset() {
    transactions.value = [];
    loadTransactions();
    debugLog('[transactionStore] reset');
  }

  loadTransactions();

  /* ----------------------------------------------- Exports */
  return {
    transactions,
    getTransactionById,
    getTransactionsByAccount,
    getTransactionsByCategory,
    getRecentTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loadTransactions,
    saveTransactions,
    reset,
  };
});
