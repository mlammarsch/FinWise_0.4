// src/stores/settingsStore.ts
import { defineStore } from 'pinia';
import { LogConfig, LogLevel } from '@/utils/logger';

interface SettingsState {
  logLevel: LogLevel;
  enabledLogCategories: Set<string>;
  historyRetentionDays: number;
  // Weitere Settings können hier ergänzt werden
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    logLevel: LogLevel.INFO,
    enabledLogCategories: new Set(['store', 'ui', 'service']),
    historyRetentionDays: 60,
  }),

  actions: {
    /**
     * Lädt die Settings beim App-Start aus dem LocalStorage.
     * Synchronisiert auch die Logger-Config.
     */
    loadFromStorage() {
      const saved = localStorage.getItem('finwise_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.logLevel = parsed.logLevel ?? LogLevel.INFO;
          this.enabledLogCategories = new Set(parsed.enabledLogCategories ?? ['store', 'ui', 'service']);
          this.historyRetentionDays = parsed.historyRetentionDays ?? 60;

          // LogConfig direkt aktualisieren
          LogConfig.level = this.logLevel;
          LogConfig.enabledCategories = this.enabledLogCategories;
          LogConfig.historyRetentionDays = this.historyRetentionDays;
        } catch (err) {
          console.error('Fehler beim Laden der Settings aus LocalStorage:', err);
        }
      } else {
        // Falls nichts gespeichert wurde, Defaultwerte auch ins LogConfig übernehmen
        LogConfig.level = this.logLevel;
        LogConfig.enabledCategories = this.enabledLogCategories;
        LogConfig.historyRetentionDays = this.historyRetentionDays;
      }
    },

    /**
     * Speichert aktuelle Settings in den LocalStorage.
     */
    saveToStorage() {
      localStorage.setItem('finwise_settings', JSON.stringify({
        logLevel: this.logLevel,
        enabledLogCategories: [...this.enabledLogCategories],
        historyRetentionDays: this.historyRetentionDays,
      }));

      // LogConfig gleich mit aktualisieren
      LogConfig.level = this.logLevel;
      LogConfig.enabledCategories = this.enabledLogCategories;
      LogConfig.historyRetentionDays = this.historyRetentionDays;
    },

    /**
     * Setzt Logger Settings gezielt und speichert sie sofort.
     */
    setLoggerSettings(level: LogLevel, categories: Set<string>, retentionDays: number) {
      this.logLevel = level;
      this.enabledLogCategories = categories;
      this.historyRetentionDays = retentionDays;
      this.saveToStorage();
    },
  }
});
