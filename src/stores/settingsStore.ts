// src/stores/settingsStore.ts
import { defineStore } from 'pinia';
import { LogConfig, LogLevel } from '@/utils/logger';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import { useSessionStore } from '@/stores/sessionStore';
import { SettingsApiService, type UserSettingsPayload, type UserSettingsResponse } from '@/services/SettingsApiService';

interface UserSettings {
  id?: string;
  user_id?: string;
  log_level: LogLevel;
  enabled_log_categories: string[];
  history_retention_days: number;
  created_at?: string;
  updated_at?: string;
}

interface SettingsState {
  logLevel: LogLevel;
  enabledLogCategories: Set<string>;
  historyRetentionDays: number;
  lastSyncTimestamp?: string;
  isSyncing: boolean;
  syncError?: string;
  // Weitere Settings können hier ergänzt werden
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    logLevel: LogLevel.INFO,
    enabledLogCategories: new Set(['store', 'ui', 'service']),
    historyRetentionDays: 60,
    lastSyncTimestamp: undefined,
    isSyncing: false,
    syncError: undefined,
  }),

  actions: {
    /**
     * Lädt die Settings beim App-Start aus dem LocalStorage und synchronisiert mit Backend.
     * Synchronisiert auch die Logger-Config.
     */
    async loadFromStorage() {
      debugLog('settingsStore', 'Lade Settings aus LocalStorage');

      const saved = localStorage.getItem('finwise_settings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.logLevel = parsed.logLevel ?? LogLevel.INFO;
          this.enabledLogCategories = new Set(parsed.enabledLogCategories ?? ['store', 'ui', 'service']);
          this.historyRetentionDays = parsed.historyRetentionDays ?? 60;
          this.lastSyncTimestamp = parsed.lastSyncTimestamp;

          this.updateLogConfig();
        } catch (err) {
          errorLog('settingsStore', 'Fehler beim Laden der Settings aus LocalStorage', err);
          this.setDefaults();
        }
      } else {
        this.setDefaults();
      }

      // Versuche Synchronisation mit Backend
      await this.syncWithBackend();
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
     * Speichert aktuelle Settings in den LocalStorage und synchronisiert mit Backend.
     */
    async saveToStorage() {
      debugLog('settingsStore', 'Speichere Settings in LocalStorage');

      const settingsData = {
        logLevel: this.logLevel,
        enabledLogCategories: [...this.enabledLogCategories],
        historyRetentionDays: this.historyRetentionDays,
        lastSyncTimestamp: this.lastSyncTimestamp,
      };

      localStorage.setItem('finwise_settings', JSON.stringify(settingsData));
      this.updateLogConfig();

      // Synchronisiere mit Backend
      await this.syncWithBackend();
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
     * Synchronisiert Settings mit dem Backend
     */
    async syncWithBackend() {
      const sessionStore = useSessionStore();
      const currentUser = sessionStore.currentUser;

      if (!currentUser?.id) {
        debugLog('settingsStore', 'Keine Benutzer-Session verfügbar - überspringe Backend-Sync');
        return;
      }

      if (this.isSyncing) {
        debugLog('settingsStore', 'Sync bereits in Bearbeitung - überspringe');
        return;
      }

      this.isSyncing = true;
      this.syncError = undefined;

      try {
        // Prüfe Backend-Verfügbarkeit
        const isBackendAvailable = await SettingsApiService.isBackendAvailable();
        if (!isBackendAvailable) {
          debugLog('settingsStore', 'Backend nicht verfügbar - überspringe Sync');
          return;
        }

        debugLog('settingsStore', `Synchronisiere Settings für User ${currentUser.id}`);

        // Erstelle Sync-Payload
        const syncPayload: UserSettingsPayload = {
          log_level: this.logLevel as unknown as string,
          enabled_log_categories: [...this.enabledLogCategories],
          history_retention_days: this.historyRetentionDays,
          updated_at: new Date().toISOString()
        };

        // API-Call mit Retry-Mechanismus
        const backendSettings = await SettingsApiService.withRetry(
          () => SettingsApiService.syncUserSettings(currentUser.id, syncPayload),
          3, // 3 Versuche
          1000 // 1 Sekunde initial delay
        );

        // Merge mit Backend-Daten (Last-Write-Wins)
        await this.mergeWithBackendSettings(backendSettings);

        this.lastSyncTimestamp = new Date().toISOString();
        infoLog('settingsStore', 'Settings erfolgreich mit Backend synchronisiert');

      } catch (error) {
        errorLog('settingsStore', 'Fehler bei Settings-Synchronisation', error);
        this.syncError = error instanceof Error ? error.message : 'Unbekannter Fehler';
        // Graceful degradation - App funktioniert weiter mit lokalen Settings
      } finally {
        this.isSyncing = false;
      }
    },

    /**
     * Lädt Settings vom Backend
     */
    async loadFromBackend() {
      const sessionStore = useSessionStore();
      const currentUser = sessionStore.currentUser;

      if (!currentUser?.id) {
        debugLog('settingsStore', 'Keine Benutzer-Session verfügbar - überspringe Backend-Load');
        return;
      }

      try {
        // Prüfe Backend-Verfügbarkeit
        const isBackendAvailable = await SettingsApiService.isBackendAvailable();
        if (!isBackendAvailable) {
          debugLog('settingsStore', 'Backend nicht verfügbar - verwende lokale Settings');
          return;
        }

        debugLog('settingsStore', `Lade Settings vom Backend für User ${currentUser.id}`);

        // API-Call mit Retry-Mechanismus
        const backendSettings = await SettingsApiService.withRetry(
          () => SettingsApiService.getUserSettings(currentUser.id),
          2, // 2 Versuche für Load-Operation
          1000
        );

        await this.mergeWithBackendSettings(backendSettings);
        infoLog('settingsStore', 'Settings erfolgreich vom Backend geladen');

      } catch (error) {
        errorLog('settingsStore', 'Fehler beim Laden der Settings vom Backend', error);
        // Graceful fallback - verwende lokale Settings
      }
    },

    /**
     * Merged Backend-Settings mit lokalen Settings (Last-Write-Wins)
     */
    async mergeWithBackendSettings(backendSettings: UserSettingsResponse) {
      debugLog('settingsStore', 'Merge Settings mit Backend-Daten', {
        backendUpdated: backendSettings.updated_at,
        localSync: this.lastSyncTimestamp
      });

      // Last-Write-Wins Logik
      const backendTimestamp = backendSettings.updated_at ? new Date(backendSettings.updated_at) : new Date(0);
      const localTimestamp = this.lastSyncTimestamp ? new Date(this.lastSyncTimestamp) : new Date(0);

      if (backendTimestamp > localTimestamp) {
        // Backend-Settings sind neuer - übernehme sie
        debugLog('settingsStore', 'Backend-Settings sind neuer - übernehme Backend-Daten');

        this.logLevel = backendSettings.log_level as unknown as LogLevel;
        this.enabledLogCategories = new Set(backendSettings.enabled_log_categories);
        this.historyRetentionDays = backendSettings.history_retention_days;
        this.lastSyncTimestamp = backendSettings.updated_at;

        this.updateLogConfig();

        // Speichere in LocalStorage
        const settingsData = {
          logLevel: this.logLevel,
          enabledLogCategories: [...this.enabledLogCategories],
          historyRetentionDays: this.historyRetentionDays,
          lastSyncTimestamp: this.lastSyncTimestamp,
        };
        localStorage.setItem('finwise_settings', JSON.stringify(settingsData));
      } else {
        debugLog('settingsStore', 'Lokale Settings sind neuer oder gleich - behalte lokale Daten');
      }
    },

    /**
     * Setzt Settings auf Standardwerte zurück
     */
    async resetToDefaults() {
      debugLog('settingsStore', 'Setze Settings auf Standardwerte zurück');

      this.setDefaults();
      await this.saveToStorage();

      // Optional: Backend-Reset
      const sessionStore = useSessionStore();
      const currentUser = sessionStore.currentUser;

      if (currentUser?.id) {
        try {
          // Prüfe Backend-Verfügbarkeit
          const isBackendAvailable = await SettingsApiService.isBackendAvailable();
          if (isBackendAvailable) {
            await SettingsApiService.resetUserSettings(currentUser.id);
            infoLog('settingsStore', 'Settings erfolgreich im Backend zurückgesetzt');
          } else {
            debugLog('settingsStore', 'Backend nicht verfügbar - nur lokaler Reset');
          }
        } catch (error) {
          errorLog('settingsStore', 'Fehler beim Zurücksetzen der Settings im Backend', error);
          // Graceful degradation - lokaler Reset funktioniert trotzdem
        }
      }
    },

    /**
     * Initialisiert Settings beim Login
     */
    async initializeForUser() {
      debugLog('settingsStore', 'Initialisiere Settings für angemeldeten Benutzer');

      // Lade zuerst lokale Settings
      await this.loadFromStorage();

      // Dann versuche Backend-Sync
      await this.loadFromBackend();
    },
  }
});
