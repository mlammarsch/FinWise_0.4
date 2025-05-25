// src/services/DataService.ts
/**
 * Daten- und Storage-Layer.
 * Enthält jetzt auch reloadTenantData für kompletten Tenant-Reset.
 */

import {
  Account,
  AccountGroup,
  Transaction,
  Category,
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
  save(key: string, data: any): void {
    const sk = storageKey(key);
    localStorage.setItem(sk, JSON.stringify(data));
    debugLog('[LocalStorageAdapter] save', {
      key: sk,
      dataSize: JSON.stringify(data).length,
    });
  },

  load<T>(key: string): T | null {
    const sk = storageKey(key);
    const json = localStorage.getItem(sk);
    const result = json ? JSON.parse(json) : null;
    debugLog('[LocalStorageAdapter] load', {
      key: sk,
      found: !!json,
      itemCount: Array.isArray(result) ? result.length : 0,
    });
    return result;
  },

  remove(key: string): void {
    const sk = storageKey(key);
    localStorage.removeItem(sk);
    debugLog('[LocalStorageAdapter] remove', { key: sk });
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
  static reloadTenantData(): void {
    debugLog('[DataService] reloadTenantData – Start');

    useAccountStore().reset();
    useCategoryStore().reset();
    useTransactionStore().reset();
    usePlanningStore().reset();
    useMonthlyBalanceStore().reset();
    useRecipientStore().reset();
    useTagStore().reset();
    useRuleStore().reset();
    useSearchStore().clearSearch();
    useTransactionFilterStore().clearFilters();

    // Nach dem Reset alle Monatsbilanzen neu berechnen
    BalanceService.calculateMonthlyBalances();

    debugLog('[DataService] reloadTenantData – Completed');
  }
  // -------------------------

  // Account-bezogene Methoden
  saveAccounts(accounts: Account[]): void {
    this.adapter.save('accounts', accounts);
  }
  loadAccounts(): Account[] | null {
    return this.adapter.load<Account[]>('accounts');
  }
  saveAccountGroups(groups: AccountGroup[]): void {
    this.adapter.save('account_groups', groups);
  }
  loadAccountGroups(): AccountGroup[] | null {
    return this.adapter.load<AccountGroup[]>('account_groups');
  }

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
  saveCategoryGroups(groups: any[]): void {
    this.adapter.save('category_groups', groups);
  }
  loadCategoryGroups(): any[] | null {
    return this.adapter.load<any[]>('category_groups');
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
