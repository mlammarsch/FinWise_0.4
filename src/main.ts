// main.ts (aktualisiert)
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { createPinia } from 'pinia';
import './style.css';
import './daisyui.css';
import { seedData } from './mock/seed_kaputt';
import { Icon } from '@iconify/vue';
import ApexCharts from 'apexcharts';
import { useSettingsStore } from '@/stores/settingsStore';
import { initializeLogger } from '@/utils/logger';
import { SessionService } from '@/services/SessionService';
import { PlanningService } from '@/services/PlanningService';
import { WebSocketService } from '@/services/WebSocketService'; // WebSocketService importieren
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore'; // Für Status-Überprüfung
import { BackendStatus } from '@/types'; // Für BackendStatus-Überprüfung

// Pinia erstellen und App konfigurieren
const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);

// Router-Guards aktivieren
SessionService.setupGuards(router);

// Globale Registrierung von Iconify
app.component('Icon', Icon);

// ApexCharts global verfügbar machen
window.ApexCharts = ApexCharts;

// Settings laden (unmittelbar nach Pinia)
const settingsStore = useSettingsStore();
settingsStore.loadFromStorage();

// Logger initialisieren (mit geladenen Settings)
initializeLogger();

app.mount('#app');

// WebSocket-Verbindung initialisieren, nachdem die App gemountet wurde und der SessionStore potenziell den Tenant geladen hat
// Es ist wichtig, dass der TenantId verfügbar ist.
// Eine robustere Lösung könnte dies in einem Vue-Lifecycle-Hook (z.B. onMounted in App.vue)
// oder nach erfolgreichem Login/Tenant-Auswahl tun.
router.isReady().then(() => {
  WebSocketService.initialize(); // WebSocketService initialisieren, um Watcher zu aktivieren
  const session = useSessionStore();
  const webSocketStore = useWebSocketStore(); // WebSocketStore Instanz

  if (session.currentTenantId) {
    WebSocketService.connect(); // Initiale Verbindung, falls Tenant schon da
  }

  // Kombinierter Watcher für Tenant-Änderung und WebSocket-Status
  watch(
    [() => session.currentTenantId, () => webSocketStore.connectionStatus, () => webSocketStore.backendStatus],
    ([newTenantId, connStatus, backendStatus], [oldTenantId, oldConnStatus, oldBackendStatus]) => {
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

      // Initialen Datenabruf anstoßen, wenn Tenant gesetzt und Verbindung bereit
      if (newTenantId && connStatus === WebSocketConnectionStatus.CONNECTED && backendStatus === BackendStatus.ONLINE) {
        // Prüfen, ob sich der Tenant geändert hat oder die Verbindung/Backend gerade erst bereit wurde,
        // um zu entscheiden, ob ein initialer Load nötig ist.
        // Ein einfaches Flag im tenantStore oder accountStore (z.B. initialLoadCompletedForTenant[tenantId])
        // wäre hier noch besser, um mehrfache Anfragen zu vermeiden.
        // Fürs Erste rufen wir es auf, wenn die Bedingungen erfüllt sind.
        infoLog('[main.ts]', `Conditions met for initial data request for tenant ${newTenantId}. Requesting...`);
        WebSocketService.requestInitialData(newTenantId);
      }
    },
    { immediate: true } // immediate: true, um den Zustand beim Start zu prüfen
  );
});


// Setup für regelmäßige Aktualisierung der Prognosen
let updateTimer: number | null = null;

document.addEventListener('DOMContentLoaded', () => {
  if (updateTimer) {
    clearInterval(updateTimer);
  }

  // Die Flag __finwise_direct_update wird nicht mehr benötigt
  updateTimer = window.setInterval(() => {
    try {
      // Verwende den PlanningService für Updates
      PlanningService.refreshForecastsForFuturePeriod();
      PlanningService.updateForecasts();
    } catch (error) {
      console.error("Failed to update forecasts:", error);
    }
  }, 24 * 60 * 60 * 1000); // Alle 24h
});

// Watch-Import hinzufügen
import { watch } from 'vue';
import { useSessionStore } from '@/stores/sessionStore';
import { infoLog } from '@/utils/logger';
