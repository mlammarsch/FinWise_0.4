import { Transaction } from '@/types';
export declare const TransactionService: {
    _skipRunningBalanceRecalc: boolean;
    _isBatchMode: boolean;
    _batchModeCache: Map<string, any>;
    startBatchMode(): void;
    endBatchMode(): void;
    isInBatchMode(): boolean;
    getAllTransactions(): Transaction[];
    getTransactionById(id: string): Transaction | null;
    resolvePayeeFromRecipient(recipientId?: string, fallbackPayee?: string): string;
    assignDefaultCategoryIfNeeded(txData: any, isReconciliation?: boolean, isIntentionalCategoryRemoval?: boolean): any;
    addTransaction(txData: Omit<Transaction, "id" | "runningBalance">, applyRules?: boolean): Promise<Transaction>;
    addAccountTransfer(fromAccountId: string, toAccountId: string, amount: number, date: string, valueDate?: string | null, note?: string, planningTransactionId?: string | null, recipientId?: string): Promise<{
        fromTransaction: Transaction;
        toTransaction: Transaction;
    }>;
    updateAccountTransfer(id: string, updates: Partial<Omit<Transaction, "id" | "runningBalance">>): Promise<boolean>;
    addCategoryTransfer(fromCategoryId: string, toCategoryId: string, amount: number, date: string, note?: string, recipientId?: string): Promise<{
        fromTransaction: Transaction;
        toTransaction: Transaction;
    }>;
    addMultipleCategoryTransfers(transfers: Array<{
        fromCategoryId: string;
        toCategoryId: string;
        amount: number;
        date: string;
        note?: string;
        recipientId?: string;
    }>): Promise<Array<{
        fromTransaction: Transaction;
        toTransaction: Transaction;
    }>>;
    updateCategoryTransfer(transactionId: string, gegentransactionId: string, fromCategoryId: string, toCategoryId: string, amount: number, date: string, note?: string | undefined, recipientId?: string): Promise<void>;
    getCategoryTransferOptions(clickedCategoryId: string, isIncome: boolean): {
        label: string;
        value: string;
    }[];
    updateCategoryTransferAmount(transactionId: string, newAmount: number): Promise<void>;
    addReconcileTransaction(accountId: string, amount: number, date: string, note?: string): Promise<void>;
    deleteSingleTransaction(id: string): Promise<boolean>;
    convertTransferToNormalTransaction(transactionId: string): Promise<Transaction | null>;
    updateTransaction(id: string, updates: Partial<Omit<Transaction, "id" | "runningBalance">>): Promise<Transaction | null>;
    deleteTransaction(id: string): Promise<boolean>;
    bulkDeleteTransactions(ids: string[]): Promise<{
        success: boolean;
        deletedCount: number;
    }>;
    bulkAssignAccount(transactionIds: string[], newAccountId: string): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    bulkAssignCategory(transactionIds: string[], newCategoryId: string | null): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    bulkChangeRecipient(transactionIds: string[], newRecipientId: string | null, removeAll?: boolean): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    bulkAssignTags(transactionIds: string[], tagIds: string[] | null, removeAll?: boolean): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    getIncomeExpenseSummary(startDate: string, endDate: string): {
        income: number;
        expense: number;
        balance: number;
    };
    getMonthlyTrend(months?: number): {
        month: string;
        income: number;
        expense: number;
    }[];
    /**
     * Intelligente Verarbeitung von eingehenden Transaktionen für Initial Data Load
     * Nutzt TenantDbService für optimierte Batch-Operationen
     */
    processTransactionsIntelligently(incomingTransactions: any[]): Promise<{
        processed: number;
        skipped: number;
        updated: number;
    }>;
    /**
     * Wendet PRE und DEFAULT Stage Regeln auf eine Liste von Transaktionen an
     * Speziell für CSV-Import optimiert - alle Regeln außer POST werden vor dem Speichern angewendet
     */
    applyPreAndDefaultRulesToTransactions(transactions: any[]): Promise<any[]>;
    /**
     * Wendet POST-Stage Regeln auf gespeicherte Transaktionen an
     * Wird nach dem Speichern und Running Balance Berechnung aufgerufen
     */
    applyPostStageRulesToTransactions(transactionIds: string[]): Promise<void>;
    /**
     * Bulk: ändere das Datum mehrerer Transaktionen (inkl. valueDate).
     */
    bulkChangeDate(transactionIds: string[], newDate: string): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    /**
     * Bulk: mehrere Transaktionen als abgeglichen markieren.
     */
    bulkSetReconciled(transactionIds: string[]): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    /**
     * Bulk: Abgleich-Status entfernen.
     */
    bulkRemoveReconciled(transactionIds: string[]): Promise<{
        success: boolean;
        updatedCount: number;
        errors: string[];
    }>;
    /**
     * Aktualisiert recipientId in allen Transaktionen mit gegebenen Quellen-IDs auf die neue Empfänger-ID.
     */
    updateRecipientReferences(sourceRecipientIds: string[], newRecipientId: string): Promise<void>;
    /**
     * Prüft, ob Empfänger gelöscht werden können. Liefert einfache Metriken für UI.
     */
    validateRecipientDeletion(recipientIds: string[]): Promise<{
        canDelete: boolean;
        blockingTransactions: number;
    }>;
};
