/**
 * Pfad: src/stores/recipientStore.ts
 * Speichert Empfänger – jetzt tenant-spezifisch mit bidirektionaler Synchronisation.
 * Erweitert um robuste Error-Handling und Rollback-Mechanismen für Task 5.6
 */
import type { Recipient, SyncQueueEntry } from '@/types';
/**
 * Fehler-Kategorisierung für Rollback-Mechanismen
 * Task 5.6: Error-Handling und Rollback-Mechanismen
 */
declare enum ErrorSeverity {
    INFO = "info",// Informational, operation continues
    WARNING = "warning",// Warning, operation continues with limitations
    ERROR = "error",// Error, operation fails but no rollback needed
    CRITICAL = "critical"
}
/**
 * State Snapshot für Rollback-Operationen
 */
interface StateSnapshot {
    id: string;
    timestamp: number;
    recipients: Recipient[];
    syncQueueEntries: SyncQueueEntry[];
    metadata: {
        operationName: string;
        operationId: string;
        affectedRecipientIds: string[];
    };
}
/**
 * Enhanced Error mit Severity und Rollback-Informationen
 */
interface EnhancedError {
    id: string;
    severity: ErrorSeverity;
    message: string;
    details?: any;
    recipientId?: string;
    operationStep?: string;
    requiresRollback: boolean;
    timestamp: number;
}
/**
 * Rollback-Ergebnis Interface
 */
interface RollbackResult {
    success: boolean;
    executedActions: number;
    failedActions: number;
    errors: string[];
    duration: number;
}
export declare const useRecipientStore: import("pinia").StoreDefinition<"recipient", Pick<{
    recipients: import("vue").Ref<{
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[], Recipient[] | {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getRecipientById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    addRecipient: (recipientData: Omit<Recipient, "id" | "updated_at"> | Recipient, fromSync?: boolean) => Promise<Recipient>;
    addMultipleRecipients: (recipientsToAdd: Recipient[], fromSync?: boolean) => Promise<Recipient[]>;
    updateRecipient: (recipientUpdatesData: Recipient, fromSync?: boolean) => Promise<boolean>;
    deleteRecipient: (recipientId: string, fromSync?: boolean) => Promise<void>;
    loadRecipients: () => Promise<void>;
    reset: () => Promise<void>;
    mergeRecipients: (sourceRecipientIds: string[], targetRecipient: Recipient | {
        name: string;
        defaultCategoryId?: string;
        note?: string;
    }) => Promise<{
        success: boolean;
        mergedRecipient: Recipient;
        updatedTransactions: number;
        updatedPlanningTransactions: number;
        updatedRules: number;
        errors: string[];
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        cleanup?: {
            cleanedTransactions: number;
            cleanedPlanningTransactions: number;
            cleanedRules: number;
            orphanedDataRemoved: number;
        };
    }>;
    batchDeleteRecipients: (recipientIds: string[]) => Promise<{
        success: boolean;
        deletedCount: number;
        errors: Array<{
            recipientId: string;
            error: string;
        }>;
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        validationResults?: Map<string, any>;
    }>;
    performPostMergeCleanup: (mergedRecipientId: string, deletedRecipientIds: string[]) => Promise<{
        cleanedTransactions: number;
        cleanedPlanningTransactions: number;
        cleanedRules: number;
        orphanedDataRemoved: number;
    }>;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    createCoordinatedRollback: (operationName: string, affectedRecipientIds: string[], serviceOperations: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<{
        operationId: string;
        execute: () => Promise<void>;
        rollback: () => Promise<RollbackResult>;
    }>;
    registerServiceRollback: (operationId: string, serviceName: string, rollbackAction: () => Promise<void>, priority?: number) => void;
    executeCoordinatedRollback: (operationId: string, serviceRollbacks?: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<RollbackResult>;
    rollbackSyncQueueEntries: (operationId: string, affectedEntityIds: string[]) => Promise<void>;
    createSyncQueueRollback: (operationId: string, syncQueueEntries: any[]) => void;
    createStateSnapshot: (operationName: string, operationId: string, affectedRecipientIds: string[]) => StateSnapshot;
    executeWithRollback: <T>(operation: () => Promise<T>, rollbackActions: Array<() => Promise<void>>, operationName: string) => Promise<T>;
    addEnhancedError: (operationId: string, error: Omit<EnhancedError, "id" | "timestamp">) => EnhancedError;
    cleanupRollbackData: (operationId: string) => void;
}, "recipients">, Pick<{
    recipients: import("vue").Ref<{
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[], Recipient[] | {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getRecipientById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    addRecipient: (recipientData: Omit<Recipient, "id" | "updated_at"> | Recipient, fromSync?: boolean) => Promise<Recipient>;
    addMultipleRecipients: (recipientsToAdd: Recipient[], fromSync?: boolean) => Promise<Recipient[]>;
    updateRecipient: (recipientUpdatesData: Recipient, fromSync?: boolean) => Promise<boolean>;
    deleteRecipient: (recipientId: string, fromSync?: boolean) => Promise<void>;
    loadRecipients: () => Promise<void>;
    reset: () => Promise<void>;
    mergeRecipients: (sourceRecipientIds: string[], targetRecipient: Recipient | {
        name: string;
        defaultCategoryId?: string;
        note?: string;
    }) => Promise<{
        success: boolean;
        mergedRecipient: Recipient;
        updatedTransactions: number;
        updatedPlanningTransactions: number;
        updatedRules: number;
        errors: string[];
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        cleanup?: {
            cleanedTransactions: number;
            cleanedPlanningTransactions: number;
            cleanedRules: number;
            orphanedDataRemoved: number;
        };
    }>;
    batchDeleteRecipients: (recipientIds: string[]) => Promise<{
        success: boolean;
        deletedCount: number;
        errors: Array<{
            recipientId: string;
            error: string;
        }>;
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        validationResults?: Map<string, any>;
    }>;
    performPostMergeCleanup: (mergedRecipientId: string, deletedRecipientIds: string[]) => Promise<{
        cleanedTransactions: number;
        cleanedPlanningTransactions: number;
        cleanedRules: number;
        orphanedDataRemoved: number;
    }>;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    createCoordinatedRollback: (operationName: string, affectedRecipientIds: string[], serviceOperations: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<{
        operationId: string;
        execute: () => Promise<void>;
        rollback: () => Promise<RollbackResult>;
    }>;
    registerServiceRollback: (operationId: string, serviceName: string, rollbackAction: () => Promise<void>, priority?: number) => void;
    executeCoordinatedRollback: (operationId: string, serviceRollbacks?: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<RollbackResult>;
    rollbackSyncQueueEntries: (operationId: string, affectedEntityIds: string[]) => Promise<void>;
    createSyncQueueRollback: (operationId: string, syncQueueEntries: any[]) => void;
    createStateSnapshot: (operationName: string, operationId: string, affectedRecipientIds: string[]) => StateSnapshot;
    executeWithRollback: <T>(operation: () => Promise<T>, rollbackActions: Array<() => Promise<void>>, operationName: string) => Promise<T>;
    addEnhancedError: (operationId: string, error: Omit<EnhancedError, "id" | "timestamp">) => EnhancedError;
    cleanupRollbackData: (operationId: string) => void;
}, "getRecipientById">, Pick<{
    recipients: import("vue").Ref<{
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[], Recipient[] | {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    }[]>;
    getRecipientById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        defaultCategoryId?: string | null | undefined;
        note?: string | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    addRecipient: (recipientData: Omit<Recipient, "id" | "updated_at"> | Recipient, fromSync?: boolean) => Promise<Recipient>;
    addMultipleRecipients: (recipientsToAdd: Recipient[], fromSync?: boolean) => Promise<Recipient[]>;
    updateRecipient: (recipientUpdatesData: Recipient, fromSync?: boolean) => Promise<boolean>;
    deleteRecipient: (recipientId: string, fromSync?: boolean) => Promise<void>;
    loadRecipients: () => Promise<void>;
    reset: () => Promise<void>;
    mergeRecipients: (sourceRecipientIds: string[], targetRecipient: Recipient | {
        name: string;
        defaultCategoryId?: string;
        note?: string;
    }) => Promise<{
        success: boolean;
        mergedRecipient: Recipient;
        updatedTransactions: number;
        updatedPlanningTransactions: number;
        updatedRules: number;
        errors: string[];
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        cleanup?: {
            cleanedTransactions: number;
            cleanedPlanningTransactions: number;
            cleanedRules: number;
            orphanedDataRemoved: number;
        };
    }>;
    batchDeleteRecipients: (recipientIds: string[]) => Promise<{
        success: boolean;
        deletedCount: number;
        errors: Array<{
            recipientId: string;
            error: string;
        }>;
        enhancedErrors?: EnhancedError[];
        rollbackExecuted?: boolean;
        rollbackResult?: RollbackResult;
        validationResults?: Map<string, any>;
    }>;
    performPostMergeCleanup: (mergedRecipientId: string, deletedRecipientIds: string[]) => Promise<{
        cleanedTransactions: number;
        cleanedPlanningTransactions: number;
        cleanedRules: number;
        orphanedDataRemoved: number;
    }>;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    createCoordinatedRollback: (operationName: string, affectedRecipientIds: string[], serviceOperations: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<{
        operationId: string;
        execute: () => Promise<void>;
        rollback: () => Promise<RollbackResult>;
    }>;
    registerServiceRollback: (operationId: string, serviceName: string, rollbackAction: () => Promise<void>, priority?: number) => void;
    executeCoordinatedRollback: (operationId: string, serviceRollbacks?: {
        transactionService?: () => Promise<void>;
        planningService?: () => Promise<void>;
        ruleService?: () => Promise<void>;
    }) => Promise<RollbackResult>;
    rollbackSyncQueueEntries: (operationId: string, affectedEntityIds: string[]) => Promise<void>;
    createSyncQueueRollback: (operationId: string, syncQueueEntries: any[]) => void;
    createStateSnapshot: (operationName: string, operationId: string, affectedRecipientIds: string[]) => StateSnapshot;
    executeWithRollback: <T>(operation: () => Promise<T>, rollbackActions: Array<() => Promise<void>>, operationName: string) => Promise<T>;
    addEnhancedError: (operationId: string, error: Omit<EnhancedError, "id" | "timestamp">) => EnhancedError;
    cleanupRollbackData: (operationId: string) => void;
}, "addRecipient" | "addMultipleRecipients" | "updateRecipient" | "deleteRecipient" | "loadRecipients" | "reset" | "mergeRecipients" | "batchDeleteRecipients" | "performPostMergeCleanup" | "updateRecipientReferences" | "createCoordinatedRollback" | "registerServiceRollback" | "executeCoordinatedRollback" | "rollbackSyncQueueEntries" | "createSyncQueueRollback" | "createStateSnapshot" | "executeWithRollback" | "addEnhancedError" | "cleanupRollbackData">>;
export {};
