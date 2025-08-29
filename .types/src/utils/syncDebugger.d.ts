export declare class SyncDebugger {
    private tenantDbService;
    diagnoseSync(): Promise<void>;
    private checkWebSocketStatus;
    private checkSyncQueueStatus;
    private testBackendConnection;
    private checkTenantStatus;
    forceSyncQueue(): Promise<void>;
    clearFailedEntries(): Promise<void>;
    resetStuckEntries(): Promise<void>;
}
export declare const syncDebugger: SyncDebugger;
declare global {
    interface Window {
        syncDebug: {
            diagnose: () => Promise<void>;
            forceSync: () => Promise<void>;
            clearFailed: () => Promise<void>;
            resetStuck: () => Promise<void>;
        };
    }
}
