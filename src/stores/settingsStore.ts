// src/stores/settingsStore.ts
// src/stores/settingsStore.ts
import { defineStore } from 'pinia';
import { LogConfig, LogLevel, LogLevelToString, StringToLogLevel } from '@/utils/logger';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import { useSessionStore } from '@/stores/sessionStore';
import { SettingsApiService, type UserSettingsPayload, type UserSettingsResponse } from '@/services/SettingsApiService';

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
     * Falls API verfügbar: Lädt einmalig vom Backend und überschreibt lokale Settings.
     */
    async loadFromStorage() {
      debugLog('settingsStore', 'Lade Settings aus LocalStorage');

      // 1. Lokal laden (wie bisher)
      const saved = localStorage.getItem('finwise_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.logLevel = parsed.logLevel ?? LogLevel.INFO;
          this.enabledLogCategories = new Set(parsed.enabledLogCategories ?? ['store', 'ui', 'service']);
          this.historyRetentionDays = parsed.historyRetentionDays ?? 60;

          this.updateLogConfig();
        } catch (err) {
          errorLog('settingsStore', 'Fehler beim Laden der Settings aus LocalStorage', err);
          this.setDefaults();
        }
      } else {
        this.setDefaults();
      }

      // 2. Falls API verfügbar: Einmalig vom Backend laden
      // Stelle sicher, dass der aktuellste sessionStore und currentUser verwendet wird
      const currentSessionStoreForLoad = useSessionStore();
      if (await this.isBackendAvailable() && currentSessionStoreForLoad.currentUser?.id) {
        try {
          const backendSettings: UserSettingsResponse = await SettingsApiService.getUserSettings(currentSessionStoreForLoad.currentUser.id);

          // Backend-Settings überschreiben lokale Settings
          this.logLevel = StringToLogLevel[backendSettings.log_level] ?? LogLevel.INFO;
          this.enabledLogCategories = new Set(backendSettings.enabled_log_categories);
          this.historyRetentionDays = backendSettings.history_retention_days;

          this.updateLogConfig();

          // Aktualisierte Settings lokal speichern
          const settingsData = {
            logLevel: this.logLevel,
            enabledLogCategories: [...this.enabledLogCategories],
            historyRetentionDays: this.historyRetentionDays,
          };
          localStorage.setItem('finwise_settings', JSON.stringify(settingsData));

          infoLog('settingsStore', 'Settings erfolgreich vom Backend geladen und lokal gespeichert');
        } catch (error) {
          debugLog('settingsStore', 'Fallback zu lokalen Settings - Backend nicht verfügbar oder Fehler', error);
          // Fallback zu lokalen Settings - kein Fehler werfen
        }
      }
    },

    /**
     * Setzt Default-Werte und aktualisiert LogConfig
     */
    setDefaults() {
      this.logLevel = LogLevel.INFO;
      this.enabledLogCategories = new Set(['store', 'ui', 'service']);
      this.historyRetentionDays = 60;
      this.updateLogConfig();
    },

    /**
     * Aktualisiert die LogConfig basierend auf aktuellen Settings
     */
    updateLogConfig() {
      LogConfig.level = this.logLevel;
      LogConfig.enabledCategories = this.enabledLogCategories;
      LogConfig.historyRetentionDays = this.historyRetentionDays;
    },

    /**
     * Speichert aktuelle Settings in den LocalStorage.
     * Falls API verfügbar: Sendet direkt an Backend.
     */
    async saveToStorage() {
      debugLog('settingsStore', 'Speichere Settings in LocalStorage');

      // 1. Lokal speichern (wie bisher)
      const settingsData = {
        logLevel: this.logLevel,
        enabledLogCategories: [...this.enabledLogCategories],
        historyRetentionDays: this.historyRetentionDays,
      };

      localStorage.setItem('finwise_settings', JSON.stringify(settingsData));
      this.updateLogConfig();

      // 2. Falls API verfügbar: Direkt senden
      // Stelle sicher, dass der aktuellste sessionStore und currentUser verwendet wird
      const currentSessionStoreForSave = useSessionStore();
      if (await this.isBackendAvailable() && currentSessionStoreForSave.currentUser?.id) {
        try {
          const payload: UserSettingsPayload = {
            log_level: LogLevelToString[this.logLevel],
            enabled_log_categories: [...this.enabledLogCategories],
            history_retention_days: this.historyRetentionDays,
            updated_at: new Date().toISOString()
          };

          await SettingsApiService.updateUserSettings(currentSessionStoreForSave.currentUser.id, payload);
          infoLog('settingsStore', 'Settings erfolgreich an Backend gesendet');
        } catch (error) {
          debugLog('settingsStore', 'Fehler beim Senden an Backend - lokale Settings bleiben gespeichert', error);
          // Fehler ignorieren - lokal ist gespeichert
        }
      }
    },

    /**
     * Setzt Logger Settings gezielt und speichert sie sofort.
     */
    async setLoggerSettings(level: LogLevel, categories: Set<string>, retentionDays: number) {
      debugLog('settingsStore', 'Setze Logger Settings', {
        level,
        categoriesCount: categories.size,
        retentionDays
      });

      this.logLevel = level;
      this.enabledLogCategories = categories;
      this.historyRetentionDays = retentionDays;
      await this.saveToStorage();
    },

    /**
     * Prüft ob das Backend verfügbar ist
     */
    async isBackendAvailable(): Promise<boolean> {
      return await SettingsApiService.isBackendAvailable();
    },

    /**
     * Setzt Settings auf Standardwerte zurück
     */
    async resetToDefaults() {
      debugLog('settingsStore', 'Setze Settings auf Standardwerte zurück');

      this.setDefaults();
      await this.saveToStorage();

      // Falls API verfügbar: Backend-Reset
      // Stelle sicher, dass der aktuellste sessionStore und currentUser verwendet wird
      const currentSessionStoreForReset = useSessionStore();
      if (await this.isBackendAvailable() && currentSessionStoreForReset.currentUser?.id) {
        try {
          await SettingsApiService.resetUserSettings(currentSessionStoreForReset.currentUser.id);
          infoLog('settingsStore', 'Settings erfolgreich im Backend zurückgesetzt');
        } catch (error) {
          debugLog('settingsStore', 'Fehler beim Zurücksetzen der Settings im Backend - lokaler Reset bleibt bestehen', error);
          // Graceful degradation - lokaler Reset funktioniert trotzdem
        }
      }
    },

    /**
     * Initialisiert Settings beim Login
     */
    async initializeForUser() {
      debugLog('settingsStore', 'Initialisiere Settings für angemeldeten Benutzer');
      await this.loadFromStorage();
    },
  }
});
