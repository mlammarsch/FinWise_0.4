// src/stores/monthlyBalanceStore.ts
/**
 * Monatsbilanz-Store – tenant-spezifisch persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageKey } from '@/utils/storageKey';
import { debugLog } from '@/utils/logger';

export interface MonthlyBalance {
  year: number;
  month: number;
  accountBalances: Record<string, number>;
  categoryBalances: Record<string, number>;
  projectedAccountBalances: Record<string, number>;
  projectedCategoryBalances: Record<string, number>;
}

export interface BalanceInfo {
  balance: number;
  date: Date;
}

export const useMonthlyBalanceStore = defineStore('monthlyBalance', () => {
  const monthlyBalances = ref<MonthlyBalance[]>([]);

  /* ----------------------------------------- CRUD-ähnliche Methoden */
  function getAllMonthlyBalances(): MonthlyBalance[] {
    return monthlyBalances.value;
  }

  function getMonthlyBalance(year: number, month: number): MonthlyBalance | null {
    return (
      monthlyBalances.value.find(mb => mb.year === year && mb.month === month) ||
      null
    );
  }

  function setMonthlyBalance(
    year: number,
    month: number,
    data: Omit<MonthlyBalance, 'year' | 'month'>,
  ): void {
    const idx = monthlyBalances.value.findIndex(
      mb => mb.year === year && mb.month === month,
    );
    if (idx >= 0) {
      monthlyBalances.value[idx] = { year, month, ...data };
    } else {
      monthlyBalances.value.push({ year, month, ...data });
    }
  }

  /* -------------------------------- Legacy-Computed-Methoden */
  const getLatestPersistedCategoryBalance = computed(() => {
    return (categoryId: string, date: Date): BalanceInfo | null => {
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth();
      const relevant = monthlyBalances.value
        .filter(
          mb =>
            mb.year < targetYear ||
            (mb.year === targetYear && mb.month < targetMonth),
        )
        .sort((a, b) =>
          b.year !== a.year ? b.year - a.year : b.month - a.month,
        );

      for (const mb of relevant) {
        if (mb.categoryBalances[categoryId] !== undefined) {
          return {
            balance: mb.categoryBalances[categoryId],
            date: new Date(mb.year, mb.month, 1),
          };
        }
      }
      return null;
    };
  });

  const getAccountBalanceForDate = computed(() => {
    return (accountId: string, date: Date): number | null => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const mb = monthlyBalances.value.find(
        mb => mb.year === year && mb.month === month,
      );
      if (mb && mb.accountBalances[accountId] !== undefined) {
        return mb.accountBalances[accountId];
      }
      return null;
    };
  });

  const getProjectedAccountBalanceForDate = computed(() => {
    return (accountId: string, date: Date): number | null => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const mb = monthlyBalances.value.find(
        mb => mb.year === year && mb.month === month,
      );
      if (mb && mb.projectedAccountBalances[accountId] !== undefined) {
        return mb.projectedAccountBalances[accountId];
      }
      return null;
    };
  });

  const getCategoryBalanceForDate = computed(() => {
    return (categoryId: string, date: Date): number | null => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const mb = monthlyBalances.value.find(
        mb => mb.year === year && mb.month === month,
      );
      if (mb && mb.categoryBalances[categoryId] !== undefined) {
        return mb.categoryBalances[categoryId];
      }
      return null;
    };
  });

  const getProjectedCategoryBalanceForDate = computed(() => {
    return (categoryId: string, date: Date): number | null => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const mb = monthlyBalances.value.find(
        mb => mb.year === year && mb.month === month,
      );
      if (mb && mb.projectedCategoryBalances[categoryId] !== undefined) {
        return mb.projectedCategoryBalances[categoryId];
      }
      return null;
    };
  });

  /* ---------------------------------------- Persistence */
  function loadMonthlyBalances() {
    const raw = localStorage.getItem(storageKey('monthly_balances'));
    monthlyBalances.value = raw ? JSON.parse(raw) : [];
    debugLog('[monthlyBalanceStore] load', { cnt: monthlyBalances.value.length });
  }

  function saveMonthlyBalances() {
    localStorage.setItem(
      storageKey('monthly_balances'),
      JSON.stringify(monthlyBalances.value),
    );
    debugLog('[monthlyBalanceStore] save', { cnt: monthlyBalances.value.length });
  }

  function reset() {
    monthlyBalances.value = [];
    loadMonthlyBalances();
    debugLog('[monthlyBalanceStore] reset');
  }

  loadMonthlyBalances();

  return {
    monthlyBalances,
    getAllMonthlyBalances,
    getMonthlyBalance,
    setMonthlyBalance,
    saveMonthlyBalances,
    loadMonthlyBalances,
    reset,

    // Legacy-Methoden für Kompatibilität, sollten später ersetzt werden
    getLatestPersistedCategoryBalance,
    getAccountBalanceForDate,
    getProjectedAccountBalanceForDate,
    getCategoryBalanceForDate,
    getProjectedCategoryBalanceForDate,
  };
});
