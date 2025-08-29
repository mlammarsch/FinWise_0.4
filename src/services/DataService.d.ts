/**
 * Daten- und Storage-Layer.
 * Enthält jetzt auch reloadTenantData für kompletten Tenant-Reset.
 */
import type { Transaction, Category, CategoryGroup, // CategoryGroup hinzugefügt
Tag, PlanningTransaction, Recipient } from '@/types';
export declare const LocalStorageAdapter: {
    save(key: string, data: unknown): void;
    load<T>(key: string): T | null;
    remove(key: string): void;
};
/**
 * Datenservice für den Zugriff auf persistierte Daten
 */
export declare class DataService {
    private adapter;
    /**
     * Lädt **alle** tenant-spezifischen Stores neu.
     * Muss nach Tenant-Wechsel oder initialem Login
     * mit bereits gesetztem currentTenantId aufgerufen werden.
     */
    static reloadTenantData(): Promise<void>;
    saveTransactions(transactions: Transaction[]): void;
    loadTransactions(): Transaction[] | null;
    saveCategories(categories: Category[]): void;
    loadCategories(): Category[] | null;
    saveCategoryGroups(groups: CategoryGroup[]): void;
    loadCategoryGroups(): CategoryGroup[] | null;
    saveTags(tags: Tag[]): void;
    loadTags(): Tag[] | null;
    savePlanningTransactions(plannings: PlanningTransaction[]): void;
    loadPlanningTransactions(): PlanningTransaction[] | null;
    saveRecipients(recipients: Recipient[]): void;
    loadRecipients(): Recipient[] | null;
    saveItem<T>(key: string, data: T): void;
    loadItem<T>(key: string): T | null;
    removeItem(key: string): void;
}
