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
