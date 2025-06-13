# Synchronisationssystem - Implementierungsdetails

## 1. SyncButton.vue Implementierung

### 1.1 Erweiterte Template-Struktur

```vue
<template>
  <div class="sync-button-container">
    <button
      class="btn btn-ghost btn-circle relative"
      :class="{
        'animate-spin': buttonState.animate,
        'btn-disabled': isDisabled
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
        {{ queueStatistics.pendingCount > 99 ? '99+' : queueStatistics.pendingCount }}
      </div>
    </button>

    <!-- Sync Progress Indicator -->
    <div
      v-if="syncAnimationState.isActive"
      class="absolute inset-0 rounded-full border-2 border-warning border-t-transparent animate-spin"
    ></div>
  </div>
</template>
```

### 1.2 Erweiterte Script-Logik

```typescript
<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { WebSocketService } from "../../services/WebSocketService";
import { infoLog, warnLog, debugLog } from "../../utils/logger";
import {
  useWebSocketStore,
  WebSocketConnectionStatus,
} from "../../stores/webSocketStore";
import { useTenantStore } from "../../stores/tenantStore";
import { TenantDbService } from "../../services/TenantDbService";
import type { QueueStatistics } from "../../types";

const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore();
const tenantDbService = new TenantDbService();

// Reactive State
const isManuallyProcessingSync = ref(false);
const syncAnimationTimer = ref(0);
const queueStatistics = ref<QueueStatistics | null>(null);
const queueUpdateInterval = ref<number | null>(null);

// Computed Properties
const isOnline = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED
);

const isConnecting = computed(
  () => webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTING
);

const hasQueueItems = computed(() => {
  return queueStatistics.value &&
    (queueStatistics.value.pendingCount > 0 || queueStatistics.value.processingCount > 0);
});

const syncAnimationState = computed(() => {
  return {
    isActive: isManuallyProcessingSync.value || syncAnimationTimer.value > 0,
    remainingTime: syncAnimationTimer.value
  };
});

const isDisabled = computed(() => {
  if (!isOnline.value) return true;
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
      title: `Online - ${queueStatistics.value?.pendingCount || 0} lokale Änderungen`,
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
    const stats = await tenantDbService.getQueueStatistics(tenantStore.activeTenantId);
    queueStatistics.value = stats;
    debugLog("SyncButton", "Queue statistics updated", stats);
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

async function handleSyncButtonClick() {
  infoLog("SyncButton", "Manual sync button clicked by user.");

  if (!isOnline.value || isManuallyProcessingSync.value) {
    warnLog("SyncButton", "Manual sync trigger ignored. Conditions not met.", {
      isOnline: isOnline.value,
      isManuallyProcessingSync: isManuallyProcessingSync.value,
      connectionStatus: webSocketStore.connectionStatus,
    });
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
        tenantId: tenantStore.activeTenantId
      });
    } else {
      warnLog("SyncButton", "Cannot call requestInitialData: activeTenantId not available.");
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

  // Periodische Updates der Queue-Statistiken
  queueUpdateInterval.value = setInterval(updateQueueStatistics, 2000);

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
      debugLog("SyncButton", "Active tenant changed, queue statistics updated", {
        tenantId: newTenantId
      });
    }
  }
);

watch(
  () => webSocketStore.connectionStatus,
  (newStatus) => {
    debugLog("SyncButton", "Connection status changed", { status: newStatus });
    // Queue-Statistiken bei Verbindungsänderung aktualisieren
    updateQueueStatistics();
  }
);
</script>
```

## 2. WebSocketService Erweiterungen

### 2.1 Automatische Synchronisation

```typescript
// Neue Properties
let autoSyncInterval: number | null = null;
let queueWatcher: (() => void) | null = null;
let isAutoSyncEnabled = true;

// Automatische Sync-Initialisierung
async initializeAutoSync(): Promise<void> {
  infoLog('[WebSocketService]', 'Initializing automatic synchronization...');

  // 1. Queue-Watcher einrichten
  this.setupQueueWatcher();

  // 2. Periodische Synchronisation starten
  this.startPeriodicSync();

  // 3. Verbindungs-Watcher einrichten
  this.setupConnectionWatcher();

  infoLog('[WebSocketService]', 'Automatic synchronization initialized');
}

private setupQueueWatcher(): void {
  const tenantStore = useTenantStore();

  // Überwacht Änderungen in der Sync-Queue
  queueWatcher = watch(
    () => tenantStore.activeTenantId,
    async (tenantId) => {
      if (!tenantId) return;

      // Prüfe auf neue Queue-Einträge alle 5 Sekunden
      const checkInterval = setInterval(async () => {
        if (!this.isOnlineAndReady()) {
          return;
        }

        const pendingEntries = await tenantDbService.getPendingSyncEntries(tenantId);
        if (pendingEntries.length > 0) {
          debugLog('[WebSocketService]', `Found ${pendingEntries.length} pending entries, triggering sync`);
          this.processSyncQueue();
        }
      }, 5000);

      // Cleanup bei Tenant-Wechsel
      return () => clearInterval(checkInterval);
    },
    { immediate: true }
  );
}

private async startPeriodicSync(intervalMs: number = 60000): Promise<void> {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  autoSyncInterval = setInterval(async () => {
    if (!isAutoSyncEnabled || !this.isOnlineAndReady()) {
      return;
    }

    const tenantStore = useTenantStore();
    if (tenantStore.activeTenantId) {
      debugLog('[WebSocketService]', 'Periodic sync check triggered');
      await this.requestServerDataStatus(tenantStore.activeTenantId);
    }
  }, intervalMs);

  infoLog('[WebSocketService]', `Periodic sync started with ${intervalMs}ms interval`);
}

private setupConnectionWatcher(): void {
  const webSocketStore = useWebSocketStore();

  watch(
    [() => webSocketStore.connectionStatus, () => webSocketStore.backendStatus],
    ([newConnStatus, newBackendStatus], [oldConnStatus, oldBackendStatus]) => {
      const wasOffline = oldConnStatus !== WebSocketConnectionStatus.CONNECTED ||
                        oldBackendStatus !== BackendStatus.ONLINE;
      const isNowOnline = newConnStatus === WebSocketConnectionStatus.CONNECTED &&
                         newBackendStatus === BackendStatus.ONLINE;

      if (wasOffline && isNowOnline) {
        infoLog('[WebSocketService]', 'Connection re-established, triggering immediate sync');
        this.processSyncQueue();
      }
    }
  );
}

private isOnlineAndReady(): boolean {
  const webSocketStore = useWebSocketStore();
  return webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED &&
         webSocketStore.backendStatus === BackendStatus.ONLINE;
}

async requestServerDataStatus(tenantId: string): Promise<void> {
  if (!this.isOnlineAndReady()) {
    debugLog('[WebSocketService]', 'Cannot request server data status: not online and ready');
    return;
  }

  try {
    const localChecksums = await tenantDbService.getEntityChecksums(tenantId);
    const webSocketStore = useWebSocketStore();

    const message = {
      type: 'request_data_status',
      tenant_id: tenantId,
      last_sync_time: webSocketStore.syncState.lastAutoSyncTime,
      entity_checksums: localChecksums
    };

    const sent = this.sendMessage(message);
    if (sent) {
      debugLog('[WebSocketService]', 'Server data status requested', { tenantId });
    }
  } catch (error) {
    errorLog('[WebSocketService]', 'Error requesting server data status', { error, tenantId });
  }
}
```

### 2.2 Erweiterte Nachrichtenbehandlung

```typescript
// Erweiterte onmessage-Handler
socket.onmessage = async (event) => {
  try {
    const message = JSON.parse(event.data) as ServerWebSocketMessage;
    debugLog('[WebSocketService]', 'Message received:', message);

    // Bestehende Handler...

    // Neuer Handler für data_status_response
    if (message.type === 'data_status_response') {
      await this.handleDataStatusResponse(message as DataStatusResponseMessage);
    }

  } catch (e) {
    errorLog('[WebSocketService]', 'Error parsing message:', e);
  }
};

private async handleDataStatusResponse(message: DataStatusResponseMessage): Promise<void> {
  const tenantStore = useTenantStore();
  const webSocketStore = useWebSocketStore();

  if (message.tenant_id !== tenantStore.activeTenantId) {
    warnLog('[WebSocketService]', 'Received data status for wrong tenant', {
      received: message.tenant_id,
      expected: tenantStore.activeTenantId
    });
    return;
  }

  try {
    // Vergleiche Server-Checksummen mit lokalen Daten
    const conflictReport = await tenantDbService.compareWithServerChecksums(
      message.entity_checksums
    );

    if (conflictReport.conflicts.length > 0 ||
        conflictReport.serverOnly.length > 0 ||
        conflictReport.localOnly.length > 0) {

      infoLog('[WebSocketService]', 'Data differences detected, resolving conflicts', {
        conflicts: conflictReport.conflicts.length,
        serverOnly: conflictReport.serverOnly.length,
        localOnly: conflictReport.localOnly.length
      });

      await this.resolveDataConflicts(conflictReport);
    } else {
      debugLog('[WebSocketService]', 'No data differences found');
    }

    // Update last sync time
    webSocketStore.syncState.lastAutoSyncTime = Date.now();

  } catch (error) {
    errorLog('[WebSocketService]', 'Error handling data status response', { error, message });
  }
}

private async resolveDataConflicts(conflicts: ConflictReport): Promise<void> {
  const tenantStore = useTenantStore();

  // 1. Server-only Entitäten: Initiale Daten anfordern
  if (conflicts.serverOnly.length > 0) {
    infoLog('[WebSocketService]', 'Requesting missing entities from server', {
      count: conflicts.serverOnly.length
    });

    if (tenantStore.activeTenantId) {
      await this.requestInitialData(tenantStore.activeTenantId);
    }
  }

  // 2. Local-only Entitäten: Zur Sync-Queue hinzufügen (falls nicht bereits vorhanden)
  for (const localEntity of conflicts.localOnly) {
    const existingQueueEntry = await tenantDbService.findQueueEntryByEntity(
      localEntity.entityType,
      localEntity.entityId
    );

    if (!existingQueueEntry) {
      debugLog('[WebSocketService]', 'Adding local-only entity to sync queue', localEntity);
      // Hier würde die entsprechende Store-Methode aufgerufen werden
    }
  }

  // 3. Konflikte: Conflict-Resolution-Strategie anwenden
  for (const conflict of conflicts.conflicts) {
    await this.resolveEntityConflict(conflict);
  }

  // 4. Sync-Queue verarbeiten
  await this.processSyncQueue();
}

private async resolveEntityConflict(conflict: any): Promise<void> {
  // Einfache Strategie: Server gewinnt bei Konflikten
  // In einer erweiterten Version könnte hier eine UI für manuelle Konfliktlösung gezeigt werden

  warnLog('[WebSocketService]', 'Resolving entity conflict (server wins)', conflict);

  // Lokale Änderungen verwerfen und Server-Version anfordern
  const tenantStore = useTenantStore();
  if (tenantStore.activeTenantId) {
    await this.requestInitialData(tenantStore.activeTenantId);
  }
}
```

## 3. TenantDbService Erweiterungen

### 3.1 Queue-Statistiken und -Management

```typescript
async getQueueStatistics(tenantId: string): Promise<QueueStatistics> {
  if (!this.db) {
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }

  try {
    const [pendingEntries, processingEntries, failedEntries] = await Promise.all([
      this.db.syncQueue.where({ tenantId, status: SyncStatus.PENDING }).toArray(),
      this.db.syncQueue.where({ tenantId, status: SyncStatus.PROCESSING }).toArray(),
      this.db.syncQueue.where({ tenantId, status: SyncStatus.FAILED }).toArray()
    ]);

    const oldestPending = pendingEntries.length > 0
      ? Math.min(...pendingEntries.map(e => e.timestamp))
      : null;

    // Sync-Metriken aus den letzten 24 Stunden
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recentMetrics = await this.db.syncMetrics
      ?.where('timestamp')
      .above(last24h)
      .toArray() || [];

    const totalSyncedToday = recentMetrics.filter(m => m.success).length;
    const avgDuration = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      : 0;

    const lastError = failedEntries.length > 0
      ? failedEntries.sort((a, b) => (b.lastAttempt || 0) - (a.lastAttempt || 0))[0].error
      : null;

    return {
      pendingCount: pendingEntries.length,
      processingCount: processingEntries.length,
      failedCount: failedEntries.length,
      lastSyncTime: this.getLastSyncTime(tenantId),
      oldestPendingTime: oldestPending,
      totalSyncedToday,
      averageSyncDuration: avgDuration,
      lastErrorMessage: lastError || null
    };

  } catch (error) {
    errorLog('TenantDbService', 'Error getting queue statistics', { error, tenantId });
    throw error;
  }
}

async batchUpdateQueueStatus(
  entryIds: string[],
  newStatus: SyncStatus,
  error?: string
): Promise<number> {
  if (!this.db) {
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }

  try {
    return await this.db.transaction('rw', this.db.syncQueue, async (tx) => {
      let updatedCount = 0;

      for (const entryId of entryIds) {
        const updateData: Partial<SyncQueueEntry> = { status: newStatus };

        if (newStatus === SyncStatus.PROCESSING) {
          const entry = await tx.table('syncQueue').get(entryId);
          updateData.attempts = (entry?.attempts || 0) + 1;
          updateData.lastAttempt = Date.now();
        }

        if (newStatus === SyncStatus.FAILED && error) {
          updateData.error = error;
        }

        if (newStatus === SyncStatus.SYNCED) {
          updateData.error = undefined;
        }

        const updated = await tx.table('syncQueue').update(entryId, updateData);
        if (updated) updatedCount++;
      }

      return updatedCount;
    });

  } catch (error) {
    errorLog('TenantDbService', 'Error in batch update queue status', { error, entryIds });
    throw error;
  }
}

async cleanupOldEntries(tenantId: string, maxAge: number): Promise<number> {
  if (!this.db) {
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }

  try {
    const cutoffTime = Date.now() - maxAge;

    // Lösche alte SYNCED und FAILED Einträge
    const oldEntries = await this.db.syncQueue
      .where({ tenantId })
      .filter(entry =>
        (entry.status === SyncStatus.SYNCED || entry.status === SyncStatus.FAILED) &&
        entry.timestamp < cutoffTime
      )
      .toArray();

    if (oldEntries.length > 0) {
      const entryIds = oldEntries.map(e => e.id);
      await this.db.syncQueue.bulkDelete(entryIds);

      debugLog('TenantDbService', `Cleaned up ${oldEntries.length} old queue entries`, {
        tenantId,
        maxAge,
        deletedIds: entryIds
      });
    }

    return oldEntries.length;

  } catch (error) {
    errorLog('TenantDbService', 'Error cleaning up old entries', { error, tenantId, maxAge });
    throw error;
  }
}
```

### 3.2 Checksummen und Konfliktvergleiche

```typescript
async calculateEntityChecksum(entityType: EntityTypeEnum, entityId: string): Promise<string | null> {
  if (!this.db) return null;

  try {
    let entity: any = null;

    switch (entityType) {
      case EntityTypeEnum.ACCOUNT:
        entity = await this.db.accounts.get(entityId);
        break;
      case EntityTypeEnum.ACCOUNT_GROUP:
        entity = await this.db.accountGroups.get(entityId);
        break;
      default:
        warnLog('TenantDbService', `Unknown entity type for checksum: ${entityType}`);
        return null;
    }

    if (!entity) return null;

    // Einfache Checksumme basierend auf JSON-String
    const entityString = JSON.stringify(entity, Object.keys(entity).sort());
    return this.simpleHash(entityString);

  } catch (error) {
    errorLog('TenantDbService', 'Error calculating entity checksum', {
      error, entityType, entityId
    });
    return null;
  }
}

async getEntityChecksums(tenantId: string): Promise<Record<string, Record<string, string>>> {
  if (!this.db) {
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }

  try {
    const checksums: Record<string, Record<string, string>> = {};

    // Accounts
    const accounts = await this.db.accounts.toArray();
    checksums[EntityTypeEnum.ACCOUNT] = {};
    for (const account of accounts) {
      const checksum = await this.calculateEntityChecksum(EntityTypeEnum.ACCOUNT, account.id);
      if (checksum) {
        checksums[EntityTypeEnum.ACCOUNT][account.id] = checksum;
      }
    }

    // Account Groups
    const accountGroups = await this.db.accountGroups.toArray();
    checksums[EntityTypeEnum.ACCOUNT_GROUP] = {};
    for (const group of accountGroups) {
      const checksum = await this.calculateEntityChecksum(EntityTypeEnum.ACCOUNT_GROUP, group.id);
      if (checksum) {
        checksums[EntityTypeEnum.ACCOUNT_GROUP][group.id] = checksum;
      }
    }

    return checksums;

  } catch (error) {
    errorLog('TenantDbService', 'Error getting entity checksums', { error, tenantId });
    throw error;
  }
}

async compareWithServerChecksums(
  serverChecksums: Record<string, Record<string, any>>
): Promise<ConflictReport> {
  const tenantStore = useTenantStore();
  if (!tenantStore.activeTenantId) {
    throw new Error('Kein aktiver Mandant verfügbar.');
  }

  try {
    const localChecksums = await this.getEntityChecksums(tenantStore.activeTenantId);

    const conflicts: ConflictReport['conflicts'] = [];
    const localOnly: ConflictReport['localOnly'] = [];
    const serverOnly: ConflictReport['serverOnly'] = [];

    // Vergleiche alle Entity-Typen
    for (const entityType of Object.keys(localChecksums)) {
      const localEntities = localChecksums[entityType] || {};
      const serverEntities = serverChecksums[entityType] || {};

      // Lokale Entitäten prüfen
      for (const [entityId, localChecksum] of Object.entries(localEntities)) {
        const serverData = serverEntities[entityId];

        if (!serverData) {
          localOnly.push({ entityType, entityId });
        } else if (serverData.checksum !== localChecksum) {
          conflicts.push({
            entityType,
            entityId,
            localChecksum,
            serverChecksum: serverData.checksum,
            lastModified: {
              local: await this.getEntityLastModified(entityType, entityId) || 0,
              server: serverData.last_modified || 0
            }
          });
        }
      }

      // Server-only Entitäten finden
      for (const entityId of Object.keys(serverEntities)) {
        if (!localEntities[entityId]) {
          serverOnly.push({ entityType, entityId });
        }
      }
    }

    return { conflicts, localOnly, serverOnly };

  } catch (error) {
    errorLog('TenantDbService', 'Error comparing with server checksums', { error });
    throw error;
  }
}

private simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

private async getEntityLastModified(entityType: string, entityId: string): Promise<number | null> {
  // Implementierung abhängig von der Entity-Struktur
  // Hier würde das updated_at Feld ausgelesen werden
  return Date.now(); // Placeholder
}
```

## 4. Store-Erweiterungen

### 4.1 WebSocketStore Sync-State

```typescript
// Erweiterte Store-Definition
export const useWebSocketStore = defineStore('webSocket', () => {
  // Bestehende Properties...

  // Neue Sync-State Properties
  const syncState = ref<SyncState>({
    isAutoSyncEnabled: true,
    lastAutoSyncTime: null,
    nextAutoSyncTime: null,
    queueStatistics: null,
    syncInProgress: false,
    syncAnimationEndTime: null,
    periodicSyncInterval: 60000
  });

  // Neue Actions
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

  function recordSyncMetrics(duration: number, success: boolean, error?: string) {
    // Hier könnten Metriken für Performance-Monitoring gespeichert werden
    debugLog('[WebSocketStore]', 'Sync metrics recorded', {
      duration,
      success,
      error
    });
  }

  // Computed Properties
  const syncStatus = computed(() => {
    const isOnline = connectionStatus.value === WebSocketConnectionStatus.CONNECTED;
    const hasQueueItems = syncState.value.queueStatistics?.pendingCount > 0 ||
                         syncState.value.
