<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { SyncService } from "../../services/SyncService";
import { infoLog, warnLog } from "../../utils/logger";

const syncService = new SyncService();
const isBackendOnline = ref(navigator.onLine);

// Hinweis: Diese Prüfung ist vorläufig. Eine robustere Lösung (z. B. über WebSocket oder Ping) ist vorgesehen.
const updateOnlineStatus = () => {
  isBackendOnline.value = navigator.onLine;
  infoLog("SyncButton", `Online status updated: ${isBackendOnline.value}`);
};

onMounted(() => {
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  syncService.updateQueueStatus();
});

onUnmounted(() => {
  window.removeEventListener("online", updateOnlineStatus);
  window.removeEventListener("offline", updateOnlineStatus);
});

const isQueueEmpty = syncService.isQueueEmpty;
const isCurrentlySyncing = syncService.isCurrentlySyncing;

const buttonState = computed(() => {
  if (isCurrentlySyncing.value) {
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew",
      animate: true,
      title: "Synchronisation läuft...",
    };
  }

  if (!isBackendOnline.value) {
    if (isQueueEmpty.value) {
      return {
        iconColorClass: "text-error",
        icon: "mdi:autorenew",
        animate: false,
        title: "Backend offline. Sync-Queue ist leer.",
      };
    }
    return {
      iconColorClass: "text-error",
      icon: "mdi:autorenew-off",
      animate: false,
      title: "Backend offline. Ungesyncte Änderungen vorhanden.",
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
    :disabled="isCurrentlySyncing && !isBackendOnline"
  >
    <Icon
      :icon="buttonState.icon"
      :class="buttonState.iconColorClass"
      style="font-size: 21px; width: 21px; height: 21px"
    />
  </button>
</template>

<style lang="postcss" scoped></style>
