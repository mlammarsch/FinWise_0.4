<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed } from "vue"; // onMounted, onUnmounted entfernt, da nicht mehr direkt für SyncService benötigt
import { WebSocketService } from "../../services/WebSocketService"; // Importiere WebSocketService
import { infoLog, warnLog } from "../../utils/logger";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "../../stores/webSocketStore";

const webSocketStore = useWebSocketStore();

const isOnline = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED
);

// Vereinfachung: isCurrentlySyncing wird an den Verbindungsaufbau gekoppelt
const isCurrentlySyncing = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTING
);

// Vereinfachung: isQueueEmpty wird vorerst als true angenommen, wenn online.
// Dies müsste durch eine echte Abfrage des Queue-Status aus dem WebSocketService ersetzt werden,
// falls diese Information reaktiv verfügbar gemacht wird.
const isQueueEmpty = computed(() => {
  if (!isOnline.value) return true; // Wenn offline, betrachten wir die Queue als irrelevant oder "leer" für die UI
  // Hier könnte später eine echte Prüfung hinzukommen, z.B. über einen Store oder Service-Status
  return true; // Annahme: Wenn online, ist die Queue erstmal leer oder synchronisiert
});

const isDisabled = computed(() => {
  // Button deaktivieren, wenn gerade "synchronisiert" (connecting) wird oder wenn offline
  // und nicht gerade versucht wird zu verbinden.
  return (
    isCurrentlySyncing.value ||
    (!isOnline.value &&
      webSocketStore.connectionStatus !== WebSocketConnectionStatus.CONNECTING)
  );
});

const buttonState = computed(() => {
  if (isCurrentlySyncing.value) {
    // Zustand "CONNECTING" als "Synchronisiere..."
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew", // Sich drehende Pfeile
      animate: true,
      title: "Verbindung wird aufgebaut...", // Angepasster Text
    };
  }

  if (!isOnline.value) {
    return {
      iconColorClass: "text-error",
      icon: "mdi:cloud-off-outline", // Offline-Icon
      animate: false,
      title: "Offline",
    };
  }

  // Online
  if (isQueueEmpty.value) {
    // Annahme: Queue ist leer, wenn online und nicht "connecting"
    return {
      iconColorClass: "text-success",
      icon: "mdi:cloud-check-outline", // Online und synchronisiert Icon
      animate: false,
      title: "Online. Synchronisiert.",
    };
  }
  // Dieser Fall wird durch die Vereinfachung von isQueueEmpty seltener eintreten,
  // es sei denn, isQueueEmpty wird später komplexer.
  return {
    iconColorClass: "text-info",
    icon: "mdi:cloud-upload-outline", // Icon für ausstehende Änderungen
    animate: false,
    title: "Online. Änderungen zum Synchronisieren vorhanden.", // Angepasster Text
  };
});

async function handleSyncButtonClick() {
  infoLog("SyncButton", "Sync button clicked");
  if (isCurrentlySyncing.value || !isOnline.value) {
    warnLog(
      "SyncButton",
      "Sync cannot be triggered. Either already syncing, or offline."
    );
    return;
  }
  try {
    // Rufe die Methode zum Verarbeiten der Sync-Queue im WebSocketService auf
    await WebSocketService.processSyncQueue();
    infoLog("SyncButton", "processSyncQueue called");
  } catch (error) {
    console.error("Fehler beim manuellen Aufruf von processSyncQueue:", error);
    // Hier könnte eine Fehlermeldung im UI angezeigt werden
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
