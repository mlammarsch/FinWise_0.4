import { WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { BackendStatus, type SyncQueueEntry, type SyncAckMessage, type SyncNackMessage, type DataStatusResponseMessage, type TenantDisconnectAckMessage } from '@/types';
export declare const WebSocketService: {
    connect(): void;
    disconnect(): void;
    stopReconnectionTimers(): void;
    handleReconnection(): void;
    startLongTermReconnection(): void;
    startBackendHealthChecks(): void;
    sendMessage(message: unknown): boolean;
    sendPing(): boolean;
    startPingInterval(): void;
    stopPingInterval(): void;
    requestConnectionStatus(): boolean;
    getConnectionStatus(): WebSocketConnectionStatus;
    getBackendStatus(): BackendStatus;
    requestInitialData(tenantId: string): void;
    processSyncQueue(): Promise<void>;
    /**
     * Teilt ein Array in Chunks der angegebenen Größe auf
     */
    chunkArray<T>(array: T[], chunkSize: number): T[][];
    /**
     * Verarbeitet einen einzelnen Chunk von Sync-Einträgen
     */
    processSyncChunk(entries: SyncQueueEntry[]): Promise<void>;
    /**
     * Wartet auf ACK/NACK für alle Einträge eines Chunks
     */
    waitForChunkAcknowledgment(entries: SyncQueueEntry[]): Promise<boolean>;
    checkAndProcessSyncQueue(): void;
    initializeSyncQueue(): Promise<void>;
    initialize(): void;
    processSyncAck(ackMessage: SyncAckMessage): Promise<void>;
    processSyncNack(nackMessage: SyncNackMessage): Promise<void>;
    getMaxRetriesForReason(reason: string): number;
    calculateRetryDelay(attemptNumber: number): number;
    initializeAutoSync(): Promise<void>;
    setupQueueWatcher(): void;
    startPeriodicSync(intervalMs?: number): Promise<void>;
    setupConnectionWatcher(): void;
    isOnlineAndReady(): boolean;
    requestServerDataStatus(tenantId: string): Promise<void>;
    handleDataStatusResponse(message: DataStatusResponseMessage): Promise<void>;
    getPendingDeleteOperations(tenantId: string): Promise<{
        accounts: string[];
        accountGroups: string[];
        categories: string[];
        categoryGroups: string[];
        recipients: string[];
        tags: string[];
    }>;
    /**
     * Intelligente Verarbeitung von Transaktionen beim Initial Data Load
     * Delegiert an TransactionService für korrekte Architektur-Trennung
     */
    processTransactionsIntelligently(incomingTransactions: any[], transactionStore: any): Promise<{
        processed: number;
        skipped: number;
        updated: number;
    }>;
    /**
     * Sendet ein Tenant-Disconnect-Signal ans Backend, um Datenbankressourcen freizugeben
     */
    sendTenantDisconnect(tenantId: string, reason?: string): boolean;
    /**
     * Verarbeitet Tenant-Disconnect-Acknowledgment-Nachrichten vom Backend
     */
    processTenantDisconnectAck(ackMessage: TenantDisconnectAckMessage): Promise<void>;
};
