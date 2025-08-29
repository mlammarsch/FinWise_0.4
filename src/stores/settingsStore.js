// src/stores/settingsStore.ts
// src/stores/settingsStore.ts
import { defineStore } from 'pinia';
import { LogConfig, LogLevel, LogLevelToString, StringToLogLevel } from '@/utils/logger';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import { useSessionStore } from '@/stores/sessionStore';
import { SettingsApiService } from '@/services/SettingsApiService';
export const useSettingsStore = defineStore('settings', {
    state: () => ({
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
                }
                catch (err) {
                    errorLog('settingsStore', 'Fehler beim Laden der Settings aus LocalStorage', err);
                    this.setDefaults();
                }
            }
            else {
                this.setDefaults();
            }
            // 2. Falls API verfügbar: Einmalig vom Backend laden
            // Stelle sicher, dass der aktuellste sessionStore und currentUser verwendet wird
            const currentSessionStoreForLoad = useSessionStore();
            if (await this.isBackendAvailable() && currentSessionStoreForLoad.currentUser?.id) {
                try {
                    const backendSettings = await SettingsApiService.getUserSettings(currentSessionStoreForLoad.currentUser.id);
                    // Backend-Settings überschreiben lokale Settings
                    this.logLevel = StringToLogLevel[backendSettings.log_level] ?? LogLevel.INFO;
                    this.enabledLogCategories = new Set(backendSettings.log_categories);
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
                }
                catch (error) {
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
            const backendAvailable = await this.isBackendAvailable();
            const currentUser = currentSessionStoreForSave.currentUser;
            debugLog('settingsStore', 'saveToStorage: Backend-Verfügbarkeit und User-Status prüfen', {
                backendAvailable,
                hasCurrentUser: !!currentUser,
                currentUserId: currentUser?.id || 'nicht verfügbar',
                sessionStoreState: {
                    currentUserId: currentSessionStoreForSave.currentUserId,
                    currentTenantId: currentSessionStoreForSave.currentTenantId,
                    hasCurrentUser: !!currentSessionStoreForSave.currentUser
                }
            });
            if (backendAvailable && currentUser?.id) {
                try {
                    const payload = {
                        log_level: LogLevelToString[this.logLevel],
                        log_categories: [...this.enabledLogCategories],
                        history_retention_days: this.historyRetentionDays,
                        updated_at: new Date().toISOString()
                    };
                    debugLog('settingsStore', 'Sende Settings an Backend', { userId: currentUser.id, payload });
                    await SettingsApiService.updateUserSettings(currentUser.id, payload);
                    infoLog('settingsStore', 'Settings erfolgreich an Backend gesendet');
                }
                catch (error) {
                    errorLog('settingsStore', 'Fehler beim Senden an Backend - lokale Settings bleiben gespeichert', error);
                    // Fehler ignorieren - lokal ist gespeichert
                }
            }
            else {
                debugLog('settingsStore', 'Backend-Sync übersprungen', {
                    reason: !backendAvailable ? 'Backend nicht verfügbar' : 'Kein aktueller User'
                });
                // Falls kein User verfügbar ist, versuche die Session und UserStore zu laden
                if (backendAvailable && !currentUser?.id) {
                    debugLog('settingsStore', 'Versuche Session und UserStore aus IndexedDB zu laden');
                    // Erst Session laden
                    await currentSessionStoreForSave.loadSession();
                    // Dann UserStore laden, damit getUserById funktioniert
                    const { useUserStore } = await import('@/stores/userStore');
                    const userStore = useUserStore();
                    await userStore._loadUsersFromDb();
                    // Nach dem Laden beider Stores erneut prüfen
                    const reloadedUser = currentSessionStoreForSave.currentUser;
                    debugLog('settingsStore', 'Nach Session- und UserStore-Reload', {
                        hasUser: !!reloadedUser,
                        userId: reloadedUser?.id || 'nicht verfügbar',
                        currentUserId: currentSessionStoreForSave.currentUserId
                    });
                    if (reloadedUser?.id) {
                        debugLog('settingsStore', 'Session erfolgreich geladen, sende Settings an Backend');
                        try {
                            const payload = {
                                log_level: LogLevelToString[this.logLevel],
                                log_categories: [...this.enabledLogCategories],
                                history_retention_days: this.historyRetentionDays,
                                updated_at: new Date().toISOString()
                            };
                            await SettingsApiService.updateUserSettings(reloadedUser.id, payload);
                            infoLog('settingsStore', 'Settings erfolgreich an Backend gesendet nach Session-Reload');
                        }
                        catch (error) {
                            errorLog('settingsStore', 'Fehler beim Senden an Backend nach Session-Reload', error);
                        }
                    }
                    else {
                        debugLog('settingsStore', 'Auch nach Session- und UserStore-Reload kein User verfügbar');
                    }
                }
            }
        },
        /**
         * Setzt Logger Settings gezielt und speichert sie sofort.
         */
        async setLoggerSettings(level, categories, retentionDays) {
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
        async isBackendAvailable() {
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
                }
                catch (error) {
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
