// main.ts (aktualisiert)
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import './style.css';
import './daisyui.css';
import { Icon } from '@iconify/vue';
import ApexCharts from 'apexcharts';
import { useSettingsStore } from '@/stores/settingsStore';
import { initializeLogger, debugLog, infoLog } from '@/utils/logger';
import { SessionService } from '@/services/SessionService';
import { PlanningService } from '@/services/PlanningService';
import { WebSocketService } from '@/services/WebSocketService';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { BackendStatus } from './types';
import '@/utils/syncDebugger'; // Import für globale Debug-Funktionen

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);

SessionService.setupGuards(router);

app.component('Icon', Icon);

// Ensure global assignment without TS error
(window as any).ApexCharts = ApexCharts;

const settingsStore = useSettingsStore();
// Settings werden async geladen, um Backend-Sync zu ermöglichen
settingsStore.loadFromStorage().catch(error => {
  console.error('Fehler beim Laden der Settings:', error);
});

initializeLogger();

app.mount('#app');

// Initialisiert die WebSocket-Verbindung und überwacht Änderungen im Tenant und Verbindungsstatus.
router.isReady().then(() => {
  WebSocketService.initialize();
  const session = useSessionStore();
  const webSocketStore = useWebSocketStore();

  debugLog('[main.ts]', 'Initial check for WebSocket connection:', { tenantId: session.currentTenantId });
  if (session.currentTenantId) {
    debugLog('[main.ts]', `Attempting initial WebSocket connect for tenant: ${session.currentTenantId}`);
    WebSocketService.connect();
  } else {
    debugLog('[main.ts]', 'No currentTenantId found at initial connect attempt.');
  }

  watch(
    [() => session.currentTenantId, () => webSocketStore.connectionStatus, () => webSocketStore.backendStatus],
    ([newTenantId, connStatus, backendStatus], [oldTenantId, oldConnStatus, oldBackendStatus]) => {
      debugLog('[main.ts Watcher]', 'State changed:', {
        newTenantId, connStatus, backendStatus,
        oldTenantId, oldConnStatus, oldBackendStatus,
      });
      const tenantJustChanged = newTenantId && newTenantId !== oldTenantId;
      const connectionJustEstablished = connStatus === WebSocketConnectionStatus.CONNECTED && oldConnStatus !== WebSocketConnectionStatus.CONNECTED;
      const backendJustOnline = backendStatus === BackendStatus.ONLINE && oldBackendStatus !== BackendStatus.ONLINE;

      if (tenantJustChanged) {
        infoLog('[main.ts]', `Tenant changed from ${oldTenantId} to ${newTenantId}. Reconnecting WebSocket.`);
        WebSocketService.disconnect();
        WebSocketService.connect();
      } else if (!newTenantId && oldTenantId) {
        infoLog('[main.ts]', 'Tenant deselected. Disconnecting WebSocket.');
        WebSocketService.disconnect();
      }

      // Verbesserte Logik für Initial Data Load
      if (newTenantId && connStatus === WebSocketConnectionStatus.CONNECTED && backendStatus === BackendStatus.ONLINE) {
        debugLog('[main.ts Watcher]', `Conditions met for initial data request for tenant ${newTenantId}. Requesting...`, { newTenantId, connStatus, backendStatus });
        WebSocketService.requestInitialData(newTenantId);
      } else if (newTenantId && (connectionJustEstablished || backendJustOnline)) {
        // Zusätzlicher Trigger: Wenn Verbindung gerade hergestellt wurde oder Backend online kam
        debugLog('[main.ts Watcher]', `Connection/Backend just became available for tenant ${newTenantId}. Requesting initial data...`, {
          connectionJustEstablished, backendJustOnline, connStatus, backendStatus
        });
        WebSocketService.requestInitialData(newTenantId);
      } else {
        debugLog('[main.ts Watcher]', 'Conditions NOT met for initial data request.', { newTenantId, connStatus, backendStatus });
      }
    },
    { immediate: true }
  );
});


let updateTimer: number | null = null;

document.addEventListener('DOMContentLoaded', () => {
  if (updateTimer) {
    clearInterval(updateTimer);
  }

  updateTimer = window.setInterval(() => {
    try {
      PlanningService.refreshForecastsForFuturePeriod();
      PlanningService.updateForecasts();
    } catch (error) {
      console.error("Failed to update forecasts:", error);
    }
  }, 24 * 60 * 60 * 1000);
});

import { watch } from 'vue';
import { useSessionStore } from '@/stores/sessionStore';
