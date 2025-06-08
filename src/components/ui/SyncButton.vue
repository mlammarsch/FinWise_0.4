<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue"; // Importiere ref
import { WebSocketService } from "../../services/WebSocketService";
import { infoLog, warnLog } from "../../utils/logger";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "../../stores/webSocketStore";
import { useTenantStore } from "../../stores/tenantStore"; // Importiere tenantStore

const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore(); // Initialisiere tenantStore
const isManuallyProcessingSync = ref(false); // Neuer Ref für manuelles Sync-Feedback

const isOnline = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED
);

// Zeigt an, ob der WebSocket gerade aktiv versucht, eine Verbindung herzustellen.
const isConnecting = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTING
);

// isQueueEmpty bleibt wie es ist für diese Aufgabe
const isQueueEmpty = computed(() => {
  if (!isOnline.value) return true;
  return true; // Annahme
});

const isDisabled = computed(() => {
  // Deaktivieren, wenn nicht online (CONNECTED).
  // Dies deckt CONNECTING, DISCONNECTED, ERROR ab.
  if (!isOnline.value) {
    return true;
  }
  // Wenn online, deaktiviere nur, wenn gerade manuell synchronisiert wird.
  return isManuallyProcessingSync.value;
});

const buttonState = computed(() => {
  if (isManuallyProcessingSync.value) {
    // Zustand für manuelle Synchronisation
    return {
      iconColorClass: "text-info",
      icon: "mdi:sync", // Rotiert durch animate: true
      animate: true,
      title: "Synchronisiere Daten...",
    };
  }

  if (isConnecting.value) {
    // Zustand, wenn WebSocket verbindet
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew",
      animate: true,
      title: "Verbindung wird aufgebaut...",
    };
  }

  if (!isOnline.value) {
    // Zustand, wenn offline (DISCONNECTED, ERROR)
    return {
      iconColorClass: "text-error",
      icon: "mdi:cloud-off-outline",
      animate: false,
      title: "Offline. Manuelle Synchronisation nicht möglich.",
    };
  }

  // Online, nicht manuell synchronisierend, nicht verbindend
  if (isQueueEmpty.value) {
    return {
      iconColorClass: "text-success",
      icon: "mdi:cloud-check-outline",
      animate: false,
      title: "Online & Synchron. Klicken für manuelle Synchronisation.",
    };
  }

  // Online, Queue nicht leer (aktuell theoretisch, basierend auf isQueueEmpty Logik)
  return {
    iconColorClass: "text-info",
    icon: "mdi:cloud-upload-outline",
    animate: false,
    title: "Online. Lokale Änderungen. Klicken für manuelle Synchronisation.",
  };
});

async function handleSyncButtonClick() {
  infoLog("SyncButton", "Manual sync button clicked by user.");

  // Nur ausführen, wenn online und nicht bereits eine manuelle Synchronisation läuft.
  if (!isOnline.value || isManuallyProcessingSync.value) {
    warnLog(
      "SyncButton",
      "Manual sync trigger ignored. Conditions not met (not online or already processing).",
      {
        isOnline: isOnline.value,
        isManuallyProcessingSync: isManuallyProcessingSync.value,
        connectionStatus: webSocketStore.connectionStatus,
      }
    );
    return;
  }

  isManuallyProcessingSync.value = true;
  infoLog("SyncButton", "Starting manual sync process...");

  try {
    await WebSocketService.processSyncQueue(); // Korrigierter Methodenname
    infoLog("SyncButton", "processSyncQueue successfully called.");

    if (tenantStore.activeTenantId) {
      await WebSocketService.requestInitialData(tenantStore.activeTenantId); // tenantId übergeben
      infoLog(
        "SyncButton",
        "requestInitialData successfully called. Manual sync process complete.",
        { tenantId: tenantStore.activeTenantId }
      );
    } else {
      warnLog(
        "SyncButton",
        "Cannot call requestInitialData: activeTenantId is not available.",
        { activeTenantId: tenantStore.activeTenantId }
      );
    }
  } catch (error) {
    warnLog("SyncButton", "Error during manual sync process.", { error });
    // console.error("Error during manual sync process:", error); // Alternative
  } finally {
    isManuallyProcessingSync.value = false;
    infoLog("SyncButton", "Manual sync process finished (finally block).");
  }
}
</script>

<template>
  <button
    class="btn btn-ghost btn-circle"
    :class="{ 'animate-spin': buttonState.animate }"
    @click="handleSyncButtonClick"
    :title="buttonState.title"
    :disabled="isDisabled"
  >
    <Icon
      :icon="buttonState.icon"
      :class="buttonState.iconColorClass"
      style="font-size: 21px; width: 21px; height: 21px"
    />
  </button>
</template>

<style lang="postcss" scoped></style>
