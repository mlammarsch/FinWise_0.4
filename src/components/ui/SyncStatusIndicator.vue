<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "@/stores/webSocketStore";
import { BackendStatus } from "@/types";

// SyncStatusIndicator - Zeigt den aktuellen Synchronisierungsstatus an
const webSocketStore = useWebSocketStore();

// Sync-Status-Typen
type SyncStatus = "SYNCED" | "SYNCING" | "OFFLINE" | "ERROR";

// Computed property für den Gesamt-Sync-Status
const overallSyncStatus = computed<SyncStatus>(() => {
  // SYNCING: Wenn syncState auf SYNCING steht
  if (webSocketStore.syncState.syncInProgress) {
    return "SYNCING";
  }

  // OFFLINE: Wenn die WebSocket-Verbindung nicht CONNECTED ist oder das Backend nicht ONLINE ist
  if (
    webSocketStore.connectionStatus !== WebSocketConnectionStatus.CONNECTED ||
    webSocketStore.backendStatus !== BackendStatus.ONLINE
  ) {
    return "OFFLINE";
  }

  // ERROR: Wenn connectionHealthStatus auf UNHEALTHY steht
  if (webSocketStore.connectionHealthStatus === "UNHEALTHY") {
    return "ERROR";
  }

  // SYNCED: In allen anderen Fällen (gilt als Standard-Gesund-Zustand)
  return "SYNCED";
});

// Status-spezifische Konfiguration
const statusConfig = computed(() => {
  switch (overallSyncStatus.value) {
    case "SYNCING":
      return {
        icon: "mdi:sync",
        color: "text-blue-500",
        bgColor: "bg-blue-100",
        label: "Synchronisiert...",
        animate: true,
        tooltip: "Daten werden synchronisiert...",
      };
    case "OFFLINE":
      return {
        icon: "mdi:wifi-off",
        color: "text-gray-500",
        bgColor: "bg-gray-100",
        label: "Offline",
        animate: false,
        tooltip:
          "Sie sind offline. Ihre Änderungen werden gespeichert und synchronisiert, sobald eine Verbindung besteht.",
      };
    case "ERROR":
      return {
        icon: "mdi:alert-circle",
        color: "text-red-500",
        bgColor: "bg-red-100",
        label: "Fehler",
        animate: false,
        tooltip:
          "Verbindungsfehler. Es wird versucht, die Verbindung wiederherzustellen.",
      };
    case "SYNCED":
    default:
      return {
        icon: "mdi:check-circle",
        color: "text-green-500",
        bgColor: "bg-green-100",
        label: "Synchronisiert",
        animate: false,
        tooltip: "Alle Daten sind auf dem neuesten Stand.",
      };
  }
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium tooltip tooltip-bottom cursor-help"
      :class="statusConfig.bgColor"
      :data-tip="statusConfig.tooltip"
    >
      <Icon
        :icon="statusConfig.icon"
        :class="[statusConfig.color, { 'animate-spin': statusConfig.animate }]"
        class="w-4 h-4"
      />
      <span :class="statusConfig.color">{{ statusConfig.label }}</span>
    </div>

    <!-- Progress-Bar für Batch-Verarbeitung -->
    <div
      v-if="
        overallSyncStatus === 'SYNCING' &&
        webSocketStore.batchProgress > 0 &&
        webSocketStore.batchProgress < 100
      "
      class="w-full bg-gray-200 rounded-full h-1.5 mx-3"
    >
      <div
        class="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
        :style="{ width: `${webSocketStore.batchProgress}%` }"
      ></div>
    </div>
  </div>
</template>

<style lang="postcss" scoped></style>
