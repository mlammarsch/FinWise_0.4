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
  const session = useSessionStore();
  if (session.currentTenantId) {
    WebSocketService.connect();
  }
  // Listener für Tenant-Änderungen, um WebSocket neu zu verbinden
  watch(() => session.currentTenantId, (newTenantId, oldTenantId) => {
    if (newTenantId && newTenantId !== oldTenantId) {
      infoLog('[main.ts]', `Tenant changed from ${oldTenantId} to ${newTenantId}. Reconnecting WebSocket.`);
      WebSocketService.disconnect(); // Alte Verbindung trennen
      WebSocketService.connect();   // Neue Verbindung aufbauen
    } else if (!newTenantId && oldTenantId) {
      infoLog('[main.ts]', 'Tenant deselected. Disconnecting WebSocket.');
      WebSocketService.disconnect();
    }
  });
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
