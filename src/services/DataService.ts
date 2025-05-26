// src/services/DataService.ts
/**
 * Daten- und Storage-Layer.
 * Enthält jetzt auch reloadTenantData für kompletten Tenant-Reset.
 */

import type { // Als Typ-Importe markiert
  Account,
  AccountGroup,
  Transaction,
  Category,
  CategoryGroup, // CategoryGroup hinzugefügt
  Tag,
  PlanningTransaction,
  Recipient,
} from '@/types';
import { debugLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';

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
  save(key: string, data: unknown): void { // data: any zu data: unknown geändert
    const sk = storageKey(key);
    const jsonData = JSON.stringify(data);
    localStorage.setItem(sk, jsonData);
    debugLog('LocalStorageAdapter', 'save', `Saved data for key: ${sk}`, { // debugLog angepasst
      key: sk,
      dataSize: jsonData.length,
    });
  },

  load<T>(key: string): T | null {
    const sk = storageKey(key);
    const json = localStorage.getItem(sk);
    const result = json ? JSON.parse(json) : null;
    debugLog('LocalStorageAdapter', 'load', `Loaded data for key: ${sk}`, { // debugLog angepasst
      key: sk,
      found: !!json,
      itemCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
    });
    return result;
  },

  remove(key: string): void {
    const sk = storageKey(key);
    localStorage.removeItem(sk);
    debugLog('LocalStorageAdapter', 'remove', `Removed data for key: ${sk}`, { key: sk }); // debugLog angepasst
  },
};

/**
 * Datenservice für den Zugriff auf persistierte Daten
 */
export class DataService {
  private adapter = LocalStorageAdapter;

  // ---------- NEU ----------
  /**
   * Lädt **alle** tenant-spezifischen Stores neu.
   * Muss nach Tenant-Wechsel oder initialem Login
   * mit bereits gesetztem currentTenantId aufgerufen werden.
   */
  static async reloadTenantData(): Promise<void> { // async gemacht
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

    useSearchStore().clearSearch(); // Diese sind nicht datenladend, bleiben synchron
    useTransactionFilterStore().clearFilters(); // Diese sind nicht datenladend, bleiben synchron

    // Nach dem Reset alle Monatsbilanzen neu berechnen
    // BalanceService.calculateMonthlyBalances() könnte auch async werden, wenn es auf async Daten wartet.
    // Fürs Erste belassen wir es synchron, aber dies könnte eine zukünftige Anpassung sein.
    BalanceService.calculateMonthlyBalances();

    debugLog('DataService', 'reloadTenantData', 'Completed');
  }
  // -------------------------

  // Account-bezogene Methoden wurden entfernt

  // Transaktions-bezogene Methoden
  saveTransactions(transactions: Transaction[]): void {
    this.adapter.save('transactions', transactions);
  }
  loadTransactions(): Transaction[] | null {
    return this.adapter.load<Transaction[]>('transactions');
  }

  // Kategorie-bezogene Methoden
  saveCategories(categories: Category[]): void {
    this.adapter.save('categories', categories);
  }
  loadCategories(): Category[] | null {
    return this.adapter.load<Category[]>('categories');
  }
  saveCategoryGroups(groups: CategoryGroup[]): void { // any[] zu CategoryGroup[] geändert
    this.adapter.save('category_groups', groups);
  }
  loadCategoryGroups(): CategoryGroup[] | null { // any[] zu CategoryGroup[] geändert
    return this.adapter.load<CategoryGroup[]>('category_groups');
  }

  // Tag-bezogene Methoden
  saveTags(tags: Tag[]): void {
    this.adapter.save('tags', tags);
  }
  loadTags(): Tag[] | null {
    return this.adapter.load<Tag[]>('tags');
  }

  // Planung-bezogene Methoden
  savePlanningTransactions(plannings: PlanningTransaction[]): void {
    this.adapter.save('planning_transactions', plannings);
  }
  loadPlanningTransactions(): PlanningTransaction[] | null {
    return this.adapter.load<PlanningTransaction[]>('planning_transactions');
  }

  // Empfänger-bezogene Methoden
  saveRecipients(recipients: Recipient[]): void {
    this.adapter.save('recipients', recipients);
  }
  loadRecipients(): Recipient[] | null {
    return this.adapter.load<Recipient[]>('recipients');
  }

  // Generische Methoden
  saveItem<T>(key: string, data: T): void {
    this.adapter.save(key, data);
  }
  loadItem<T>(key: string): T | null {
    return this.adapter.load<T>(key);
  }
  removeItem(key: string): void {
    this.adapter.remove(key);
  }
}
