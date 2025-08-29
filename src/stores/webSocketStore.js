// src/stores/webSocketStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { infoLog, errorLog, debugLog } from '@/utils/logger';
import { BackendStatus } from '@/types';
export var WebSocketConnectionStatus;
(function (WebSocketConnectionStatus) {
    WebSocketConnectionStatus["CONNECTING"] = "connecting";
    WebSocketConnectionStatus["CONNECTED"] = "connected";
    WebSocketConnectionStatus["DISCONNECTED"] = "disconnected";
    WebSocketConnectionStatus["ERROR"] = "error";
})(WebSocketConnectionStatus || (WebSocketConnectionStatus = {}));
export const useWebSocketStore = defineStore('webSocket', () => {
    const connectionStatus = ref(WebSocketConnectionStatus.DISCONNECTED);
    const backendStatus = ref(BackendStatus.OFFLINE);
    const lastError = ref(null);
    const lastMessage = ref(null); // Typisiert mit ServerWebSocketMessage
    // Erweiterte Sync-State Properties
    const syncState = ref({
        isAutoSyncEnabled: true,
        lastAutoSyncTime: null,
        nextAutoSyncTime: null,
        queueStatistics: null,
        syncInProgress: false,
        syncAnimationEndTime: null,
        periodicSyncInterval: 60000
    });
    function setConnectionStatus(newStatus) {
        infoLog('[WebSocketStore]', `Connection status changed to: ${newStatus}`);
        connectionStatus.value = newStatus;
        if (newStatus === WebSocketConnectionStatus.DISCONNECTED || newStatus === WebSocketConnectionStatus.ERROR) {
            // Wenn die Verbindung getrennt wird oder ein Fehler auftritt, ist das Backend nicht mehr zuverlässig erreichbar
            setBackendStatus(BackendStatus.OFFLINE);
        }
    }
    function setBackendStatus(newStatus) {
        infoLog('[WebSocketStore]', `Backend status changed to: ${newStatus}`);
        backendStatus.value = newStatus;
    }
    function setError(errorMessage) {
        if (errorMessage) {
            errorLog('[WebSocketStore]', `Error: ${errorMessage}`);
        }
        lastError.value = errorMessage;
        if (errorMessage) {
            setConnectionStatus(WebSocketConnectionStatus.ERROR);
            // Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt
        }
    }
    function setLastMessage(message) {
        // infoLog('[WebSocketStore]', 'New message received:', message); // Kann sehr gesprächig sein
        lastMessage.value = message;
    }
    function reset() {
        setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
        setBackendStatus(BackendStatus.OFFLINE); // Explizit auch hier setzen
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
    function setSyncInProgress(inProgress, minimumDuration = 3000) {
        syncState.value.syncInProgress = inProgress;
        if (inProgress) {
            syncState.value.syncAnimationEndTime = Date.now() + minimumDuration;
        }
        else {
            syncState.value.syncAnimationEndTime = null;
        }
        infoLog('[WebSocketStore]', `Sync in progress: ${inProgress}`, {
            minimumDuration,
            endTime: syncState.value.syncAnimationEndTime
        });
    }
    function updateQueueStatistics(stats) {
        syncState.value.queueStatistics = stats;
        debugLog('[WebSocketStore]', 'Queue statistics updated', stats);
    }
    function setAutoSyncEnabled(enabled) {
        syncState.value.isAutoSyncEnabled = enabled;
        infoLog('[WebSocketStore]', `Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
    }
    function setPeriodicSyncInterval(intervalMs) {
        syncState.value.periodicSyncInterval = intervalMs;
        infoLog('[WebSocketStore]', `Periodic sync interval set to ${intervalMs}ms`);
    }
    function updateLastAutoSyncTime(timestamp = null) {
        syncState.value.lastAutoSyncTime = timestamp || Date.now();
        debugLog('[WebSocketStore]', 'Last auto sync time updated', {
            timestamp: syncState.value.lastAutoSyncTime
        });
    }
    function recordSyncMetrics(duration, success, error) {
        debugLog('[WebSocketStore]', 'Sync metrics recorded', {
            duration,
            success,
            error
        });
    }
    return {
        connectionStatus,
        backendStatus,
        lastError,
        lastMessage,
        syncState,
        setConnectionStatus,
        setBackendStatus,
        setError,
        setLastMessage,
        reset,
        setSyncInProgress,
        updateQueueStatistics,
        setAutoSyncEnabled,
        setPeriodicSyncInterval,
        updateLastAutoSyncTime,
        recordSyncMetrics,
    };
});
