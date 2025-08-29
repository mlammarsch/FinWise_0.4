import { type Transaction } from 'dexie';
import type { Account, AccountGroup, Category, CategoryGroup, Recipient, Tag, AutomationRule, SyncQueueEntry, QueueStatistics, PlanningTransaction } from '@/types';
import type { MonthlyBalance } from '@/stores/monthlyBalanceStore';
import type { ExtendedTransaction } from '@/stores/transactionStore';
import { SyncStatus } from '@/types';
export declare class TenantDbService {
    private get db();
    addAccount(account: Account): Promise<void>;
    updateAccount(account: Account): Promise<void>;
    deleteAccount(accountId: string): Promise<void>;
    getAccountById(accountId: string): Promise<Account | undefined>;
    getAllAccounts(): Promise<Account[]>;
    addAccountGroup(accountGroup: AccountGroup): Promise<void>;
    updateAccountGroup(accountGroup: AccountGroup): Promise<void>;
    deleteAccountGroup(accountGroupId: string): Promise<void>;
    getAccountGroupById(accountGroupId: string): Promise<AccountGroup | undefined>;
    getAllAccountGroups(): Promise<AccountGroup[]>;
    addCategory(category: Category): Promise<void>;
    updateCategory(category: Category): Promise<void>;
    deleteCategory(categoryId: string): Promise<void>;
    getCategoryById(categoryId: string): Promise<Category | undefined>;
    getAllCategories(): Promise<Category[]>;
    addCategoryGroup(categoryGroup: CategoryGroup): Promise<void>;
    updateCategoryGroup(categoryGroup: CategoryGroup): Promise<void>;
    deleteCategoryGroup(categoryGroupId: string): Promise<void>;
    getCategoryGroupById(categoryGroupId: string): Promise<CategoryGroup | undefined>;
    getAllCategoryGroups(): Promise<CategoryGroup[]>;
    /**
     * Batch-Import für Kategorien - deutlich performanter als einzelne Operationen
     */
    addCategoriesBatch(categories: Category[]): Promise<void>;
    /**
     * Intelligente Bulk-Operation für Kategorien - nur neue/geänderte werden geschrieben
     */
    addCategoriesBatchIntelligent(categories: Category[]): Promise<{
        updated: number;
        skipped: number;
    }>;
    /**
     * Batch-Import für Kategoriegruppen - deutlich performanter als einzelne Operationen
     */
    addCategoryGroupsBatch(categoryGroups: CategoryGroup[]): Promise<void>;
    addSyncQueueEntry(entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId'>): Promise<SyncQueueEntry | null>;
    getPendingSyncEntries(tenantId: string): Promise<SyncQueueEntry[]>;
    updateSyncQueueEntryStatus(entryId: string, newStatus: SyncStatus, error?: string | undefined, transaction?: Transaction): Promise<boolean>;
    removeSyncQueueEntry(entryId: string, transaction?: Transaction): Promise<boolean>;
    getSyncQueueEntry(entryId: string): Promise<SyncQueueEntry | undefined>;
    getFailedSyncEntries(tenantId: string, maxRetries?: number): Promise<SyncQueueEntry[]>;
    getProcessingSyncEntries(tenantId: string): Promise<SyncQueueEntry[]>;
    resetStuckProcessingEntries(tenantId: string, timeoutMs?: number): Promise<number>;
    getQueueStatistics(tenantId: string): Promise<QueueStatistics>;
    getPendingDeleteOperations(tenantId: string): Promise<{
        accounts: string[];
        accountGroups: string[];
        categories: string[];
        categoryGroups: string[];
        recipients: string[];
        tags: string[];
    }>;
    /**
     * Löscht die komplette IndexedDB für den aktuellen Mandanten
     */
    deleteTenantDatabase(): Promise<void>;
    /**
     * Setzt die IndexedDB für den aktuellen Mandanten zurück und initialisiert sie neu
     */
    resetTenantDatabase(): Promise<void>;
    /**
     * Löscht alle SyncQueue-Einträge für den aktuellen Mandanten
     */
    clearSyncQueue(): Promise<void>;
    addTransaction(transaction: ExtendedTransaction, skipIfOlder?: boolean): Promise<boolean>;
    updateTransaction(transaction: ExtendedTransaction): Promise<void>;
    deleteTransaction(transactionId: string): Promise<void>;
    getTransactionById(transactionId: string): Promise<ExtendedTransaction | undefined>;
    getAllTransactions(): Promise<ExtendedTransaction[]>;
    /**
     * Batch-Import für Transaktionen - deutlich performanter als einzelne Operationen
     */
    addTransactionsBatch(transactions: ExtendedTransaction[]): Promise<void>;
    /**
     * Intelligente Bulk-Operation für Transaktionen - nur neue/geänderte werden geschrieben
     * Optimiert für Initial Data Load Performance
     */
    addTransactionsBatchIntelligent(transactions: ExtendedTransaction[]): Promise<{
        updated: number;
        skipped: number;
    }>;
    createRecipient(recipient: Recipient): Promise<Recipient>;
    /**
     * Erstellt mehrere Empfänger in einem Batch-Vorgang (Performance-Optimierung für CSV-Import)
     */
    addRecipientsBatch(recipients: Recipient[]): Promise<Recipient[]>;
    /**
     * Intelligente Bulk-Operation für Empfänger - nur neue/geänderte werden geschrieben
     * Optimiert für Initial Data Load Performance
     */
    addRecipientsBatchIntelligent(recipients: Recipient[]): Promise<{
        updated: number;
        skipped: number;
    }>;
    getRecipients(): Promise<Recipient[]>;
    getRecipientById(id: string): Promise<Recipient | undefined>;
    updateRecipient(id: string, updates: Partial<Recipient>): Promise<boolean>;
    deleteRecipient(id: string): Promise<boolean>;
    createTag(tag: Tag): Promise<Tag>;
    /**
     * Batch-Import für Tags - deutlich performanter als einzelne Operationen
     */
    addTagsBatch(tags: Tag[]): Promise<void>;
    /**
     * Intelligente Bulk-Operation für Tags - nur neue/geänderte werden geschrieben
     */
    addTagsBatchIntelligent(tags: Tag[]): Promise<{
        updated: number;
        skipped: number;
    }>;
    getTags(): Promise<Tag[]>;
    getTagById(id: string): Promise<Tag | undefined>;
    updateTag(id: string, updates: Partial<Tag>): Promise<boolean>;
    deleteTag(id: string): Promise<boolean>;
    toPlainObject(obj: any): any;
    createRule(rule: AutomationRule): Promise<AutomationRule>;
    getRules(): Promise<AutomationRule[]>;
    getRuleById(id: string): Promise<AutomationRule | undefined>;
    updateRule(id: string, updates: Partial<AutomationRule>): Promise<boolean>;
    deleteRule(id: string): Promise<boolean>;
    createPlanningTransaction(planningTransaction: PlanningTransaction): Promise<PlanningTransaction>;
    /**
     * Batch-Import für Planungstransaktionen - deutlich performanter als einzelne Operationen
     */
    addPlanningTransactionsBatch(planningTransactions: PlanningTransaction[]): Promise<void>;
    /**
     * Intelligente Bulk-Operation für Planungstransaktionen - nur neue/geänderte werden geschrieben
     */
    addPlanningTransactionsBatchIntelligent(planningTransactions: PlanningTransaction[]): Promise<{
        updated: number;
        skipped: number;
    }>;
    getPlanningTransactions(): Promise<PlanningTransaction[]>;
    getPlanningTransactionById(id: string): Promise<PlanningTransaction | undefined>;
    updatePlanningTransaction(id: string, updates: Partial<PlanningTransaction>): Promise<boolean>;
    deletePlanningTransaction(id: string): Promise<boolean>;
    /**
     * Batch-Import für MonthlyBalances - deutlich performanter als einzelne Operationen
     */
    saveMonthlyBalancesBatch(monthlyBalances: MonthlyBalance[]): Promise<void>;
    getAllMonthlyBalances(): Promise<MonthlyBalance[]>;
    saveMonthlyBalance(monthlyBalance: MonthlyBalance): Promise<void>;
    getMonthlyBalancesByYear(year: number): Promise<MonthlyBalance[]>;
    getMonthlyBalance(year: number, month: number): Promise<MonthlyBalance | undefined>;
    deleteMonthlyBalance(year: number, month: number): Promise<boolean>;
    getCachedLogo(path: string): Promise<{
        path: string;
        data: string | Blob;
    } | null>;
    cacheLogo(path: string, data: string | Blob): Promise<void>;
    removeCachedLogo(path: string): Promise<void>;
    clearAllLogoCache(): Promise<void>;
    getAllCachedLogoKeys(): Promise<string[]>;
    addToSyncQueue(tableName: string, operation: 'create' | 'update' | 'delete', entity: any): Promise<void>;
    /**
     * Batch-Erstellung von Sync-Queue-Einträgen für bessere Performance bei CSV-Import
     * Wird nach der Running Balance Neuberechnung aufgerufen
     */
    addTransactionsBatchToSyncQueue(transactions: ExtendedTransaction[]): Promise<void>;
    private getEntityTypeFromTableName;
    private getSyncOperationType;
    /**
     * Prüft, ob Transaktionen existieren, die auf eine bestimmte Kategorie verweisen
     */
    hasTransactionsForCategory(categoryId: string): Promise<boolean>;
    /**
     * Prüft, ob Transaktionen existieren, die auf einen bestimmten Empfänger verweisen
     */
    hasTransactionsForRecipient(recipientId: string): Promise<boolean>;
    /**
     * Prüft, ob Transaktionen existieren, die einen bestimmten Tag verwenden
     */
    hasTransactionsForTag(tagId: string): Promise<boolean>;
    /**
     * Löscht alle Kategorien und Kategoriengruppen (nur wenn keine Transaktionen existieren)
     */
    clearAllCategories(): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Löscht alle Empfänger (nur wenn keine Transaktionen existieren)
     */
    clearAllRecipients(): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Löscht alle Tags (nur wenn keine Transaktionen existieren)
     */
    clearAllTags(): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Holt mehrere Transaktionen anhand ihrer IDs (Bulk-Read)
     */
    getTransactionsByIds(ids: string[]): Promise<ExtendedTransaction[]>;
    /**
     * Bulk-Update für Transaktionen (optimiert für Running Balance Updates)
     */
    bulkUpdateTransactions(transactions: ExtendedTransaction[]): Promise<void>;
}
