// src/utils/syncDebugger.ts
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import { useWebSocketStore } from '@/stores/webSocketStore';
import { useTenantStore } from '@/stores/tenantStore';
import { TenantDbService } from '@/services/TenantDbService';
import { WebSocketService } from '@/services/WebSocketService';

export class SyncDebugger {
  private tenantDbService = new TenantDbService();

  async diagnoseSync(): Promise<void> {
    infoLog('[SyncDebugger]', '=== SYNC DIAGNOSIS START ===');

    // 1. WebSocket Status prüfen
    await this.checkWebSocketStatus();

    // 2. Sync Queue Status prüfen
    await this.checkSyncQueueStatus();

    // 3. Backend-Verbindung testen
    await this.testBackendConnection();

    // 4. Tenant-Status prüfen
    await this.checkTenantStatus();

    infoLog('[SyncDebugger]', '=== SYNC DIAGNOSIS END ===');
  }

  private async checkWebSocketStatus(): Promise<void> {
    const webSocketStore = useWebSocketStore();

    infoLog('[SyncDebugger]', 'WebSocket Status:', {
      connectionStatus: webSocketStore.connectionStatus,
      backendStatus: webSocketStore.backendStatus,
      lastError: webSocketStore.lastError,
      lastMessage: webSocketStore.lastMessage?.type,
      syncInProgress: webSocketStore.syncState.syncInProgress,
      isAutoSyncEnabled: webSocketStore.syncState.isAutoSyncEnabled
    });
  }

  private async checkSyncQueueStatus(): Promise<void> {
    const tenantStore = useTenantStore();
    const currentTenantId = tenantStore.activeTenantId;

    if (!currentTenantId) {
      errorLog('[SyncDebugger]', 'No active tenant ID');
      return;
    }

    try {
      const stats = await this.tenantDbService.getQueueStatistics(currentTenantId);
      infoLog('[SyncDebugger]', 'Sync Queue Status:', stats);

      // Detaillierte Queue-Einträge abrufen
      const pendingEntries = await this.tenantDbService.getPendingSyncEntries(currentTenantId);
      const failedEntries = await this.tenantDbService.getFailedSyncEntries(currentTenantId);

      if (pendingEntries.length > 0) {
        infoLog('[SyncDebugger]', 'Pending Sync Entries:', pendingEntries);
      }

      if (failedEntries.length > 0) {
        errorLog('[SyncDebugger]', 'Failed Sync Entries:', failedEntries);
      }
    } catch (error) {
      errorLog('[SyncDebugger]', 'Error checking sync queue status:', error);
    }
  }

  private async testBackendConnection(): Promise<void> {
    try {
      // Test WebSocket connection
      const connectionStatus = WebSocketService.getConnectionStatus();
      const backendStatus = WebSocketService.getBackendStatus();

      infoLog('[SyncDebugger]', 'Backend Connection Test:', {
        connectionStatus,
        backendStatus,
        isOnlineAndReady: WebSocketService.isOnlineAndReady()
      });

      // Test if we can send a message
      const testMessage = { type: 'ping', timestamp: Date.now() };
      const sent = WebSocketService.sendMessage(testMessage);

      infoLog('[SyncDebugger]', 'Test message sent:', { sent, message: testMessage });
    } catch (error) {
      errorLog('[SyncDebugger]', 'Backend connection test failed:', error);
    }
  }

  private async checkTenantStatus(): Promise<void> {
    const tenantStore = useTenantStore();

    infoLog('[SyncDebugger]', 'Tenant Status:', {
      activeTenantId: tenantStore.activeTenantId,
      activeTenant: tenantStore.activeTenant?.tenantName,
      hasActiveDB: !!tenantStore.activeTenantDB,
      dbName: tenantStore.activeTenantDB?.name
    });
  }

  async forceSyncQueue(): Promise<void> {
    infoLog('[SyncDebugger]', 'Forcing sync queue processing...');
    try {
      await WebSocketService.processSyncQueue();
      infoLog('[SyncDebugger]', 'Sync queue processing completed');
    } catch (error) {
      errorLog('[SyncDebugger]', 'Error forcing sync queue:', error);
    }
  }

  async clearFailedEntries(): Promise<void> {
    const tenantStore = useTenantStore();
    const currentTenantId = tenantStore.activeTenantId;

    if (!currentTenantId) {
      errorLog('[SyncDebugger]', 'No active tenant ID for clearing failed entries');
      return;
    }

    try {
      const failedEntries = await this.tenantDbService.getFailedSyncEntries(currentTenantId);
      infoLog('[SyncDebugger]', `Clearing ${failedEntries.length} failed entries...`);

      for (const entry of failedEntries) {
        await this.tenantDbService.removeSyncQueueEntry(entry.id);
      }

      infoLog('[SyncDebugger]', 'Failed entries cleared');
    } catch (error) {
      errorLog('[SyncDebugger]', 'Error clearing failed entries:', error);
    }
  }

  async resetStuckEntries(): Promise<void> {
    const tenantStore = useTenantStore();
    const currentTenantId = tenantStore.activeTenantId;

    if (!currentTenantId) {
      errorLog('[SyncDebugger]', 'No active tenant ID for resetting stuck entries');
      return;
    }

    try {
      const resetCount = await this.tenantDbService.resetStuckProcessingEntries(currentTenantId, 30000);
      infoLog('[SyncDebugger]', `Reset ${resetCount} stuck processing entries`);
    } catch (error) {
      errorLog('[SyncDebugger]', 'Error resetting stuck entries:', error);
    }
  }
}

// Globale Instanz für einfachen Zugriff
export const syncDebugger = new SyncDebugger();

// Globale Debug-Funktionen für die Browser-Konsole
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

// Debug-Funktionen in der Browser-Konsole verfügbar machen
if (typeof window !== 'undefined') {
  window.syncDebug = {
    diagnose: () => syncDebugger.diagnoseSync(),
    forceSync: () => syncDebugger.forceSyncQueue(),
    clearFailed: () => syncDebugger.clearFailedEntries(),
    resetStuck: () => syncDebugger.resetStuckEntries()
  };
}
