// src/stores/monthlyBalanceStore.ts
/**
 * Monatsbilanz-Store – tenant-spezifisch persistiert.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageKey } from '@/utils/storageKey';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';
export const useMonthlyBalanceStore = defineStore('monthlyBalance', () => {
    const monthlyBalances = ref([]);
    const isLoaded = ref(false);
    // TenantDbService-Instanz (wird bei Bedarf initialisiert)
    const tenantDbService = new TenantDbService();
    /* ----------------------------------------- CRUD-ähnliche Methoden */
    function getAllMonthlyBalances() {
        return monthlyBalances.value;
    }
    function getMonthlyBalance(year, month) {
        return (monthlyBalances.value.find(mb => mb.year === year && mb.month === month) ||
            null);
    }
    async function setMonthlyBalance(year, month, data) {
        const monthlyBalance = { year, month, ...data };
        // Lokaler State aktualisieren
        const idx = monthlyBalances.value.findIndex(mb => mb.year === year && mb.month === month);
        if (idx >= 0) {
            monthlyBalances.value[idx] = monthlyBalance;
        }
        else {
            monthlyBalances.value.push(monthlyBalance);
        }
        // IndexedDB aktualisieren
        try {
            if (!tenantDbService) {
                warnLog('monthlyBalanceStore', 'Kein TenantDbService verfügbar für setMonthlyBalance');
                return;
            }
            await tenantDbService.saveMonthlyBalance(monthlyBalance);
            // debugLog('monthlyBalanceStore', `MonthlyBalance für ${year}/${month + 1} gespeichert`);
        }
        catch (error) {
            errorLog('monthlyBalanceStore', `Fehler beim Speichern der MonthlyBalance für ${year}/${month + 1}`, error);
            throw error;
        }
    }
    /* -------------------------------- Legacy-Computed-Methoden */
    const getLatestPersistedCategoryBalance = computed(() => {
        return (categoryId, date) => {
            const targetYear = date.getFullYear();
            const targetMonth = date.getMonth();
            const relevant = monthlyBalances.value
                .filter(mb => mb.year < targetYear ||
                (mb.year === targetYear && mb.month < targetMonth))
                .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
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
        return (accountId, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const mb = monthlyBalances.value.find(mb => mb.year === year && mb.month === month);
            if (mb && mb.accountBalances[accountId] !== undefined) {
                return mb.accountBalances[accountId];
            }
            return null;
        };
    });
    const getProjectedAccountBalanceForDate = computed(() => {
        return (accountId, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const mb = monthlyBalances.value.find(mb => mb.year === year && mb.month === month);
            if (mb && mb.projectedAccountBalances[accountId] !== undefined) {
                return mb.projectedAccountBalances[accountId];
            }
            return null;
        };
    });
    const getCategoryBalanceForDate = computed(() => {
        return (categoryId, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const mb = monthlyBalances.value.find(mb => mb.year === year && mb.month === month);
            if (mb && mb.categoryBalances[categoryId] !== undefined) {
                return mb.categoryBalances[categoryId];
            }
            return null;
        };
    });
    const getProjectedCategoryBalanceForDate = computed(() => {
        return (categoryId, date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const mb = monthlyBalances.value.find(mb => mb.year === year && mb.month === month);
            if (mb && mb.projectedCategoryBalances[categoryId] !== undefined) {
                return mb.projectedCategoryBalances[categoryId];
            }
            return null;
        };
    });
    /* ---------------------------------------- Persistence */
    async function loadMonthlyBalances() {
        if (isLoaded.value)
            return;
        try {
            if (!tenantDbService) {
                warnLog('monthlyBalanceStore', 'Kein TenantDbService verfügbar für loadMonthlyBalances');
                monthlyBalances.value = [];
                isLoaded.value = true;
                return;
            }
            // Versuche Migration von localStorage
            await migrateFromLocalStorage();
            // Lade Daten aus IndexedDB
            const loadedBalances = await tenantDbService.getAllMonthlyBalances();
            monthlyBalances.value = loadedBalances;
            isLoaded.value = true;
            // debugLog('monthlyBalanceStore', `${loadedBalances.length} MonthlyBalances geladen`);
        }
        catch (error) {
            errorLog('monthlyBalanceStore', 'Fehler beim Laden der MonthlyBalances', error);
            monthlyBalances.value = [];
            isLoaded.value = true;
        }
    }
    async function saveMonthlyBalances() {
        try {
            if (!tenantDbService) {
                warnLog('monthlyBalanceStore', 'Kein TenantDbService verfügbar für saveMonthlyBalances');
                return;
            }
            // Verwende Bulk-Operation für bessere Performance
            if (monthlyBalances.value.length > 0) {
                await tenantDbService.saveMonthlyBalancesBatch(monthlyBalances.value);
                debugLog('monthlyBalanceStore', `${monthlyBalances.value.length} MonthlyBalances als Batch gespeichert`);
            }
        }
        catch (error) {
            errorLog('monthlyBalanceStore', 'Fehler beim Speichern der MonthlyBalances', error);
            throw error;
        }
    }
    /**
     * Speichert mehrere MonthlyBalances in einem Batch - optimiert für große Datenmengen
     */
    async function bulkSaveMonthlyBalances(balancesToSave) {
        if (balancesToSave.length === 0) {
            debugLog('monthlyBalanceStore', 'bulkSaveMonthlyBalances: Keine MonthlyBalances zum Speichern');
            return;
        }
        try {
            if (!tenantDbService) {
                warnLog('monthlyBalanceStore', 'Kein TenantDbService verfügbar für bulkSaveMonthlyBalances');
                return;
            }
            // Verwende Batch-Operation für optimale Performance
            await tenantDbService.saveMonthlyBalancesBatch(balancesToSave);
            // Aktualisiere lokalen State
            for (const balance of balancesToSave) {
                const idx = monthlyBalances.value.findIndex(mb => mb.year === balance.year && mb.month === balance.month);
                if (idx >= 0) {
                    monthlyBalances.value[idx] = balance;
                }
                else {
                    monthlyBalances.value.push(balance);
                }
            }
            debugLog('monthlyBalanceStore', `${balancesToSave.length} MonthlyBalances erfolgreich als Batch gespeichert`);
        }
        catch (error) {
            errorLog('monthlyBalanceStore', `Fehler beim Batch-Speichern von ${balancesToSave.length} MonthlyBalances`, error);
            throw error;
        }
    }
    async function reset() {
        monthlyBalances.value = [];
        isLoaded.value = false;
        await loadMonthlyBalances();
        // debugLog('monthlyBalanceStore', 'MonthlyBalanceStore zurückgesetzt');
    }
    // Migration von localStorage zu IndexedDB
    async function migrateFromLocalStorage() {
        const legacyKey = storageKey('monthly_balances');
        const legacyData = localStorage.getItem(legacyKey);
        if (legacyData && !isLoaded.value) {
            try {
                if (!tenantDbService) {
                    warnLog('monthlyBalanceStore', 'Kein TenantDbService verfügbar für Migration');
                    return;
                }
                const parsedData = JSON.parse(legacyData);
                if (parsedData.length > 0) {
                    infoLog('monthlyBalanceStore', `Migriere ${parsedData.length} MonthlyBalances von localStorage zu IndexedDB`);
                    // Daten in IndexedDB speichern (mit Bulk-Operation für bessere Performance)
                    await tenantDbService.saveMonthlyBalancesBatch(parsedData);
                    // Legacy-Daten entfernen
                    localStorage.removeItem(legacyKey);
                    infoLog('monthlyBalanceStore', 'Migration von localStorage zu IndexedDB abgeschlossen');
                }
            }
            catch (error) {
                errorLog('monthlyBalanceStore', 'Fehler bei der Migration von localStorage', error);
            }
        }
    }
    return {
        monthlyBalances,
        isLoaded,
        getAllMonthlyBalances,
        getMonthlyBalance,
        setMonthlyBalance,
        saveMonthlyBalances,
        bulkSaveMonthlyBalances,
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
