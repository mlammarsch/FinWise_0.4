import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { WebSocketService } from '@/services/WebSocketService';
import { TenantDbService } from '@/services/TenantDbService';
import { useTenantStore } from '@/stores/tenantStore';
import { BackendStatus } from '@/types';
import { infoLog, errorLog, debugLog } from '@/utils/logger';

/**
 * Composable für die kontinuierliche Überwachung der Synchronisations-Queue.
 * Implementiert einen Auto-Sync-Monitor, der alle 10 Sekunden die Queue prüft.
 */
export function useSyncMonitor() {
  const webSocketStore = useWebSocketStore();
  const tenantStore = useTenantStore();
  const tenantDbService = new TenantDbService();

  let monitorInterval: NodeJS.Timeout | undefined;
  const isMonitorActive = ref(false);

  // Computed property für Online-Status
  const isOnline = computed(() => {
    return webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED &&
           webSocketStore.backendStatus === BackendStatus.ONLINE;
  });

  /**
   * Startet den kontinuierlichen Auto-Sync-Monitor (nur intern verwendet)
   */
  function startMonitorInternal(): void {
    if (monitorInterval) {
      debugLog('useSyncMonitor', 'Monitor bereits aktiv - überspringe Start');
      return;
    }

    infoLog('useSyncMonitor', 'Starte kontinuierlichen Auto-Sync-Monitor');
    isMonitorActive.value = true;

    monitorInterval = setInterval(async () => {
      await checkAndProcessQueue();
    }, 10000); // 10 Sekunden Intervall

    debugLog('useSyncMonitor', 'Auto-Sync-Monitor gestartet', {
      intervalMs: 10000,
      isActive: isMonitorActive.value
    });
  }

  /**
   * Stoppt den kontinuierlichen Auto-Sync-Monitor (nur intern verwendet)
   */
  function stopMonitorInternal(): void {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = undefined;
      isMonitorActive.value = false;
      infoLog('useSyncMonitor', 'Auto-Sync-Monitor gestoppt');
    }
  }

  /**
   * Startet den Monitor manuell (für externe Nutzung)
   */
  function startMonitor(): void {
    if (isOnline.value) {
      startMonitorInternal();
    } else {
      debugLog('useSyncMonitor', 'Monitor-Start übersprungen - nicht online');
    }
  }

  /**
   * Stoppt den Monitor manuell (für externe Nutzung)
   */
  function stopMonitor(): void {
    stopMonitorInternal();
  }

  /**
   * Prüft die Bedingungen und verarbeitet die Sync-Queue falls möglich
   * Hinweis: Online-Status wird bereits durch watch-Funktion geprüft
   */
  async function checkAndProcessQueue(): Promise<void> {
    try {
      // Prüfe ob aktiver Tenant vorhanden ist
      if (!tenantStore.activeTenantId) {
        debugLog('useSyncMonitor', 'Monitor-Check übersprungen - kein aktiver Tenant');
        return;
      }

      // Prüfe auf pending Einträge in der Queue
      const pendingEntries = await tenantDbService.getPendingSyncEntries(tenantStore.activeTenantId);

      if (pendingEntries.length > 0) {
        infoLog('useSyncMonitor', `${pendingEntries.length} pending Einträge gefunden - starte Sync-Verarbeitung`);

        // Rufe WebSocketService.processSyncQueue() auf
        await WebSocketService.processSyncQueue();

        debugLog('useSyncMonitor', 'Sync-Queue-Verarbeitung durch Monitor ausgelöst');
      } else {
        debugLog('useSyncMonitor', 'Keine pending Einträge in der Queue gefunden');
      }

      // Zusätzlich: Setze hängende PROCESSING-Einträge zurück (älter als 30 Sekunden)
      const resetCount = await tenantDbService.resetStuckProcessingEntries();
      if (resetCount > 0) {
        infoLog('useSyncMonitor', `${resetCount} hängende PROCESSING-Einträge zurückgesetzt`);
      }

    } catch (error) {
      errorLog('useSyncMonitor', 'Fehler bei Monitor-Queue-Check', { error });
    }
  }

  /**
   * Führt eine manuelle Queue-Prüfung durch
   */
  async function manualCheck(): Promise<void> {
    infoLog('useSyncMonitor', 'Manuelle Queue-Prüfung ausgelöst');
    await checkAndProcessQueue();
  }

  // Watch für Online-Status - Monitor nur bei Online-Status aktiv
  watch(isOnline, (newIsOnline, oldIsOnline) => {
    debugLog('useSyncMonitor', 'Online-Status geändert', {
      newIsOnline,
      oldIsOnline,
      connectionStatus: webSocketStore.connectionStatus,
      backendStatus: webSocketStore.backendStatus
    });

    if (newIsOnline && !oldIsOnline) {
      // Von offline zu online - Monitor starten
      infoLog('useSyncMonitor', 'WebSocket ist online - starte Monitor');
      startMonitorInternal();
    } else if (!newIsOnline && oldIsOnline) {
      // Von online zu offline - Monitor stoppen
      infoLog('useSyncMonitor', 'WebSocket ist offline - stoppe Monitor');
      stopMonitorInternal();
    }
  }, { immediate: true }); // immediate: true startet den Monitor sofort wenn bereits online

  // Lifecycle-Management
  onMounted(() => {
    debugLog('useSyncMonitor', 'Composable mounted', {
      isOnline: isOnline.value,
      connectionStatus: webSocketStore.connectionStatus,
      backendStatus: webSocketStore.backendStatus
    });
    // Monitor wird durch watch gestartet, nicht hier
  });

  onUnmounted(() => {
    debugLog('useSyncMonitor', 'Composable unmounted - Stoppe Monitor');
    stopMonitorInternal();
  });

  return {
    isMonitorActive,
    startMonitor,
    stopMonitor,
    manualCheck
  };
}
