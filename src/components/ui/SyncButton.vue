<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";
import { WebSocketService } from "../../services/WebSocketService";
import { infoLog, warnLog } from "../../utils/logger";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "../../stores/webSocketStore";
import { useTenantStore } from "../../stores/tenantStore";

const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore();
const isManuallyProcessingSync = ref(false);

const isOnline = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED
);

const isConnecting = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTING
);

const isQueueEmpty = computed(() => {
  if (!isOnline.value) return true;
  return true;
});

const isDisabled = computed(() => {
  if (!isOnline.value) {
    return true;
  }
  if (isManuallyProcessingSync.value) return true;
  return false;
});

const buttonState = computed(() => {
  if (isManuallyProcessingSync.value) {
    return {
      iconColorClass: "text-info",
      icon: "mdi:sync",
      animate: true,
      title: "Synchronisiere Daten...",
    };
  }

  if (isConnecting.value) {
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew",
      animate: true,
      title: "Verbindung wird aufgebaut...",
    };
  }

  if (!isOnline.value) {
    return {
      iconColorClass: "text-error",
      icon: "mdi:cloud-off-outline",
      animate: false,
      title: "Offline. Manuelle Synchronisation nicht möglich.",
    };
  }

  if (isQueueEmpty.value) {
    return {
      iconColorClass: "text-success",
      icon: "mdi:cloud-check-outline",
      animate: false,
      title: "Online & Synchron. Klicken für manuelle Synchronisation.",
    };
  }

  return {
    iconColorClass: "text-info",
    icon: "mdi:cloud-upload-outline",
    animate: false,
    title: "Online. Lokale Änderungen. Klicken für manuelle Synchronisation.",
  };
});

/**
 *  Ermöglicht die manuelle Synchronisation von Daten mit dem Server.
 */
async function handleSyncButtonClick() {
  infoLog("SyncButton", "Manual sync button clicked by user.");

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
    await WebSocketService.processSyncQueue();
    infoLog("SyncButton", "processSyncQueue successfully called.");

    if (tenantStore.activeTenantId) {
      await WebSocketService.requestInitialData(tenantStore.activeTenantId);
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
