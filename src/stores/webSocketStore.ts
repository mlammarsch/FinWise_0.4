// src/stores/webSocketStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { infoLog, errorLog, debugLog } from '@/utils/logger';
import { BackendStatus, type ServerWebSocketMessage, type SyncState, type QueueStatistics } from '@/types';

export enum WebSocketConnectionStatus { // Umbenannt zur Klarheit
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export type ConnectionHealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'RECONNECTING';

export const useWebSocketStore = defineStore('webSocket', () => {
  const connectionStatus = ref<WebSocketConnectionStatus>(WebSocketConnectionStatus.DISCONNECTED);
  const backendStatus = ref<BackendStatus>(BackendStatus.OFFLINE);
  const connectionHealthStatus = ref<ConnectionHealthStatus>('RECONNECTING');
  const lastError = ref<string | null>(null);
  const lastMessage = ref<ServerWebSocketMessage | null>(null); // Typisiert mit ServerWebSocketMessage

  // Erweiterte Sync-State Properties
  const syncState = ref<SyncState>({
    isAutoSyncEnabled: true,
    lastAutoSyncTime: null,
    nextAutoSyncTime: null,
    queueStatistics: null,
    syncInProgress: false,
    syncAnimationEndTime: null,
    periodicSyncInterval: 60000
  });

  // Batch-Fortschritts-Verfolgung
  const totalBatches = ref<number>(0);
  const processedBatches = ref<number>(0);

  // Computed property für Batch-Fortschritt in Prozent
  const batchProgress = computed(() => {
    if (totalBatches.value === 0) {
      return 0;
    }
    return (processedBatches.value / totalBatches.value) * 100;
  });

  // Computed property für Reconnection-Status
  const isReconnecting = computed(() => {
    return connectionHealthStatus.value === 'RECONNECTING';
  });

  function resetBatchProgress() {
    totalBatches.value = 0;
    processedBatches.value = 0;
  }

  function setConnectionStatus(newStatus: WebSocketConnectionStatus) {
    infoLog('[WebSocketStore]', `Connection status changed to: ${newStatus}`);
    connectionStatus.value = newStatus;
    if (newStatus === WebSocketConnectionStatus.DISCONNECTED || newStatus === WebSocketConnectionStatus.ERROR) {
      // Wenn die Verbindung getrennt wird oder ein Fehler auftritt, ist das Backend nicht mehr zuverlässig erreichbar
      setBackendStatus(BackendStatus.OFFLINE);
    }
  }

  function setBackendStatus(newStatus: BackendStatus) {
    infoLog('[WebSocketStore]', `Backend status changed to: ${newStatus}`);
    backendStatus.value = newStatus;
  }

  function setError(errorMessage: string | null) {
    if (errorMessage) {
      errorLog('[WebSocketStore]', `Error: ${errorMessage}`);
    }
    lastError.value = errorMessage;
    if (errorMessage) {
      setConnectionStatus(WebSocketConnectionStatus.ERROR);
      // Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt
    }
  }

  function setLastMessage(message: ServerWebSocketMessage) {
    // infoLog('[WebSocketStore]', 'New message received:', message); // Kann sehr gesprächig sein
    lastMessage.value = message;
  }

  function reset() {
    setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
    setBackendStatus(BackendStatus.OFFLINE); // Explizit auch hier setzen
    connectionHealthStatus.value = 'RECONNECTING';
    lastError.value = null;
    lastMessage.value = null;
    // Sync-State zurücksetzen
    syncState.value = {
      isAutoSyncEnabled: true,
      lastAutoSyncTime: null,
      nextAutoSyncTime: null,
      queueStatistics: null,
      syncInProgress: false,
      syncAnimationEndTime: null,
      periodicSyncInterval: 60000
    };
  }

  // Neue Sync-State Actions
  function setSyncInProgress(inProgress: boolean, minimumDuration: number = 3000) {
    syncState.value.syncInProgress = inProgress;
    if (inProgress) {
      syncState.value.syncAnimationEndTime = Date.now() + minimumDuration;
    } else {
      syncState.value.syncAnimationEndTime = null;
    }
    infoLog('[WebSocketStore]', `Sync in progress: ${inProgress}`, {
      minimumDuration,
      endTime: syncState.value.syncAnimationEndTime
    });
  }

  function updateQueueStatistics(stats: QueueStatistics) {
    syncState.value.queueStatistics = stats;
    debugLog('[WebSocketStore]', 'Queue statistics updated', stats);
  }

  function setAutoSyncEnabled(enabled: boolean) {
    syncState.value.isAutoSyncEnabled = enabled;
    infoLog('[WebSocketStore]', `Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  function setPeriodicSyncInterval(intervalMs: number) {
    syncState.value.periodicSyncInterval = intervalMs;
    infoLog('[WebSocketStore]', `Periodic sync interval set to ${intervalMs}ms`);
  }

  function updateLastAutoSyncTime(timestamp: number | null = null) {
    syncState.value.lastAutoSyncTime = timestamp || Date.now();
    debugLog('[WebSocketStore]', 'Last auto sync time updated', {
      timestamp: syncState.value.lastAutoSyncTime
    });
  }

  function recordSyncMetrics(duration: number, success: boolean, error?: string) {
    debugLog('[WebSocketStore]', 'Sync metrics recorded', {
      duration,
      success,
      error
    });
  }

  return {
    connectionStatus,
    backendStatus,
    connectionHealthStatus,
    lastError,
    lastMessage,
    syncState,
    totalBatches,
    processedBatches,
    batchProgress,
    isReconnecting,
    setConnectionStatus,
    setBackendStatus,
    setError,
    setLastMessage,
    reset,
    resetBatchProgress,
    setSyncInProgress,
    updateQueueStatistics,
    setAutoSyncEnabled,
    setPeriodicSyncInterval,
    updateLastAutoSyncTime,
    recordSyncMetrics,
  };
});
