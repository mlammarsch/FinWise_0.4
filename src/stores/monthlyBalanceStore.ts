// src/stores/monthlyBalanceStore.ts
/**
 * Monatsbilanz-Store – tenant-spezifisch persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageKey } from '@/utils/storageKey';
import { debugLog, errorLog, infoLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

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
  const isLoaded = ref(false);
  const tenantDbService = new TenantDbService();

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

  async function setMonthlyBalance(
    year: number,
    month: number,
    data: Omit<MonthlyBalance, 'year' | 'month'>,
  ): Promise<void> {
    const monthlyBalance: MonthlyBalance = { year, month, ...data };

    // Lokaler State aktualisieren
    const idx = monthlyBalances.value.findIndex(
      mb => mb.year === year && mb.month === month,
    );
    if (idx >= 0) {
      monthlyBalances.value[idx] = monthlyBalance;
    } else {
      monthlyBalances.value.push(monthlyBalance);
    }

    // IndexedDB aktualisieren
    try {
      await tenantDbService.saveMonthlyBalance(monthlyBalance);
      debugLog('monthlyBalanceStore', `MonthlyBalance für ${year}/${month + 1} gespeichert`);
    } catch (error) {
      errorLog('monthlyBalanceStore', `Fehler beim Speichern der MonthlyBalance für ${year}/${month + 1}`, error);
      throw error;
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
  async function loadMonthlyBalances(): Promise<void> {
    if (isLoaded.value) return;

    try {
      // Versuche Migration von localStorage
      await migrateFromLocalStorage();

      // Lade Daten aus IndexedDB
      const loadedBalances = await tenantDbService.getAllMonthlyBalances();
      monthlyBalances.value = loadedBalances;
      isLoaded.value = true;

      debugLog('monthlyBalanceStore', `${loadedBalances.length} MonthlyBalances geladen`);
    } catch (error) {
      errorLog('monthlyBalanceStore', 'Fehler beim Laden der MonthlyBalances', error);
      monthlyBalances.value = [];
      isLoaded.value = true;
    }
  }

  async function saveMonthlyBalances(): Promise<void> {
    try {
      // Alle MonthlyBalances in IndexedDB speichern
      for (const balance of monthlyBalances.value) {
        await tenantDbService.saveMonthlyBalance(balance);
      }
      debugLog('monthlyBalanceStore', `${monthlyBalances.value.length} MonthlyBalances gespeichert`);
    } catch (error) {
      errorLog('monthlyBalanceStore', 'Fehler beim Speichern der MonthlyBalances', error);
      throw error;
    }
  }

  async function reset(): Promise<void> {
    monthlyBalances.value = [];
    isLoaded.value = false;
    await loadMonthlyBalances();
    debugLog('monthlyBalanceStore', 'MonthlyBalanceStore zurückgesetzt');
  }

  // Migration von localStorage zu IndexedDB
  async function migrateFromLocalStorage(): Promise<void> {
    const legacyKey = storageKey('monthly_balances');
    const legacyData = localStorage.getItem(legacyKey);

    if (legacyData && !isLoaded.value) {
      try {
        const parsedData: MonthlyBalance[] = JSON.parse(legacyData);

        if (parsedData.length > 0) {
          infoLog('monthlyBalanceStore', `Migriere ${parsedData.length} MonthlyBalances von localStorage zu IndexedDB`);

          // Daten in IndexedDB speichern
          for (const balance of parsedData) {
            await tenantDbService.saveMonthlyBalance(balance);
          }

          // Legacy-Daten entfernen
          localStorage.removeItem(legacyKey);
          infoLog('monthlyBalanceStore', 'Migration von localStorage zu IndexedDB abgeschlossen');
        }
      } catch (error) {
        errorLog('monthlyBalanceStore', 'Fehler bei der Migration von localStorage', error);
      }
    }
  }

  // Initialisierung
  loadMonthlyBalances();

  return {
    monthlyBalances,
    isLoaded,
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
