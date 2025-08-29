// src/services/DataService.ts
/**
 * Daten- und Storage-Layer.
 * Enthält jetzt auch reloadTenantData für kompletten Tenant-Reset.
 */
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger'; // warnLog importiert
import { storageKey } from '@/utils/storageKey';
import { TenantDbService } from '@/services/TenantDbService'; // Korrigierter Import
// ---------- NEW – Store-Imports für reload ----------
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useMonthlyBalanceStore } from '@/stores/monthlyBalanceStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { useTagStore } from '@/stores/tagStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useSearchStore } from '@/stores/searchStore';
import { useTransactionFilterStore } from '@/stores/transactionFilterStore';
import { BalanceService } from './BalanceService';
// ----------------------------------------------------
export const LocalStorageAdapter = {
    save(key, data) {
        const sk = storageKey(key);
        const jsonData = JSON.stringify(data);
        localStorage.setItem(sk, jsonData);
        debugLog('LocalStorageAdapter', 'save', `Saved data for key: ${sk}`, {
            key: sk,
            dataSize: jsonData.length,
        });
    },
    load(key) {
        const sk = storageKey(key);
        const json = localStorage.getItem(sk);
        const result = json ? JSON.parse(json) : null;
        debugLog('LocalStorageAdapter', 'load', `Loaded data for key: ${sk}`, {
            key: sk,
            found: !!json,
            itemCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
        });
        return result;
    },
    remove(key) {
        const sk = storageKey(key);
        localStorage.removeItem(sk);
        debugLog('LocalStorageAdapter', 'remove', `Removed data for key: ${sk}`, { key: sk }); // debugLog angepasst
    },
};
/**
 * Datenservice für den Zugriff auf persistierte Daten
 */
export class DataService {
    constructor() {
        Object.defineProperty(this, "adapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: LocalStorageAdapter
        });
    }
    // ---------- NEU ----------
    /**
     * Lädt **alle** tenant-spezifischen Stores neu.
     * Muss nach Tenant-Wechsel oder initialem Login
     * mit bereits gesetztem currentTenantId aufgerufen werden.
     */
    static async reloadTenantData() {
        debugLog('DataService', 'reloadTenantData', 'Start');
        // Da die reset-Methoden (oder die von ihnen aufgerufenen Ladefunktionen) nun async sind,
        // müssen sie mit await aufgerufen werden.
        // Es ist wichtig, dass die initializeStore-Methoden der Stores aufgerufen werden,
        // wenn diese für das initiale Laden zuständig sind und nicht reset allein.
        // Annahme: reset() in den Stores ruft die neuen async Ladefunktionen auf.
        // Für accountStore ist das `await reset()` korrekt, da es `await loadAccounts()` enthält.
        // Für die anderen Stores muss sichergestellt werden, dass ihre reset() oder eine
        // äquivalente Initialisierungsmethode asynchron ist und korrekt aufgerufen wird.
        const accountStore = useAccountStore();
        const categoryStore = useCategoryStore();
        const transactionStore = useTransactionStore();
        const planningStore = usePlanningStore();
        const monthlyBalanceStore = useMonthlyBalanceStore();
        const recipientStore = useRecipientStore();
        const tagStore = useTagStore();
        const ruleStore = useRuleStore();
        // searchStore und transactionFilterStore haben keine async reset-Methoden im typischen Sinne des Datenladens
        await accountStore.reset(); // accountStore.reset ist async
        await categoryStore.reset(); // Annahme: categoryStore.reset ist oder wird async
        await transactionStore.reset(); // Annahme: transactionStore.reset ist oder wird async
        await planningStore.reset(); // Annahme: planningStore.reset ist oder wird async
        await monthlyBalanceStore.reset(); // Annahme: monthlyBalanceStore.reset ist oder wird async
        await recipientStore.reset(); // Annahme: recipientStore.reset ist oder wird async
        await tagStore.reset(); // Annahme: tagStore.reset ist oder wird async
        await ruleStore.reset(); // Annahme: ruleStore.reset ist oder wird async
        // Explizite Initialisierung des MonthlyBalanceStore
        await monthlyBalanceStore.loadMonthlyBalances();
        useSearchStore().clearSearch(); // Diese sind nicht datenladend, bleiben synchron
        useTransactionFilterStore().clearFilters(); // Diese sind nicht datenladend, bleiben synchron
        // Intelligente Neuberechnung nur bei tatsächlichen Datenänderungen
        await BalanceService.calculateMonthlyBalancesIfNeeded();
        // Logo-Cache-Aktualisierung wird jetzt vom SessionService.preloadLogosForTenant() übernommen
        // Bereinigung verwaister Logos
        const tenantDbInstance = new TenantDbService();
        try {
            const accountStore = useAccountStore(); // Sicherstellen, dass der Store hier verfügbar ist
            const validLogoPaths = new Set();
            accountStore.accounts.forEach(acc => { if (acc.logo_path)
                validLogoPaths.add(acc.logo_path); });
            accountStore.accountGroups.forEach(group => { if (group.logo_path)
                validLogoPaths.add(group.logo_path); });
            const cachedLogoKeys = await tenantDbInstance.getAllCachedLogoKeys();
            if (cachedLogoKeys) { // Prüfen, ob die Methode erfolgreich war (nicht leeres Array bedeutet nicht unbedingt Erfolg)
                for (const cachedKey of cachedLogoKeys) {
                    if (!validLogoPaths.has(cachedKey)) {
                        await tenantDbInstance.removeCachedLogo(cachedKey);
                        infoLog('DataService', `Removed orphaned logo from cache: ${cachedKey}`);
                    }
                }
            }
            else {
                warnLog('DataService', 'Could not retrieve cached logo keys, skipping orphaned logo cleanup.');
            }
        }
        catch (e) {
            errorLog('DataService', 'Error cleaning orphaned logos from cache', e);
        }
        debugLog('DataService', 'reloadTenantData', 'Completed');
    }
    // -------------------------
    // Account-bezogene Methoden wurden entfernt
    // Transaktions-bezogene Methoden
    saveTransactions(transactions) {
        this.adapter.save('transactions', transactions);
    }
    loadTransactions() {
        return this.adapter.load('transactions');
    }
    // Kategorie-bezogene Methoden
    saveCategories(categories) {
        this.adapter.save('categories', categories);
    }
    loadCategories() {
        return this.adapter.load('categories');
    }
    saveCategoryGroups(groups) {
        this.adapter.save('category_groups', groups);
    }
    loadCategoryGroups() {
        return this.adapter.load('category_groups');
    }
    // Tag-bezogene Methoden
    saveTags(tags) {
        this.adapter.save('tags', tags);
    }
    loadTags() {
        return this.adapter.load('tags');
    }
    // Planung-bezogene Methoden
    savePlanningTransactions(plannings) {
        this.adapter.save('planning_transactions', plannings);
    }
    loadPlanningTransactions() {
        return this.adapter.load('planning_transactions');
    }
    // Empfänger-bezogene Methoden
    saveRecipients(recipients) {
        this.adapter.save('recipients', recipients);
    }
    loadRecipients() {
        return this.adapter.load('recipients');
    }
    // Generische Methoden
    saveItem(key, data) {
        this.adapter.save(key, data);
    }
    loadItem(key) {
        return this.adapter.load(key);
    }
    removeItem(key) {
        this.adapter.remove(key);
    }
}
