<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { WebSocketService } from "../../services/WebSocketService";
import { infoLog, warnLog, debugLog, errorLog } from "../../utils/logger";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "../../stores/webSocketStore";
import { useTenantStore } from "../../stores/tenantStore";
import { TenantDbService } from "../../services/TenantDbService";
import type { QueueStatistics } from "../../types";
import { ImageService } from "../../services/ImageService";
import { useAccountStore } from "../../stores/accountStore";
import { useAccountGroupStore } from "../../stores/accountGroupStore";

const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore();
const tenantDbService = new TenantDbService();
const accountStore = useAccountStore();
const accountGroupStore = useAccountGroupStore();

// Reactive State
const isManuallyProcessingSync = ref(false);
const syncAnimationTimer = ref(0);
const queueStatistics = ref<QueueStatistics | null>(null);
const queueUpdateInterval = ref<NodeJS.Timeout | null>(null);

const isOnline = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED
);

const isConnecting = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTING
);

const hasQueueItems = computed(() => {
  return (
    queueStatistics.value &&
    (queueStatistics.value.pendingCount > 0 ||
      queueStatistics.value.processingCount > 0)
  );
});

const syncAnimationState = computed(() => {
  return {
    isActive: isManuallyProcessingSync.value || syncAnimationTimer.value > 0,
    remainingTime: syncAnimationTimer.value,
  };
});

const isDisabled = computed(() => {
  if (!isOnline.value) {
    return true;
  }
  if (isManuallyProcessingSync.value) return true;
  return false;
});

const buttonState = computed(() => {
  // Aktive Synchronisation (höchste Priorität)
  if (syncAnimationState.value.isActive) {
    return {
      iconColorClass: "text-warning",
      icon: "mdi:sync",
      animate: true,
      title: "Synchronisiere Daten...",
    };
  }

  // Verbindung wird aufgebaut
  if (isConnecting.value) {
    return {
      iconColorClass: "text-warning",
      icon: "mdi:autorenew",
      animate: true,
      title: "Verbindung wird aufgebaut...",
    };
  }

  // Offline-Zustände
  if (!isOnline.value) {
    if (hasQueueItems.value) {
      return {
        iconColorClass: "text-error",
        icon: "mdi:cloud-alert-outline",
        animate: false,
        title: "Offline - Ungesyncte Änderungen vorhanden",
      };
    } else {
      return {
        iconColorClass: "text-error",
        icon: "mdi:cloud-off-outline",
        animate: false,
        title: "Offline & Synchron",
      };
    }
  }

  // Online-Zustände
  if (hasQueueItems.value) {
    return {
      iconColorClass: "text-info",
      icon: "mdi:cloud-upload-outline",
      animate: false,
      title: `Online - ${
        queueStatistics.value?.pendingCount || 0
      } lokale Änderungen`,
    };
  }

  // Vollständig synchron und online
  return {
    iconColorClass: "text-success",
    icon: "mdi:cloud-check",
    animate: false,
    title: "Online & Synchron",
  };
});

// Methods
async function updateQueueStatistics() {
  if (!tenantStore.activeTenantId) return;

  try {
    const stats = await tenantDbService.getQueueStatistics(
      tenantStore.activeTenantId
    );
    queueStatistics.value = stats;
    // debugLog("SyncButton", "Queue statistics updated", stats);
  } catch (error) {
    warnLog("SyncButton", "Failed to update queue statistics", { error });
  }
}

function startSyncAnimation(minimumDuration: number = 3000) {
  syncAnimationTimer.value = minimumDuration;
  const interval = setInterval(() => {
    syncAnimationTimer.value -= 100;
    if (syncAnimationTimer.value <= 0) {
      clearInterval(interval);
      syncAnimationTimer.value = 0;
    }
  }, 100);
}

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
  startSyncAnimation(3000);
  infoLog("SyncButton", "Starting manual sync process...");

  try {
    await WebSocketService.processSyncQueue();
    infoLog("SyncButton", "processSyncQueue successfully called.");

    if (tenantStore.activeTenantId) {
      await WebSocketService.requestInitialData(tenantStore.activeTenantId);
      infoLog("SyncButton", "requestInitialData successfully called.", {
        tenantId: tenantStore.activeTenantId,
      });
    } else {
      warnLog(
        "SyncButton",
        "Cannot call requestInitialData: activeTenantId not available."
      );
    }

    // Logo-Cache aktualisieren
    if (accountStore.accounts && accountStore.accounts.length > 0) {
      infoLog(
        "SyncButton",
        `Starting logo cache update for ${accountStore.accounts.length} accounts.`
      );
      for (const account of accountStore.accounts) {
        if (account.logoUrl) {
          ImageService.fetchAndCacheLogo(account.logoUrl).catch((err) => {
            errorLog(
              "SyncButton",
              `Failed to fetch/cache logo for account ${account.id}: ${account.logoUrl}`,
              err
            );
          });
        }
      }
    }

    if (
      accountGroupStore.accountGroups &&
      accountGroupStore.accountGroups.length > 0
    ) {
      infoLog(
        "SyncButton",
        `Starting logo cache update for ${accountGroupStore.accountGroups.length} account groups.`
      );
      for (const accountGroup of accountGroupStore.accountGroups) {
        if (accountGroup.logoUrl) {
          ImageService.fetchAndCacheLogo(accountGroup.logoUrl).catch((err) => {
            errorLog(
              "SyncButton",
              `Failed to fetch/cache logo for account group ${accountGroup.id}: ${accountGroup.logoUrl}`,
              err
            );
          });
        }
      }
    }
  } catch (error) {
    warnLog("SyncButton", "Error during manual sync process.", { error });
  } finally {
    // Warten auf Mindest-Animation-Dauer
    const remainingTime = syncAnimationTimer.value;
    if (remainingTime > 0) {
      setTimeout(() => {
        isManuallyProcessingSync.value = false;
        infoLog("SyncButton", "Manual sync process finished after animation.");
      }, remainingTime);
    } else {
      isManuallyProcessingSync.value = false;
      infoLog("SyncButton", "Manual sync process finished immediately.");
    }
  }
}

// Lifecycle
onMounted(async () => {
  // Initiale Queue-Statistiken laden
  await updateQueueStatistics();

  // Periodische Updates der Queue-Statistiken (weniger aggressiv)
  queueUpdateInterval.value = setInterval(updateQueueStatistics, 10000); // 10 Sekunden statt 2

  debugLog("SyncButton", "Component mounted and queue monitoring started");
});

onUnmounted(() => {
  if (queueUpdateInterval.value) {
    clearInterval(queueUpdateInterval.value);
    queueUpdateInterval.value = null;
  }
  debugLog("SyncButton", "Component unmounted and queue monitoring stopped");
});

// Watchers
watch(
  () => tenantStore.activeTenantId,
  async (newTenantId) => {
    if (newTenantId) {
      await updateQueueStatistics();
      debugLog(
        "SyncButton",
        "Active tenant changed, queue statistics updated",
        {
          tenantId: newTenantId,
        }
      );
    }
  }
);

watch(
  () => webSocketStore.connectionStatus,
  (newStatus) => {
    debugLog("SyncButton", "Connection status changed", { status: newStatus });
    // Queue-Statistiken werden bereits periodisch aktualisiert
    // updateQueueStatistics(); // Entfernt, um redundante Aufrufe zu vermeiden
  }
);
</script>

<template>
  <div class="sync-button-container relative">
    <button
      class="btn btn-ghost btn-circle relative"
      :class="{
        'animate-spin': buttonState.animate,
        'btn-disabled': isDisabled,
      }"
      @click="handleSyncButtonClick"
      :title="buttonState.title"
      :disabled="isDisabled"
    >
      <Icon
        :icon="buttonState.icon"
        :class="buttonState.iconColorClass"
        style="font-size: 21px; width: 21px; height: 21px"
      />

      <!-- Queue-Counter Badge -->
      <div
        v-if="queueStatistics && queueStatistics.pendingCount > 0"
        class="absolute -top-1 -right-1 bg-warning text-warning-content rounded-full text-xs min-w-[16px] h-4 flex items-center justify-center px-1"
      >
        {{
          queueStatistics.pendingCount > 99
            ? "99+"
            : queueStatistics.pendingCount
        }}
      </div>
    </button>

    <!-- Sync Progress Indicator -->
    <div
      v-if="syncAnimationState.isActive"
      class="absolute inset-0 rounded-full border-2 border-warning border-t-transparent animate-spin"
    ></div>
  </div>
</template>

<style lang="postcss" scoped></style>
