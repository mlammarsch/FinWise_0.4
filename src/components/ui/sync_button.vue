<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, onUnmounted } from "vue"; // ref entfernt, da isBackendOnline direkt vom Service kommt
import { SyncService } from "../../services/SyncService";
import { infoLog, warnLog } from "../../utils/logger";

const syncService = new SyncService(); // Beachte Hinweis zur Singleton-Instanziierung oben

// isBackendOnline wird jetzt direkt vom SyncService bezogen
const isBackendReallyOnline = syncService.isBackendReallyOnline;

onMounted(() => {
  // Die Listener für navigator.onLine werden entfernt, da wir den WebSocket-Status verwenden
  syncService.updateQueueStatus(); // Initialen Queue-Status laden
});

onUnmounted(() => {
  // Keine Listener mehr zu entfernen
  // syncService.cleanup() sollte global beim App-Unmount aufgerufen werden, nicht hier pro Button-Instanz
});

const isQueueEmpty = syncService.isQueueEmpty;
const isCurrentlySyncing = syncService.isCurrentlySyncing;
const webSocketStatus = syncService.webSocketStatus; // Für detailliertere Zustände, falls benötigt

const isDisabled = computed(() => {
  return (
    isCurrentlySyncing.value ||
    (!isBackendReallyOnline.value && webSocketStatus.value !== "connecting")
  );
});

const buttonState = computed(() => {
  if (isCurrentlySyncing.value) {
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew",
      animate: true,
      title: "Synchronisation läuft...",
    };
  }

  // Verwende isBackendReallyOnline vom SyncService
  if (!isBackendReallyOnline.value) {
    const titleDetail =
      webSocketStatus.value === "connecting"
        ? "Verbindung wird aufgebaut..."
        : "Backend offline.";
    if (isQueueEmpty.value) {
      return {
        iconColorClass: "text-error",
        icon: "mdi:autorenew",
        animate: false,
        title: `${titleDetail} Sync-Queue ist leer.`,
      };
    }
    return {
      iconColorClass: "text-error",
      icon: "mdi:autorenew-off",
      animate: false,
      title: `${titleDetail} Ungesyncte Änderungen vorhanden.`,
    };
  }

  if (isQueueEmpty.value) {
    return {
      iconColorClass: "text-success",
      icon: "mdi:autorenew",
      animate: false,
      title: "Bereit zum Synchronisieren.",
    };
  }
  return {
    iconColorClass: "text-success",
    icon: "mdi:autorenew-off",
    animate: false,
    title:
      "Ungesyncte Änderungen vorhanden. Manuelle Synchronisation empfohlen.",
  };
});

// Führt die manuelle Synchronisation aus, falls keine bereits läuft
async function handleSyncButtonClick() {
  infoLog("SyncButton", "Sync button clicked");
  if (isCurrentlySyncing.value) {
    warnLog("SyncButton", "Sync already in progress.");
    return;
  }
  try {
    await syncService.triggerManualSync();
  } catch (error) {
    console.error("Fehler beim manuellen Sync im Button:", error);
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
